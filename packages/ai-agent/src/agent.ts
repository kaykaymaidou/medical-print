//! DeepSeek Autonomous Agent Runner for MedPrint

declare const process: any;

import { MEDPRINT_TOOLS, MedPrintToolExecutor } from './tools.js'

export interface AgentConfig {
  apiKey?: string
  baseURL?: string
  model?: string
}

export class MedPrintAgentRunner {
  private apiKey: string
  private baseURL: string
  private model: string

  constructor(config: AgentConfig = {}) {
    this.apiKey = config.apiKey || process.env.DEEPSEEK_API_KEY || ''
    this.baseURL = config.baseURL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'
    this.model = config.model || 'deepseek-chat'
  }

  /// 运行单轮或多轮医疗报告设计与打印 Agent 任务
  async runTask(userPrompt: string): Promise<string> {
    console.log(`[MedPrint AI Agent] 接收临床指令: "${userPrompt}"`)

    // 如果没有配置真实 API KEY，进行本地离线智能意图解析演示
    if (!this.apiKey) {
      console.log('[MedPrint AI Agent] 未配置 DEEPSEEK_API_KEY，切换至内置规则模拟推理模式...')
      return this.runMockAgent(userPrompt)
    }

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content:
                '你是一个精通医疗信息化 (HIS/LIS/PACS) 的 AI 报告单设计与排版专家。请根据医生的自然语言要求调用 MedPrint 工具完成报告单设计、A5双列排版优化、公式计算与打印。',
            },
            { role: 'user', content: userPrompt },
          ],
          tools: MEDPRINT_TOOLS.map((t) => ({ type: 'function', function: t })),
        }),
      })

      const data = await response.json()
      const choice = data.choices?.[0]
      if (choice?.message?.tool_calls) {
        for (const toolCall of choice.message.tool_calls) {
          const fnName = toolCall.function.name
          const args = JSON.parse(toolCall.function.arguments)
          console.log(`[MedPrint AI Agent] 🤖 调用工具: ${fnName}`, args)
          const result = await MedPrintToolExecutor.executeTool(fnName, args)
          console.log(`[MedPrint AI Agent] 产出结果:`, result)
        }
      }

      return choice?.message?.content || 'Agent 任务执行完成。'
    } catch (err: any) {
      return `Agent 运行错误: ${err.message}`
    }
  }

  private async runMockAgent(prompt: string): Promise<string> {
    // 智能关键词意图提取
    if (prompt.includes('双列') || prompt.includes('血常规') || prompt.includes('生化') || prompt.includes('A5')) {
      const template = await MedPrintToolExecutor.executeTool('create_medical_template', {
        template_type: 'lis_a5_snaking',
        hospital_name: 'XX市中心医院',
        report_title: '临床血液生化常规报告单',
        include_barcode: true,
        include_seal: true,
        items: [
          { name: '谷丙转氨酶', abbr: 'ALT', value: '65.2', unit: 'U/L', ref_range: '9-50' },
          { name: '谷草转氨酶', abbr: 'AST', value: '41.0', unit: 'U/L', ref_range: '15-40' },
          { name: '血肌酐', abbr: 'CREA', value: '85.0', unit: 'umol/L', ref_range: '59-104' },
        ],
      })

      const compact = await MedPrintToolExecutor.executeTool('optimize_page_compaction', {
        total_items_count: 30,
        available_height_mm: 95.0,
      })

      return `【MedPrint AI 智能响应】\n已为您自动完成任务：\n1. 模板生成：${template.summary}\n2. 纸张排版：${compact.message}\n3. 防伪印章与三级签名链已自动注入。`
    }

    if (prompt.includes('打印')) {
      const printRes = await MedPrintToolExecutor.executeTool('dispatch_silent_print', {
        template_id: 'current_active_template',
      })
      return `【MedPrint 硬件响应】\n${printRes.message}\n任务ID: #${printRes.job_id}，物理打印机出纸成功。`
    }

    return '【MedPrint AI】已接收指令。支持：“生成A5双列血常规化验单”、“计算eGFR”、“发送静默打印并监控纸张”等。'
  }
}
