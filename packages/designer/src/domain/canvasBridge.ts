import { createReportTemplate } from './presets'
import { layoutTemplateFrames } from './engineBridge'
import { CANONICAL_SLOT_ORDER } from './slotLayout'
import {
  A5_LANDSCAPE,
  DEFAULT_NOTES,
  MEDICAL_MARGINS,
  catalogField,
  defaultPatientFields,
  findElement,
  hasElement,
  isReportElementKind,
  type LabItemRow,
  type MarginsMm,
  type PatientField,
  type PatientFieldKey,
  type PreviewFrame,
  type ReportElement,
  type ReportElementKind,
  type ReportTemplate,
  type TextAlign,
} from './reportAst'

/** Canvas preview type. Must map 1:1 onto ReportElementKind. */
export type ClosedCanvasType =
  | 'header'
  | 'demographics'
  | 'snaking_table'
  | 'teg_chart'
  | 'pacs_grid'
  | 'seal'
  | 'signature_chain'
  | 'notes'

export interface CanvasSlot {
  id: string
  type: ClosedCanvasType
  name: string
  /** Preview-only millimeters. Print layout is owned by the engine. */
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  props: Record<string, unknown>
}

export const AST_KIND_TO_CANVAS: Record<ReportElementKind, ClosedCanvasType> = {
  HospitalHeader: 'header',
  PatientBanner: 'demographics',
  SnakingTable: 'snaking_table',
  TegCurveChart: 'teg_chart',
  PacsGrid: 'pacs_grid',
  Seal: 'seal',
  Signatures: 'signature_chain',
  NotesFooter: 'notes',
}

export const CANVAS_TO_AST_KIND: Record<ClosedCanvasType, ReportElementKind> = {
  header: 'HospitalHeader',
  demographics: 'PatientBanner',
  snaking_table: 'SnakingTable',
  teg_chart: 'TegCurveChart',
  pacs_grid: 'PacsGrid',
  seal: 'Seal',
  signature_chain: 'Signatures',
  notes: 'NotesFooter',
}

export const CLOSED_TOOLBOX: Array<{
  canvasType: ClosedCanvasType
  astKind: ReportElementKind
  label: string
  group: 'flow' | 'clinical' | 'compliance'
}> = [
  { canvasType: 'header', astKind: 'HospitalHeader', label: '医院页眉', group: 'flow' },
  { canvasType: 'demographics', astKind: 'PatientBanner', label: '患者信息条', group: 'flow' },
  { canvasType: 'snaking_table', astKind: 'SnakingTable', label: 'A5双列折流表', group: 'clinical' },
  { canvasType: 'teg_chart', astKind: 'TegCurveChart', label: 'TEG 弹力图', group: 'clinical' },
  { canvasType: 'pacs_grid', astKind: 'PacsGrid', label: 'PACS 影像网格', group: 'clinical' },
  { canvasType: 'notes', astKind: 'NotesFooter', label: '免责声明', group: 'compliance' },
  { canvasType: 'seal', astKind: 'Seal', label: '防伪检验红章', group: 'compliance' },
  { canvasType: 'signature_chain', astKind: 'Signatures', label: '三级签名链', group: 'compliance' },
]

const OPEN_LOWCODE_TYPES = new Set(['label', 'perforation', 'grid_table'])

const SLOT_NAMES: Record<ClosedCanvasType, string> = {
  header: '医院页眉',
  demographics: '患者信息条',
  snaking_table: 'A5 双列折流表',
  teg_chart: 'TEG 弹力图',
  pacs_grid: 'PACS 影像网格',
  seal: '防伪检验红章',
  signature_chain: '三级签名链',
  notes: '免责声明',
}

export function isClosedCanvasType(type: string): type is ClosedCanvasType {
  return type in CANVAS_TO_AST_KIND
}

export function isForbiddenLowcodeType(type: string): boolean {
  return OPEN_LOWCODE_TYPES.has(type)
}

