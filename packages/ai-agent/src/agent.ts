//! OpenAI-compatible clinical agent: tool calling → closed ReportTemplate AST.

import {
  defaultLocalBaseUrl,
  envVar,
  modelSupportsVision,
  normalizeBaseUrl,
  type ModelProviderConfig,
  type ProviderMode,
  type VisionMode,
} from './provider.js'
import { MEDPRINT_TOOLS, MedPrintToolExecutor, normalizeLabItems } from './tools.js'

export interface AgentTurnInput {
  prompt: string
  imageDataUrl?: string
  context?: {
    hospitalName?: string
    reportTitle?: string
    includeBarcode?: boolean
    includeSeal?: boolean
    items?: unknown[]
  }
}

export interface AgentTurnResult {
  reply: string
  template: Record<string, unknown> | null
  toolsCalled: string[]
  printBlocked: boolean
  error?: string
  mode: 'tools' | 'structured-json' | 'unconfigured'
  visionAttempted: boolean
  visionUsed: boolean
}

type ChatContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: ChatContent | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

interface ToolCall {
  id?: string
  type?: string
  function?: { name?: string; arguments?: string | Record<string, unknown> }
}

const SYSTEM_PROMPT = `你是 MedPrint 临床排版专家。
只能通过工具生成封闭 ReportTemplate AST（ReportElement 有限枚举：HospitalHeader、PatientBanner、SnakingTable、TegCurveChart、PacsGrid、Signatures、Seal、NotesFooter）。
禁止输出自由画布 x/y、Vue/HTML/CSS、开放物料或自定义组件。
打印几何由 medprint-core 物理毫米引擎计算，你只规划槽位。

规划顺序：
1. 必要时 calculate_clinical_formula
2. create_medical_template（化验单必须用 lis_a5_snaking + items 填入 SnakingTable）
3. apply_layout_constraints（定义元素相对对齐或避让障碍物：例如 Logo 垂直居中对齐标题、列表避开 TEG/超声图表、单页硬预算）
4. optimize_page_compaction
5. verify_compliance；缺签名或条码时禁止 dispatch_silent_print

若用户给出化验单图片：识别医院名、报告标题、单据类型（LIS 生化 / PACS 影像 / TEG / 处方），并把化验项目写入 items（name/abbr/value/unit/ref_range）。识别不到的字段留空，不要编造危急值。`

const JSON_FALLBACK_PROMPT = `当前运行时没有可用的 function calling。请只输出一个 JSON 对象，不要 Markdown 围栏，不要坐标。
{
  "action": "create_medical_template" | "verify_compliance" | "dispatch_silent_print" | "calculate_clinical_formula",
  "template_type": "lis_a5_snaking" | "pacs_imaging" | "teg_thromboelastogram" | "prescription",
  "hospital_name": "医院全称",
  "report_title": "报告标题",
  "include_barcode": true,
  "include_seal": true,
  "items": [{ "name": "项目", "abbr": "ALT", "value": "65", "unit": "U/L", "ref_range": "9-50" }],
  "formula": "egfr_ckd_epi" | "ldl_c_friedewald" | "bmi" | "anion_gap",
  "params": {}
}`

function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms)
  }
  const c = new AbortController()
  setTimeout(() => c.abort(), ms)
  return c.signal
}

function parseArgs(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>
  return {}
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced ? fenced[1] : trimmed).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

function looksLikeMissingTools(status: number, body: string): boolean {
  const t = body.toLowerCase()
  return (
    status === 400 ||
    status === 404 ||
    t.includes('tool') && (t.includes('not support') || t.includes('unknown') || t.includes('does not support')) ||
    t.includes('function calling') ||
    t.includes('no such tool')
  )
}

function patchTemplateRowHeight(template: Record<string, unknown> | null, rowHeightMm: number) {
  if (!template || !Array.isArray(template.elements)) return
  for (const el of template.elements as Array<Record<string, unknown>>) {
    if (el.kind === 'SnakingTable') el.row_height_mm = rowHeightMm
  }
}

export class MedPrintAgentRunner {
  private apiKey: string
  private baseURL: string
  private model: string
  private mode: ProviderMode
  private vision: VisionMode

