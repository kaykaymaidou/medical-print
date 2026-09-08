<template>
  <div v-if="visible" class="apple-modal-overlay" @click.self="$emit('close')">
    <div class="formula-modal-card">
      <div class="modal-header">
        <div class="title-wrap">
          <span class="icon">⚗️</span>
          <div>
            <h3>临床检验公式实验室 (Clinical Formula Lab)</h3>
            <p class="subtitle">内置循证医学计算模型，实时异常阈值判定，一键注入报表模板</p>
          </div>
        </div>
        <button class="btn-close" @click="$emit('close')">✕</button>
      </div>

      <div class="formula-body">
        <!-- 左侧公式选择导航 -->
        <div class="formula-nav">
          <button
            v-for="formula in formulaList"
            :key="formula.id"
            class="formula-nav-item"
            :class="{ active: selectedFormulaId === formula.id }"
            @click="selectedFormulaId = formula.id"
          >
            <span class="formula-badge">{{ formula.category }}</span>
            <span class="formula-name">{{ formula.name }}</span>
          </button>
        </div>

        <!-- 右侧公式计算与参数工作区 -->
        <div class="formula-workspace">
          <div class="formula-header-info">
            <h4>{{ activeFormula.name }}</h4>
            <p class="formula-desc">{{ activeFormula.description }}</p>
            <div class="formula-math-box">
              <code>{{ activeFormula.expression }}</code>
            </div>
          </div>

          <!-- 输入参数表单 -->
          <div class="param-grid">
            <div v-for="param in activeFormula.params" :key="param.key" class="param-item">
              <label>{{ param.label }} ({{ param.unit }})</label>
              <template v-if="param.type === 'number'">
                <input
                  v-model.number="paramValues[param.key]"
                  type="number"
                  :step="param.step || '1'"
                  class="apple-input"
                />
              </template>
              <template v-else-if="param.type === 'select'">
                <select v-model="paramValues[param.key]" class="apple-select">
                  <option v-for="opt in param.options" :key="opt.value" :value="opt.value">
                    {{ opt.text }}
                  </option>
                </select>
              </template>
            </div>
          </div>

          <!-- 实时求值结果面板 -->
          <div class="result-card" :class="evaluationResult.statusClass">
            <div class="result-meta">
              <span class="result-label">实时计算结果</span>
              <span class="result-status-tag">{{ evaluationResult.statusText }}</span>
            </div>
            <div class="result-value-row">
              <span class="value-number">{{ evaluationResult.value }}</span>
              <span class="value-unit">{{ activeFormula.outputUnit }}</span>
            </div>
            <div class="result-eval-text">
              临床参考区间：<strong>{{ activeFormula.referenceRange }}</strong> | 判定：{{ evaluationResult.interpretation }}
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作按钮 -->
      <div class="modal-footer">
        <button class="apple-btn-secondary" @click="$emit('close')">取消</button>
        <button class="apple-btn-primary" @click="handleInsertToReport">
          📥 将本公式项目插入报表模板
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'insert', item: { name: string; value: string; unit: string; refRange: string; flag: string }): void
}>()

interface FormulaParam {
  key: string
  label: string
  unit: string
  type: 'number' | 'select'
  step?: string
  options?: { text: string; value: any }[]
}

