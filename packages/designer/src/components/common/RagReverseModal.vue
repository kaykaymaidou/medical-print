<template>
  <div v-if="visible" class="rag-modal-overlay" @click.self="$emit('close')">
    <div class="rag-modal-card">
      <!-- 头部：交通灯与标题 -->
      <div class="modal-header">
        <div class="title-wrap">
          <div class="traffic-lights">
            <span class="dot red" @click="$emit('close')"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
          </div>
          <h3>🧬 医疗多源文档 RAG 知识库检索与 Pi Agent 逆向生成工作台</h3>
        </div>
        <button class="btn-close" @click="$emit('close')">✕</button>
      </div>

      <!-- 副标题与说明 -->
      <div class="modal-sub">
        <span class="badge">医院本地 7B/14B 小模型架构</span>
        <span class="sub-desc">
          无需高算力云端大模型，依托“结构指纹 + 黄金标准骨架 RAG 召回 + Pi Agent 最小化槽位填空 + Rust 几何校验”，实现 Word/PDF 到封闭 AST 的 100% 物理合规逆向直出。
        </span>
      </div>

      <!-- 主体分栏：左侧输入与样例，右侧四阶流水线与结果 -->
      <div class="modal-body-grid">
        <!-- 左栏：异构源输入 -->
        <div class="input-panel">
          <div class="section-title-row">
            <span class="section-title">1. 异构源输入 (Word / PDF OCR / DSL / 需求描述)</span>
          </div>

          <!-- 快捷样例选择器 -->
          <div class="presets-row">
            <span class="preset-label">快捷载入真实样张：</span>
            <div class="preset-buttons">
              <button
                v-for="sample in RAG_PRESET_SAMPLES"
                :key="sample.id"
                class="preset-chip"
                :class="{ active: selectedSampleId === sample.id }"
                @click="loadSample(sample)"
              >
                {{ sample.name }}
                <span class="chip-tag">{{ sample.tag }}</span>
              </button>
              <label class="preset-chip upload-chip" title="支持直接导入葡萄城 .rdlx 报表、Word 提取文本或旧版 JSON">
                📂 导入外部模板 (.rdlx / .json / .txt)
                <input type="file" accept=".rdlx,.xml,.json,.txt" @change="handleFileUpload" style="display: none;" />
              </label>
            </div>
          </div>

          <!-- 文本编辑输入区 -->
          <div class="textarea-wrapper">
            <textarea
              v-model="inputText"
              class="rag-textarea"
              placeholder="在此粘贴 Word 表格文本、PDF 识别文本、旧系统 DSL JSON/XML 或随手记述的科室需求...
