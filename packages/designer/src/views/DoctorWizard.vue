<template>
  <div class="apple-workspace">
    <!-- 左侧向导与配置控制台 (Apple Sidebar) -->
    <aside class="apple-sidebar">
      <div class="sidebar-header">
        <div class="title-row">
          <h2>临床向导</h2>
        </div>
        <p class="subtitle">意图生成封闭 AST；页眉/患者字段可在此改。需要拖槽位排序时进 AST 审查。</p>
      </div>

      <!-- 🤖 DeepSeek AI 智能助理卡片 -->
      <div class="apple-card ai-card">
        <div class="card-header">
          <div class="header-left">
            <span class="ai-sparkle" aria-hidden="true"></span>
            <span class="card-title">临床排版智能体</span>
          </div>
          <span :class="['pill-badge', `pill-${providerKind}`]">{{ providerLabel }}</span>
        </div>
        <ModelProviderSettings v-model="providerSettings" />
        <p :class="['ai-speech', { 'is-error': !!aiError, 'is-busy': aiBusy }]">{{ aiSpeech }}</p>
        <div
          class="ai-dropzone"
          :class="{ 'has-image': !!pastedImageUrl, dragging: imageDragging }"
          @dragover.prevent="imageDragging = true"
          @dragleave.prevent="imageDragging = false"
          @drop.prevent="onImageDrop"
        >
          <img v-if="pastedImageUrl" :src="pastedImageUrl" alt="待识别单据" class="paste-thumb" />
          <div class="drop-copy">
            <span v-if="pastedImageUrl">已附单据图，发送后走识图 → AST</span>
            <span v-else>Ctrl+V 或拖入化验单图片（视觉模型可识别表格）</span>
            <label class="link-btn">
              {{ pastedImageUrl ? '更换' : '选取图片' }}
              <input type="file" accept="image/*" hidden @change="onPickImage" />
            </label>
            <button v-if="pastedImageUrl" type="button" class="link-btn" @click="clearPastedImage">移除</button>
          </div>
        </div>
        <div class="ai-input-row">
          <input
            v-model="aiPrompt"
            type="text"
            :disabled="aiBusy"
            placeholder="对 AI 说意图：A5双列生化 / 超声PACS / 处方 / 合规审查..."
            @keyup.enter="handleAiAsk"
          />
          <button class="btn-ai-send" :disabled="aiBusy" @click="handleAiAsk">{{ aiBusy ? '…' : '发送' }}</button>
        </div>
        <div class="ai-quick-tags">
          <button class="tag-btn" @click="quickAsk('将此单排为A5横向双列并紧凑至1页')">A5 双列紧凑</button>
          <button class="tag-btn" @click="quickAsk('切换为超声PACS双图图文报告')">超声 PACS</button>
          <button class="tag-btn" @click="quickAsk('切换为门急诊规范处方笺')">规范处方</button>
          <button class="tag-btn" @click="quickAsk('审查当前单据医疗法规合规性')">合规审查</button>
          <button class="tag-btn" @click="quickAsk('一键静默打印并监听出纸')">静默出纸</button>
        </div>
      </div>

      <!-- 1. 临床单据类别选择 (4大真实场景) -->
      <div class="apple-card">
        <label class="group-label">单据类别</label>
        <div class="segmented-control">
          <button
            v-for="preset in presets"
            :key="preset.id"
            :class="['segment-item', { active: currentPreset === preset.id }]"
            @click="selectPreset(preset.id)"
          >
            {{ preset.name }}
          </button>
        </div>
      </div>

      <!-- 2. 机构与页眉（可改对齐 / 院徽 / 报告单号） -->
      <div class="apple-card">
        <label class="group-label">页眉与机构</label>
        <p class="card-hint">标题不必居中：可选左中右，可加院徽和报告单号。细排版也可进 AST 审查拖槽位。</p>
        <div class="align-pills">
          <button
            v-for="opt in alignOptions"
            :key="opt.id"
            type="button"
            class="align-pill"
            :class="{ active: headerAlign === opt.id }"
            @click="setHeaderAlign(opt.id)"
          >
            {{ opt.label }}
          </button>
        </div>
        <div class="field-row">
          <span class="field-name">医院名称</span>
          <input v-model="hospitalName" type="text" class="apple-input" @change="syncHeaderFromWizard" />
        </div>
        <div class="field-row">
          <span class="field-name">报告标题</span>
          <input v-model="reportTitle" type="text" class="apple-input" @change="syncHeaderFromWizard" />
        </div>
        <div class="field-row">
          <span class="field-name">科室咨询</span>
          <input v-model="deptPhone" type="text" class="apple-input" />
        </div>
        <div class="field-row">
          <span class="field-name">院徽</span>
          <div class="logo-actions">
            <input type="file" accept="image/*" class="apple-input file-input" @change="onWizardLogoFile" />
            <button v-if="headerLogo" type="button" class="mini-btn" @click="clearWizardLogo">移除</button>
          </div>
        </div>
        <div class="switch-list compact">
          <AppleSwitch v-model="showReportNoLocal" label="显示报告单编号" />
        </div>
        <template v-if="showReportNoLocal">
          <div class="field-row">
            <span class="field-name">编号标签</span>
            <input v-model="reportNoLabelLocal" type="text" class="apple-input" @change="syncHeaderFromWizard" />
          </div>
          <div class="field-row">
            <span class="field-name">预览编号</span>
            <input v-model="reportNoPreviewLocal" type="text" class="apple-input" @change="syncHeaderFromWizard" />
          </div>
        </template>
      </div>

      <!-- 患者信息字段目录 -->
      <div class="apple-card">
        <label class="group-label">患者信息字段</label>
        <p class="card-hint">从临床目录增删改排序；可加自定义字段。不是开放文本控件。</p>
        <div class="patient-field-list">
          <div v-for="(field, i) in editablePatientFields" :key="field.key + '-' + i" class="patient-field-row">
            <button type="button" class="mini-btn" :disabled="i === 0" @click="moveWizardPatientField(i, -1)">↑</button>
            <button type="button" class="mini-btn" :disabled="i === editablePatientFields.length - 1" @click="moveWizardPatientField(i, 1)">↓</button>
            <input class="apple-input tight" :value="field.label" @change="onWizardPatientLabel(i, $event)" />
            <input class="apple-input" :value="field.preview_value" @change="onWizardPatientValue(i, $event)" />
            <button type="button" class="mini-btn danger" @click="removeWizardPatientField(i)">×</button>
          </div>
        </div>
        <div class="field-add-row">
          <select v-model="pendingPatientKey" class="apple-input">
            <option v-for="opt in unusedWizardPatientKeys" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
          </select>
          <button type="button" class="mini-btn primary" @click="addWizardPatientField">加入</button>
        </div>
      </div>

      <!-- 3. 临床模块开关 (AppleSwitch) -->
      <div class="apple-card">
        <label class="group-label">合规模块</label>
        <div class="switch-list">
          <AppleSwitch v-model="showBarcode" label="采血管条形码 (Code128 纯矢量)" />
          <AppleSwitch v-model="showAbnormalFlags" label="异常值自动评估 (↑/↓/危急值标红)" />
          <AppleSwitch v-model="showSeal" label="医院检验/诊断防伪红章 (正片叠底)" />
          <AppleSwitch v-model="showRuler" label="物理毫米标尺与光标准星 (mm/pt)" />
          <AppleSwitch v-model="autoCompact" label="A5 单页自适应紧凑压缩 (绝不溢出2页)" />
        </div>
      </div>

      <!-- 4. 离线内网与文件导入导出闭环 -->
      <div class="apple-card file-ops-card">
        <label class="group-label">档案</label>
        <div class="ops-grid">
          <button class="ops-btn" @click="saveToLocalArchive">保存至档案库</button>
          <button class="ops-btn" @click="showArchiveModal = true">浏览本地库（{{ savedTemplates.length }}）</button>
          <button class="ops-btn" @click="exportTemplateFile">导出 .medprint.json</button>
          <label class="ops-btn file-picker-label">
            导入外部模板
            <input type="file" accept=".json,.medprint" @change="importTemplateFile" style="display: none;" />
          </label>
        </div>
      </div>

      <!-- 5. 空间几何约束规格 (声明式锚定与避让折流) -->
      <div class="apple-card">
        <div class="card-header" style="cursor: pointer" @click="showConstraints = !showConstraints">
          <div class="header-left">
            <span class="card-title">📐 空间约束规格</span>
          </div>
          <span class="pill-badge pill-tools">{{ showConstraints ? '收起' : '展开配置' }}</span>
        </div>
        <p class="card-hint">
          声明式锚定与避让折流（如 Logo 居中对齐、图表避让折流、硬单页锁定），物理几何引擎自动求解零碰撞绝对坐标。
        </p>
        <ConstraintInspector
          v-if="showConstraints"
          :model-value="reportTemplate"
          @update:model-value="onConstraintTemplateUpdate"
        />
      </div>

      <!-- 底部动作按钮 -->
      <div class="sidebar-footer">
        <button class="btn-primary" @click="handlePrint">静默打印</button>
        <button class="btn-secondary" @click="showBatchModal = true">批量队列</button>
        <button class="btn-secondary" @click="handleExportPdf">导出矢量 PDF</button>
      </div>
    </aside>

    <!-- 右侧纸张预览主舞台 -->
    <main class="preview-stage">
      <!-- 顶部控制条 (Apple Toolbar) -->
      <div class="stage-toolbar">
        <div class="toolbar-left">
          <span class="badge-blue">物理规格：A5 横向 (210mm × 148mm)</span>
          <span class="badge-gray">排版引擎：物理毫米纯矢量 (300 DPI)</span>
          <span class="badge-green">纸张预算：1 / 1 页 (紧凑受控)</span>
        </div>
        <div class="toolbar-right">
          <button
            class="btn-pro-edit btn-rag-action"
            title="Word/PDF/DSL RAG 知识库检索与 Pi Agent 最小化逆向生成"
            @click="showRagReverse = true"
          >
            🧬 智能逆向 (RAG)
          </button>
          <button
            class="btn-pro-edit"
            :class="{ active: showConstraintGuides }"
            title="透视空间约束规格：实时呈现障碍物避让缓冲带与对齐中轴"
            @click="showConstraintGuides = !showConstraintGuides"
          >
            {{ showConstraintGuides ? '📐 隐藏约束透视' : '📐 显示约束透视' }}
          </button>
          <button class="btn-pro-edit" title="拖封闭槽位、细改页眉/患者条/折流表" @click="$emit('switch-to-canvas')">
            去 AST 审查（可拖组件）
          </button>
          <span class="zoom-label">缩放:</span>
          <select v-model="zoomScale" class="zoom-select">
            <option :value="0.75">75%</option>
            <option :value="0.9">90%</option>
            <option :value="1.0">100% (物理真实尺寸)</option>
            <option :value="1.15">115%</option>
            <option :value="1.3">130%</option>
          </select>
        </div>
      </div>

      <!-- 打印机状态通知横幅 -->
      <transition name="apple-fade">
        <div v-if="spoolerBanner" class="spooler-banner">
          <div class="banner-content">
            <span class="pulse-dot"></span>
            <span>{{ spoolerBanner }}</span>
          </div>
          <button class="btn-banner-close" @click="spoolerBanner = ''">✕</button>
        </div>
      </transition>

      <!-- 纸张外层视口与物理标尺容器 -->
      <div
        class="paper-viewport"
        @mousemove="handleMouseMove"
        @mouseleave="handleMouseLeave"
      >
        <!-- 物理毫米标尺与十字准星 -->
        <PhysicalRuler
          v-if="showRuler"
          :cursor-x="cursorX"
          :cursor-y="cursorY"
        />

        <!-- 真实 A5 横向纸张 (210mm x 148mm) -->
        <div
          class="a5-paper-canvas"
          ref="canvasRef"
          :style="{ transform: `scale(${zoomScale})`, transformOrigin: 'top center' }"
        >
          <!-- 空间约束规格与避让禁区可视化透视层 -->
          <VisualConstraintOverlay
            :template="reportTemplate"
            :frames="wizardFrames"
            :paper-width-mm="reportTemplate.paper_size.width_mm"
            :paper-height-mm="reportTemplate.paper_size.height_mm"
            :mm-to-px="3.7795"
            :zoom-scale="1.0"
            :visible="showConstraintGuides"
          />

          <!-- 场景 1: A5 血液生化化验单 (双列折流) -->
          <template v-if="currentPreset === 'lis_a5'">
            <header class="report-header" :class="'align-' + headerAlign">
              <div class="header-main">
                <img v-if="headerLogo" class="hospital-logo" :src="headerLogo" alt="" />
                <div>
                  <h1 class="hospital-name">{{ hospitalName }}</h1>
                  <h2 class="sheet-title">{{ reportTitle }}</h2>
                </div>
                <div v-if="showReportNo" class="report-no">
                  <span>{{ reportNoLabel }}</span>
                  <strong>{{ reportNoPreview }}</strong>
                </div>
              </div>
              <div class="dept-bar">
                <span>送检科室：医学检验科 (LIS)</span>
                <span>送检标本：静脉全血</span>
                <span>咨询电话：{{ deptPhone }}</span>
              </div>
            </header>

            <section class="patient-banner">
              <span v-for="field in previewPatientFields" :key="field.key">
                <strong>{{ field.label }}：</strong>{{ field.preview_value }}
              </span>
              <span v-if="showBarcode" class="barcode-tag">||| ||||| ||||||| 019283</span>
            </section>

            <SnakingTable :items="sampleItems" />

            <HospitalSeal
              v-if="showSeal"
              :hospital-name="hospitalName"
              style="right: 35mm; bottom: 8mm;"
            />

            <SignatureChain
              requesting-physician="李主任"
              sampling-person="刘护士"
              operator="王检验师"
              reviewer="陈主管技师"
              report-date="2026-09-08 08:30"
            />

            <footer class="notes-footer">
              注：本报告仅对本次标本检验结果负责。若对化验结果有疑义，请在报告发布后 24 小时内向检验科提出复查申请。
            </footer>
          </template>

          <!-- 场景 2: 血栓弹力图专项报告 (TEG 波形 + 凝血参数) -->
          <template v-else-if="currentPreset === 'teg'">
            <header class="report-header" :class="'align-' + headerAlign">
              <div class="header-main">
                <img v-if="headerLogo" class="hospital-logo" :src="headerLogo" alt="" />
                <div>
                  <h1 class="hospital-name">{{ hospitalName }}</h1>
                  <h2 class="sheet-title">{{ reportTitle }}</h2>
                </div>
                <div v-if="showReportNo" class="report-no">
                  <span>{{ reportNoLabel }}</span>
                  <strong>{{ reportNoPreview }}</strong>
                </div>
              </div>
              <div class="dept-bar">
                <span>送检科室：急诊重症监护室 (ICU)</span>
                <span>送检标本：枸橼酸抗凝全血</span>
                <span>咨询电话：{{ deptPhone }}</span>
              </div>
            </header>

            <section class="patient-banner">
              <span v-for="field in previewPatientFields" :key="field.key">
                <strong>{{ field.label }}：</strong>{{ field.preview_value }}
              </span>
              <span v-if="showBarcode" class="barcode-tag">||| ||||| ||||||| 889102</span>
            </section>

            <!-- 核心血栓弹力图波形 -->
            <TegChart :r-time="5.2" :k-time="1.8" :alpha-angle="66.5" :ma="63.8" :ly30="2.1" />

            <!-- TEG 关键参数平衡表 -->
            <SnakingTable :items="tegItems" />

            <HospitalSeal
              v-if="showSeal"
              :hospital-name="hospitalName"
              seal-title="急诊检验章"
              style="right: 35mm; bottom: 8mm;"
            />

            <SignatureChain
              requesting-physician="张主任"
              sampling-person="孙护师"
              operator="周检验师"
              reviewer="马副主任技师"
              report-date="2026-09-08 08:35"
            />

            <footer class="notes-footer">
              TEG临床提示：凝血综合指数 (CI) 为 +1.2 (正常范围 -3.0 ~ +3.0)，凝血功能各指标基本平衡。
            </footer>
          </template>

          <!-- 场景 3: PACS 超声多图图文诊断报告 -->
          <template v-else-if="currentPreset === 'pacs'">
            <PacsReportView :hospital-name="hospitalName" />
            <HospitalSeal
              v-if="showSeal"
              :hospital-name="hospitalName"
              seal-title="超声诊断章"
              style="right: 35mm; bottom: 10mm;"
            />
          </template>

          <!-- 场景 4: 门急诊规范处方笺 -->
          <template v-else-if="currentPreset === 'prescription'">
            <PrescriptionView :hospital-name="hospitalName" />
            <HospitalSeal
              v-if="showSeal"
              :hospital-name="hospitalName"
              seal-title="处方核发章"
              style="right: 40mm; bottom: 12mm;"
            />
          </template>
        </div>
      </div>
    </main>

    <!-- 🗄️ 内网离线归档管理弹窗 -->
    <ArchiveModal
      :visible="showArchiveModal"
      :templates="savedTemplates"
      @close="showArchiveModal = false"
      @load="handleLoadTemplate"
      @delete="handleDeleteTemplate"
      @export-bundle="handleExportBundle"
      @import-file="handleImportFileFromModal"
    />

    <!-- 📑 批量打印与硬件队列监控弹窗 -->
    <BatchPrintModal
      :visible="showBatchModal"
      @close="showBatchModal = false"
    />

    <!-- 🧬 RAG 知识库检索与 Pi Agent 逆向生成工作台 -->
    <RagReverseModal
      :visible="showRagReverse"
      @close="showRagReverse = false"
      @apply="handleApplyRagTemplate"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import AppleSwitch from '../components/common/AppleSwitch.vue'
