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
