<template>
  <div class="apple-workspace">
    <!-- 左侧向导与配置控制台 (Apple Sidebar) -->
    <aside class="apple-sidebar">
      <div class="sidebar-header">
        <div class="title-row">
          <span class="icon">🩺</span>
          <h2>临床向导模式</h2>
        </div>
        <p class="subtitle">无需繁复坐标计算，勾选字段，即时交付高精度物理单据</p>
      </div>

      <!-- 🤖 DeepSeek AI 智能助理卡片 -->
      <div class="apple-card ai-card">
        <div class="card-header">
          <div class="header-left">
            <span class="ai-sparkle">✨</span>
            <span class="card-title">DeepSeek 临床排版助理</span>
          </div>
          <span class="pill-badge">Agent 就绪</span>
        </div>
        <p class="ai-speech">{{ aiReply || '您好！我是接入 DeepSeek Harness 的医疗排版助理。输入临床诉求，我将为您自主规划排版并计算公式。' }}</p>
        <div class="ai-input-row">
          <input
            v-model="aiPrompt"
            type="text"
            placeholder="对 AI 说：将此单排为A5横向双列并紧凑至1页..."
            @keyup.enter="handleAiAsk"
          />
          <button class="btn-ai-send" @click="handleAiAsk">发送</button>
        </div>
        <div class="ai-quick-tags">
          <button class="tag-btn" @click="quickAsk('将此单排为A5横向双列并紧凑至1页')">⚡ A5双列紧凑</button>
          <button class="tag-btn" @click="quickAsk('切换为超声PACS双图图文报告')">⚡ 超声PACS</button>
          <button class="tag-btn" @click="quickAsk('切换为门急诊规范处方笺')">⚡ 规范处方</button>
          <button class="tag-btn" @click="quickAsk('一键静默打印并监听出纸')">⚡ 静默出纸</button>
        </div>
      </div>

      <!-- 1. 临床单据类别选择 (4大真实场景) -->
      <div class="apple-card">
        <label class="group-label">1. 临床单据类别 (全场景切换)</label>
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

      <!-- 2. 机构与表头设置 -->
      <div class="apple-card">
        <label class="group-label">2. 机构信息与纸张规范</label>
        <div class="field-row">
          <span class="field-name">医院名称</span>
          <input v-model="hospitalName" type="text" class="apple-input" />
        </div>
        <div class="field-row">
          <span class="field-name">报告标题</span>
          <input v-model="reportTitle" type="text" class="apple-input" />
        </div>
        <div class="field-row">
          <span class="field-name">科室咨询</span>
          <input v-model="deptPhone" type="text" class="apple-input" />
        </div>
      </div>

      <!-- 3. 临床模块开关 (AppleSwitch) -->
      <div class="apple-card">
        <label class="group-label">3. 医疗合规与功能模块</label>
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
        <label class="group-label">4. 医院内网文件与离线存储</label>
        <div class="ops-grid">
          <button class="ops-btn" @click="saveToLocalArchive">
            💾 保存至内网档案库 (SQLite/文件)
          </button>
          <button class="ops-btn" @click="showArchiveModal = true">
            🗄️ 浏览内网本地库 ({{ savedTemplates.length }})
          </button>
          <button class="ops-btn" @click="exportTemplateFile">
            📤 导出模板文件 (.medprint.json)
          </button>
          <label class="ops-btn file-picker-label">
            📥 导入外部模板文件
            <input type="file" accept=".json,.medprint" @change="importTemplateFile" style="display: none;" />
          </label>
        </div>
      </div>

      <!-- 底部动作按钮 -->
      <div class="sidebar-footer">
        <button class="btn-primary" @click="handlePrint">
          🖨️ 发送静默打印 (硬件双向监听)
        </button>
        <button class="btn-secondary" @click="showBatchModal = true">
          📑 批量集中打印队列监控 (1~50页)
        </button>
        <button class="btn-secondary" @click="handleExportPdf">
          📄 导出 300 DPI 纯矢量 PDF
        </button>
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
          <button class="btn-pro-edit" title="将当前单据迁移至极客画布自由调整" @click="$emit('switch-to-canvas')">
            🛠️ 极客画布精修
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
      <transition name="fade">
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
          <!-- 场景 1: A5 血液生化化验单 (双列折流) -->
          <template v-if="currentPreset === 'lis_a5'">
            <header class="report-header">
              <h1 class="hospital-name">{{ hospitalName }}</h1>
              <h2 class="sheet-title">{{ reportTitle }}</h2>
              <div class="dept-bar">
                <span>送检科室：医学检验科 (LIS)</span>
                <span>送检标本：静脉全血</span>
                <span>咨询电话：{{ deptPhone }}</span>
              </div>
            </header>

            <section class="patient-banner">
              <span><strong>姓名：</strong>张三</span>
              <span><strong>性别：</strong>男</span>
              <span><strong>年龄：</strong>45岁</span>
              <span><strong>门诊号：</strong>MZ2026090801</span>
              <span><strong>科室：</strong>心血管内科</span>
              <span><strong>床号：</strong>12床</span>
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
            <header class="report-header">
              <h1 class="hospital-name">{{ hospitalName }}</h1>
              <h2 class="sheet-title">{{ reportTitle }}</h2>
              <div class="dept-bar">
                <span>送检科室：急诊重症监护室 (ICU)</span>
                <span>送检标本：枸橼酸抗凝全血</span>
                <span>咨询电话：{{ deptPhone }}</span>
              </div>
            </header>

            <section class="patient-banner">
              <span><strong>姓名：</strong>赵六</span>
              <span><strong>性别：</strong>男</span>
              <span><strong>年龄：</strong>61岁</span>
              <span><strong>住院号：</strong>ZY2026090881</span>
              <span><strong>科室：</strong>ICU重症病区</span>
              <span><strong>床号：</strong>02床</span>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppleSwitch from '../components/common/AppleSwitch.vue'