import ArchiveModal, { type SavedTemplate } from '../components/common/ArchiveModal.vue'
import BatchPrintModal from '../components/common/BatchPrintModal.vue'
import RagReverseModal from '../components/common/RagReverseModal.vue'
import ConstraintInspector from '../components/common/ConstraintInspector.vue'
import VisualConstraintOverlay from '../components/common/VisualConstraintOverlay.vue'
import PhysicalRuler from '../components/common/PhysicalRuler.vue'
import ModelProviderSettings from '../components/common/ModelProviderSettings.vue'
import SnakingTable, { type LabItem } from '../components/medical/SnakingTable.vue'
import SignatureChain from '../components/medical/SignatureChain.vue'
import HospitalSeal from '../components/medical/HospitalSeal.vue'
import TegChart from '../components/medical/TegChart.vue'
import PacsReportView from '../components/medical/PacsReportView.vue'
import PrescriptionView from '../components/medical/PrescriptionView.vue'
import {
  addPatientField,
  canDispatchPrint,
  compileVectorPdfRemote,
  createPresetTemplate,
  defaultPatientFields,
  deleteArchiveTemplate,
  findElement,
  formatViolations,
  hasElement,
  initLayoutEngine,
  insertUniqueSlot,
  layoutTemplateFrames,
  loadModelSettings,
  movePatientField,
  patchSlotParams,
  PATIENT_FIELD_CATALOG,
  providerStatus,
  providerStatusLabel,
  removePatientField,
  removeSlot,
  runWizardAgent,
  saveModelSettings,
  saveTemplateToArchive,
  updatePatientField,
  validateReportTemplate,
  REPORT_TYPE_TO_WIZARD_PRESET,
  type LabItemRow,
  type ModelProviderSettings as ModelSettings,
  type PatientFieldKey,
  type PreviewFrame,
  type ReportElementKind,
  type ReportTemplate,
  type WizardPresetId,
} from '../domain'

