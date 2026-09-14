/** TypeScript mirror of crates/medprint-core/src/schema/mod.rs. Keep in lockstep with Rust. */

export const REPORT_ELEMENT_KINDS = [
  'HospitalHeader',
  'PatientBanner',
  'SnakingTable',
  'TegCurveChart',
  'PacsGrid',
  'Signatures',
  'Seal',
  'NotesFooter',
] as const

export type ReportElementKind = (typeof REPORT_ELEMENT_KINDS)[number]

export const MEDICAL_REPORT_TYPES = [
  'LisBloodRoutine',
  'PacsImagingReport',
  'EcgDiagnosticReport',
  'OutpatientPrescription',
  'InpatientThreePartForm',
  'TegThromboelastogram',
] as const

export type MedicalReportType = (typeof MEDICAL_REPORT_TYPES)[number]

export type AlertFlag = 'Normal' | 'High' | 'Low' | 'Critical'

export interface PhysicalSizeMm {
  width_mm: number
  height_mm: number
}

export interface MarginsMm {
  top_mm: number
  right_mm: number
  bottom_mm: number
  left_mm: number
}

export interface LabItemRow {
  index: number
  item_name: string
  item_abbr: string
  result_value: string
  unit: string
  ref_range_display: string
  alert_flag: AlertFlag
  is_critical: boolean
}

export type TextAlign = 'left' | 'center' | 'right'

export const PATIENT_FIELD_KEYS = [
  'name',
  'gender',
  'age',
  'outpatient_no',
  'inpatient_no',
  'medical_record_no',
  'department',
  'bed_no',
  'sample_type',
  'barcode',
  'report_no',
  'diagnosis',
  'sampling_time',
  'phone',
  'custom',
] as const

export type PatientFieldKey = (typeof PATIENT_FIELD_KEYS)[number]

export interface PatientField {
  key: PatientFieldKey | string
  label: string
  preview_value: string
}

export const PATIENT_FIELD_CATALOG: Record<
  Exclude<PatientFieldKey, 'custom'>,
  { label: string; preview: string }
> = {
  name: { label: '姓名', preview: '张伟' },
  gender: { label: '性别', preview: '男' },
  age: { label: '年龄', preview: '45岁' },
  outpatient_no: { label: '门诊号', preview: 'MZ809214' },
  inpatient_no: { label: '住院号', preview: 'ZY20260908' },
  medical_record_no: { label: '病历号', preview: 'MR-10086' },
  department: { label: '科室', preview: '内分泌门诊' },
  bed_no: { label: '床号', preview: '12床' },
  sample_type: { label: '标本', preview: '静脉血清' },
  barcode: { label: '条码', preview: '019283' },
  report_no: { label: '报告单号', preview: 'BG20260908001' },
  diagnosis: { label: '诊断', preview: '2型糖尿病' },
  sampling_time: { label: '采样时间', preview: '07:48' },
  phone: { label: '电话', preview: '138****0000' },
}

export function defaultPatientFields(): PatientField[] {
  return (['name', 'gender', 'age', 'outpatient_no', 'department', 'sample_type'] as const).map(
    (key) => ({
      key,
      label: PATIENT_FIELD_CATALOG[key].label,
      preview_value: PATIENT_FIELD_CATALOG[key].preview,
    }),
  )
}

export function catalogField(key: PatientFieldKey): PatientField {
  if (key === 'custom') {
    return { key: `custom-${Date.now()}`, label: '自定义', preview_value: '' }
  }
  const meta = PATIENT_FIELD_CATALOG[key]
  return { key, label: meta.label, preview_value: meta.preview }
}

export type AnchorPosition =
  | 'TopLeft'
  | 'TopCenter'
  | 'TopRight'
  | 'MiddleLeft'
  | 'Center'
  | 'MiddleRight'
  | 'BottomLeft'
  | 'BottomCenter'
  | 'BottomRight'

export type AlignmentType =
  | 'AlignTop'
  | 'AlignBottom'
  | 'AlignCenterVertical'
  | 'AlignLeft'
  | 'AlignRight'
  | 'AlignCenterHorizontal'

export interface RelativeAlignment {
  target_id: string
  align_type: AlignmentType
  offset_mm: number
}