例如：
首都医科大学附属北京朝阳医院检验科
全血细胞分析 (血常规24项) 报告单
姓名：张建国  性别：男  年龄：42岁  病案号：MR20260912
1 白细胞计数 WBC 6.52 10^9/L 3.50-9.50
2 红细胞计数 RBC 4.85 10^12/L 4.30-5.80
送检人：赵主任  检验师：王技师  审核人：陈主管
排版要求：院徽放左上角与标题居中对齐，单页硬预算绝不超页，右下角盖检验专用章"
            ></textarea>
            <div class="textarea-footer">
              <span>字数：{{ inputText.length }}</span>
              <button v-if="inputText" class="btn-clear" @click="inputText = ''">清空输入</button>
            </div>
          </div>

          <!-- 触发按钮 -->
          <button
            class="run-reverse-btn"
            :disabled="isRunning || !inputText.trim()"
            @click="handleRunReverse"
          >
            <span v-if="isRunning">⚡ 正在执行 RAG 检索与 Pi Agent 槽位填充...</span>
            <span v-else>🚀 执行 RAG 骨架召回与 Pi Agent 逆向生成</span>
          </button>
        </div>

        <!-- 右栏：四阶流水线执行进度与成果 -->
        <div class="result-panel">
          <div class="section-title-row">
            <span class="section-title">2. Pi Agent 四阶流水线流转状态</span>
            <span v-if="result" class="elapsed-badge">耗时: {{ result.elapsedMs }}ms</span>
          </div>

          <!-- 四步流水线步骤条 -->
          <div class="pipeline-container">
            <div
              v-for="step in pipelineSteps"
              :key="step.stepIndex"
              class="pipeline-step-card"
              :class="step.status"
            >
              <div class="step-header">
                <span class="step-num">Step {{ step.stepIndex }}</span>
                <span class="step-title">{{ step.name }}</span>
                <span class="step-state-badge">{{ statusLabel(step.status) }}</span>
              </div>
              <p class="step-desc">{{ step.message }}</p>
            </div>
          </div>

          <!-- 成果预览与注入操作 -->
          <div v-if="result" class="output-preview-card">
            <div class="preview-header">
              <span class="preview-title">✅ 生成的封闭 ReportTemplate AST 已就绪</span>
              <span class="paper-badge">{{ result.slotFilling.physicalBudgetSummary }}</span>
            </div>
            <div class="stats-grid">
              <div class="stat-box">
                <span class="stat-label">命中骨架</span>
                <span class="stat-val">{{ result.retrieval.matchedArchetype.name }}</span>
              </div>
              <div class="stat-box">
                <span class="stat-label">RAG 置信度</span>
                <span class="stat-val highlight">{{ (result.retrieval.confidence * 100).toFixed(1) }}%</span>
              </div>
              <div class="stat-box">
                <span class="stat-label">提取项目数</span>
                <span class="stat-val">{{ result.slotFilling.filledSlots.itemsExtractedCount }} 项</span>
              </div>
              <div class="stat-box">
                <span class="stat-label">约束注入</span>
                <span class="stat-val">{{ result.slotFilling.filledSlots.constraintsApplied.length }} 个规则</span>
              </div>
            </div>

            <!-- 真实业务数据灌入出单演练 -->
            <div class="runtime-data-section">
              <div class="runtime-data-header">
                <span class="runtime-data-title">🧪 3. 真实患者数据灌入出单演练 (Runtime Data Binding)</span>
              </div>
              <div class="runtime-scenarios-row">
                <button
                  v-for="scenario in REAL_CLINICAL_SCENARIOS"
                  :key="scenario.id"
                  class="scenario-btn"
                  :class="{ active: selectedScenarioId === scenario.id }"
                  @click="applyScenarioData(scenario)"
                >
                  {{ scenario.name }}
                </button>
              </div>
              <div v-if="bindingStats" class="binding-feedback">
                <span class="binding-tag">✓ 注入 {{ bindingStats.itemsCount }} 项真实化验</span>
                <span v-if="bindingStats.criticalCount > 0" class="binding-tag critical">🚨 {{ bindingStats.criticalCount }} 项危急值</span>
                <span v-if="bindingStats.highCount > 0" class="binding-tag high">↑ {{ bindingStats.highCount }} 项偏高</span>
                <span v-if="bindingStats.lowCount > 0" class="binding-tag low">↓ {{ bindingStats.lowCount }} 项偏低</span>
                <span v-if="bindingStats.formulasComputed.length > 0" class="binding-tag formula">🧮 {{ bindingStats.formulasComputed.join(', ') }}</span>
                <span class="binding-tag budget">📐 行高 {{ bindingStats.appliedRowHeightMm }}mm (100% Fit in A5)</span>
              </div>
            </div>

            <!-- 操作按钮组 -->
            <div class="action-footer">
              <button class="apple-btn-secondary" @click="handleCompilePdf">
                📄 编译纯矢量 PDF 预览 (Rust)
              </button>
              <button class="apple-btn-primary" @click="handleApplyToCanvas">
                ✨ 一键注入当前设计器画布
              </button>
            </div>
          </div>
          <div v-else class="empty-placeholder">
            <div class="placeholder-icon">🧬</div>
            <p>在左侧选择临床样例或粘贴异构文本，点击执行即可实时观察四步生成流水线</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  executeRagReverse,
  RAG_PRESET_SAMPLES,
  REAL_CLINICAL_SCENARIOS,
  bindRuntimeDataToAst,
  type PresetSample,
  type ReverseGenerationResult,
  type PipelineStepLog,
  type BindingResult,
} from '../../domain/ragReverse'
import type { ReportTemplate } from '../../domain/reportAst'
import { compileVectorPdfRemote } from '../../domain/engineBridge'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'apply', template: ReportTemplate): void
}>()

const selectedSampleId = ref<string>('')
const selectedScenarioId = ref<string>('')
const bindingStats = ref<BindingResult['stats'] | null>(null)
const inputText = ref<string>('')
const isRunning = ref(false)
const result = ref<ReverseGenerationResult | null>(null)