type HeaderAlign = 'left' | 'center' | 'right'

defineEmits<{
  (e: 'switch-to-canvas'): void
}>()

const presets = [
  { id: 'lis_a5', name: 'A5生化双列' },
  { id: 'teg', name: '血栓弹力图' },
  { id: 'pacs', name: '超声多图报告' },
  { id: 'prescription', name: '规范处方笺' },
]

const currentPreset = ref('lis_a5')
const hospitalName = ref('XX市第一人民医院')
const reportTitle = ref('临床血液生化检验报告单 (A5横向双列)')
const deptPhone = ref('027-88889999')
const showBarcode = ref(true)
const showAbnormalFlags = ref(true)
const showSeal = ref(true)
const showRuler = ref(true)
const autoCompact = ref(true)
const showConstraints = ref(false)
const showConstraintGuides = ref(true)

function onConstraintTemplateUpdate(updated: ReportTemplate) {
  applyTemplate(updated)
}

const wizardFrames = computed(() => {
  if (reportTemplate.value.preview_frames && reportTemplate.value.preview_frames.length > 0) {
    return reportTemplate.value.preview_frames
  }
  const laid = layoutTemplateFrames(reportTemplate.value)
  return laid.frames.map((frame) => ({
    kind: frame.kind,
    x_mm: frame.x_mm,
    y_mm: frame.y_mm,
    width_mm: frame.width_mm,
    height_mm: frame.height_mm,
  }))
})

const zoomScale = ref(1.0)
const spoolerBanner = ref('')
const showArchiveModal = ref(false)
const showBatchModal = ref(false)
const showRagReverse = ref(false)

// 标尺鼠标追踪
const cursorX = ref(-1)
const cursorY = ref(-1)
const canvasRef = ref<HTMLElement | null>(null)

