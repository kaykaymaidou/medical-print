<template>
  <div class="apple-app-shell">
    <!-- macOS 质感顶部毛玻璃导航条 -->
    <header class="apple-nav-header">
      <div class="header-section left">
        <div class="macos-traffic-lights">
          <span class="light red"></span>
          <span class="light yellow"></span>
          <span class="light green"></span>
        </div>
        <div class="brand">
          <span class="brand-icon">🏥</span>
          <span class="brand-title">MedPrint Studio</span>
          <span class="brand-badge">v0.1.0</span>
        </div>
      </div>

      <div class="header-section center">
        <div class="apple-segmented-pill">
          <button
            :class="['pill-item', { active: currentView === 'wizard' }]"
            @click="currentView = 'wizard'"
          >
            🩺 医生快速向导
          </button>
          <button
            :class="['pill-item', { active: currentView === 'canvas' }]"
            @click="currentView = 'canvas'"
          >
            🛠️ 极客自由画布
          </button>
        </div>
      </div>

      <div class="header-section right">
        <div class="agent-status-tag">
          <span class="status-dot"></span>
          <span>Agent 本地服务就绪 (Spooler 联机)</span>
        </div>
      </div>
    </header>

    <!-- 工作台视口 -->
    <div class="apple-main-viewport">
      <DoctorWizard
        v-if="currentView === 'wizard'"
        @switch-to-canvas="currentView = 'canvas'"
      />
      
      <!-- 极客自由画布 -->
      <ProCanvas
        v-else
        @switch-view="currentView = $event"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import DoctorWizard from './views/DoctorWizard.vue'
import ProCanvas from './views/ProCanvas.vue'

const currentView = ref<'wizard' | 'canvas'>('wizard')
</script>

<style>
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  padding: 0;
  background-color: #f5f5f7;
  -webkit-font-smoothing: antialiased;
}
</style>

<style scoped>
.apple-app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", Arial, sans-serif;
}

/* macOS 风格顶部毛玻璃导航条 */
.apple-nav-header {
  height: 52px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  position: relative;
  z-index: 50;
}
.header-section {
  display: flex;
  align-items: center;
}
.macos-traffic-lights {
  display: flex;
  gap: 7px;
  margin-right: 16px;
}
.light {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
}
.light.red { background: #ff5f56; box-shadow: 0 0 0 1px rgba(0,0,0,0.08); }
.light.yellow { background: #ffbd2e; box-shadow: 0 0 0 1px rgba(0,0,0,0.08); }
.light.green { background: #27c93f; box-shadow: 0 0 0 1px rgba(0,0,0,0.08); }

.brand {
  display: flex;
  align-items: center;
  gap: 6px;
}
.brand-icon { font-size: 18px; }
.brand-title {
  font-size: 14px;
  font-weight: 600;
  color: #1d1d1f;
  letter-spacing: -0.3px;
}
.brand-badge {
  background: #f2f2f7;
  color: #86868b;
  font-size: 10px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
}

/* Apple 胶囊分段控制 */
.apple-segmented-pill {
  display: flex;
  background: #ebebeb;
  padding: 3px;
  border-radius: 9999px;
  gap: 2px;
}
.pill-item {
  background: transparent;
  border: none;
  padding: 5px 18px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  color: #636366;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.pill-item.active {
  background: white;
  color: #1d1d1f;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.agent-status-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #eafaf1;
  color: #248a3d;
  font-size: 11.5px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 9999px;
  border: 1px solid rgba(36, 138, 61, 0.2);
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34c759;
  box-shadow: 0 0 6px #34c759;
}

.apple-main-viewport {
  flex: 1;
  overflow: hidden;
}

.pro-canvas-wrapper {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f7;
}
.pro-canvas-card {
  background: white;
  border-radius: 16px;
  padding: 48px;
  max-width: 580px;
  text-align: center;
  box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04);
}
.card-icon { font-size: 40px; margin-bottom: 12px; }
.pro-canvas-card h2 {
  margin: 0 0 10px;
  font-size: 20px;
  font-weight: 600;
  color: #1d1d1f;
}
.card-desc {
  font-size: 13px;
  color: #86868b;
  line-height: 1.6;
  margin: 0 0 20px;
}
.info-pill {
  background: #f2f2f7;
  color: #1d1d1f;
  display: inline-block;
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 9999px;
  margin-bottom: 24px;
}
.btn-return-wizard {
  background: #0071e3;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-return-wizard:hover { background: #0077ed; }
</style>