const pipelineSteps = ref<PipelineStepLog[]>([
  { stepIndex: 1, name: '结构拓扑指纹分析 (Fingerprinting)', status: 'pending', message: '等待输入文本...' },
  { stepIndex: 2, name: '黄金骨架 RAG 召回 (Archetype Retrieval)', status: 'pending', message: '待指纹提取后计算综合亲和度' },
  { stepIndex: 3, name: 'Pi Agent 槽位精准填充 (Slot Filling)', status: 'pending', message: '待骨架召回后执行实体提取' },
  { stepIndex: 4, name: '物理几何闭环校验 (Physical Budget Guard)', status: 'pending', message: '待 AST 生成后验证单页高度预算与避让' },
])

function loadSample(sample: PresetSample) {
  selectedSampleId.value = sample.id
  inputText.value = sample.content.trim()
}

function applyScenarioData(scenario: typeof REAL_CLINICAL_SCENARIOS[number]) {
  if (!result.value) return
  selectedScenarioId.value = scenario.id
  const { boundAst, stats } = bindRuntimeDataToAst(result.value.template, scenario.data)
  result.value.template = boundAst
  bindingStats.value = stats
}

function handleFileUpload(e: Event) {
  const target = e.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return
  const file = target.files[0]
  const reader = new FileReader()
  reader.onload = () => {
    inputText.value = String(reader.result || '')
    selectedSampleId.value = 'uploaded_file'
  }
  reader.readAsText(file)
}

async function handleRunReverse() {
  if (!inputText.value.trim() || isRunning.value) return
  isRunning.value = true
  result.value = null

  // 动画步进显示
  pipelineSteps.value[0].status = 'running'
  pipelineSteps.value[0].message = '正在嗅探报告类别、医院名称、患者字段及表格维度...'

  try {
    const res = await executeRagReverse(inputText.value)
    result.value = res
    pipelineSteps.value = res.pipelineSteps
  } catch (err) {
    pipelineSteps.value[0].status = 'pending'
    alert(`逆向生成异常: ${err instanceof Error ? err.message : '未知错误'}`)
  } finally {
    isRunning.value = false
  }
}

function handleApplyToCanvas() {
  if (!result.value) return
  emit('apply', result.value.template as unknown as ReportTemplate)
  emit('close')
}

async function handleCompilePdf() {
  if (!result.value) return
  try {
    const blob = await compileVectorPdfRemote(result.value.template as unknown as ReportTemplate)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${result.value.fingerprint.reportTitle || 'MedPrint_RAG'}_300DPI_Vector.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    alert(`PDF 编译提示: ${err instanceof Error ? err.message : '服务未连接'}`)
  }
}

function statusLabel(status: PipelineStepLog['status']): string {
  switch (status) {
    case 'done': return '✓ 已完成'
    case 'running': return '⏳ 计算中'
    default: return '○ 待就绪'
  }
}
</script>

<style scoped>
.rag-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(14px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  animation: fadeIn 0.2s ease-out;
}

.rag-modal-card {
  width: 1080px;
  max-width: 94vw;
  height: 85vh;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: saturate(180%) blur(20px);
  border-radius: 18px;
  box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08);
  padding: 24px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-wrap h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #1d1d1f;
}

.traffic-lights {
  display: flex;
  gap: 6px;
}

.dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  cursor: pointer;
}