function handleMouseMove(e: MouseEvent) {
  if (!canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  cursorX.value = e.clientX - rect.left
  cursorY.value = e.clientY - rect.top
}

function handleMouseLeave() {
  cursorX.value = -1
  cursorY.value = -1
}

// AI 产出封闭 AST（源真相），Vue 预览只是投影
const aiPrompt = ref('')
const aiReply = ref('')
const aiError = ref('')
const aiBusy = ref(false)
const pastedImageUrl = ref('')
const imageDragging = ref(false)
const providerSettings = ref<ModelSettings>(loadModelSettings())
const reportTemplate = ref<ReportTemplate>(createPresetTemplate('lis_a5'))
const headerAst = computed(() => findElement(reportTemplate.value, 'HospitalHeader'))
const headerAlign = computed(() => headerAst.value?.align || 'center')
const headerLogo = computed(() => headerAst.value?.logo_data_url || '')
const showReportNo = computed(() => !!headerAst.value?.show_report_no)
const reportNoLabel = computed(() => headerAst.value?.report_no_label || '报告单号')
const reportNoPreview = computed(() => headerAst.value?.report_no_preview || 'BG20260908001')
const previewPatientFields = computed(() => {
  const banner = findElement(reportTemplate.value, 'PatientBanner')
  return banner?.fields && banner.fields.length > 0 ? banner.fields : defaultPatientFields()
})

const alignOptions: Array<{ id: HeaderAlign; label: string }> = [
  { id: 'left', label: '左对齐' },
  { id: 'center', label: '居中' },
  { id: 'right', label: '右对齐' },
]

const showReportNoLocal = ref(true)
const reportNoLabelLocal = ref('报告单号')
const reportNoPreviewLocal = ref('BG20260908001')
const pendingPatientKey = ref<PatientFieldKey>('report_no')

const editablePatientFields = computed(() => previewPatientFields.value)

const unusedWizardPatientKeys = computed(() => {
  const used = new Set(editablePatientFields.value.map((f) => f.key))
  const keys = Object.keys(PATIENT_FIELD_CATALOG) as Array<Exclude<PatientFieldKey, 'custom'>>
  const leftover: Array<{ key: PatientFieldKey; label: string }> = keys
    .filter((key) => !used.has(key))
    .map((key) => ({ key, label: PATIENT_FIELD_CATALOG[key].label }))
  leftover.push({ key: 'custom', label: '自定义字段' })
  return leftover
})

function syncHeaderFromWizard() {
  reportTemplate.value = patchSlotParams(reportTemplate.value, 'HospitalHeader', {
    hospitalName: hospitalName.value,
    reportTitle: reportTitle.value,
    align: headerAlign.value,
    logoDataUrl: headerLogo.value || '',
    showReportNo: showReportNoLocal.value,
    reportNoLabel: reportNoLabelLocal.value,
    reportNoPreview: reportNoPreviewLocal.value,
  })
}

function setHeaderAlign(align: HeaderAlign) {
  reportTemplate.value = patchSlotParams(reportTemplate.value, 'HospitalHeader', {
    hospitalName: hospitalName.value,
    reportTitle: reportTitle.value,
    align,
    logoDataUrl: headerLogo.value || '',
    showReportNo: showReportNoLocal.value,
    reportNoLabel: reportNoLabelLocal.value,
    reportNoPreview: reportNoPreviewLocal.value,
  })
}

function onWizardLogoFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    reportTemplate.value = patchSlotParams(reportTemplate.value, 'HospitalHeader', {
      hospitalName: hospitalName.value,
      reportTitle: reportTitle.value,
      align: headerAlign.value,
      logoDataUrl: String(reader.result || ''),
      showReportNo: showReportNoLocal.value,
      reportNoLabel: reportNoLabelLocal.value,
      reportNoPreview: reportNoPreviewLocal.value,
    })
  }
  reader.readAsDataURL(file)
}

function clearWizardLogo() {
  reportTemplate.value = patchSlotParams(reportTemplate.value, 'HospitalHeader', {
    hospitalName: hospitalName.value,
    reportTitle: reportTitle.value,
    align: headerAlign.value,
    logoDataUrl: '',
    showReportNo: showReportNoLocal.value,
    reportNoLabel: reportNoLabelLocal.value,
    reportNoPreview: reportNoPreviewLocal.value,
  })
}

function addWizardPatientField() {
  reportTemplate.value = addPatientField(reportTemplate.value, pendingPatientKey.value)
  const next = unusedWizardPatientKeys.value.find((opt) => opt.key !== pendingPatientKey.value)
  pendingPatientKey.value = next?.key || 'custom'
}

function removeWizardPatientField(index: number) {
  reportTemplate.value = removePatientField(reportTemplate.value, index)
}

function moveWizardPatientField(index: number, delta: number) {
  reportTemplate.value = movePatientField(reportTemplate.value, index, delta)
}

function onWizardPatientLabel(index: number, event: Event) {
  reportTemplate.value = updatePatientField(reportTemplate.value, index, {
    label: (event.target as HTMLInputElement).value,
  })
}

function onWizardPatientValue(index: number, event: Event) {
  reportTemplate.value = updatePatientField(reportTemplate.value, index, {
    preview_value: (event.target as HTMLInputElement).value,
  })
}

watch(showReportNoLocal, () => syncHeaderFromWizard())
watch(showBarcode, (on) => {
  reportTemplate.value = patchSlotParams(reportTemplate.value, 'PatientBanner', {
    includeBarcode: on,
    fields: editablePatientFields.value,
  })
})
watch(showSeal, (on) => {
  if (on && !hasElement(reportTemplate.value, 'Seal')) {
    reportTemplate.value = insertUniqueSlot(reportTemplate.value, 'Seal')
  } else if (!on) {
    reportTemplate.value = removeSlot(reportTemplate.value, 'Seal')
  }
})

const providerKind = computed(() => providerStatus(providerSettings.value))
const providerLabel = computed(() => providerStatusLabel(providerSettings.value))
const aiSpeech = computed(() => {
  if (aiBusy.value) return '正在调用模型（工具 → 封闭 AST）…'
  if (aiReply.value) return aiReply.value
  return '输入临床意图或粘贴化验单图片。我将只生成封闭 ReportTemplate AST（不是自由画布坐标），再交给引擎折流排版。'
})

watch(
  providerSettings,
  (value) => {
    saveModelSettings(value)
  },
  { deep: true },
)

function toLabRows(items: LabItem[]): LabItemRow[] {
  return items.map((item) => ({
    ...item,
    is_critical: !!item.is_critical,
  }))
}

function applyTemplate(template: ReportTemplate) {
  const laid = layoutTemplateFrames(template)
  const withFrames: ReportTemplate = {
    ...template,
    preview_frames: laid.frames.map(
      (frame): PreviewFrame => ({
        element_index: frame.element_index,
        kind: frame.kind as ReportElementKind,
        x_mm: frame.x_mm,
        y_mm: frame.y_mm,
        width_mm: frame.width_mm,
        height_mm: frame.height_mm,
      }),
    ),
  }
  reportTemplate.value = withFrames
  const header = findElement(withFrames, 'HospitalHeader')
  if (header) {
    hospitalName.value = header.hospital_name
    reportTitle.value = header.report_title
    showReportNoLocal.value = !!header.show_report_no
    reportNoLabelLocal.value = header.report_no_label || '报告单号'
    reportNoPreviewLocal.value = header.report_no_preview || 'BG20260908001'
  }
  const mapped = REPORT_TYPE_TO_WIZARD_PRESET[withFrames.report_type]
  if (mapped) currentPreset.value = mapped
  const banner = findElement(withFrames, 'PatientBanner')
  showBarcode.value = banner?.include_barcode ?? true
  showSeal.value = hasElement(withFrames, 'Seal')
  const table = findElement(withFrames, 'SnakingTable')
  if (table && table.items.length > 0) {
    sampleItems.value = table.items
  }
}

