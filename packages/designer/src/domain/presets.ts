import {
  A4_PORTRAIT,
  A5_LANDSCAPE,
  DEFAULT_NOTES,
  MEDICAL_MARGINS,
  defaultPatientFields,
  type LabItemRow,
  type MedicalReportType,
  type ReportElement,
  type ReportTemplate,
} from './reportAst'

export type WizardPresetId = 'lis_a5' | 'teg' | 'pacs' | 'prescription'

export const WIZARD_PRESET_TO_REPORT_TYPE: Record<WizardPresetId, MedicalReportType> = {
  lis_a5: 'LisBloodRoutine',
  teg: 'TegThromboelastogram',
  pacs: 'PacsImagingReport',
  prescription: 'OutpatientPrescription',
}

export const REPORT_TYPE_TO_WIZARD_PRESET: Partial<Record<MedicalReportType, WizardPresetId>> = {
  LisBloodRoutine: 'lis_a5',
  TegThromboelastogram: 'teg',
  PacsImagingReport: 'pacs',
  OutpatientPrescription: 'prescription',
}

const DEFAULT_ITEMS: LabItemRow[] = [
  { index: 1, item_name: '丙氨酸氨基转移酶', item_abbr: 'ALT', result_value: '68.5', unit: 'U/L', ref_range_display: '9.0 - 50.0', alert_flag: 'High', is_critical: false },
  { index: 2, item_name: '天门冬氨酸氨基转移酶', item_abbr: 'AST', result_value: '42.0', unit: 'U/L', ref_range_display: '15.0 - 40.0', alert_flag: 'High', is_critical: false },
  { index: 3, item_name: '葡萄糖', item_abbr: 'GLU', result_value: '16.8', unit: 'mmol/L', ref_range_display: '3.90 - 6.10', alert_flag: 'Critical', is_critical: true },
]

const TEG_ITEMS: LabItemRow[] = [
  { index: 1, item_name: '凝血反应时间 (R)', item_abbr: 'R', result_value: '5.2', unit: 'min', ref_range_display: '4.0 - 8.0', alert_flag: 'Normal', is_critical: false },
  { index: 2, item_name: '凝血形成时间 (K)', item_abbr: 'K', result_value: '1.8', unit: 'min', ref_range_display: '1.0 - 3.0', alert_flag: 'Normal', is_critical: false },
  { index: 3, item_name: '凝固角 (α角)', item_abbr: 'Angle', result_value: '66.5', unit: 'deg', ref_range_display: '53.0 - 72.0', alert_flag: 'Normal', is_critical: false },
  { index: 4, item_name: '最大振幅 (MA)', item_abbr: 'MA', result_value: '63.8', unit: 'mm', ref_range_display: '50.0 - 70.0', alert_flag: 'Normal', is_critical: false },
  { index: 5, item_name: '30分钟纤溶指数', item_abbr: 'LY30', result_value: '2.1', unit: '%', ref_range_display: '0.0 - 7.5', alert_flag: 'Normal', is_critical: false },
  { index: 6, item_name: '凝血综合指数 (CI)', item_abbr: 'CI', result_value: '+1.2', unit: '', ref_range_display: '-3.0 - +3.0', alert_flag: 'Normal', is_critical: false },
]

export interface PresetOptions {
  hospitalName?: string
  reportTitle?: string
  includeBarcode?: boolean
  includeSeal?: boolean
  items?: LabItemRow[]
}

function header(
  hospitalName: string,
  reportTitle: string,
  subTitle: string,
): ReportElement {
  return {
    kind: 'HospitalHeader',
    hospital_name: hospitalName,
    sub_title: subTitle,
    report_title: reportTitle,
    align: 'center',
    show_report_no: true,
    report_no_label: '报告单号',
    report_no_preview: 'BG20260908001',
  }
}

function signatures(): ReportElement {
  return {
    kind: 'Signatures',
    requesting_physician: '李主任',
    sampling_person: '刘护士',
    operator: '王检验师',
    reviewer: '陈主管技师',
    report_date: '2026-09-08 08:30',
  }
}

function seal(hospitalName: string, sealTitle: string): ReportElement {
  return {
    kind: 'Seal',
    hospital_name: hospitalName,
    seal_title: sealTitle,
    seal_code: 'SEAL-001',
    diameter_mm: 32,
    angle_jitter_deg: 1.5,
    opacity: 0.82,
    constraints: {
      anchor_position: 'BottomRight',
    },
  }
}

function notes(text = DEFAULT_NOTES): ReportElement {
  return { kind: 'NotesFooter', text }
}

