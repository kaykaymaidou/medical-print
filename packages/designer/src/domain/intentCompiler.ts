import { canDispatchPrint, formatViolations, validateReportTemplate } from './constraints'
import {
  createPresetTemplate,
  createReportTemplate,
  type WizardPresetId,
} from './presets'
import {
  findElement,
  type LabItemRow,
  type MedicalReportType,
  type ReportTemplate,
} from './reportAst'

export interface CompileContext {
  hospitalName?: string
  reportTitle?: string
  items?: LabItemRow[]
  includeBarcode?: boolean
  includeSeal?: boolean
  currentTemplate?: ReportTemplate
}

export interface CompileResult {
  template: ReportTemplate
  toolsCalled: string[]
  reply: string
  preset: WizardPresetId
  printBlocked: boolean
}

const TYPE_TO_PRESET: Record<MedicalReportType, WizardPresetId | null> = {
  LisBloodRoutine: 'lis_a5',
  TegThromboelastogram: 'teg',
  PacsImagingReport: 'pacs',
  OutpatientPrescription: 'prescription',
  EcgDiagnosticReport: null,
  InpatientThreePartForm: null,
}

function resolveReportType(prompt: string): MedicalReportType {
  if (prompt.includes('处方')) return 'OutpatientPrescription'
  if (prompt.includes('超声') || prompt.toUpperCase().includes('PACS')) return 'PacsImagingReport'
  if (prompt.includes('血栓') || prompt.toUpperCase().includes('TEG')) return 'TegThromboelastogram'
  return 'LisBloodRoutine'
}

function compactMessage(template: ReportTemplate): { tool: string; text: string } {
  const table = findElement(template, 'SnakingTable')
  const itemCount = table?.items.length ?? 0
  const availableHeight =
    template.paper_size.height_mm - template.margins.top_mm - template.margins.bottom_mm - 40
  const rowH = table?.row_height_mm ?? 5.5
  const cap = Math.floor((availableHeight - 6.5) / rowH) * 2

  if (!table) {
    return {
      tool: 'optimize_page_compaction',
      text: '当前模板无折流表，纸张预算由引擎按槽位流式计算。',
    }
  }
  if (itemCount <= cap) {
    return {
      tool: 'optimize_page_compaction',
      text: `${itemCount} 项可容纳于单页双列（容量约 ${cap} 项），无需压缩。`,
    }
  }
  return {
    tool: 'optimize_page_compaction',
    text: `项目 ${itemCount} 接近纸张预算，引擎将在可读性底线内自动微调行高。`,
  }
}

/**
 * Compile clinical natural language into a closed ReportTemplate.
 * Wizard and the agent runner must share this path — do not keyword-switch Vue presets only.
 */
export function compileClinicalIntent(prompt: string, ctx: CompileContext = {}): CompileResult {
  const q = prompt.trim()
  const toolsCalled: string[] = []

  if (q.includes('合规') || q.includes('审查') || q.includes('法规')) {
    const template = ctx.currentTemplate || createPresetTemplate('lis_a5', ctx)
    const issues = validateReportTemplate(template)
    toolsCalled.push('verify_compliance')
    const preset = TYPE_TO_PRESET[template.report_type] ?? 'lis_a5'
    return {
      template,
      toolsCalled,
      preset,
      printBlocked: !canDispatchPrint(issues),
      reply: `[约束审查 verify_compliance]\n${formatViolations(issues)}`,
    }
  }

  if (q.includes('打印') || q.includes('出纸')) {
    const template = ctx.currentTemplate || createPresetTemplate('lis_a5', ctx)
    const issues = validateReportTemplate(template)
    toolsCalled.push('verify_compliance')
    const preset = TYPE_TO_PRESET[template.report_type] ?? 'lis_a5'
    const blocked = !canDispatchPrint(issues)
    if (blocked) {
      return {
        template,
        toolsCalled,
        preset,
        printBlocked: true,
        reply: `[打印已拦截]\n${formatViolations(issues)}\n缺少签名或条码时禁止派发 spooler。`,
      }
    }
    toolsCalled.push('dispatch_silent_print')
    return {
      template,
      toolsCalled,
      preset,
      printBlocked: false,
      reply: '[dispatch_silent_print] 合规通过，已交给 medprint-spooler 监听真实出纸。',
    }
  }

  const reportType = resolveReportType(q)
  toolsCalled.push('create_medical_template')
  const template = createReportTemplate(reportType, {
    hospitalName: ctx.hospitalName,
    reportTitle: ctx.reportTitle,
    items: ctx.items,
    includeBarcode: ctx.includeBarcode,
    includeSeal: ctx.includeSeal,
  })

  const compact = compactMessage(template)
  toolsCalled.push(compact.tool)

  const issues = validateReportTemplate(template)
  toolsCalled.push('verify_compliance')

  const preset = TYPE_TO_PRESET[reportType] ?? 'lis_a5'
  const header = findElement(template, 'HospitalHeader')

  return {
    template,
    toolsCalled,
    preset,
    printBlocked: !canDispatchPrint(issues),
    reply: [
      `[create_medical_template] 已生成封闭 AST「${header?.report_title ?? template.name}」`,
      `report_type=${template.report_type}，元素：${template.elements.map((el) => el.kind).join(' → ')}`,
      `[${compact.tool}] ${compact.text}`,
      `[verify_compliance] ${formatViolations(issues)}`,
    ].join('\n'),
  }
}
