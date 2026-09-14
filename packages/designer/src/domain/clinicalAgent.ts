import { MedPrintAgentRunner } from '../../../ai-agent/src/agent'
import {
  compileClinicalIntent,
  type CompileContext,
} from './intentCompiler'
import {
  providerStatus,
  type ModelProviderSettings,
} from './modelSettings'
import { isReportTemplate, type ReportTemplate } from './reportAst'

export interface WizardAgentResult {
  reply: string
  template: ReportTemplate
  printBlocked: boolean
  error?: string
  toolsCalled: string[]
  usedModel: boolean
}

function fallbackTemplate(ctx: CompileContext, prompt: string): ReturnType<typeof compileClinicalIntent> {
  return compileClinicalIntent(prompt.trim() || '生成当前类型报告单', ctx)
}

export async function runWizardAgent(opts: {
  prompt: string
  imageDataUrl?: string
  settings: ModelProviderSettings
  ctx: CompileContext
}): Promise<WizardAgentResult> {
  const status = providerStatus(opts.settings)
  const prompt = opts.prompt.trim()
  const heuristic = fallbackTemplate(opts.ctx, prompt)

  if (status === 'unconfigured') {
    if (opts.imageDataUrl) {
      return {
        reply:
          '未配置模型，无法识图。请在「模型连接」中填写本地 Ollama 或外部 OpenAI 兼容接口，并选用支持视觉的模型（如 llava / gpt-4o）。也可以改用文字描述临床意图。',
        template: opts.ctx.currentTemplate || heuristic.template,
        printBlocked: false,
        error: 'unconfigured',
        toolsCalled: [],
        usedModel: false,
      }
    }
    return {
      reply: `未配置模型，已用本地意图编译器生成封闭 AST。\n${heuristic.reply}`,
      template: heuristic.template,
      printBlocked: heuristic.printBlocked,
      toolsCalled: heuristic.toolsCalled,
      usedModel: false,
    }
  }

  const runner = new MedPrintAgentRunner({
    mode: opts.settings.mode,
    baseURL: opts.settings.baseUrl,
    apiKey: opts.settings.apiKey,
    model: opts.settings.model,
    vision: opts.settings.vision,
  })

  const turn = await runner.runTurn({
    prompt,
    imageDataUrl: opts.imageDataUrl,
    context: {
      hospitalName: opts.ctx.hospitalName,
      reportTitle: opts.ctx.reportTitle,
      includeBarcode: opts.ctx.includeBarcode,
      includeSeal: opts.ctx.includeSeal,
      items: opts.ctx.items,
    },
  })

  if (turn.template && isReportTemplate(turn.template)) {
    return {
      reply: turn.reply,
      template: turn.template,
      printBlocked: turn.printBlocked,
      error: turn.error,
      toolsCalled: turn.toolsCalled,
      usedModel: true,
    }
  }

  if (opts.imageDataUrl && !turn.visionUsed && !prompt) {
    return {
      reply: turn.reply || '当前模型无法识图，AST 未改动。',
      template: opts.ctx.currentTemplate || heuristic.template,
      printBlocked: false,
      error: turn.error || 'vision-unsupported',
      toolsCalled: turn.toolsCalled,
      usedModel: true,
    }
  }

  if (turn.error && !prompt) {
    return {
      reply: turn.reply,
      template: opts.ctx.currentTemplate || heuristic.template,
      printBlocked: false,
      error: turn.error,
      toolsCalled: turn.toolsCalled,
      usedModel: true,
    }
  }

  return {
    reply: [turn.reply, prompt ? `已回退本地意图编译器。\n${heuristic.reply}` : '']
      .filter(Boolean)
      .join('\n'),
    template: prompt ? heuristic.template : opts.ctx.currentTemplate || heuristic.template,
    printBlocked: heuristic.printBlocked,
    error: turn.error,
    toolsCalled: [...turn.toolsCalled, ...heuristic.toolsCalled],
    usedModel: true,
  }
}