interface FormulaDef {
  id: string
  name: string
  category: string
  description: string
  expression: string
  outputUnit: string
  referenceRange: string
  params: FormulaParam[]
  calculate: (params: Record<string, any>) => { value: number; flag: 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL'; text: string }
}

const formulaList: FormulaDef[] = [
  {
    id: 'egfr',
    name: 'eGFR 肾小球滤过率 (CKD-EPI 2021)',
    category: '肾功能',
    description: '美国 KDIGO 指南推荐最新版无种族系数肌酐公式，精准诊断慢性肾脏病（CKD）分期。',
    expression: 'eGFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^(-1.200) × 0.9938^Age [× 1.012 if female]',
    outputUnit: 'mL/min/1.73m²',
    referenceRange: '≥ 90 mL/min/1.73m²',
    params: [
      { key: 'scr', label: '血清肌酐 (Scr)', unit: 'mg/dL', type: 'number', step: '0.01' },
      { key: 'age', label: '患者年龄', unit: '岁', type: 'number', step: '1' },
      { key: 'gender', label: '生理性别', unit: '', type: 'select', options: [{ text: '男性 (Male)', value: 'M' }, { text: '女性 (Female)', value: 'F' }] }
    ],
    calculate: (p) => {
      const isFemale = p.gender === 'F'
      const scr = Number(p.scr) || 1.0
      const age = Number(p.age) || 45
      const kappa = isFemale ? 0.7 : 0.9
      const alpha = isFemale ? -0.241 : -0.302
      const genderFactor = isFemale ? 1.012 : 1.0
      const scrOverKappa = scr / kappa
      const minVal = Math.min(scrOverKappa, 1.0)
      const maxVal = Math.max(scrOverKappa, 1.0)
      const val = 142.0 * Math.pow(minVal, alpha) * Math.pow(maxVal, -1.2) * Math.pow(0.9938, age) * genderFactor
      const rounded = Math.round(val * 10) / 10
      if (rounded >= 90) return { value: rounded, flag: 'NORMAL', text: 'G1期：肾功能正常' }
      if (rounded >= 60) return { value: rounded, flag: 'LOW', text: 'G2期：轻度下降' }
      if (rounded >= 30) return { value: rounded, flag: 'LOW', text: 'G3期：中度下降' }
      if (rounded >= 15) return { value: rounded, flag: 'CRITICAL', text: 'G4期：重度下降 (危急)' }
      return { value: rounded, flag: 'CRITICAL', text: 'G5期：肾衰竭尿毒症期 (严重危急)' }
    }
  },
  {
    id: 'ldl',
    name: 'LDL-C 低密度脂蛋白 (Friedewald)',
    category: '生化血脂',
    description: '通过总胆固醇、高密度脂蛋白和甘油三酯精准测算动脉粥样硬化风险。',
    expression: 'LDL-C = TC - HDL-C - (TG / 2.2) [mmol/L]',
    outputUnit: 'mmol/L',
    referenceRange: '< 3.4 mmol/L',
    params: [
      { key: 'tc', label: '总胆固醇 (TC)', unit: 'mmol/L', type: 'number', step: '0.1' },
      { key: 'hdl', label: '高密度脂蛋白 (HDL-C)', unit: 'mmol/L', type: 'number', step: '0.1' },
      { key: 'tg', label: '甘油三酯 (TG)', unit: 'mmol/L', type: 'number', step: '0.1' }
    ],
    calculate: (p) => {
      const tc = Number(p.tc) || 5.2
      const hdl = Number(p.hdl) || 1.3
      const tg = Number(p.tg) || 1.8
      const val = tc - hdl - (tg / 2.2)
      const rounded = Math.round(val * 100) / 100
      if (rounded < 3.4) return { value: rounded, flag: 'NORMAL', text: '理想水平' }
      if (rounded < 4.1) return { value: rounded, flag: 'HIGH', text: '边缘升高' }
      return { value: rounded, flag: 'CRITICAL', text: '极高危异常 (心脑血管风险)' }
    }
  },
  {
    id: 'bmi',
    name: 'BMI 体质指数 (Body Mass Index)',
    category: '体格营养',
    description: '临床营养与心血管危险因素评估标准指标。',
    expression: 'BMI = 体重(kg) / (身高(m))²',
    outputUnit: 'kg/m²',
    referenceRange: '18.5 ~ 23.9 kg/m²',
    params: [
      { key: 'weight', label: '体重', unit: 'kg', type: 'number', step: '0.5' },
      { key: 'height', label: '身高', unit: 'cm', type: 'number', step: '1' }
    ],
    calculate: (p) => {
      const w = Number(p.weight) || 68
      const h = (Number(p.height) || 172) / 100
      const val = w / (h * h)
      const rounded = Math.round(val * 10) / 10
      if (rounded < 18.5) return { value: rounded, flag: 'LOW', text: '体重过低/营养不良' }
      if (rounded <= 23.9) return { value: rounded, flag: 'NORMAL', text: '正常体型' }
      if (rounded <= 27.9) return { value: rounded, flag: 'HIGH', text: '超重' }
      return { value: rounded, flag: 'CRITICAL', text: '肥胖 (心代谢高危)' }
    }
  },
  {
    id: 'ag',
    name: 'AG 阴离子间隙 (Anion Gap)',
    category: '血气酸碱',
    description: '重症ICU判断代谢性酸中毒类型的核心计算指标。',
    expression: 'AG = Na⁺ - (Cl⁻ + HCO₃⁻)',
    outputUnit: 'mmol/L',
    referenceRange: '8.0 ~ 16.0 mmol/L',
    params: [
      { key: 'na', label: '血钠 (Na⁺)', unit: 'mmol/L', type: 'number', step: '1' },
      { key: 'cl', label: '血氯 (Cl⁻)', unit: 'mmol/L', type: 'number', step: '1' },
      { key: 'hco3', label: '碳酸氢根 (HCO₃⁻)', unit: 'mmol/L', type: 'number', step: '1' }
    ],
    calculate: (p) => {
      const na = Number(p.na) || 140
      const cl = Number(p.cl) || 103
      const hco3 = Number(p.hco3) || 24
      const val = na - (cl + hco3)
      const rounded = Math.round(val * 10) / 10
      if (rounded < 8) return { value: rounded, flag: 'LOW', text: '低阴离子间隙' }
      if (rounded <= 16) return { value: rounded, flag: 'NORMAL', text: '正常区间' }
      return { value: rounded, flag: 'CRITICAL', text: '高AG代酸 (高危提示)' }
    }
  },
  {
    id: 'cacal',
    name: '校正钙 (Corrected Calcium)',
    category: '生化离子',
    description: '在低白蛋白血症患者中纠正假性低钙血症。',
    expression: 'Ca(corr) = 实测总钙 + 0.02 × (40 - 白蛋白 [g/L])',
    outputUnit: 'mmol/L',
    referenceRange: '2.15 ~ 2.55 mmol/L',
    params: [
      { key: 'ca', label: '实测总钙 (Total Ca)', unit: 'mmol/L', type: 'number', step: '0.01' },
      { key: 'alb', label: '血清白蛋白 (Albumin)', unit: 'g/L', type: 'number', step: '1' }
    ],
    calculate: (p) => {
      const ca = Number(p.ca) || 2.10
      const alb = Number(p.alb) || 32
      const val = ca + 0.02 * (40 - alb)
      const rounded = Math.round(val * 100) / 100
      if (rounded < 2.15) return { value: rounded, flag: 'LOW', text: '真性低钙血症' }
      if (rounded <= 2.55) return { value: rounded, flag: 'NORMAL', text: '校正后钙离子正常' }
      return { value: rounded, flag: 'HIGH', text: '高钙血症' }
    }
  }
]

const selectedFormulaId = ref('egfr')

const paramValues = reactive<Record<string, any>>({
  scr: 0.95,
  age: 52,
  gender: 'M',
  tc: 5.6,
  hdl: 1.1,
  tg: 2.3,
  weight: 72,
  height: 175,
  na: 142,
  cl: 104,
  hco3: 22,
  ca: 2.05,
  alb: 30
})

const activeFormula = computed(() => {
  return formulaList.find((f) => f.id === selectedFormulaId.value) || formulaList[0]
})

const evaluationResult = computed(() => {
  const res = activeFormula.value.calculate(paramValues)
  let statusClass = 'normal'
  let statusText = '正常 (NORMAL)'
  if (res.flag === 'HIGH') {
    statusClass = 'high'
    statusText = '↑ 偏高 (HIGH)'
  } else if (res.flag === 'LOW') {
    statusClass = 'low'
    statusText = '↓ 偏低 (LOW)'
  } else if (res.flag === 'CRITICAL') {
    statusClass = 'critical'
    statusText = '⚠️ 危急值 (CRITICAL)'
  }
  return {
    value: res.value,
    statusClass,
    statusText,
    interpretation: res.text,
    flag: res.flag === 'NORMAL' ? '' : res.flag === 'HIGH' ? '↑' : res.flag === 'LOW' ? '↓' : '※'
  }
})

function handleInsertToReport() {
  emit('insert', {
    name: activeFormula.value.name.split(' ')[0],
    value: evaluationResult.value.value.toString(),
    unit: activeFormula.value.outputUnit,
    refRange: activeFormula.value.referenceRange,
    flag: evaluationResult.value.flag
  })
  emit('close')
}
</script>

<style scoped>
.apple-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.formula-modal-card {
  width: 760px;
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.22);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.1);
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

