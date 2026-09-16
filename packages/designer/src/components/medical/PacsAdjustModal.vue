<template>
  <div v-if="visible" class="apple-modal-overlay" @click.self="$emit('close')">
    <div class="pacs-adjust-card">
      <div class="modal-header">
        <div class="title-wrap">
          <div>
            <h3>PACS 影像窗宽窗位与打印参数调校 (DICOM Calibration)</h3>
            <p class="subtitle">针对高分辨率打印输出优化灰阶阶调与对比度范围</p>
          </div>
        </div>
        <button class="btn-close" @click="$emit('close')">✕</button>
      </div>

      <div class="pacs-body">
        <!-- 图像实时预览区 -->
        <div class="preview-stage">
          <div class="stage-toolbar">
            <span class="toolbar-label">当前视图仿真：300 DPI 医疗胶片相纸</span>
            <div class="zoom-tag">100% 物理比例</div>
          </div>
          
          <div class="canvas-viewport" :class="activeFilterClass">
            <div
              class="image-canvas-box"
              :style="computedImageStyle"
            >
              <img
                src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'><rect width='400' height='300' fill='%23111'/><ellipse cx='200' cy='150' rx='130' ry='90' fill='%23222' stroke='%23444' stroke-width='3'/><path d='M100,160 Q180,80 280,140 Q220,220 100,160' fill='%23383838' opacity='0.7'/><circle cx='180' cy='130' r='24' fill='%23555' opacity='0.9'/><circle cx='195' cy='125' r='12' fill='%23888'/><path d='M80,260 L320,260' stroke='%23555' stroke-width='2' stroke-dasharray='5,5'/><text x='20' y='30' fill='%23888' font-size='12' font-family='sans-serif'>GE LOGIQ E9 / 7.5MHz</text><text x='20' y='50' fill='%23888' font-size='11' font-family='sans-serif'>MI: 0.8 TIS: 0.4</text></svg>"
                alt="Ultrasound Image"
                class="dicom-img"
              />
              
              <!-- 物理测量游标尺叠加 (0.01mm 精度) -->
              <div v-if="showCaliper" class="caliper-overlay">
                <div class="caliper-line">
                  <span class="caliper-marker left">|</span>
                  <span class="caliper-text">24.5 mm</span>
                  <span class="caliper-marker right">|</span>
                </div>
              </div>

              <!-- 窗位数据水印 -->
              <div class="dicom-osd">
                <span>WW: {{ windowWidth }} / WL: {{ windowLevel }}</span>
                <span>Gamma: {{ gammaVal.toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 调校参数控制侧栏 -->
        <div class="controls-panel">
          <div class="control-section">
            <span class="section-title">临床影像标准窗预设</span>
            <div class="preset-grid">
              <button
                v-for="p in presets"
                :key="p.name"
                class="preset-btn"
                :class="{ active: currentPreset === p.name }"
                @click="applyPreset(p)"
              >
                {{ p.name }}
              </button>
            </div>
          </div>

          <div class="control-section">
            <span class="section-title">窗宽与窗位 (WW / WL)</span>
            
            <div class="slider-row">
              <div class="slider-header">
                <span>窗宽 (Window Width)</span>
                <strong>{{ windowWidth }} HU</strong>
              </div>
              <input
                v-model.number="windowWidth"
                type="range"
                min="50"
                max="2500"
                step="10"
                class="apple-range"
              />
            </div>

            <div class="slider-row">
              <div class="slider-header">
                <span>窗位 (Window Level)</span>
                <strong>{{ windowLevel }} HU</strong>
              </div>
              <input
                v-model.number="windowLevel"
                type="range"
                min="-800"
                max="800"
                step="5"
                class="apple-range"
              />
            </div>
          </div>

          <div class="control-section">
            <span class="section-title">打印对比度与伽马增强</span>
            
            <div class="slider-row">
              <div class="slider-header">
                <span>伽马校正 (Gamma)</span>
                <strong>{{ gammaVal.toFixed(2) }}</strong>
              </div>
              <input
                v-model.number="gammaVal"
                type="range"
                min="0.5"
                max="2.2"
                step="0.05"
                class="apple-range"
              />
            </div>

            <div class="toggle-list">
              <label class="toggle-label">
                <input v-model="invertGrayscale" type="checkbox" />
                <span>灰阶反转 (胶片阴影模式)</span>
              </label>

              <label class="toggle-label">
                <input v-model="printSharpen" type="checkbox" />
                <span>300 DPI 边缘锐化与轮廓增强</span>
              </label>

              <label class="toggle-label">
                <input v-model="showCaliper" type="checkbox" />
                <span>显示病灶真实物理毫米标尺 (Caliper)</span>
              </label>
            </div>
          </div>

          <div class="control-section">
            <span class="section-title">伪彩映射 (Pseudocolor)</span>
            <div class="color-mode-tabs">
              <button
                :class="['color-tab', { active: colorMode === 'gray' }]"
                @click="colorMode = 'gray'"
              >
                标准灰阶
              </button>
              <button
                :class="['color-tab', { active: colorMode === 'thermal' }]"
                @click="colorMode = 'thermal'"
              >
                血管热力
              </button>
              <button
                :class="['color-tab', { active: colorMode === 'rainbow' }]"
                @click="colorMode = 'rainbow'"
              >
                彩超血流
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="apple-btn-secondary" @click="$emit('close')">取消</button>
        <button class="apple-btn-primary" @click="saveAdjustments">
          保存影像调校参数并应用
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'apply', settings: { ww: number; wl: number; gamma: number; invert: boolean; sharpen: boolean; colorMode: string }): void
}>()

