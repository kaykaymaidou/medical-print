<template>
  <div class="provider-settings">
    <button type="button" class="disclosure" @click="open = !open">
      <span>模型连接</span>
      <span class="hint">{{ modeHint }}</span>
      <span class="chevron" :class="{ open }">‹</span>
    </button>
    <div v-if="open" class="panel">
      <div class="mode-row" role="radiogroup" aria-label="模型来源">
        <button
          type="button"
          :class="['mode-btn', { active: modelValue.mode === 'local' }]"
          @click="setMode('local')"
        >
          本地
        </button>
        <button
          type="button"
          :class="['mode-btn', { active: modelValue.mode === 'external' }]"
          @click="setMode('external')"
        >
          外部
        </button>
      </div>

      <label class="field">
        <span>Base URL</span>
        <input
          :value="modelValue.baseUrl"
          type="url"
          autocomplete="off"
          :placeholder="modelValue.mode === 'local' ? 'http://127.0.0.1:11434/v1 或 /ollama/v1' : 'https://api.deepseek.com/v1'"
          @input="patch({ baseUrl: ($event.target as HTMLInputElement).value })"
        />
      </label>

      <label class="field">
        <span>模型名</span>
        <input
          :value="modelValue.model"
          type="text"
          autocomplete="off"
          :placeholder="modelValue.mode === 'local' ? 'qwen2.5 / llava' : 'deepseek-chat / gpt-4o-mini'"
          @input="patch({ model: ($event.target as HTMLInputElement).value })"
        />
      </label>

      <label class="field">
        <span>API Key{{ modelValue.mode === 'local' ? '（可选）' : '' }}</span>
        <input
          :value="modelValue.apiKey"
          type="password"
          autocomplete="off"
          :placeholder="modelValue.mode === 'local' ? '本地通常留空' : 'sk-… 仅存本机'"
          @input="patch({ apiKey: ($event.target as HTMLInputElement).value })"
        />
      </label>

      <label class="field">
        <span>识图</span>
        <select
          :value="modelValue.vision"
          @change="patch({ vision: ($event.target as HTMLSelectElement).value as ModelProviderSettings['vision'] })"
        >
          <option value="auto">自动（按模型名）</option>
          <option value="on">强制开启</option>
          <option value="off">关闭</option>
        </select>
      </label>

      <p class="footnote">
        密钥只写在本机 localStorage，不会进仓库。本地开发可用 <code>/ollama/v1</code> 避开 CORS。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  applyModeDefaults,
  type ModelProviderSettings,
  type ProviderMode,
} from '../../domain/modelSettings'

const props = defineProps<{
  modelValue: ModelProviderSettings
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: ModelProviderSettings): void
}>()

const open = ref(false)

const modeHint = computed(() => {
  if (!props.modelValue.model.trim()) return '填写模型名后即可调用'
  return props.modelValue.mode === 'local' ? props.modelValue.model : props.modelValue.model
})

function patch(partial: Partial<ModelProviderSettings>) {
  emit('update:modelValue', { ...props.modelValue, ...partial })
}

function setMode(mode: ProviderMode) {
  emit('update:modelValue', applyModeDefaults(props.modelValue, mode))
}
</script>

<style scoped>
.provider-settings {
  margin: 0 0 10px;
}
.disclosure {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(0, 113, 227, 0.1);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  cursor: pointer;
  color: var(--label);
}
.disclosure span:first-child {
  font-size: 11.5px;
  font-weight: 600;
}
.hint {
  flex: 1;
  text-align: right;
  font-size: 11px;
  color: var(--label-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chevron {
  display: inline-block;
  transform: rotate(-90deg);
  color: var(--label-tertiary);
  transition: transform var(--duration-fast) var(--ease-out);
  font-size: 14px;
  line-height: 1;
}
.chevron.open {
  transform: rotate(-180deg);
}
.panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.72);
  border-radius: var(--radius);
  border: 1px solid rgba(0, 0, 0, 0.04);
}
.mode-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  background: var(--fill-grouped);
  padding: 3px;
  border-radius: var(--radius-sm);
}
.mode-btn {
  border: none;
  background: transparent;
  padding: 6px 0;
  border-radius: var(--radius-xs);
  font-size: 12px;
  color: var(--label-secondary);
  cursor: pointer;
}
.mode-btn.active {
  background: #fff;
  color: var(--label);
  font-weight: 600;
  box-shadow: var(--shadow-thumb);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--label-tertiary);
  font-weight: 600;
}
.field input,
.field select {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--separator-opaque);
  border-radius: var(--radius-xs);
  font-size: 12.5px;
  font-weight: 500;
  color: var(--label);
  background: var(--fill-grouped);
  outline: none;
}
.field input:focus,
.field select:focus {
  border-color: var(--blue);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.16);
}
.footnote {
  margin: 0;
  font-size: 10.5px;
  font-weight: 500;
  color: var(--label-tertiary);
  line-height: 1.45;
}
.footnote code {
  font-size: 10px;
  background: var(--fill-grouped);
  padding: 1px 4px;
  border-radius: 4px;
}
</style>