.dot.red { background: #ff5f56; }
.dot.yellow { background: #ffbd2e; }
.dot.green { background: #27c93f; }

.btn-close {
  background: none;
  border: none;
  font-size: 15px;
  color: #86868b;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.btn-close:hover {
  background: rgba(0, 0, 0, 0.06);
}

.modal-sub {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.badge {
  background: rgba(0, 113, 227, 0.1);
  color: #0071e3;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.sub-desc {
  font-size: 12px;
  color: #6e6e73;
  line-height: 1.4;
}

.modal-body-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  flex: 1;
  min-height: 0;
}

.input-panel,
.result-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #1d1d1f;
}

.elapsed-badge {
  font-size: 11px;
  color: #34c759;
  background: rgba(52, 199, 89, 0.12);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.presets-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.preset-label {
  font-size: 11px;
  color: #86868b;
}

.preset-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.preset-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 11px;
  color: #1d1d1f;
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-chip:hover {
  background: rgba(0, 113, 227, 0.08);
  border-color: rgba(0, 113, 227, 0.3);
}

.preset-chip.active {
  background: rgba(0, 113, 227, 0.12);
  border-color: #0071e3;
  color: #0071e3;
  font-weight: 600;
}

.chip-tag {
  background: rgba(0, 0, 0, 0.06);
  color: #6e6e73;
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 9px;
}

.textarea-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
  margin-bottom: 12px;
}

.rag-textarea {
  flex: 1;
  width: 100%;
  border: none;
  outline: none;
  padding: 12px;
  font-family: 'SF Mono', Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.5;
  color: #1d1d1f;
  resize: none;
}

.textarea-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: #fbfbfd;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  font-size: 11px;
  color: #86868b;
}

.btn-clear {
  background: none;
  border: none;
  color: #ff3b30;
  cursor: pointer;
  font-size: 11px;
}

.run-reverse-btn {
  background: #0071e3;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.run-reverse-btn:hover:not(:disabled) {
  background: #0077ed;
}

.run-reverse-btn:disabled {
  background: #a1a1a6;
  cursor: not-allowed;
}

.pipeline-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.pipeline-step-card {
  background: #fbfbfd;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  padding: 10px 12px;
  transition: all 0.2s ease;
}

.pipeline-step-card.running {
  background: rgba(0, 113, 227, 0.04);
  border-color: #0071e3;
  box-shadow: 0 0 0 1px #0071e3;
}

.pipeline-step-card.done {
  background: rgba(52, 199, 89, 0.04);
  border-color: rgba(52, 199, 89, 0.3);
}

.step-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.step-num {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #86868b;
}

.step-title {
  font-size: 12px;
  font-weight: 600;
  color: #1d1d1f;
  flex: 1;
}

.step-state-badge {
  font-size: 10px;
  font-weight: 600;
  color: #86868b;
}

.pipeline-step-card.done .step-state-badge {
  color: #34c759;
}

.pipeline-step-card.running .step-state-badge {
  color: #0071e3;
}

.step-desc {
  margin: 0;
  font-size: 11px;
  color: #6e6e73;
  line-height: 1.4;
}

.output-preview-card {
  flex: 1;
  background: #fff;
  border: 1px solid rgba(52, 199, 89, 0.3);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 4px 12px rgba(52, 199, 89, 0.08);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.preview-title {
  font-size: 12px;
  font-weight: 600;
  color: #1d1d1f;
}

.paper-badge {
  font-size: 10px;
  background: rgba(52, 199, 89, 0.12);
  color: #248a3d;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.stat-box {
  background: #fbfbfd;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 10px;
  color: #86868b;
}

.stat-val {
  font-size: 12px;
  font-weight: 600;
  color: #1d1d1f;
}

.stat-val.highlight {
  color: #0071e3;
}

.action-footer {
  display: flex;
  gap: 8px;
}

.apple-btn-primary {
  flex: 1;
  background: #0071e3;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.apple-btn-primary:hover {
  background: #0077ed;
}

.apple-btn-secondary {
  background: rgba(0, 0, 0, 0.06);
  color: #1d1d1f;
  border: none;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.apple-btn-secondary:hover {
  background: rgba(0, 0, 0, 0.1);
}

.empty-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fbfbfd;
  border: 1px dashed rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
}

.placeholder-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.empty-placeholder p {
  margin: 0;
  font-size: 12px;
  color: #86868b;
  max-width: 280px;
  line-height: 1.5;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}

.runtime-data-section {
  background: #f5f9ff;
  border: 1px solid rgba(0, 113, 227, 0.15);
  border-radius: 12px;
  padding: 12px 14px;
  margin-top: 12px;
}

.runtime-data-header {
  margin-bottom: 8px;
}

.runtime-data-title {
  font-size: 12px;
  font-weight: 600;
  color: #0071e3;
}

.runtime-scenarios-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.scenario-btn {
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 500;
  color: #1d1d1f;
  cursor: pointer;
  transition: all 0.15s ease;
}

.scenario-btn:hover {
  border-color: #0071e3;
  background: #f0f7ff;
}

.scenario-btn.active {
  background: #0071e3;
  color: white;
  border-color: #0071e3;
}

.binding-feedback {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.binding-tag {
  font-size: 10px;
  background: rgba(0, 113, 227, 0.08);
  color: #0071e3;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.binding-tag.critical {
  background: rgba(255, 59, 48, 0.12);
  color: #ff3b30;
  font-weight: 600;
}

.binding-tag.high {
  background: rgba(255, 149, 0, 0.12);
  color: #ff9500;
}

.binding-tag.low {
  background: rgba(52, 199, 89, 0.12);
  color: #248a3d;
}

.binding-tag.formula {
  background: rgba(88, 86, 214, 0.12);
  color: #5856d6;
}

.binding-tag.budget {
  background: rgba(0, 0, 0, 0.06);
  color: #48484a;
}
</style>
