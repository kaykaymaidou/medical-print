import {
  defaultLocalBaseUrl,
  EXTERNAL_DEEPSEEK_BASE,
  LOCAL_OPENAI_BASE,
  type ProviderMode,
  type VisionMode,
} from '../../../ai-agent/src/provider'

export type { ProviderMode, VisionMode }

export interface ModelProviderSettings {
  mode: ProviderMode
  baseUrl: string
  apiKey: string
  model: string
  vision: VisionMode
}

export const MODEL_SETTINGS_KEY = 'medprint_model_provider'

export function defaultModelSettings(): ModelProviderSettings {
  return {
    mode: 'local',
    baseUrl: defaultLocalBaseUrl(),
    apiKey: '',
    model: '',
    vision: 'auto',
  }
}

export function loadModelSettings(): ModelProviderSettings {
  const defaults = defaultModelSettings()
  try {
    const raw = localStorage.getItem(MODEL_SETTINGS_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<ModelProviderSettings>
    return {
      mode: parsed.mode === 'external' ? 'external' : 'local',
      baseUrl: String(parsed.baseUrl || defaults.baseUrl),
      apiKey: String(parsed.apiKey || ''),
      model: String(parsed.model || ''),
      vision: parsed.vision === 'on' || parsed.vision === 'off' ? parsed.vision : 'auto',
    }
  } catch {
    return defaults
  }
}

export function saveModelSettings(settings: ModelProviderSettings): void {
  localStorage.setItem(MODEL_SETTINGS_KEY, JSON.stringify(settings))
}

export type ProviderStatusKind = 'unconfigured' | 'local' | 'external'

export function providerStatus(settings: ModelProviderSettings): ProviderStatusKind {
  if (!settings.model.trim() || !settings.baseUrl.trim()) return 'unconfigured'
  return settings.mode === 'local' ? 'local' : 'external'
}

export function providerStatusLabel(settings: ModelProviderSettings): string {
  switch (providerStatus(settings)) {
    case 'unconfigured':
      return '未配置'
    case 'local':
      return '本地就绪'
    case 'external':
      return '外部已连接'
  }
}

export function applyModeDefaults(settings: ModelProviderSettings, mode: ProviderMode): ModelProviderSettings {
  const next = { ...settings, mode }
  if (mode === 'local') {
    if (!next.baseUrl || next.baseUrl === EXTERNAL_DEEPSEEK_BASE) {
      next.baseUrl = defaultLocalBaseUrl()
    }
  } else if (!next.baseUrl || next.baseUrl === LOCAL_OPENAI_BASE || next.baseUrl === defaultLocalBaseUrl()) {
    next.baseUrl = EXTERNAL_DEEPSEEK_BASE
  }
  return next
}