export function occupiedKinds(template: ReportTemplate): Set<ReportElementKind> {
  return new Set(template.elements.map((el) => el.kind))
}

export function defaultElementForKind(kind: ReportElementKind, template: ReportTemplate): ReportElement {
  const header = findElement(template, 'HospitalHeader')
  const hospitalName = header?.hospital_name || 'XX市第一人民医院'
  const reportTitle = header?.report_title || template.name
  switch (kind) {
    case 'HospitalHeader':
      return {
        kind,
        hospital_name: hospitalName,
        sub_title: '',
        report_title: reportTitle,
        align: 'center',
        show_report_no: false,
        report_no_label: '报告单号',
        report_no_preview: 'BG20260908001',
      }
    case 'PatientBanner':
      return { kind, include_barcode: true, fields: defaultPatientFields() }
    case 'SnakingTable':
      return {
        kind,
        columns_count: 2,
        column_gap_mm: 4,
        left_ratio: 0.5,
        row_height_mm: 5.5,
        auto_compaction: true,
        items: findElement(template, 'SnakingTable')?.items ?? [],
      }
    case 'TegCurveChart':
      return {
        kind,
        r_time_min: 5.2,
        k_time_min: 1.8,
        alpha_angle_deg: 66.5,
        ma_amplitude_mm: 63.8,
        ly30_percent: 2.1,
      }
    case 'PacsGrid':
      return { kind, grid_cols: 2, grid_rows: 1, image_urls: [], show_scale_ruler: true }
    case 'Signatures':
      return {
        kind,
        requesting_physician: '李主任',
        sampling_person: '刘护士',
        operator: '王检验师',
        reviewer: '陈主管技师',
        report_date: '2026-09-08 08:30',
      }
    case 'Seal':
      return {
        kind,
        hospital_name: hospitalName,
        seal_title: '检验科防伪专用章',
        seal_code: 'SEAL-001',
        diameter_mm: 32,
        angle_jitter_deg: 1.5,
        opacity: 0.82,
      }
    case 'NotesFooter':
      return { kind, text: DEFAULT_NOTES }
  }
}

export function insertUniqueSlot(template: ReportTemplate, kind: ReportElementKind): ReportTemplate {
  if (hasElement(template, kind)) return template
  const next = defaultElementForKind(kind, template)
  const preferred = CANONICAL_SLOT_ORDER.indexOf(kind)
  const elements = [...template.elements]
  const insertAt = elements.findIndex((el) => CANONICAL_SLOT_ORDER.indexOf(el.kind) > preferred)
  if (insertAt === -1) elements.push(next)
  else elements.splice(insertAt, 0, next)
  return { ...template, elements }
}

export function moveSlot(template: ReportTemplate, kind: ReportElementKind, delta: number): ReportTemplate {
  const from = template.elements.findIndex((el) => el.kind === kind)
  if (from < 0) return template
  const to = Math.max(0, Math.min(template.elements.length - 1, from + delta))
  if (to === from) return template
  const elements = [...template.elements]
  const [item] = elements.splice(from, 1)
  elements.splice(to, 0, item)
  return { ...template, elements }
}

export function reorderSlotsByPreviewY(
  template: ReportTemplate,
  slots: Array<{ type: string; y: number }>,
): ReportTemplate {
  const ranked = [...slots].sort((a, b) => a.y - b.y)
  const byKind = new Map(template.elements.map((el) => [el.kind, el]))
  const used = new Set<ReportElementKind>()
  const elements: ReportElement[] = []
  for (const slot of ranked) {
    if (!isClosedCanvasType(slot.type)) continue
    const kind = CANVAS_TO_AST_KIND[slot.type]
    const el = byKind.get(kind)
    if (!el || used.has(kind)) continue
    used.add(kind)
    elements.push(el)
  }
  for (const el of template.elements) {
    if (!used.has(el.kind)) elements.push(el)
  }
  return { ...template, elements }
}

