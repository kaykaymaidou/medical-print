/** Integer-micrometer slot layout. Must stay in lockstep with crates/medprint-core/src/layout/slot_frames.rs */

import type { ReportElementKind, ReportTemplate } from './reportAst'

const GAP_UM = 1_000
const HEADER_H_UM = 14_000
const BANNER_H_UM = 10_000
const TEG_H_UM = 36_000
const NOTES_H_UM = 7_000
const SIG_H_UM = 12_000
const SIG_W_UM = 140_000
const SNAKING_HEADER_UM = 6_500
const SNAKING_ROW_DEFAULT_UM = 5_500
const SNAKING_EMPTY_H_UM = 40_000

const FLOW_ORDER: ReportElementKind[] = [
  'HospitalHeader',
  'PatientBanner',
  'TegCurveChart',
  'PacsGrid',
  'SnakingTable',
]

const FOOTER_ORDER: ReportElementKind[] = ['NotesFooter', 'Signatures']

export const CANONICAL_SLOT_ORDER: ReportElementKind[] = [
  ...FLOW_ORDER,
  'NotesFooter',
  'Signatures',
  'Seal',
]

export interface SlotFrame {
  element_index: number
  kind: string
  x_mm: number
  y_mm: number
  width_mm: number
  height_mm: number
  page: number
  overlay: boolean
  keep_with_next: boolean
}

export interface SlotLayoutResult {
  frames: SlotFrame[]
  page_count: number
  compacted_row_height_mm: number | null
  unique_kind_errors: string[]
}

interface Spec {
  index: number
  kind: ReportElementKind
  rowHeightUm: number
  autoCompaction: boolean
  itemCount: number
  diameterUm: number
  gridCols: number
  gridRows: number
}

function fromMm(mm: number): number {
  return Math.round(mm * 1000)
}

function asMm(um: number): number {
  return um / 1000
}

function keepWithNext(kind: ReportElementKind): boolean {
  return kind === 'Signatures' || kind === 'Seal' || kind === 'NotesFooter'
}

export function layoutSlotFrames(template: ReportTemplate): SlotLayoutResult {
  const specs: Spec[] = []
  const seen = new Set<ReportElementKind>()
  const unique_kind_errors: string[] = []

  template.elements.forEach((el, index) => {
    if (seen.has(el.kind)) {
      unique_kind_errors.push(`槽位 ${el.kind} 重复，已忽略后续实例。每类 ReportElement 只能出现一次`)
      return
    }
    seen.add(el.kind)
    specs.push(specFromElement(el, index))
  })

  const left = fromMm(template.margins.left_mm)
  const right = fromMm(template.margins.right_mm)
  const top = fromMm(template.margins.top_mm)
  const bottomM = fromMm(template.margins.bottom_mm)
  const paperW = fromMm(template.paper_size.width_mm)
  const paperH = fromMm(template.paper_size.height_mm)
  const flowW = Math.max(0, paperW - left - right)
  const contentBottom = Math.max(0, paperH - bottomM)

  const byKind = (kind: ReportElementKind) => specs.find((s) => s.kind === kind)
  const footer = FOOTER_ORDER.map(byKind).filter((s): s is Spec => !!s)
  const flow = FLOW_ORDER.map(byKind).filter((s): s is Spec => !!s)
  const seal = byKind('Seal')

  const footerH = footerStackHeight(footer)
  const flowGaps = flow.length > 1 ? GAP_UM * (flow.length - 1) : 0
  const gapBeforeFooter = flow.length === 0 || footer.length === 0 ? 0 : GAP_UM
  const flexKind: ReportElementKind | null = flow.some((s) => s.kind === 'SnakingTable')
    ? 'SnakingTable'
    : flow.some((s) => s.kind === 'PacsGrid')
      ? 'PacsGrid'
      : null

  let fixedFlowH = 0
  for (const spec of flow) {
    if (spec.kind === flexKind) continue
    fixedFlowH += intrinsicHeight(spec, flowW)
  }
  const remaining = Math.max(
    0,
    contentBottom - (top + fixedFlowH + flowGaps + gapBeforeFooter + footerH),
  )

  let compacted_row_height_mm: number | null = null
  let page_count = 1
  let snakingH = remaining
  const table = flow.find((s) => s.kind === 'SnakingTable')
  if (table) {
    const computed = snakingFrameHeight(table, remaining)
    snakingH = Math.min(computed.heightUm, Math.max(remaining, 1))
    page_count = Math.max(computed.pages, 1)
    compacted_row_height_mm = computed.rowMm
  }

  const frames: SlotFrame[] = []
  let cursor = top
  for (const spec of flow) {
    let h: number
    if (spec.kind === flexKind) {
      h = spec.kind === 'SnakingTable' ? snakingH : Math.max(remaining, intrinsicHeight(spec, flowW))
    } else {
      h = intrinsicHeight(spec, flowW)
    }
    frames.push(toFrame(spec, left, cursor, flowW, h, 1))
    cursor += h + GAP_UM
  }

  if (page_count === 1) {
    let footerCursor = cursor
    if (flow.length && footer.length && footerCursor + footerH > contentBottom) {
      footerCursor = Math.max(0, contentBottom - footerH)
    }
    for (const spec of footer) {
      const h = footerHeight(spec.kind)
      const w = spec.kind === 'Signatures' ? Math.min(SIG_W_UM, flowW) : flowW
      frames.push(toFrame(spec, left, footerCursor, w, h, 1))
      footerCursor += h + GAP_UM
    }
  } else {
    let footerCursor = top
    for (const spec of footer) {
      const h = footerHeight(spec.kind)
      const w = spec.kind === 'Signatures' ? Math.min(SIG_W_UM, flowW) : flowW
      frames.push(toFrame(spec, left, footerCursor, w, h, page_count))
      footerCursor += h + GAP_UM
    }
  }

  if (seal) {
    const d = Math.max(seal.diameterUm, 24_000)
    const sig = frames.find((f) => f.kind === 'Signatures')
    let x = Math.max(0, paperW - right - d)
    let y = Math.max(0, contentBottom - d)
    let page = page_count
    if (sig) {
      const sigY = fromMm(sig.y_mm)
      const sigH = fromMm(sig.height_mm)
      y = sigY + Math.max(0, sigH - Math.floor((d * 70) / 100))
      page = sig.page
    }
    frames.push(toFrame(seal, x, y, d, d, page))
  }

  return { frames, page_count, compacted_row_height_mm, unique_kind_errors }
}