export type FlowBehavior = 'None' | 'AvoidAndNarrow' | 'BreakColumnAround' | 'StopAbove'

export interface ObstacleConstraint {
  is_obstacle: boolean
  safe_padding_mm: number
  flow_behavior: FlowBehavior
}

export type PageBudgetConstraint = 'SinglePageHard' | 'SinglePageSoft' | 'MultiPageNatural'

export interface ElementConstraints {
  anchor_position?: AnchorPosition
  relative_alignment?: RelativeAlignment
  obstacle_constraint?: ObstacleConstraint
}

export type ReportElement =
  | {
      kind: 'HospitalHeader'
      hospital_name: string
      sub_title: string
      report_title: string
      align?: TextAlign
      logo_data_url?: string
      show_report_no?: boolean
      report_no_label?: string
      report_no_preview?: string
      constraints?: ElementConstraints
    }
  | {
      kind: 'PatientBanner'
      include_barcode: boolean
      fields?: PatientField[]
      constraints?: ElementConstraints
    }
  | {
      kind: 'SnakingTable'
      columns_count: number
      column_gap_mm: number
      left_ratio: number
      row_height_mm: number
      auto_compaction: boolean
      items: LabItemRow[]
      constraints?: ElementConstraints
    }
  | {
      kind: 'TegCurveChart'
      r_time_min: number
      k_time_min: number
      alpha_angle_deg: number
      ma_amplitude_mm: number
      ly30_percent: number
      constraints?: ElementConstraints
    }
  | {
      kind: 'PacsGrid'
      grid_cols: number
      grid_rows: number
      image_urls: string[]
      show_scale_ruler: boolean
      constraints?: ElementConstraints
    }
  | {
      kind: 'Signatures'
      requesting_physician: string
      sampling_person?: string
      operator: string
      reviewer: string
      report_date: string
      constraints?: ElementConstraints
    }
  | {
      kind: 'Seal'
      hospital_name: string
      seal_title: string
      seal_code: string
      diameter_mm: number
      angle_jitter_deg: number
      opacity: number
      constraints?: ElementConstraints
    }
  | {
      kind: 'NotesFooter'
      text: string
      constraints?: ElementConstraints
    }

/** Optional screen preview boxes. Never the print source of truth. */
export interface PreviewFrame {
  element_index: number
  kind: ReportElementKind
  x_mm: number
  y_mm: number
  width_mm: number
  height_mm: number
}

export interface ReportTemplate {
  id: string
  name: string
  version: string
  app: 'MedPrint'
  paper_size: PhysicalSizeMm
  margins: MarginsMm
  report_type: MedicalReportType
  elements: ReportElement[]
  preview_frames?: PreviewFrame[]
  page_budget?: PageBudgetConstraint
}

export const A5_LANDSCAPE: PhysicalSizeMm = { width_mm: 210, height_mm: 148 }
export const A4_PORTRAIT: PhysicalSizeMm = { width_mm: 210, height_mm: 297 }
export const A4_LANDSCAPE: PhysicalSizeMm = { width_mm: 297, height_mm: 210 }

export const MEDICAL_MARGINS: MarginsMm = {
  top_mm: 8,
  right_mm: 10,
  bottom_mm: 8,
  left_mm: 10,
}

export const DEFAULT_NOTES =
  '注：本报告仅对本次标本检验结果负责。若对化验结果有疑义，请在报告发布后 24 小时内向检验科提出复查申请。'

export function isReportElementKind(value: string): value is ReportElementKind {
  return (REPORT_ELEMENT_KINDS as readonly string[]).includes(value)
}

export function findElement<K extends ReportElementKind>(
  template: ReportTemplate,
  kind: K,
): Extract<ReportElement, { kind: K }> | undefined {
  return template.elements.find((el): el is Extract<ReportElement, { kind: K }> => el.kind === kind)
}

export function hasElement(template: ReportTemplate, kind: ReportElementKind): boolean {
  return template.elements.some((el) => el.kind === kind)
}

export function isReportTemplate(value: unknown): value is ReportTemplate {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return v.app === 'MedPrint' && typeof v.report_type === 'string' && Array.isArray(v.elements)
}
