export type ProviderMode = 'local' | 'external'
export type VisionMode = 'auto' | 'on' | 'off'

export interface ModelProviderConfig {
  mode?: ProviderMode
  apiKey?: string
  baseURL?: string
  model?: string
  vision?: VisionMode
}

export const LOCAL_OPENAI_BASE = 'http://127.0.0.1:11434/v1'
export const LOCAL_DEV_PROXY_BASE = '/ollama/v1'
export const EXTERNAL_DEEPSEEK_BASE = 'https://api.deepseek.com/v1'

const VISION_MODEL_RE =
  /llava|vision|gpt-4o|gpt-4\.1|gpt-5|gemini|qwen[-._]?vl|qwen2[-.]?5?[-.]?vl|qwen2-vl|minicpm-v|moondream|phi-4-multimodal|claude-3|glm-4v|internvl|pixtral|mistral-small.*vision/i

export function envVar(name: string): string {
  try {
    const g = globalThis as { process?: { env?: Record<string, string | undefined> } }
    return g.process?.env?.[name] || ''
  } catch {
    return ''
  }
}

export function normalizeBaseUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, '')
  if (!u) return u
  if (/\/chat\/completions$/i.test(u)) {
    return u.replace(/\/chat\/completions$/i, '')
  }
  if (!/\/v\d+$/i.test(u)) u += '/v1'
  return u
}

export function modelSupportsVision(model: string, vision: VisionMode = 'auto'): boolean {
  if (vision === 'on') return true
  if (vision === 'off') return false
  return VISION_MODEL_RE.test(model.trim())
}

export function defaultLocalBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') return LOCAL_DEV_PROXY_BASE
  }
  return LOCAL_OPENAI_BASE
}