function specFromElement(el: ReportTemplate['elements'][number], index: number): Spec {
  return {
    index,
    kind: el.kind,
    rowHeightUm: fromMm(el.kind === 'SnakingTable' ? el.row_height_mm : 5.5),
    autoCompaction: el.kind === 'SnakingTable' ? el.auto_compaction : true,
    itemCount: el.kind === 'SnakingTable' ? el.items.length : 0,
    diameterUm: fromMm(el.kind === 'Seal' ? el.diameter_mm : 32),
    gridCols: el.kind === 'PacsGrid' ? el.grid_cols : 2,
    gridRows: el.kind === 'PacsGrid' ? el.grid_rows : 1,
  }
}

function footerHeight(kind: ReportElementKind): number {
  if (kind === 'NotesFooter') return NOTES_H_UM
  if (kind === 'Signatures') return SIG_H_UM
  return 0
}

function footerStackHeight(footer: Spec[]): number {
  if (!footer.length) return 0
  let h = footer.reduce((sum, spec) => sum + footerHeight(spec.kind), 0)
  if (footer.length > 1) h += GAP_UM * (footer.length - 1)
  return h
}

function intrinsicHeight(spec: Spec, flowW: number): number {
  switch (spec.kind) {
    case 'HospitalHeader':
      return HEADER_H_UM
    case 'PatientBanner':
      return BANNER_H_UM
    case 'TegCurveChart':
      return TEG_H_UM
    case 'PacsGrid':
      return pacsHeight(Math.max(spec.gridCols, 1), Math.max(spec.gridRows, 1), flowW)
    case 'SnakingTable':
      return SNAKING_EMPTY_H_UM
    case 'NotesFooter':
      return NOTES_H_UM
    case 'Signatures':
      return SIG_H_UM
    case 'Seal':
      return Math.max(spec.diameterUm, 24_000)
  }
}

function pacsHeight(cols: number, rows: number, flowW: number): number {
  const cellW = Math.floor(flowW / Math.max(cols, 1))
  const cellH = Math.floor((cellW * 3) / 4)
  return Math.min(90_000, Math.max(36_000, cellH * rows + 4_000))
}

function snakingFrameHeight(spec: Spec, available: number): { heightUm: number; pages: number; rowMm: number } {
  const avail = Math.max(available, 1)
  let rowH = spec.rowHeightUm || SNAKING_ROW_DEFAULT_UM
  const header = SNAKING_HEADER_UM
  if (spec.itemCount === 0) {
    return { heightUm: Math.min(SNAKING_EMPTY_H_UM, avail), pages: 1, rowMm: asMm(rowH) }
  }
  const body = Math.max(0, avail - header)
  let maxRows = Math.floor(body / rowH)
  if (spec.autoCompaction && maxRows > 0) {
    const twoCol = maxRows * 2
    if (spec.itemCount > twoCol && spec.itemCount <= twoCol + 4) {
      const needed = Math.ceil(spec.itemCount / 2)
      const compacted = Math.floor(body / needed)
      if (compacted >= Math.floor((rowH * 80) / 100)) {
        rowH = compacted
        maxRows = needed
      }
    }
  }
  if (maxRows <= 0) {
    return { heightUm: avail, pages: 2, rowMm: asMm(rowH) }
  }
  const perPage = maxRows * 2
  const pages = Math.max(1, Math.ceil(spec.itemCount / perPage))
  const page1Count = Math.min(spec.itemCount, perPage)
  const col0 = Math.min(maxRows, page1Count)
  const col1 = Math.min(maxRows, Math.max(0, page1Count - maxRows))
  const rows = Math.max(col0, col1)
  return { heightUm: Math.max(1, header + rows * rowH), pages, rowMm: asMm(rowH) }
}

function toFrame(spec: Spec, x: number, y: number, w: number, h: number, page: number): SlotFrame {
  return {
    element_index: spec.index,
    kind: spec.kind,
    x_mm: asMm(x),
    y_mm: asMm(y),
    width_mm: asMm(w),
    height_mm: asMm(h),
    page,
    overlay: spec.kind === 'Seal',
    keep_with_next: keepWithNext(spec.kind),
  }
}