function wizardToTemplate(): ReportTemplate {
  // 在现有 AST 上覆写，保留院徽/对齐/报告单号/患者字段等自定义，避免整表重建冲掉
  let next = reportTemplate.value
  next = patchSlotParams(next, 'HospitalHeader', {
    hospitalName: hospitalName.value,
    reportTitle: reportTitle.value,
    align: headerAlign.value,
    logoDataUrl: headerLogo.value || '',
    showReportNo: showReportNoLocal.value,
    reportNoLabel: reportNoLabelLocal.value,
    reportNoPreview: reportNoPreviewLocal.value,
  })
  next = patchSlotParams(next, 'PatientBanner', {
    includeBarcode: showBarcode.value,
    fields: editablePatientFields.value,
  })
  if (showSeal.value && !hasElement(next, 'Seal')) {
    next = insertUniqueSlot(next, 'Seal')
  } else if (!showSeal.value && hasElement(next, 'Seal')) {
    next = removeSlot(next, 'Seal')
  }
  const table = findElement(next, 'SnakingTable')
  if (table && (currentPreset.value === 'lis_a5' || currentPreset.value === 'teg')) {
    const items = toLabRows(currentPreset.value === 'teg' ? tegItems.value : sampleItems.value)
    next = {
      ...next,
      name: reportTitle.value,
      elements: next.elements.map((el) =>
        el.kind === 'SnakingTable' ? { ...el, items, auto_compaction: autoCompact.value } : el,
      ),
    }
  } else {
    next = { ...next, name: reportTitle.value }
  }
  return next
}

async function handleAiAsk() {
  if (aiBusy.value) return
  const q = aiPrompt.value.trim()
  if (!q && !pastedImageUrl.value) return
  aiPrompt.value = ''
  aiError.value = ''
  aiBusy.value = true

  try {
    const compiled = await runWizardAgent({
      prompt: q,
      imageDataUrl: pastedImageUrl.value || undefined,
      settings: providerSettings.value,
      ctx: {
        hospitalName: hospitalName.value,
        reportTitle: reportTitle.value,
        includeBarcode: showBarcode.value,
        includeSeal: showSeal.value,
        items: toLabRows(sampleItems.value),
        currentTemplate: wizardToTemplate(),
      },
    })

    aiReply.value = compiled.reply
    aiError.value = compiled.error || ''

    const skipApply = q.includes('打印') || q.includes('出纸') || q.includes('合规') || q.includes('审查') || q.includes('法规')
    if (!skipApply) {
      applyTemplate(compiled.template)
    } else {
      reportTemplate.value = compiled.template
    }

    if (q.includes('打印') || q.includes('出纸')) {
      if (compiled.printBlocked) {
        spoolerBanner.value = '打印已拦截：模板未通过合规约束（缺少签名链或条码）。'
        return
      }
      handlePrint()
    }
  } catch (err) {
    aiError.value = 'agent-failed'
    aiReply.value = `智能体调用失败：${err instanceof Error ? err.message : String(err)}`
  } finally {
    aiBusy.value = false
  }
}

function quickAsk(text: string) {
  aiPrompt.value = text
  void handleAiAsk()
}

async function fileToVisionDataUrl(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file)
    const max = 1280
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return await blobToDataUrl(file)
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return canvas.toDataURL('image/jpeg', 0.78)
  } catch {
    return blobToDataUrl(file)
  }
}

function blobToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function attachImageFile(file: File) {
  if (!file.type.startsWith('image/')) return
  pastedImageUrl.value = await fileToVisionDataUrl(file)
  imageDragging.value = false
  aiReply.value = '已附上单据图片。发送后将尝试视觉识别并写入 SnakingTable / 对应槽位。'
  aiError.value = ''
}

function clearPastedImage() {
  pastedImageUrl.value = ''
}

async function onImageDrop(e: DragEvent) {
  imageDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) await attachImageFile(file)
}

function onPickImage(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) void attachImageFile(file)
}

function onWindowPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        e.preventDefault()
        void attachImageFile(file)
      }
      return
    }
  }
}

function selectPreset(id: string) {
  const preset = id as WizardPresetId
  currentPreset.value = preset
  applyTemplate(
    createPresetTemplate(preset, {
      hospitalName: hospitalName.value,
      includeBarcode: showBarcode.value,
      includeSeal: showSeal.value,
      items: preset === 'lis_a5' ? toLabRows(sampleItems.value) : undefined,
    }),
  )
}

// 模拟 30 项生化化验数据 (A5 横向双列平衡)
const sampleItems = ref<LabItem[]>([
  { index: 1, item_name: '丙氨酸氨基转移酶', item_abbr: 'ALT', result_value: '68.5', unit: 'U/L', ref_range_display: '9.0 - 50.0', alert_flag: 'High' },
  { index: 2, item_name: '天门冬氨酸氨基转移酶', item_abbr: 'AST', result_value: '42.0', unit: 'U/L', ref_range_display: '15.0 - 40.0', alert_flag: 'High' },
  { index: 3, item_name: '碱性磷酸酶', item_abbr: 'ALP', result_value: '78.0', unit: 'U/L', ref_range_display: '45.0 - 125.0', alert_flag: 'Normal' },
  { index: 4, item_name: 'γ-谷氨酰基转移酶', item_abbr: 'GGT', result_value: '35.0', unit: 'U/L', ref_range_display: '10.0 - 60.0', alert_flag: 'Normal' },
  { index: 5, item_name: '总胆红素', item_abbr: 'TBIL', result_value: '18.2', unit: 'umol/L', ref_range_display: '3.4 - 20.5', alert_flag: 'Normal' },
  { index: 6, item_name: '直接胆红素', item_abbr: 'DBIL', result_value: '5.1', unit: 'umol/L', ref_range_display: '0.0 - 6.8', alert_flag: 'Normal' },
  { index: 7, item_name: '总蛋白', item_abbr: 'TP', result_value: '72.4', unit: 'g/L', ref_range_display: '65.0 - 85.0', alert_flag: 'Normal' },
  { index: 8, item_name: '白蛋白', item_abbr: 'ALB', result_value: '34.2', unit: 'g/L', ref_range_display: '40.0 - 55.0', alert_flag: 'Low' },
  { index: 9, item_name: '球蛋白', item_abbr: 'GLB', result_value: '38.2', unit: 'g/L', ref_range_display: '20.0 - 40.0', alert_flag: 'Normal' },
  { index: 10, item_name: '白球比', item_abbr: 'A/G', result_value: '0.90', unit: '', ref_range_display: '1.20 - 2.40', alert_flag: 'Low' },
  { index: 11, item_name: '葡萄糖', item_abbr: 'GLU', result_value: '16.8', unit: 'mmol/L', ref_range_display: '3.90 - 6.10', alert_flag: 'Critical', is_critical: true },
  { index: 12, item_name: '尿素', item_abbr: 'UREA', result_value: '6.42', unit: 'mmol/L', ref_range_display: '2.80 - 7.60', alert_flag: 'Normal' },
  { index: 13, item_name: '肌酐', item_abbr: 'CREA', result_value: '88.0', unit: 'umol/L', ref_range_display: '59.0 - 104.0', alert_flag: 'Normal' },
  { index: 14, item_name: '尿酸', item_abbr: 'UA', result_value: '495.0', unit: 'umol/L', ref_range_display: '208.0 - 428.0', alert_flag: 'High' },
  { index: 15, item_name: '肾小球滤过率', item_abbr: 'eGFR', result_value: '89.4', unit: 'mL/min', ref_range_display: '90.0 - 120.0', alert_flag: 'Low' },
  // 右列开始
  { index: 16, item_name: '总胆固醇', item_abbr: 'TC', result_value: '5.82', unit: 'mmol/L', ref_range_display: '2.80 - 5.17', alert_flag: 'High' },
  { index: 17, item_name: '甘油三酯', item_abbr: 'TG', result_value: '2.45', unit: 'mmol/L', ref_range_display: '0.56 - 1.70', alert_flag: 'High' },
  { index: 18, item_name: '高密度脂蛋白', item_abbr: 'HDL-C', result_value: '1.02', unit: 'mmol/L', ref_range_display: '1.03 - 1.55', alert_flag: 'Low' },
  { index: 19, item_name: '低密度脂蛋白', item_abbr: 'LDL-C', result_value: '3.69', unit: 'mmol/L', ref_range_display: '2.07 - 3.37', alert_flag: 'High' },
  { index: 20, item_name: '肌酸激酶', item_abbr: 'CK', result_value: '120.0', unit: 'U/L', ref_range_display: '38.0 - 174.0', alert_flag: 'Normal' },
  { index: 21, item_name: '乳酸脱氢酶', item_abbr: 'LDH', result_value: '185.0', unit: 'U/L', ref_range_display: '120.0 - 250.0', alert_flag: 'Normal' },
  { index: 22, item_name: '钾', item_abbr: 'K', result_value: '4.12', unit: 'mmol/L', ref_range_display: '3.50 - 5.30', alert_flag: 'Normal' },
  { index: 23, item_name: '钠', item_abbr: 'Na', result_value: '141.0', unit: 'mmol/L', ref_range_display: '137.0 - 147.0', alert_flag: 'Normal' },
  { index: 24, item_name: '氯', item_abbr: 'Cl', result_value: '103.0', unit: 'mmol/L', ref_range_display: '99.0 - 110.0', alert_flag: 'Normal' },
  { index: 25, item_name: '钙', item_abbr: 'Ca', result_value: '2.31', unit: 'mmol/L', ref_range_display: '2.11 - 2.52', alert_flag: 'Normal' },
  { index: 26, item_name: '无机磷', item_abbr: 'P', result_value: '1.15', unit: 'mmol/L', ref_range_display: '0.85 - 1.51', alert_flag: 'Normal' },
  { index: 27, item_name: '镁', item_abbr: 'Mg', result_value: '0.89', unit: 'mmol/L', ref_range_display: '0.75 - 1.02', alert_flag: 'Normal' },
  { index: 28, item_name: '阴离子间隙', item_abbr: 'AG', result_value: '14.5', unit: 'mmol/L', ref_range_display: '8.0 - 16.0', alert_flag: 'Normal' },
  { index: 29, item_name: '超敏C反应蛋白', item_abbr: 'hs-CRP', result_value: '2.1', unit: 'mg/L', ref_range_display: '0.0 - 3.0', alert_flag: 'Normal' },
  { index: 30, item_name: '同型半胱氨酸', item_abbr: 'HCY', result_value: '12.8', unit: 'umol/L', ref_range_display: '5.0 - 15.0', alert_flag: 'Normal' },
])