  constructor(config: ModelProviderConfig = {}) {
    this.mode = config.mode || 'external'
    this.apiKey =
      config.apiKey ||
      envVar('DEEPSEEK_API_KEY') ||
      envVar('OPENAI_API_KEY') ||
      ''
    this.baseURL = normalizeBaseUrl(
      config.baseURL ||
        envVar('DEEPSEEK_BASE_URL') ||
        envVar('OPENAI_BASE_URL') ||
        (this.mode === 'local' ? defaultLocalBaseUrl() : 'https://api.deepseek.com/v1'),
    )
    this.model = config.model || envVar('MEDPRINT_MODEL') || (this.mode === 'local' ? 'qwen2.5' : 'deepseek-chat')
    this.vision = config.vision || 'auto'
  }

  async runTask(userPrompt: string): Promise<string> {
    const result = await this.runTurn({ prompt: userPrompt })
    return result.error ? `${result.reply}\n${result.error}` : result.reply
  }

  async runTurn(input: AgentTurnInput): Promise<AgentTurnResult> {
    const prompt = (input.prompt || '').trim()
    const visionOk = modelSupportsVision(this.model, this.vision)
    const visionAttempted = Boolean(input.imageDataUrl)
    const canUseVision = visionAttempted && visionOk
    let visionNote = ''

    if (!this.model.trim() || !this.baseURL.trim()) {
      return {
        reply: '未配置模型名称或接口地址。',
        template: null,
        toolsCalled: [],
        printBlocked: false,
        error: 'unconfigured',
        mode: 'unconfigured',
        visionAttempted,
        visionUsed: false,
      }
    }

    if (visionAttempted && !visionOk) {
      visionNote =
        '当前模型未开启视觉能力，已忽略图片。请改选 llava / gpt-4o / qwen-vl 等，或在设置中打开「支持识图」。'
      if (!prompt) {
        return {
          reply: `${visionNote}也可以改用文字描述临床意图。`,
          template: null,
          toolsCalled: [],
          printBlocked: false,
          error: 'vision-unsupported',
          mode: 'tools',
          visionAttempted: true,
          visionUsed: false,
        }
      }
    }

    const userContent = this.buildUserContent(prompt, canUseVision ? input.imageDataUrl : undefined)
    const tools = MEDPRINT_TOOLS.map((t) => ({ type: 'function' as const, function: t }))
    const withNote = (result: AgentTurnResult): AgentTurnResult => ({
      ...result,
      reply: visionNote ? `${visionNote}\n${result.reply}` : result.reply,
      visionAttempted,
      visionUsed: canUseVision && result.mode !== 'unconfigured',
    })

    try {
      const toolResult = await this.runToolLoop(userContent, tools, input)
      if (toolResult) return withNote(toolResult)
    } catch (err: any) {
      const message = String(err?.message || err)
      if (!looksLikeMissingTools(err?.status || 0, message)) {
        return withNote({
          reply: this.networkHint(message),
          template: null,
          toolsCalled: [],
          printBlocked: false,
          error: message,
          mode: 'tools',
          visionAttempted,
          visionUsed: canUseVision,
        })
      }
    }

    try {
      const jsonResult = await this.runStructuredFallback(userContent, input)
      return withNote(jsonResult)
    } catch (err: any) {
      const message = String(err?.message || err)
      return withNote({
        reply: this.networkHint(message),
        template: null,
        toolsCalled: [],
        printBlocked: false,
        error: message,
        mode: 'structured-json',
        visionAttempted,
        visionUsed: canUseVision,
      })
    }
  }

  private buildUserContent(prompt: string, imageDataUrl?: string): ChatContent {
    const text =
      prompt ||
      (imageDataUrl
        ? '请根据这张临床单据图片识别结构，生成封闭 ReportTemplate AST。化验单优先 lis_a5_snaking，把项目写入 SnakingTable items。'
        : '请根据当前临床意图生成封闭 ReportTemplate AST。')
    if (!imageDataUrl) return text
    return [
      { type: 'text', text },
      { type: 'image_url', image_url: { url: imageDataUrl } },
    ]
  }

