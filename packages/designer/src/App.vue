<template>
  <div class="app-root">
    <!-- 顶部极简导航：临床双轨制切换 -->
    <header class="app-header">
      <div class="brand">
        <span class="logo">🏥</span>
        <span class="title">MedPrint 医疗报告单设计器</span>
        <span class="version-tag">v0.1.0</span>
      </div>
      <div class="mode-tabs">
        <button
          :class="['tab-btn', { active: currentView === 'wizard' }]"
          @click="currentView = 'wizard'"
        >
          🩺 医生快速向导模式 (零门槛)
        </button>
        <button
          :class="['tab-btn', { active: currentView === 'canvas' }]"
          @click="currentView = 'canvas'"
        >
          🛠️ 信息科极客画布模式 (毫米级自由拖拽)
        </button>
      </div>
      <div class="header-right">
        <span class="status-indicator online">● 本地 Agent 已联机 (Spooler 就绪)</span>
      </div>
    </header>

    <!-- 主工作区 -->
    <main class="app-main">
      <DoctorWizard v-if="currentView === 'wizard'" />
      <div v-else class="canvas-placeholder">
        <div class="pro-panel">
          <h2>🛠️ 信息科极客自由画布</h2>
          <p>支持微米级坐标吸附、表达式脚本编写、印章正片叠底与自定义驱动指令 (ESC/P2 针式连续纸走纸穿孔线设置)。</p>
          <div class="ruler-banner">当前画布基准单位：<strong>绝对物理毫米 (mm)</strong> | 坐标：(0.00mm, 0.00mm)</div>
          <button class="btn btn-switch" @click="currentView = 'wizard'">返回医生快速向导</button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import DoctorWizard from './views/DoctorWizard.vue'

const currentView = ref<'wizard' | 'canvas'>('wizard')
</script>

<style>
* { box-sizing: border-box; }
body { margin: 0; padding: 0; }
</style>

<style scoped>
.app-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.app-header {
  height: 48px;
  background: #0f172a;
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.logo { font-size: 20px; }
.title { font-weight: 700; font-size: 15px; letter-spacing: 0.5px; }
.version-tag {
  background: #0284c7;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
}
.mode-tabs {
  display: flex;
  gap: 8px;
}
.tab-btn {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  color: #cbd5e1;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.tab-btn.active {
  background: #0284c7;
  color: white;
  border-color: #38bdf8;
  font-weight: 600;
}
.header-right {
  font-size: 12px;
}
.status-indicator.online {
  color: #4ade80;
}
.app-main {
  flex: 1;
  overflow: hidden;
}
.canvas-placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
}
.pro-panel {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 40px;
  max-width: 600px;
  text-align: center;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
}
.pro-panel h2 { color: #0284c7; margin-top: 0; }
.ruler-banner {
  background: #f1f5f9;
  padding: 8px 16px;
  border-radius: 6px;
  margin: 16px 0;
  font-size: 13px;
  color: #334155;
}
.btn-switch {
  background: #0284c7;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}
</style>
