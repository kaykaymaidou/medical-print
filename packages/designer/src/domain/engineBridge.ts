import type { ReportTemplate } from './reportAst'
import { layoutSlotFrames, type SlotLayoutResult } from './slotLayout'

type WasmLayoutFn = (json: string) => string

let wasmLayout: WasmLayoutFn | null = null
let wasmTried = false

export function layoutEngineSource(): 'wasm' | 'core-ts' {
  return wasmLayout ? 'wasm' : 'core-ts'
}

/** Load medprint-wasm when the package has been built into src/wasm. */
export async function initLayoutEngine(): Promise<void> {
  if (wasmTried) return
  wasmTried = true
  try {
    const mod = await import('../wasm/medprint_wasm.js')
    const init = (mod as { default: () => Promise<unknown> }).default
    await init()
    const fn = (mod as { layout_slot_frames?: WasmLayoutFn }).layout_slot_frames
    if (typeof fn === 'function') wasmLayout = fn
  } catch {
    wasmLayout = null
  }
}

export function layoutTemplateFrames(template: ReportTemplate): SlotLayoutResult {
  if (wasmLayout) {
    try {
      return JSON.parse(wasmLayout(JSON.stringify(template))) as SlotLayoutResult
    } catch {
      // fall through to TS port of the same algorithm
    }
  }
  return layoutSlotFrames(template)
}

const SERVER_BASE = typeof window !== 'undefined' && window.location.port === '19800'
  ? window.location.origin
  : 'http://localhost:19800'

/** 调用 medprint-server 纯矢量 Rust 内核实时编译 300/600 DPI 医疗级 PDF */
export async function compileVectorPdfRemote(template: ReportTemplate): Promise<Blob> {
  const resp = await fetch(`${SERVER_BASE}/api/v1/render/compile_pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template),
  })
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`Compile PDF failed with HTTP ${resp.status}: ${errText}`)
  }
  return await resp.blob()
}

/** 保存模板到医院内网本地档案库 (./data/templates/) */
export async function saveTemplateToArchive(template: ReportTemplate): Promise<{ status: string; id: string }> {
  const resp = await fetch(`${SERVER_BASE}/api/v1/storage/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template),
  })
  if (!resp.ok) {
    throw new Error(`Save template failed with HTTP ${resp.status}`)
  }
  return await resp.json()
}

/** 获取医院内网已保存的医疗模板列表 */
export async function fetchArchiveTemplates(): Promise<ReportTemplate[]> {
  const resp = await fetch(`${SERVER_BASE}/api/v1/storage/templates`)
  if (!resp.ok) {
    throw new Error(`Fetch templates failed with HTTP ${resp.status}`)
  }
  return await resp.json()
}

/** 从医院内网归档库删除模板 */
export async function deleteArchiveTemplate(id: string): Promise<boolean> {
  const resp = await fetch(`${SERVER_BASE}/api/v1/storage/templates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!resp.ok) {
    throw new Error(`Delete template failed with HTTP ${resp.status}`)
  }
  const data = await resp.json()
  return data.found === true
}