  private networkHint(message: string): string {
    const cors =
      /failed to fetch|fetch failed|networkerror|cors|load failed|econnrefused|timeout/i.test(message)
        ? ' 若是本机 Ollama，请确认已启动，或把 Base URL 设为 /ollama/v1（设计器开发代理）。'
        : ''
    return `无法调用模型：${message}${cors}`
  }

  private async runToolLoop(
    userContent: ChatContent,
    tools: Array<{ type: 'function'; function: (typeof MEDPRINT_TOOLS)[number] }>,
    input: AgentTurnInput,
  ): Promise<AgentTurnResult | null> {
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ]
    let template: Record<string, unknown> | null = null
    const toolsCalled: string[] = []
    let printBlocked = false
    const notes: string[] = []
    let sawToolSupport = false

    for (let round = 0; round < 6; round++) {
      const data = await this.chat(messages, { tools, toolChoice: 'auto' })
      const choice = data.choices?.[0]
      const message = choice?.message
      if (!message) {
        throw Object.assign(new Error(data.error?.message || '模型返回为空'), { status: data.status })
      }

      const toolCalls: ToolCall[] = message.tool_calls || []
      if (toolCalls.length === 0) {
        const text = typeof message.content === 'string' ? message.content : ''
        if (!sawToolSupport) {
          const parsed = extractJsonObject(text)
          if (parsed) return this.executeStructuredIntent(parsed, input)
          return null
        }
        notes.push(text)
        break
      }

      sawToolSupport = true
      messages.push({
        role: 'assistant',
        content: message.content || '',
        tool_calls: toolCalls,
      })

      for (const call of toolCalls) {
        const fnName = call.function?.name || ''
        const args = this.withContextDefaults(fnName, parseArgs(call.function?.arguments), input)
        toolsCalled.push(fnName)
        const result = await MedPrintToolExecutor.executeTool(fnName, args)
        if (result?.template) template = result.template
        if (typeof result?.compacted_row_height_mm === 'number') {
          patchTemplateRowHeight(template, result.compacted_row_height_mm)
        }
        if (fnName === 'verify_compliance') {
          printBlocked = result?.is_valid_for_print === false
        }
        if (result?.summary) notes.push(String(result.summary))
        else if (result?.message) notes.push(String(result.message))
        messages.push({
          role: 'tool',
          tool_call_id: call.id || fnName,
          content: JSON.stringify(result),
        })
      }
    }

    if (!template && !toolsCalled.length) return null