export function removeSlot(template: ReportTemplate, kind: ReportElementKind): ReportTemplate {
  return { ...template, elements: template.elements.filter((el) => el.kind !== kind) }
}

/**
 * Project engine-computed millimeter frames onto canvas slots.
 * Duplicate kinds are dropped by the engine; only page 1 is drawn on the sheet.
 */
export function projectTemplateToSlots(template: ReportTemplate, page = 1): CanvasSlot[] {
  const laidOut = layoutTemplateFrames(template)
  return laidOut.frames
    .filter((frame) => frame.page === page)
    .map((frame) => {
      const kind = frame.kind as ReportElementKind
      const canvasType = AST_KIND_TO_CANVAS[kind]
      const el = template.elements[frame.element_index]
      return {
        id: `slot-${frame.element_index}-${frame.kind}`,
        type: canvasType,
        name: SLOT_NAMES[canvasType],
        x: frame.x_mm,
        y: frame.y_mm,
        width: frame.width_mm,
        height: frame.height_mm,
        zIndex: frame.overlay ? 20 : frame.element_index + 1,
        props: el ? elementToProps(el, template) : { engineKind: frame.kind },
      }
    })
}

export function previewFramesOf(slots: CanvasSlot[]): PreviewFrame[] {
  return slots.map((slot, element_index) => ({
    element_index,
    kind: CANVAS_TO_AST_KIND[slot.type],
    x_mm: slot.x,
    y_mm: slot.y,
    width_mm: slot.width,
    height_mm: slot.height,
  }))
}

export function slotsToTemplate(slots: CanvasSlot[], base?: ReportTemplate): ReportTemplate {
  const header = slots.find((s) => s.type === 'header')
  const hospitalName = String(header?.props.hospitalName || 'XX市第一人民医院')
  const reportTitle = String(header?.props.reportTitle || base?.name || '临床报告单')

  const elements: ReportElement[] = slots
    .filter((slot) => isClosedCanvasType(slot.type))
    .map((slot) => slotToElement(slot, hospitalName, reportTitle, base))

  const template: ReportTemplate = {
    ...(base || createReportTemplate('LisBloodRoutine', { hospitalName, reportTitle })),
    name: reportTitle,
    elements,
    paper_size: base?.paper_size || { ...A5_LANDSCAPE },
    margins: base?.margins || { ...MEDICAL_MARGINS },
    preview_frames: previewFramesOf(slots),
  }
  return template
}

function elementToProps(el: ReportElement, template: ReportTemplate): Record<string, unknown> {
  switch (el.kind) {
    case 'HospitalHeader':
      return {
        hospitalName: el.hospital_name,
        reportTitle: el.report_title,
        subTitle: el.sub_title,
        align: el.align || 'center',
        logoDataUrl: el.logo_data_url || '',
        showReportNo: !!el.show_report_no,
        reportNoLabel: el.report_no_label || '报告单号',
        reportNoPreview: el.report_no_preview || 'BG20260908001',
      }
    case 'PatientBanner':
      return {
        includeBarcode: el.include_barcode,
        fields: (el.fields && el.fields.length > 0 ? el.fields : defaultPatientFields()).map((f) => ({ ...f })),
      }
    case 'SnakingTable':
      return {
        snakingFlow: true,
        autoCompaction: el.auto_compaction,
        rowHeightMm: el.row_height_mm,
        leftRatio: el.left_ratio,
        columnGapMm: el.column_gap_mm,
        columnsCount: el.columns_count,
        items: el.items.map((row) => ({ ...row })),
      }
    case 'Seal':
      return {
        hospitalName: el.hospital_name,
        deptName: el.seal_title,
        diameterMm: el.diameter_mm,
        opacity: el.opacity,
        multiplyBlend: true,
      }
    case 'NotesFooter':
      return { text: el.text, fontSizePt: 8, align: 'center' }
    case 'PacsGrid':
      return {
        gridCols: el.grid_cols,
        gridRows: el.grid_rows,
        showScaleRuler: el.show_scale_ruler,
      }
    case 'TegCurveChart':
      return {
        rTimeMin: el.r_time_min,
        kTimeMin: el.k_time_min,
        alphaAngleDeg: el.alpha_angle_deg,
        maAmplitudeMm: el.ma_amplitude_mm,
        ly30Percent: el.ly30_percent,
      }
    case 'Signatures':
      return {
        requestingPhysician: el.requesting_physician,
        samplingPerson: el.sampling_person || '',
        operator: el.operator,
        reviewer: el.reviewer,
        reportDate: el.report_date,
      }
    default:
      return { reportType: template.report_type }
  }
}