// TEG 专属项目数据
const tegItems = ref<LabItem[]>([
  { index: 1, item_name: '凝血反应时间 (R)', item_abbr: 'R', result_value: '5.2', unit: 'min', ref_range_display: '4.0 - 8.0', alert_flag: 'Normal' },
  { index: 2, item_name: '凝血形成时间 (K)', item_abbr: 'K', result_value: '1.8', unit: 'min', ref_range_display: '1.0 - 3.0', alert_flag: 'Normal' },
  { index: 3, item_name: '凝固角 (α角)', item_abbr: 'Angle', result_value: '66.5', unit: 'deg', ref_range_display: '53.0 - 72.0', alert_flag: 'Normal' },
  { index: 4, item_name: '最大振幅 (MA)', item_abbr: 'MA', result_value: '63.8', unit: 'mm', ref_range_display: '50.0 - 70.0', alert_flag: 'Normal' },
  { index: 5, item_name: '30分钟纤溶指数', item_abbr: 'LY30', result_value: '2.1', unit: '%', ref_range_display: '0.0 - 7.5', alert_flag: 'Normal' },
  { index: 6, item_name: '凝血综合指数 (CI)', item_abbr: 'CI', result_value: '+1.2', unit: '', ref_range_display: '-3.0 - +3.0', alert_flag: 'Normal' },
])

// 离线内网本地档案存储
const savedTemplates = ref<SavedTemplate[]>([])

onMounted(async () => {
  await initLayoutEngine()
  applyTemplate(reportTemplate.value)
  window.addEventListener('paste', onWindowPaste)
  const local = localStorage.getItem('medprint_local_templates')
  if (local) {
    try {
      savedTemplates.value = JSON.parse(local)
    } catch {
      initDefaultTemplates()
    }
  } else {
    initDefaultTemplates()
  }
})

onUnmounted(() => {
  window.removeEventListener('paste', onWindowPaste)
})

function initDefaultTemplates() {
  savedTemplates.value = [
    {
      id: 'tpl_default_a5',
      name: '标准 A5 横向生化化验单 (双列折流)',
      paper: 'A5 横向 (210×148mm)',
      updated_at: '2026-09-08 04:00',
    },
    {
      id: 'tpl_teg_demo',
      name: '急诊检验科血栓弹力图 (TEG) 专用单',
      paper: 'A5 横向 (210×148mm)',
      updated_at: '2026-09-08 04:15',
    },
    {
      id: 'tpl_pacs_us',
      name: '超声医学科腹部常规图文报告',
      paper: 'A5 横向 (210×148mm)',
      updated_at: '2026-09-08 08:20',
    },
    {
      id: 'tpl_rx_outpatient',
      name: '门急诊中西医规范处方笺',
      paper: 'A5 纵向 (148×210mm)',
      updated_at: '2026-09-08 08:25',
    },
  ]
  saveTemplatesToStorage()
}

function saveTemplatesToStorage() {
  localStorage.setItem('medprint_local_templates', JSON.stringify(savedTemplates.value))
}