export function createReportTemplate(
  reportType: MedicalReportType,
  options: PresetOptions = {},
): ReportTemplate {
  const hospitalName = options.hospitalName || 'XX市第一人民医院'
  const includeBarcode = options.includeBarcode !== false
  const includeSeal = options.includeSeal !== false
  const id = `tpl_${Date.now()}`

  const commonTail: ReportElement[] = [
    ...(includeSeal ? [seal(hospitalName, sealTitleFor(reportType))] : []),
    signatures(),
    notes(),
  ]

  if (reportType === 'TegThromboelastogram') {
    const reportTitle = options.reportTitle || '血栓弹力图 (TEG) 凝血功能专项报告单'
    return {
      id,
      name: reportTitle,
      version: '1.0',
      app: 'MedPrint',
      paper_size: A5_LANDSCAPE,
      margins: { ...MEDICAL_MARGINS },
      report_type: reportType,
      page_budget: 'SinglePageHard',
      elements: [
        header(hospitalName, reportTitle, '急诊重症监护室 (ICU)'),
        { kind: 'PatientBanner', include_barcode: includeBarcode, fields: defaultPatientFields() },
        {
          kind: 'TegCurveChart',
          r_time_min: 5.2,
          k_time_min: 1.8,
          alpha_angle_deg: 66.5,
          ma_amplitude_mm: 63.8,
          ly30_percent: 2.1,
          constraints: {
            obstacle_constraint: {
              is_obstacle: true,
              safe_padding_mm: 2.0,
              flow_behavior: 'AvoidAndNarrow',
            },
          },
        },
        {
          kind: 'SnakingTable',
          columns_count: 2,
          column_gap_mm: 4,
          left_ratio: 0.5,
          row_height_mm: 5.5,
          auto_compaction: true,
          items: options.items || TEG_ITEMS,
        },
        ...commonTail,
      ],
    }
  }

  if (reportType === 'PacsImagingReport') {
    const reportTitle = options.reportTitle || '超声医学科检查报告单'
    return {
      id,
      name: reportTitle,
      version: '1.0',
      app: 'MedPrint',
      paper_size: A4_PORTRAIT,
      margins: { ...MEDICAL_MARGINS },
      report_type: reportType,
      elements: [
        header(hospitalName, reportTitle, '超声医学科'),
        { kind: 'PatientBanner', include_barcode: includeBarcode, fields: defaultPatientFields() },
        {
          kind: 'PacsGrid',
          grid_cols: 2,
          grid_rows: 1,
          image_urls: [],
          show_scale_ruler: true,
        },
        ...commonTail,
      ],
    }
  }

  if (reportType === 'OutpatientPrescription') {
    const reportTitle = options.reportTitle || '门 急 诊 处 方 笺'
    return {
      id,
      name: reportTitle,
      version: '1.0',
      app: 'MedPrint',
      paper_size: A5_LANDSCAPE,
      margins: { ...MEDICAL_MARGINS },
      report_type: reportType,
      elements: [
        header(hospitalName, reportTitle, '门急诊药房'),
        { kind: 'PatientBanner', include_barcode: includeBarcode, fields: defaultPatientFields() },
        notes('Rp 药品组、用法用量由处方业务数据注入；本模板只保留合规槽位。'),
        ...(includeSeal ? [seal(hospitalName, '处方核发章')] : []),
        signatures(),
      ],
    }
  }

  const reportTitle = options.reportTitle || '临床血液生化检验报告单 (A5横向双列)'
  return {
    id,
    name: reportTitle,
    version: '1.0',
    app: 'MedPrint',
    paper_size: A5_LANDSCAPE,
    margins: { ...MEDICAL_MARGINS },
    report_type: 'LisBloodRoutine',
    page_budget: 'SinglePageHard',
    elements: [
      header(hospitalName, reportTitle, '医学检验科 (LIS)'),
      { kind: 'PatientBanner', include_barcode: includeBarcode, fields: defaultPatientFields() },
      {
        kind: 'SnakingTable',
        columns_count: 2,
        column_gap_mm: 4,
        left_ratio: 0.5,
        row_height_mm: 5.5,
        auto_compaction: true,
        items: options.items || DEFAULT_ITEMS,
      },
      ...commonTail,
    ],
  }
}

function sealTitleFor(reportType: MedicalReportType): string {
  if (reportType === 'TegThromboelastogram') return '急诊检验章'
  if (reportType === 'PacsImagingReport') return '超声诊断章'
  if (reportType === 'OutpatientPrescription') return '处方核发章'
  return '检验科防伪专用章'
}

export function createPresetTemplate(preset: WizardPresetId, options: PresetOptions = {}): ReportTemplate {
  return createReportTemplate(WIZARD_PRESET_TO_REPORT_TYPE[preset], options)
}
