<template>
  <label class="apple-switch">
    <input
      type="checkbox"
      :checked="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="slider"></span>
    <span v-if="label" class="switch-label">{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean
  label?: string
}>()

defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()
</script>

<style scoped>
.apple-switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  color: var(--label);
}
.apple-switch input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.slider {
  position: relative;
  width: 40px;
  height: 24px;
  flex-shrink: 0;
  background-color: #e5e5ea;
  border-radius: var(--radius-pill);
  transition: background-color var(--duration) var(--spring);
}
.slider::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background-color: white;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18), 0 1px 1px rgba(0, 0, 0, 0.06);
  transition: transform var(--duration) var(--spring);
}
.apple-switch:active .slider::after {
  width: 22px;
}
input:checked + .slider {
  background-color: var(--green);
}
input:checked + .slider::after {
  transform: translateX(16px);
}
input:checked + .slider + .switch-label {
  color: var(--label);
}
.switch-label {
  font-size: 13px;
  letter-spacing: -0.2px;
  line-height: 1.3;
}
</style>