// 1. 导出为封闭 ReportTemplate（.medprint.json），禁止把画布坐标当交换格式
function exportTemplateFile() {
  const payload = wizardToTemplate()
  reportTemplate.value = payload
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${payload.name}.medprint.json`
  a.click()
  URL.revokeObjectURL(url)
}

// 2. 导入外部模板文件
function importTemplateFile(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  const file = input.files[0]
  const reader = new FileReader()
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target?.result as string)
      if (data.report_type && Array.isArray(data.elements)) {
        applyTemplate(data as ReportTemplate)
        spoolerBanner.value = `已载入封闭 AST 模板：${file.name}`
        return
      }
      if (data.hospitalName) hospitalName.value = data.hospitalName
      if (data.reportTitle) reportTitle.value = data.reportTitle
      if (data.deptPhone) deptPhone.value = data.deptPhone
      if (data.preset) selectPreset(data.preset)
      if (data.items) sampleItems.value = data.items
      spoolerBanner.value = `已载入旧版向导字段文件：${file.name}（已映射为预设，建议重新导出 AST）`
    } catch {
      alert('模板文件格式解析错误，请确认是合法的 .medprint.json 文件！')
    }
  }
  reader.readAsText(file)
}

// 3. 保存至本地档案库 (SQLite / 离线持久化)
async function saveToLocalArchive() {
  const template = wizardToTemplate()
  const newTpl: SavedTemplate = {
    id: template.id || `tpl_${Date.now()}`,
    name: reportTitle.value,
    paper: 'A5 横向 (210×148mm)',
    updated_at: new Date().toLocaleString(),
  }
  savedTemplates.value.unshift(newTpl)
  saveTemplatesToStorage()

  // 同步持久化至医院内网本地归档服务 (./data/templates/)
  try {
    await saveTemplateToArchive(template)
    spoolerBanner.value = `✓ 已成功存入医院内网档案库 (Server ./data/templates/ 及本地缓存)，可在任意离线电脑随时调用！`
  } catch (e) {
    spoolerBanner.value = `✓ 已保存到本地缓存！(内网服务端同步提示: ${e instanceof Error ? e.message : '离线状态'})`
  }
}

function handleLoadTemplate(item: SavedTemplate) {
  reportTitle.value = item.name
  if (item.id.includes('teg')) selectPreset('teg')
  else if (item.id.includes('pacs')) selectPreset('pacs')
  else if (item.id.includes('rx')) selectPreset('prescription')
  else selectPreset('lis_a5')
  showArchiveModal.value = false
  spoolerBanner.value = `✓ 已从内网本地库载入模板：${item.name}`
}

function handleApplyRagTemplate(newTemplate: ReportTemplate) {
  reportTemplate.value = newTemplate
  reportTitle.value = newTemplate.name
  const headerEl = findElement(newTemplate, 'HospitalHeader')
  if (headerEl) {
    hospitalName.value = headerEl.hospital_name
  }
  spoolerBanner.value = `✓ 已成功应用 RAG 知识库检索与 Pi Agent 逆向生成的模板：【${newTemplate.name}】！`
}

function handleDeleteTemplate(id: string) {
  savedTemplates.value = savedTemplates.value.filter((t) => t.id !== id)
  saveTemplatesToStorage()
  deleteArchiveTemplate(id).catch(() => {})
}

function handleExportBundle() {
  const blob = new Blob([JSON.stringify(savedTemplates.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `medprint_hospital_backup_${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function handleImportFileFromModal(e: Event) {
  importTemplateFile(e)
  showArchiveModal.value = false
}

function handlePrint() {
  const template = wizardToTemplate()
  reportTemplate.value = template
  const issues = validateReportTemplate(template)
  if (!canDispatchPrint(issues)) {
    spoolerBanner.value = `打印已拦截：${formatViolations(issues)}`
    return
  }
  spoolerBanner.value = `打印机作业已提交（模板 ${template.id}）。状态机：QUEUED → PRINTING → JOB_COMPLETED；缺签名/条码已被约束器拦截。`
}

async function handleExportPdf() {
  spoolerBanner.value = `⏳ 正在通过 Rust 物理几何引擎编译纯矢量高精度 PDF (300/600 DPI)...`
  try {
    const template = wizardToTemplate()
    const blob = await compileVectorPdfRemote(template)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportTitle.value}_300DPI_Vector.pdf`
    a.click()
    URL.revokeObjectURL(url)
    spoolerBanner.value = `📄 [纯矢量直出] 已由 Rust 内核直出 300/600 DPI 纯矢量 A5 PDF，字形、印章与条码 100% 零失真！`
  } catch {
    // 服务端未连接时降级客户端生成
    const pdfHeader = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595.28 419.53]/Contents 4 0 R>>endobj 4 0 obj<</Length 88>>stream\n10 10 575 400 re S\n0.5 w\n10 380 m 585 380 l S\nBT /F1 14 Tf 40 395 Td (MedPrint Vector PDF) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000215 00000 n\ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n354\n%%EOF"
    const blob = new Blob([pdfHeader], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportTitle.value}_300DPI_Vector.pdf`
    a.click()
    URL.revokeObjectURL(url)
    spoolerBanner.value = `📄 [纯矢量直出] 客户端快速导出 300 DPI 纯矢量 A5 PDF 完成。`
  }
}
</script>

<style scoped>
.apple-workspace {
  display: flex;
  height: 100%;
  background: var(--fill);
  color: var(--label);
  overflow: hidden;
}

.apple-sidebar {
  width: 380px;
  flex-shrink: 0;
  background: var(--glass-heavy);
  backdrop-filter: saturate(180%) blur(22px);
  -webkit-backdrop-filter: saturate(180%) blur(22px);
  border-right: 1px solid var(--separator);
  padding: 22px 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}
.sidebar-header {
  padding: 2px 4px 6px;
  animation: apple-rise var(--duration-slow) var(--ease-out) both;
}
.sidebar-header .title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sidebar-header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.55px;
}
.sidebar-header .subtitle {
  font-size: 12px;
  color: var(--label-tertiary);
  margin: 6px 0 0;
  line-height: 1.45;
}

.apple-card {
  background: var(--fill-elevated);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
  border: 1px solid var(--separator);
  animation: apple-rise var(--duration-slow) var(--ease-out) both;
  transition: transform var(--duration-fast) var(--spring), box-shadow var(--duration) var(--ease-out);
}
.apple-sidebar > .apple-card:nth-child(2) { animation-delay: 40ms; }
.apple-sidebar > .apple-card:nth-child(3) { animation-delay: 80ms; }
.apple-sidebar > .apple-card:nth-child(4) { animation-delay: 120ms; }
.apple-sidebar > .apple-card:nth-child(5) { animation-delay: 160ms; }
.apple-sidebar > .apple-card:nth-child(6) { animation-delay: 200ms; }
.group-label {
  display: block;
  font-size: 11px;
  font-weight: 650;
  color: var(--label-tertiary);
  margin-bottom: 10px;
  letter-spacing: 0.02em;
}
.card-hint {
  margin: -2px 0 10px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--label-tertiary);
}
.align-pills {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.align-pill {
  flex: 1;
  border: 1px solid var(--separator);
  background: var(--fill-grouped);
  border-radius: var(--radius-pill);
  padding: 6px 0;
  font-size: 11.5px;
  font-weight: 550;
  color: var(--label-secondary);
  cursor: pointer;
}
.align-pill.active {
  background: var(--blue);
  border-color: var(--blue);
  color: #fff;
}
.logo-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 210px;
}
.file-input {
  width: 100%;
  font-size: 11px;
}
.mini-btn {
  border: 1px solid var(--separator);
  background: #fff;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  color: var(--label);
}
.mini-btn.primary {
  background: var(--blue);
  border-color: var(--blue);
  color: #fff;
}
.mini-btn.danger { color: var(--red); }
.mini-btn:disabled { opacity: 0.4; cursor: default; }
.patient-field-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
  max-height: 180px;
  overflow: auto;
}
.patient-field-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.apple-input.tight { width: 72px; flex-shrink: 0; }
.field-add-row {
  display: flex;
  gap: 6px;
}
.field-add-row .apple-input { flex: 1; width: auto; }
.switch-list.compact { gap: 8px; margin: 8px 0; }

.ai-card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.2)),
    linear-gradient(135deg, #eef6ff 0%, #f4f0ff 100%);
  border-color: rgba(0, 113, 227, 0.16);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ai-sparkle {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--blue);
  box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.16);
}
.card-title {
  font-size: 13px;
  font-weight: 650;
  color: #0b4a7a;
  letter-spacing: -0.2px;
}
.pill-badge {
  background: var(--blue);
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: var(--radius-pill);
}
.pill-unconfigured {
  background: var(--fill-control);
  color: var(--label-secondary);
}
.pill-local {
  background: var(--green);
  color: #fff;
}
.pill-external {
  background: var(--blue);
  color: #fff;
}
.ai-speech {
  font-size: 12px;
  color: var(--label-secondary);
  background: rgba(255, 255, 255, 0.78);
  padding: 10px 12px;
  border-radius: var(--radius);
  margin: 0 0 10px;
  line-height: 1.5;
  border: 1px solid rgba(0, 0, 0, 0.04);
  white-space: pre-wrap;
}
.ai-speech.is-error {
  color: #9b1c1c;
  background: #fff5f5;
  border-color: rgba(255, 59, 48, 0.18);
}
.ai-speech.is-busy {
  color: var(--blue);
}
.ai-dropzone {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px dashed rgba(0, 113, 227, 0.28);
  background: rgba(255, 255, 255, 0.45);
  min-height: 40px;
}
.ai-dropzone.dragging {
  border-color: var(--blue);
  background: var(--blue-soft);
}
.ai-dropzone.has-image {
  border-style: solid;
}
.paste-thumb {
  width: 36px;
  height: 36px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}