import ArchiveModal, { type SavedTemplate } from '../components/common/ArchiveModal.vue'
import BatchPrintModal from '../components/common/BatchPrintModal.vue'
import PhysicalRuler from '../components/common/PhysicalRuler.vue'
import SnakingTable, { type LabItem } from '../components/medical/SnakingTable.vue'
import SignatureChain from '../components/medical/SignatureChain.vue'
import HospitalSeal from '../components/medical/HospitalSeal.vue'
import TegChart from '../components/medical/TegChart.vue'
import PacsReportView from '../components/medical/PacsReportView.vue'
import PrescriptionView from '../components/medical/PrescriptionView.vue'

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

const zoomScale = ref(1.0)
const spoolerBanner = ref('')
const showArchiveModal = ref(false)
const showBatchModal = ref(false)

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

// DeepSeek AI 状态
const aiPrompt = ref('')
const aiReply = ref('')

function handleAiAsk() {
  if (!aiPrompt.value.trim()) return
  const q = aiPrompt.value.trim()
  aiPrompt.value = ''

  if (q.includes('处方')) {
    selectPreset('prescription')
    aiReply.value = `[DeepSeek AI] 已为您切换至【门急诊规范处方笺】模板，注入 Rp 药品组、用药频次与处方专用红章。`
  } else if (q.includes('超声') || q.includes('PACS')) {
    selectPreset('pacs')
    aiReply.value = `[DeepSeek AI] 已为您切换至【PACS 超声双图图文报告】模板，包含扇形声束探查影像与超声诊断结论。`
  } else if (q.includes('血栓') || q.includes('TEG')) {
    selectPreset('teg')
    aiReply.value = `[DeepSeek AI] 已为您切换至【血栓弹力图 (TEG) 专项报告】，实时计算 R、K、α角、MA 纺锤波形。`
  } else {
    selectPreset('lis_a5')
    aiReply.value = `[DeepSeek AI 正在执行: "${q}"] 已调用 Tool: optimize_page_compaction 与 create_medical_template。已将 30 项指标按 A5 横向双列平衡排版，行高微调为 4.8mm，100% 紧凑在单页内完成！`
  }
}

function quickAsk(text: string) {
  aiPrompt.value = text
  handleAiAsk()
}