function slotToElement(
  slot: CanvasSlot,
  hospitalName: string,
  reportTitle: string,
  base?: ReportTemplate,
): ReportElement {
  const kind = CANVAS_TO_AST_KIND[slot.type]
  switch (kind) {
    case 'HospitalHeader':
      return {
        kind,
        hospital_name: String(slot.props.hospitalName || hospitalName),
        sub_title: String(slot.props.subTitle || ''),
        report_title: String(slot.props.reportTitle || reportTitle),
        align: (slot.props.align as TextAlign) || 'center',
        logo_data_url: String(slot.props.logoDataUrl || '') || undefined,
        show_report_no: slot.props.showReportNo === true,
        report_no_label: String(slot.props.reportNoLabel || '报告单号'),
        report_no_preview: String(slot.props.reportNoPreview || ''),
      }
    case 'PatientBanner': {
      const fields = Array.isArray(slot.props.fields)
        ? (slot.props.fields as PatientField[])
        : defaultPatientFields()
      return { kind, include_barcode: slot.props.includeBarcode !== false, fields }
    }
    case 'SnakingTable': {
      const existing = base ? findElement(base, 'SnakingTable') : undefined
      const items = Array.isArray(slot.props.items)
        ? (slot.props.items as LabItemRow[])
        : existing?.items ?? []
      return {
        kind,
        columns_count: 2,
        column_gap_mm: Number(slot.props.columnGapMm || 4),
        left_ratio: Number(slot.props.leftRatio || 0.5),
        row_height_mm: Number(slot.props.rowHeightMm || 5.5),
        auto_compaction: slot.props.autoCompaction !== false,
        items,
      }
    }
    case 'TegCurveChart':
      return {
        kind,
        r_time_min: 5.2,
        k_time_min: 1.8,
        alpha_angle_deg: 66.5,
        ma_amplitude_mm: 63.8,
        ly30_percent: 2.1,
      }
    case 'PacsGrid':
      return {
        kind,
        grid_cols: Number(slot.props.gridCols || 2),
        grid_rows: Number(slot.props.gridRows || 1),
        image_urls: [],
        show_scale_ruler: true,
      }
    case 'Signatures':
      return {
        kind,
        requesting_physician: '李主任',
        operator: '王检验师',
        reviewer: '陈主管技师',
        report_date: '2026-09-08 08:30',
      }
    case 'Seal':
      return {
        kind,
        hospital_name: String(slot.props.hospitalName || hospitalName),
        seal_title: String(slot.props.deptName || '检验科防伪专用章'),
        seal_code: 'SEAL-001',
        diameter_mm: 32,
        angle_jitter_deg: 1.5,
        opacity: 0.82,
      }
    case 'NotesFooter':
      return {
        kind,
        text: String(slot.props.text || '注：本报告仅对本次标本负责，如有疑问请于 24 小时内复核。'),
      }
  }
}

