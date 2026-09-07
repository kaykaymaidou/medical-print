<template>
  <label class="apple-switch">
    <input type="checkbox" :checked="modelValue" @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)" />
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
  font-size: 13px;
  color: #1d1d1f;
  font-weight: 450;
}
.apple-switch input {
  display: none;
}
.slider {
  position: relative;
  width: 38px;
  height: 22px;
  background-color: #e5e5ea;
  border-radius: 9999px;
  transition: background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.slider::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background-color: white;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15), 0 1px 1px rgba(0, 0, 0, 0.05);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
input:checked + .slider {
  background-color: #34c759; /* Apple Green */
}
input:checked + .slider::after {
  transform: translateX(16px);
}
.switch-label {
  font-size: 13px;
  letter-spacing: -0.2px;
}
</style>