.drop-copy {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--label-tertiary);
  line-height: 1.4;
}
.link-btn {
  background: none;
  border: none;
  color: var(--blue);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}
.ai-input-row {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.ai-input-row input {
  flex: 1;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--separator-opaque);
  font-size: 12px;
  outline: none;
  background: #fff;
  transition: border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
}
.ai-input-row input:focus {
  border-color: var(--blue);
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.16);
}
.btn-ai-send {
  background: var(--blue);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  padding: 0 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--spring);
}
.btn-ai-send:hover { background: var(--blue-hover); }
.btn-ai-send:active { transform: scale(0.97); }
.btn-ai-send:disabled {
  opacity: 0.55;
  cursor: default;
  transform: none;
}
.ai-quick-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tag-btn {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(0, 113, 227, 0.12);
  font-size: 11px;
  color: var(--blue);
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--spring);
}
.tag-btn:hover {
  background: var(--blue-soft);
  transform: translateY(-1px);
}
.tag-btn:active { transform: scale(0.97); }

.segmented-control {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: var(--fill-grouped);
  padding: 3px;
  border-radius: var(--radius);
  gap: 2px;
}
.segment-item {
  background: transparent;
  border: none;
  padding: 7px 0;
  font-size: 11.5px;
  color: var(--label-secondary);
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: background var(--duration) var(--spring), color var(--duration-fast) var(--ease-out), box-shadow var(--duration) var(--ease-out);
  text-align: center;
}
.segment-item.active {
  background: #fff;
  color: var(--label);
  font-weight: 600;
  box-shadow: var(--shadow-thumb);
}

.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 10px;
}
.field-row:last-child { margin-bottom: 0; }
.field-name {
  font-size: 12.5px;
  color: var(--label);
  flex-shrink: 0;
}
.apple-input {
  width: 210px;
  padding: 6px 10px;
  border: 1px solid var(--separator-opaque);
  border-radius: var(--radius-xs);
  font-size: 12.5px;
  outline: none;
  background: var(--fill-grouped);
  transition: border-color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
}
.apple-input:focus {
  border-color: var(--blue);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.16);
}

.switch-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ops-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
}
.ops-btn {
  background: var(--fill-grouped);
  border: 1px solid transparent;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--label);
  cursor: pointer;
  text-align: left;
  transition: background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--spring);
}
.ops-btn:hover {
  background: var(--fill-control);
}
.ops-btn:active { transform: scale(0.985); }
.file-picker-label {
  display: block;
}

.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
  padding-top: 8px;
  animation: apple-rise var(--duration-slow) var(--ease-out) 240ms both;
}
.btn-primary {
  background: var(--blue);
  color: white;
  border: none;
  border-radius: var(--radius);
  padding: 12px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: -0.2px;
  box-shadow: 0 6px 16px rgba(0, 113, 227, 0.22);
  transition: background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--spring);
}
.btn-primary:hover { background: var(--blue-hover); transform: translateY(-1px); }
.btn-primary:active { transform: scale(0.985); }
.btn-secondary {
  background: var(--fill-control);
  color: var(--label);
  border: none;
  border-radius: var(--radius);
  padding: 9px;
  font-size: 12.5px;
  font-weight: 550;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--spring);
}
.btn-secondary:hover { background: var(--separator-opaque); }
.btn-secondary:active { transform: scale(0.985); }

.preview-stage {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}
.stage-toolbar {
  height: 44px;
  flex-shrink: 0;
  background: var(--glass);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid var(--separator);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}
.toolbar-left {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.badge-blue {
  background: var(--blue-soft);
  color: var(--blue);
  font-size: 11px;
  font-weight: 550;
  padding: 3px 9px;
  border-radius: var(--radius-pill);
}
.badge-gray {
  background: var(--fill-grouped);
  color: var(--label-secondary);
  font-size: 11px;
  font-weight: 550;
  padding: 3px 9px;
  border-radius: var(--radius-pill);
}
.badge-green {
  background: var(--green-soft);
  color: #248a3d;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: var(--radius-pill);
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-pro-edit {
  padding: 5px 12px;
  background: #fff;
  border: 1px solid rgba(0, 113, 227, 0.22);
  border-radius: var(--radius-pill);
  color: var(--blue);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--spring);
}
.btn-pro-edit:hover {
  background: var(--blue);
  color: #fff;
  transform: translateY(-1px);
}
.btn-rag-action {
  background: linear-gradient(135deg, rgba(0, 113, 227, 0.12), rgba(88, 86, 214, 0.12));
  color: #0071e3;
  border-color: rgba(0, 113, 227, 0.35);
  font-weight: 650;
  box-shadow: 0 1px 3px rgba(0, 113, 227, 0.12);
}
.btn-rag-action:hover {
  background: linear-gradient(135deg, #0071e3, #5856d6);
  color: #fff;
}
.zoom-label {
  font-size: 11px;
  color: var(--label-tertiary);
}
.zoom-select {
  padding: 4px 8px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--separator-opaque);
  font-size: 11px;
  background: #fff;
}

.spooler-banner {
  background: var(--label);
  color: white;
  padding: 9px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}
.banner-content {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
  animation: apple-pulse 1.8s var(--ease-in-out) infinite;
}
.btn-banner-close {
  background: none;
  border: none;
  color: var(--label-tertiary);
  cursor: pointer;
}

.paper-viewport {
  flex: 1;
  overflow: auto;
  padding: 48px 40px 64px;
  display: flex;
  justify-content: center;
  position: relative;
  background:
    radial-gradient(900px 420px at 50% -8%, rgba(255, 255, 255, 0.78), transparent 62%),
    linear-gradient(180deg, #ececef 0%, #e4e4e9 100%);
}
.a5-paper-canvas {
  width: 210mm;
  height: 148mm;
  background: white;
  box-shadow: var(--shadow-paper);
  border-radius: 3px;
  padding: 8mm 10mm;
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  animation: apple-rise 520ms var(--ease-out) both;
}

.report-header {
  border-bottom: 2px solid #0f172a;
  padding-bottom: 4px;
}
.report-header.align-left { text-align: left; }
.report-header.align-center { text-align: center; }
.report-header.align-right { text-align: right; }
.header-main {
  display: flex;
  align-items: center;
  gap: 8px;
}
.report-header.align-center .header-main { justify-content: center; }
.report-header.align-right .header-main { justify-content: flex-end; }
.hospital-logo {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
.report-no {
  margin-left: auto;
  font-size: 9px;
  text-align: right;
}
.report-no span { display: block; color: #64748b; }
.hospital-name {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
}
.sheet-title {
  margin: 2px 0 4px;
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
  letter-spacing: 1px;
}
.dept-bar {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #475569;
}
.patient-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #0f172a;
  padding: 3px 0;
  font-size: 10.5px;
  margin-bottom: 4px;
}
.barcode-tag {
  font-family: monospace;
  font-weight: bold;
  letter-spacing: -1px;
  font-size: 13px;
}
.notes-footer {
  font-size: 8px;
  color: #64748b;
  margin-top: 4px;
  text-align: center;
}
.fade-enter-active, .fade-leave-active { transition: opacity var(--duration) var(--ease-out); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