.btn-close:hover {
  background: rgba(0, 0, 0, 0.12);
}

.formula-body {
  display: flex;
  min-height: 420px;
}

.formula-nav {
  width: 220px;
  background: #f5f5f7;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.formula-nav-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.formula-nav-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

.formula-nav-item.active {
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.formula-badge {
  font-size: 10px;
  font-weight: 600;
  color: #0071e3;
  margin-bottom: 2px;
}

.formula-name {
  font-size: 12px;
  font-weight: 600;
  color: #1d1d1f;
  line-height: 1.3;
}

.formula-workspace {
  flex: 1;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.formula-header-info h4 {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 700;
  color: #1d1d1f;
}

.formula-desc {
  margin: 0 0 10px;
  font-size: 12px;
  color: #6e6e73;
  line-height: 1.4;
}

.formula-math-box {
  background: #f0f0f2;
  padding: 8px 12px;
  border-radius: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #333336;
  border-left: 3px solid #0071e3;
}

.param-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.param-item label {
  font-size: 11px;
  font-weight: 600;
  color: #48484a;
}

.apple-input,
.apple-select {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #d2d2d7;
  font-size: 13px;
  background: #ffffff;
  outline: none;
}

.apple-input:focus,
.apple-select:focus {
  border-color: #0071e3;
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.15);
}

.result-card {
  margin-top: auto;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid #e5e5ea;
  transition: all 0.2s ease;
}

.result-card.normal {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.result-card.high,
.result-card.low {
  background: #fffbeb;
  border-color: #fde68a;
}

.result-card.critical {
  background: #fef2f2;
  border-color: #fecaca;
}

.result-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.result-label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.result-status-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 12px;
}

.result-card.normal .result-status-tag {
  background: #dcfce7;
  color: #166534;
}

.result-card.high .result-status-tag,
.result-card.low .result-status-tag {
  background: #fef3c7;
  color: #92400e;
}

.result-card.critical .result-status-tag {
  background: #fee2e2;
  color: #991b1b;
}

.result-value-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
}

.value-number {
  font-size: 32px;
  font-weight: 800;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  color: #0f172a;
}

.value-unit {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
}

.result-eval-text {
  font-size: 11px;
  color: #475569;
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

.apple-btn-primary:hover {
  background: #0077ed;
}
</style>