const windowWidth = ref(400)
const windowLevel = ref(40)
const gammaVal = ref(1.0)
const invertGrayscale = ref(false)
const printSharpen = ref(true)
const showCaliper = ref(true)
const colorMode = ref<'gray' | 'thermal' | 'rainbow'>('gray')
const currentPreset = ref('软组织窗')

const presets = [
  { name: '软组织窗', ww: 350, wl: 40 },
  { name: '肺窗 (胸片)', ww: 1500, wl: -600 },
  { name: '骨窗 (骨折)', ww: 2000, wl: 450 },
  { name: '脑组织窗', ww: 80, wl: 35 },
  { name: '超声高对比', ww: 450, wl: 50 }
]

function applyPreset(p: { name: string; ww: number; wl: number }) {
  currentPreset.value = p.name
  windowWidth.value = p.ww
  windowLevel.value = p.wl
}

const activeFilterClass = computed(() => {
  return `color-${colorMode.value}`
})

const computedImageStyle = computed(() => {
  // 根据 WW/WL 和 Gamma 计算 CSS 滤镜仿真
  // 窗宽越窄，对比度越高
  const contrastFactor = Math.max(0.6, Math.min(2.5, 1000 / windowWidth.value))
  // 窗位影响明亮度
  const brightnessFactor = Math.max(0.5, Math.min(2.0, 1.0 + windowLevel.value / 400))
  // 灰阶反转
  const invertVal = invertGrayscale.value ? 1 : 0

  let filterStr = `contrast(${contrastFactor.toFixed(2)}) brightness(${brightnessFactor.toFixed(2)}) invert(${invertVal})`

  if (colorMode.value === 'thermal') {
    filterStr += ` sepia(1) hue-rotate(-50deg) saturate(3)`
  } else if (colorMode.value === 'rainbow') {
    filterStr += ` hue-rotate(180deg) saturate(2.5)`
  }

  return {
    filter: filterStr
  }
})

function saveAdjustments() {
  emit('apply', {
    ww: windowWidth.value,
    wl: windowLevel.value,
    gamma: gammaVal.value,
    invert: invertGrayscale.value,
    sharpen: printSharpen.value,
    colorMode: colorMode.value
  })
  emit('close')
}
</script>

<style scoped>
.apple-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.pacs-adjust-card {
  width: 900px;
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.modal-header {
  padding: 16px 20px;
  background: #fbfbfd;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-wrap .icon {
  font-size: 24px;
}

.title-wrap h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #1d1d1f;
}

.title-wrap .subtitle {
  margin: 2px 0 0;
  font-size: 11px;
  color: #86868b;
}

.btn-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.06);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #666;
}

.pacs-body {
  display: flex;
  min-height: 480px;
}

.preview-stage {
  flex: 1;
  background: #0f1012;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(0, 0, 0, 0.1);
}

.stage-toolbar {
  height: 36px;
  background: #1a1b1e;
  border-bottom: 1px solid #282a2e;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
}

.toolbar-label {
  font-size: 11px;
  color: #8e9096;
}

.zoom-tag {
  font-size: 10px;
  background: #2a2c32;
  color: #a0a2a8;
  padding: 2px 6px;
  border-radius: 4px;
}

.canvas-viewport {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: hidden;
}

.image-canvas-box {
  position: relative;
  width: 440px;
  height: 330px;
  background: #000;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dicom-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.caliper-overlay {
  position: absolute;
  top: 45%;
  left: 36%;
  display: flex;
  align-items: center;
}

.caliper-line {
  display: flex;
  align-items: center;
  gap: 4px;
  border-bottom: 2px dashed #ff3b30;
  padding-bottom: 2px;
}

.caliper-marker {
  color: #ff3b30;
  font-weight: 900;
  font-size: 14px;
}

.caliper-text {
  font-size: 11px;
  font-weight: 700;
  color: #ff3b30;
  background: rgba(0, 0, 0, 0.6);
  padding: 1px 4px;
  border-radius: 3px;
}

.dicom-osd {
  position: absolute;
  bottom: 8px;
  left: 12px;
  display: flex;
  flex-direction: column;
  font-family: monospace;
  font-size: 10px;
  color: #00e676;
  text-shadow: 0 1px 2px #000;
  gap: 2px;
}

.controls-panel {
  width: 320px;
  background: #fbfbfd;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-size: 12px;
  font-weight: 700;
  color: #1d1d1f;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preset-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.preset-btn {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #d2d2d7;
  background: #ffffff;
  font-size: 11px;
  font-weight: 600;
  color: #333;
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-btn:hover {
  background: #f0f0f5;
}

.preset-btn.active {
  background: #0071e3;
  border-color: #0071e3;
  color: #ffffff;
}

.slider-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slider-header {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #6e6e73;
}

.apple-range {
  width: 100%;
  accent-color: #0071e3;
  cursor: pointer;
}

.toggle-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 6px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #333336;
  cursor: pointer;
}

.color-mode-tabs {
  display: flex;
  background: #e5e5ea;
  border-radius: 8px;
  padding: 2px;
}

.color-tab {
  flex: 1;
  padding: 6px 0;
  border-radius: 6px;
  border: none;
  background: transparent;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  cursor: pointer;
  text-align: center;
}

.color-tab.active {
  background: #ffffff;
  color: #0071e3;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.modal-footer {
  padding: 14px 20px;
  background: #fbfbfd;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.apple-btn-secondary {
  padding: 7px 16px;
  border-radius: 8px;
  border: 1px solid #d2d2d7;
  background: #ffffff;
  color: #1d1d1f;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.apple-btn-primary {
  padding: 7px 18px;
  border-radius: 8px;
  border: none;
  background: #0071e3;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 113, 227, 0.25);
}
</style>