    return {
      reply: notes.filter(Boolean).join('\n') || 'Agent 已通过工具生成封闭 AST。',
      template,
      toolsCalled,
      printBlocked,
      mode: 'tools',
      visionAttempted: false,
      visionUsed: false,
    }
  }

  private async runStructuredFallback(userContent: ChatContent, input: AgentTurnInput): Promise<AgentTurnResult> {
    const data = await this.chat(
      [
        { role: 'system', content: `${SYSTEM_PROMPT}\n${JSON_FALLBACK_PROMPT}` },
        { role: 'user', content: userContent },
      ],
      { tools: null },
    )
    const text = String(data.choices?.[0]?.message?.content || '')
    const parsed = extractJsonObject(text)
    if (!parsed) {
      throw new Error(text ? `模型未返回可解析的意图 JSON。原文：${text.slice(0, 280)}` : '模型未返回内容')
    }
    return this.executeStructuredIntent(parsed, input)
  }

  private async executeStructuredIntent(
    parsed: Record<string, unknown>,
    input: AgentTurnInput,
  ): Promise<AgentTurnResult> {
    const action = String(parsed.action || 'create_medical_template')
    const toolsCalled: string[] = []
    const notes: string[] = []
    let template: Record<string, unknown> | null = null
    let printBlocked = false

    const run = async (name: string, args: Record<string, unknown>) => {
      toolsCalled.push(name)
      const result = await MedPrintToolExecutor.executeTool(name, this.withContextDefaults(name, args, input))
      if (result?.template) template = result.template
      if (typeof result?.compacted_row_height_mm === 'number') {
        patchTemplateRowHeight(template, result.compacted_row_height_mm)
      }
      if (name === 'verify_compliance') printBlocked = result?.is_valid_for_print === false
      if (result?.summary) notes.push(String(result.summary))
      else if (result?.message) notes.push(String(result.message))
      return result
    }

    if (action === 'calculate_clinical_formula' && parsed.formula) {
      await run('calculate_clinical_formula', {
        formula: parsed.formula,
        params: (parsed.params as Record<string, unknown>) || {},
      })
    }

    if (action === 'verify_compliance') {
      await run('verify_compliance', {
        has_signatures: parsed.has_signatures !== false,
        has_barcode: parsed.has_barcode !== false,
        has_seal: parsed.has_seal !== false,
        has_disclaimer: parsed.has_disclaimer !== false,
      })
    } else if (action === 'dispatch_silent_print') {
      const compliance = await run('verify_compliance', {
        has_signatures: true,
        has_barcode: input.context?.includeBarcode !== false,
        has_seal: input.context?.includeSeal !== false,
        has_disclaimer: true,
      })
      if (compliance?.is_valid_for_print) {
        await run('dispatch_silent_print', { template_id: String(parsed.template_id || 'current') })
      } else {
        printBlocked = true
      }
    } else {
      const created = await run('create_medical_template', {
        template_type: parsed.template_type || 'lis_a5_snaking',
        hospital_name: parsed.hospital_name || input.context?.hospitalName,
        report_title: parsed.report_title || input.context?.reportTitle,
        include_barcode: parsed.include_barcode,
        include_seal: parsed.include_seal,
        items: parsed.items,
      })
      const itemCount = Array.isArray(created?.template?.elements)
        ? (
            created.template.elements.find((el: { kind: string }) => el.kind === 'SnakingTable') as
              | { items?: unknown[] }
              | undefined
          )?.items?.length || 0
        : 0
      await run('optimize_page_compaction', {
        total_items_count: itemCount,
        available_height_mm: 95,
        current_row_height_mm: 5.5,
      })
      await run('verify_compliance', {
        has_signatures: true,
        has_barcode: parsed.include_barcode !== false,
        has_seal: parsed.include_seal !== false,
        has_disclaimer: true,
      })
    }

    return {
      reply: `【结构化意图 → 本地工具】\n${notes.join('\n')}`,
      template,
      toolsCalled,
      printBlocked,
      mode: 'structured-json',
      visionAttempted: false,
      visionUsed: false,
    }
  }

  private withContextDefaults(
    fnName: string,
    args: Record<string, unknown>,
    input: AgentTurnInput,
  ): Record<string, unknown> {
    if (fnName !== 'create_medical_template') return args
    const ctxItems = normalizeLabItems(input.context?.items)
    const argItems = normalizeLabItems(args.items)
    return {
      template_type: args.template_type || 'lis_a5_snaking',
      hospital_name: args.hospital_name || input.context?.hospitalName || 'XX市第一人民医院',
      report_title: args.report_title || input.context?.reportTitle || '临床报告单',
      include_barcode: args.include_barcode ?? input.context?.includeBarcode ?? true,
      include_seal: args.include_seal ?? input.context?.includeSeal ?? true,
      items: argItems.length > 0 ? argItems : ctxItems,
    }
  }

  private async chat(
    messages: ChatMessage[],
    opts: { tools: Array<{ type: 'function'; function: unknown }> | null; toolChoice?: string },
  ): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: 0.2,
    }
    if (opts.tools) {
      body.tools = opts.tools
      body.tool_choice = opts.toolChoice || 'auto'
    }

    let response: Response
    try {
      response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: timeoutSignal(120_000),
      })
    } catch (err: any) {
      throw Object.assign(new Error(err?.message || '网络请求失败'), { status: 0 })
    }

    const raw = await response.text()
    let data: any = {}
    try {
      data = raw ? JSON.parse(raw) : {}
    } catch {
      data = { error: { message: raw.slice(0, 400) } }
    }
    data.status = response.status

    if (!response.ok) {
      const msg = data.error?.message || raw.slice(0, 400) || `HTTP ${response.status}`
      throw Object.assign(new Error(msg), { status: response.status, body: raw })
    }
    return data
  }
}
