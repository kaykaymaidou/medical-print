<template>
  <div class="apple-app-shell">
    <header class="apple-nav-header">
      <div class="header-section left">
        <div class="macos-traffic-lights" aria-hidden="true">
          <span class="light red"></span>
          <span class="light yellow"></span>
          <span class="light green"></span>
        </div>
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect width="18" height="18" rx="5" fill="#0071e3" />
              <path d="M8.15 3.4h1.7v11.2h-1.7V3.4ZM3.4 8.15h11.2v1.7H3.4V8.15Z" fill="white" />
            </svg>
          </span>
          <span class="brand-title">MedPrint</span>
          <span class="brand-subtitle">Studio</span>
        </div>
      </div>

      <div class="header-section center">
        <div class="apple-segmented" :data-view="currentView">
          <span class="seg-thumb" aria-hidden="true"></span>
          <button
            type="button"
            :class="['seg-item', { active: currentView === 'wizard' }]"
            @click="currentView = 'wizard'"
          >
            临床向导
          </button>
          <button
            type="button"
            :class="['seg-item', { active: currentView === 'canvas' }]"
            @click="currentView = 'canvas'"
          >
            AST 审查
          </button>
        </div>
      </div>

      <div class="header-section right">
        <div class="agent-status-tag">
          <span class="status-dot"></span>
          <span>Spooler 就绪</span>
        </div>
      </div>
    </header>

    <div class="apple-main-viewport">
      <Transition name="apple-view" mode="out-in">
        <DoctorWizard
          v-if="currentView === 'wizard'"
          key="wizard"
          @switch-to-canvas="currentView = 'canvas'"
        />
        <ProCanvas
          v-else
          key="canvas"
          @switch-view="currentView = $event"
        />
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import DoctorWizard from './views/DoctorWizard.vue'
import ProCanvas from './views/ProCanvas.vue'

const currentView = ref<'wizard' | 'canvas'>('wizard')
</script>

<style scoped>
.apple-app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--fill);
}

.apple-nav-header {
  height: 52px;
  flex-shrink: 0;
  background: var(--glass);
  backdrop-filter: saturate(180%) blur(22px);
  -webkit-backdrop-filter: saturate(180%) blur(22px);
  border-bottom: 1px solid var(--separator);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  position: relative;
  z-index: 50;
}
.apple-nav-header::after {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.85), transparent);
  pointer-events: none;
}

.header-section {
  display: flex;
  align-items: center;
  min-width: 0;
}
.header-section.center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}
.header-section.right {
  margin-left: auto;
}

.macos-traffic-lights {
  display: flex;
  gap: 7px;
  margin-right: 14px;
}
.light {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.12);
}
.light.red { background: #ff5f57; }
.light.yellow { background: #febc2e; }
.light.green { background: #28c840; }

.brand {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.brand-mark {
  display: inline-flex;
  align-self: center;
  filter: drop-shadow(0 1px 1px rgba(0, 113, 227, 0.28));
}
.brand-title {
  font-size: 14px;
  font-weight: 650;
  color: var(--label);
  letter-spacing: -0.32px;
}
.brand-subtitle {
  font-size: 12px;
  font-weight: 500;
  color: var(--label-tertiary);
  letter-spacing: -0.2px;
}

.apple-segmented {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: var(--fill-control);
  padding: 3px;
  border-radius: var(--radius-pill);
  min-width: 228px;
}
.seg-thumb {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc(50% - 3px);
  background: #fff;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-thumb);
  transition: transform var(--duration) var(--spring);
  pointer-events: none;
}
.apple-segmented[data-view="canvas"] .seg-thumb {
  transform: translateX(100%);
}
.seg-item {
  position: relative;
  z-index: 1;
  background: transparent;
  border: none;
  padding: 6px 18px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 500;
  color: var(--label-secondary);
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-out);
}
.seg-item.active {
  color: var(--label);
  font-weight: 600;
}

.agent-status-tag {
  display: flex;
  align-items: center;
  gap: 7px;
  background: var(--green-soft);
  color: #1f7a36;
  font-size: 11.5px;
  font-weight: 550;
  padding: 5px 11px;
  border-radius: var(--radius-pill);
}
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 0 3px rgba(52, 199, 89, 0.18);
  animation: apple-pulse 2.4s var(--ease-in-out) infinite;
}

.apple-main-viewport {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}
.apple-main-viewport :deep(.apple-workspace),
.apple-main-viewport :deep(.pro-canvas-container) {
  height: 100%;
}
</style>