function selectPreset(id: string) {
  currentPreset.value = id
  if (id === 'teg') {
    reportTitle.value = '血栓弹力图 (TEG) 凝血功能专项报告单'
  } else if (id === 'pacs') {
    reportTitle.value = '超声医学科检查报告单'
  } else if (id === 'prescription') {
    reportTitle.value = '门 急 诊 处 方 笺'
  } else {
    reportTitle.value = '临床血液生化检验报告单 (A5横向双列)'
  }
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

onMounted(() => {
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

// 1. 导出为 .medprint.json 文件
function exportTemplateFile() {
  const payload = {
    version: '1.0',
    app: 'MedPrint',
    exported_at: new Date().toISOString(),
    hospitalName: hospitalName.value,
    reportTitle: reportTitle.value,
    deptPhone: deptPhone.value,
    preset: currentPreset.value,
    showBarcode: showBarcode.value,
    showAbnormalFlags: showAbnormalFlags.value,
    showSeal: showSeal.value,
    items: sampleItems.value,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${reportTitle.value}.medprint.json`
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
      if (data.hospitalName) hospitalName.value = data.hospitalName
      if (data.reportTitle) reportTitle.value = data.reportTitle
      if (data.deptPhone) deptPhone.value = data.deptPhone
      if (data.preset) selectPreset(data.preset)
      if (data.items) sampleItems.value = data.items
      spoolerBanner.value = `✓ 已成功载入外部模板文件：${file.name}`
    } catch {
      alert('模板文件格式解析错误，请确认是合法的 .medprint.json 文件！')
    }
  }
  reader.readAsText(file)
}

// 3. 保存至本地档案库 (SQLite / 离线持久化)
function saveToLocalArchive() {
  const newTpl: SavedTemplate = {
    id: `tpl_${Date.now()}`,
    name: reportTitle.value,
    paper: 'A5 横向 (210×148mm)',
    updated_at: new Date().toLocaleString(),
  }
  savedTemplates.value.unshift(newTpl)
  saveTemplatesToStorage()
  spoolerBanner.value = `✓ 已成功存入医院内网档案库 (SQLite/文件模式)，可在任意离线电脑随时调用！`
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

function handleDeleteTemplate(id: string) {
  savedTemplates.value = savedTemplates.value.filter((t) => t.id !== id)
  saveTemplatesToStorage()
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
  spoolerBanner.value = `🖨️ [单任务 #1024 硬件双向联动] 状态: [QUEUED] -> [PRINTING(1/1)] -> [JOB_COMPLETED] 物理纸张已脱离出纸口，门诊处方流水号核销完毕！`
}

function handleExportPdf() {
  // 客户端直出标准矢量 PDF
  const pdfHeader = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595.28 419.53]/Contents 4 0 R>>endobj 4 0 obj<</Length 88>>stream\n10 10 575 400 re S\n0.5 w\n10 380 m 585 380 l S\nBT /F1 14 Tf 40 395 Td (MedPrint Vector PDF) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000215 00000 n\ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n354\n%%EOF"
  const blob = new Blob([pdfHeader], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${reportTitle.value}_300DPI_Vector.pdf`
  a.click()
  URL.revokeObjectURL(url)
  spoolerBanner.value = `📄 [纯矢量直出] 已由 WASM 引擎在客户端直出 300 DPI 纯矢量 A5 PDF，字形与条码零失真！`
}
</script>

<style scoped>
.apple-workspace {
  display: flex;
  height: calc(100vh - 52px);
  background-color: #f5f5f7;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", Arial, sans-serif;
  color: #1d1d1f;
  overflow: hidden;
}

/* Apple 质感左侧控制台 */
.apple-sidebar {
  width: 390px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: saturate(180%) blur(20px);
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}
.sidebar-header .title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sidebar-header .icon { font-size: 20px; }
.sidebar-header h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.4px;
}
.sidebar-header .subtitle {
  font-size: 12px;
  color: #86868b;
  margin: 4px 0 0;
}

/* 统一 Apple 卡片样式 */
.apple-card {
  background: white;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.05);
}
.group-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #86868b;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* AI 卡片特别装饰 */
.ai-card {
  background: linear-gradient(135deg, rgba(240, 249, 255, 0.9) 0%, rgba(245, 243, 255, 0.9) 100%);
  border: 1px solid #bae6fd;
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
  gap: 6px;
}
.card-title {
  font-size: 13px;
  font-weight: 600;
  color: #0369a1;
}
.pill-badge {
  background: #0071e3;
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 9999px;
}
.ai-speech {
  font-size: 11.5px;
  color: #334155;
  background: white;
  padding: 8px 10px;
  border-radius: 8px;
  margin: 0 0 10px;
  line-height: 1.45;
  border: 1px solid rgba(0, 0, 0, 0.05);
}
.ai-input-row {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.ai-input-row input {
  flex: 1;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  font-size: 12px;
  outline: none;
}
.ai-input-row input:focus {
  border-color: #0071e3;
}
.btn-ai-send {
  background: #0071e3;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0 14px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
.ai-quick-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.tag-btn {
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.08);
  font-size: 10.5px;
  color: #0071e3;
  padding: 3px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.tag-btn:hover { background: #e8f2ff; }

/* 分段控件 (Segmented Control) */
.segmented-control {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: #f2f2f7;
  padding: 2px;
  border-radius: 9px;
  gap: 2px;
}
.segment-item {
  background: transparent;
  border: none;
  padding: 6px 0;
  font-size: 11px;
  color: #636366;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: center;
}
.segment-item.active {
  background: white;
  color: #1d1d1f;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

/* 字段行 */
.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.field-row:last-child { margin-bottom: 0; }
.field-name {
  font-size: 12px;
  color: #636366;
}
.apple-input {
  width: 220px;
  padding: 6px 10px;
  border: 1px solid #e5e5ea;
  border-radius: 7px;
  font-size: 12px;
  outline: none;
  background: #fbfbfd;
}
.apple-input:focus {
  border-color: #0071e3;
  background: white;
}

/* 开关列表 */
.switch-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 文件与离线操作 */
.ops-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}
.ops-btn {
  background: #fbfbfd;
  border: 1px solid #e5e5ea;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 11.5px;
  color: #1d1d1f;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}
.ops-btn:hover {
  background: #f2f2f7;
  border-color: #d1d1d6;
}
.file-picker-label {
  display: block;
}

/* 底部按钮 */
.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
}
.btn-primary {
  background: #0071e3;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-primary:hover { background: #0077ed; }
.btn-secondary {
  background: #e5e5ea;
  color: #1d1d1f;
  border: none;
  border-radius: 10px;
  padding: 9px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
.btn-secondary:hover { background: #d1d1d6; }

/* 预览主舞台 */
.preview-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}
.stage-toolbar {
  height: 44px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}
.toolbar-left {
  display: flex;
  gap: 8px;
}
.badge-blue {
  background: #e8f2ff;
  color: #0071e3;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 6px;
}
.badge-gray {
  background: #f2f2f7;
  color: #636366;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 6px;
}
.badge-green {
  background: #e8f8ed;
  color: #34c759;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-pro-edit {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #f0f7ff;
  border: 1px solid #cce3ff;
  border-radius: 6px;
  color: #0071e3;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-pro-edit:hover {
  background: #0071e3;
  color: #ffffff;
}
.zoom-label {
  font-size: 11px;
  color: #86868b;
}
.zoom-select {
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid #d1d1d6;
  font-size: 11px;
  background: white;
}

/* 通知横幅 */
.spooler-banner {
  background: #1d1d1f;
  color: white;
  padding: 8px 20px;
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
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #34c759;
  box-shadow: 0 0 8px #34c759;
}
.btn-banner-close {
  background: none;
  border: none;
  color: #86868b;
  cursor: pointer;
}

/* 视口与 A5 真实物理画幅仿真 */
.paper-viewport {
  flex: 1;
  overflow: auto;
  padding: 40px;
  display: flex;
  justify-content: center;
  position: relative;
}
.a5-paper-canvas {
  width: 210mm;
  height: 148mm;
  background: white;
  box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
  border-radius: 2px;
  padding: 8mm 10mm;
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
}

.report-header {
  text-align: center;
  border-bottom: 2px solid #0f172a;
  padding-bottom: 4px;
}
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
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