function num(patch: Partial<Record<string, unknown>>, key: string, fallback: number): number {
  const value = patch[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function bool(patch: Partial<Record<string, unknown>>, key: string, fallback: boolean): boolean {
  const value = patch[key]
  return typeof value === 'boolean' ? value : fallback
}

function str(patch: Partial<Record<string, unknown>>, key: string, fallback: string): string {
  const value = patch[key]
  return typeof value === 'string' ? value : fallback
}

export function patchMargins(template: ReportTemplate, patch: Partial<MarginsMm>): ReportTemplate {
  return {
    ...template,
    margins: {
      top_mm: patch.top_mm ?? template.margins.top_mm,
      right_mm: patch.right_mm ?? template.margins.right_mm,
      bottom_mm: patch.bottom_mm ?? template.margins.bottom_mm,
      left_mm: patch.left_mm ?? template.margins.left_mm,
    },
  }
}

export function blankLabItem(index: number): LabItemRow {
  return {
    index,
    item_name: '新检验项目',
    item_abbr: 'NEW',
    result_value: '—',
    unit: '',
    ref_range_display: '',
    alert_flag: 'Normal',
    is_critical: false,
  }
}

export function addLabItem(template: ReportTemplate, item?: Partial<LabItemRow>): ReportTemplate {
  return {
    ...template,
    elements: template.elements.map((el) => {
      if (el.kind !== 'SnakingTable') return el
      const next = blankLabItem(el.items.length + 1)
      return { ...el, items: [...el.items, { ...next, ...item, index: next.index }] }
    }),
  }
}

export function removeLabItem(template: ReportTemplate, index: number): ReportTemplate {
  return {
    ...template,
    elements: template.elements.map((el) => {
      if (el.kind !== 'SnakingTable') return el
      return {
        ...el,
        items: el.items.filter((_, i) => i !== index).map((row, i) => ({ ...row, index: i + 1 })),
      }
    }),
  }
}

export function updateLabItem(
  template: ReportTemplate,
  index: number,
  patch: Partial<LabItemRow>,
): ReportTemplate {
  return {
    ...template,
    elements: template.elements.map((el) => {
      if (el.kind !== 'SnakingTable') return el
      return {
        ...el,
        items: el.items.map((row, i) => (i === index ? { ...row, ...patch, index: row.index } : row)),
      }
    }),
  }
}

export function addPatientField(template: ReportTemplate, key: PatientFieldKey): ReportTemplate {
  return {
    ...template,
    elements: template.elements.map((el) => {
      if (el.kind !== 'PatientBanner') return el
      const fields = [...(el.fields && el.fields.length ? el.fields : defaultPatientFields()), catalogField(key)]
      return { ...el, fields }
    }),
  }
}

export function removePatientField(template: ReportTemplate, index: number): ReportTemplate {
  return {
    ...template,
    elements: template.elements.map((el) => {
      if (el.kind !== 'PatientBanner') return el
      const current = el.fields && el.fields.length ? el.fields : defaultPatientFields()
      return { ...el, fields: current.filter((_, i) => i !== index) }
    }),
  }
}

export function movePatientField(template: ReportTemplate, index: number, delta: number): ReportTemplate {
  return {
    ...template,
    elements: template.elements.map((el) => {
      if (el.kind !== 'PatientBanner') return el
      const fields = [...(el.fields && el.fields.length ? el.fields : defaultPatientFields())]
      const to = index + delta
      if (to < 0 || to >= fields.length) return el
      const [item] = fields.splice(index, 1)
      fields.splice(to, 0, item)
      return { ...el, fields }
    }),
  }
}

export function updatePatientField(
  template: ReportTemplate,
  index: number,
  patch: Partial<PatientField>,
): ReportTemplate {
  return {
    ...template,
    elements: template.elements.map((el) => {
      if (el.kind !== 'PatientBanner') return el
      const fields = [...(el.fields && el.fields.length ? el.fields : defaultPatientFields())]
      if (!fields[index]) return el
      fields[index] = { ...fields[index], ...patch }
      return { ...el, fields }
    }),
  }
}

export function patchSlotParams(
  template: ReportTemplate,
  kind: ReportElementKind,
  patch: Partial<Record<string, unknown>>,
): ReportTemplate {
  if (!isReportElementKind(kind)) return template
  return {
    ...template,
    elements: template.elements.map((el) => {
      if (el.kind !== kind) return el
      if (el.kind === 'SnakingTable') {
        const items = Array.isArray(patch.items) ? (patch.items as LabItemRow[]) : el.items
        const leftRatio = Math.min(0.72, Math.max(0.28, num(patch, 'leftRatio', el.left_ratio)))
        return {
          ...el,
          row_height_mm: num(patch, 'rowHeightMm', el.row_height_mm),
          auto_compaction: bool(patch, 'autoCompaction', el.auto_compaction),
          left_ratio: leftRatio,
          column_gap_mm: num(patch, 'columnGapMm', el.column_gap_mm),
          columns_count: 2,
          items,
        }
      }
      if (el.kind === 'HospitalHeader') {
        const align = patch.align
        return {
          ...el,
          hospital_name: str(patch, 'hospitalName', el.hospital_name),
          report_title: str(patch, 'reportTitle', el.report_title),
          sub_title: str(patch, 'subTitle', el.sub_title),
          align: align === 'left' || align === 'right' || align === 'center' ? align : el.align || 'center',
          logo_data_url: patch.logoDataUrl === '' ? undefined : str(patch, 'logoDataUrl', el.logo_data_url || ''),
          show_report_no: bool(patch, 'showReportNo', !!el.show_report_no),
          report_no_label: str(patch, 'reportNoLabel', el.report_no_label || '报告单号'),
          report_no_preview: str(patch, 'reportNoPreview', el.report_no_preview || ''),
        }
      }
      if (el.kind === 'PatientBanner') {
        const fields = Array.isArray(patch.fields) ? (patch.fields as PatientField[]) : el.fields
        return {
          ...el,
          include_barcode: bool(patch, 'includeBarcode', el.include_barcode),
          fields: fields && fields.length > 0 ? fields : defaultPatientFields(),
        }
      }
      if (el.kind === 'Seal') {
        return {
          ...el,
          hospital_name: str(patch, 'hospitalName', el.hospital_name),
          seal_title: str(patch, 'deptName', el.seal_title),
          diameter_mm: num(patch, 'diameterMm', el.diameter_mm),
          opacity: num(patch, 'opacity', el.opacity),
        }
      }
      if (el.kind === 'NotesFooter') {
        return { ...el, text: str(patch, 'text', el.text) }
      }
      if (el.kind === 'PacsGrid') {
        return {
          ...el,
          grid_cols: num(patch, 'gridCols', el.grid_cols),
          grid_rows: num(patch, 'gridRows', el.grid_rows),
          show_scale_ruler: bool(patch, 'showScaleRuler', el.show_scale_ruler),
        }
      }
      if (el.kind === 'TegCurveChart') {
        return {
          ...el,
          r_time_min: num(patch, 'rTimeMin', el.r_time_min),
          k_time_min: num(patch, 'kTimeMin', el.k_time_min),
          alpha_angle_deg: num(patch, 'alphaAngleDeg', el.alpha_angle_deg),
          ma_amplitude_mm: num(patch, 'maAmplitudeMm', el.ma_amplitude_mm),
          ly30_percent: num(patch, 'ly30Percent', el.ly30_percent),
        }
      }
      if (el.kind === 'Signatures') {
        return {
          ...el,
          requesting_physician: str(patch, 'requestingPhysician', el.requesting_physician),
          sampling_person: str(patch, 'samplingPerson', el.sampling_person || ''),
          operator: str(patch, 'operator', el.operator),
          reviewer: str(patch, 'reviewer', el.reviewer),
          report_date: str(patch, 'reportDate', el.report_date),
        }
      }
      return el
    }),
  }
}
