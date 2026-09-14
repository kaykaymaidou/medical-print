import {
  hasElement,
  isReportElementKind,
  type ReportTemplate,
} from './reportAst'

export interface ConstraintViolation {
  code: string
  severity: 'error' | 'warning'
  message: string
}

export function validateReportTemplate(template: ReportTemplate): ConstraintViolation[] {
  const issues: ConstraintViolation[] = []
  const PACS_SLOT_COUNTS = new Set([1, 2, 4, 6])

  const kinds = template.elements.map((el) => el.kind)
  const dup = kinds.filter((kind, i) => kinds.indexOf(kind) !== i)
  if (dup.length > 0) {
    issues.push({
      code: 'duplicate_slot',
      severity: 'error',
      message: `槽位重复：${[...new Set(dup)].join('、')}。每类 ReportElement 只能出现一次`,
    })
  }

  for (const el of template.elements) {
    if (!isReportElementKind(el.kind)) {
      issues.push({
        code: 'unknown_element',
        severity: 'error',
        message: `元素 ${String((el as { kind: string }).kind)} 不在封闭 ReportElement 词表，禁止作为打印源`,
      })
    }
  }

  if (!hasElement(template, 'HospitalHeader')) {
    issues.push({
      code: 'missing_header',
      severity: 'error',
      message: '缺少医院页眉槽位 HospitalHeader',
    })
  }

  if (!hasElement(template, 'Signatures')) {
    issues.push({
      code: 'missing_signatures',
      severity: 'error',
      message: '缺少三级责任签名链，违反检验/处方责任制，不可派发打印',
    })
  }

  const banner = template.elements.find((el) => el.kind === 'PatientBanner')
  const needsBarcode =
    template.report_type === 'LisBloodRoutine' ||
    template.report_type === 'OutpatientPrescription' ||
    template.report_type === 'TegThromboelastogram'

  if (needsBarcode && (!banner || (banner.kind === 'PatientBanner' && !banner.include_barcode))) {
    issues.push({
      code: 'missing_barcode',
      severity: 'error',
      message: '缺少标本/门诊唯一条码，存在混样或处方核销风险',
    })
  }

  if (!hasElement(template, 'Seal')) {
    issues.push({
      code: 'missing_seal',
      severity: 'warning',
      message: '未挂载防伪红章槽位 Seal',
    })
  }

  if (!hasElement(template, 'NotesFooter')) {
    issues.push({
      code: 'missing_disclaimer',
      severity: 'warning',
      message: '缺少 24 小时复核免责声明 NotesFooter',
    })
  }

  if (template.report_type === 'LisBloodRoutine' && !hasElement(template, 'SnakingTable')) {
    issues.push({
      code: 'missing_snaking',
      severity: 'error',
      message: 'LIS 化验单必须使用 SnakingTable，禁止用自由网格表替代',
    })
  }

  if (template.report_type === 'TegThromboelastogram' && !hasElement(template, 'TegCurveChart')) {
    issues.push({
      code: 'missing_teg',
      severity: 'error',
      message: 'TEG 报告缺少 TegCurveChart 槽位',
    })
  }

  if (template.report_type === 'PacsImagingReport' && !hasElement(template, 'PacsGrid')) {
    issues.push({
      code: 'missing_pacs',
      severity: 'error',
      message: 'PACS 报告缺少 PacsGrid 槽位',
    })
  }

  for (const el of template.elements) {
    if (el.kind === 'SnakingTable' && el.columns_count !== 2) {
      issues.push({
        code: 'snaking_columns',
        severity: 'error',
        message: 'A5 折流表 columns_count 必须为 2，列几何由引擎计算',
      })
    }
    if (el.kind === 'PacsGrid') {
      const slots = el.grid_cols * el.grid_rows
      if (!PACS_SLOT_COUNTS.has(slots)) {
        issues.push({
          code: 'pacs_slots',
          severity: 'error',
          message: `PACS 槽位数 ${slots} 非法，仅允许 1/2/4/6`,
        })
      }
    }
  }

  return issues
}

export function canDispatchPrint(issues: ConstraintViolation[]): boolean {
  return !issues.some((issue) => issue.severity === 'error')
}

export function formatViolations(issues: ConstraintViolation[]): string {
  if (issues.length === 0) {
    return '医疗合规性审查通过（签名链、条码、印章、免责声明槽位齐全）。'
  }
  return issues.map((issue) => `${issue.severity === 'error' ? '✗' : '⚠'} ${issue.message}`).join('\n')
}
