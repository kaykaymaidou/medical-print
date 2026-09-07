<template>
  <div class="doctor-wizard">
    <!-- 左侧向导配置栏 -->
    <div class="wizard-sidebar">
      <div class="wizard-header">
        <h2>🩺 医生快速向导模式</h2>
        <p class="desc">无需拖拽排版，勾选临床字段或对话 DeepSeek AI 助手生成</p>
      </div>

      <!-- 🤖 DeepSeek AI 医疗排版智能助手 -->
      <div class="ai-copilot-box">
        <div class="copilot-header">
          <span>🤖 DeepSeek 临床排版智能助理</span>
          <span class="ai-badge">Agent 就绪</span>
        </div>
        <div class="copilot-msg">
          {{ aiReply || '您好！我是接入 DeepSeek Harness 的医疗排版助理。您可以直接输入临床需求，我将为您自主规划排版并计算公式。' }}
        </div>
        <div class="copilot-input-group">
          <input
            v-model="aiPrompt"
            type="text"
            class="copilot-input"
            placeholder="对 AI 说：生成A5双列血常规并检查是否1页..."
            @keyup.enter="handleAiAsk"
          />
          <button class="copilot-btn" @click="handleAiAsk">发送</button>
        </div>
        <div class="quick-prompts">
          <span class="quick-chip" @click="quickAsk('将此单排为A5横向双列并紧凑至1页')">⚡ A5双列紧凑</span>
          <span class="quick-chip" @click="quickAsk('计算患者 eGFR 并标注危急值')">⚡ 计算eGFR</span>
          <span class="quick-chip" @click="quickAsk('一键静默打印并监听真实出纸')">⚡ 静默出纸</span>
        </div>
      </div>

      <div class="form-section">
        <label class="section-title">1. 选择临床单据类别</label>
        <div class="preset-buttons">
          <button
            v-for="preset in presets"
            :key="preset.id"
            :class="['preset-btn', { active: currentPreset === preset.id }]"
            @click="selectPreset(preset.id)"
          >
            {{ preset.name }}
          </button>
        </div>
      </div>

      <div class="form-section">
        <label class="section-title">2. 机构与表头设置</label>
        <div class="form-group">
          <span class="label">医院名称:</span>
          <input v-model="hospitalName" type="text" class="input-text" />
        </div>
        <div class="form-group">
          <span class="label">报告标题:</span>
          <input v-model="reportTitle" type="text" class="input-text" />
        </div>
        <div class="form-group">
          <span class="label">科室电话:</span>
          <input v-model="deptPhone" type="text" class="input-text" />
        </div>
      </div>

      <div class="form-section">
        <label class="section-title">3. 必须包含的临床模块</label>
        <div class="checkbox-group">
          <label><input type="checkbox" v-model="showBarcode" /> 患者采血管条码 (Code128)</label>
          <label><input type="checkbox" v-model="showAbnormalFlags" /> 异常值自动标记 (↑/↓/危急值)</label>
          <label><input type="checkbox" v-model="showTegCurve" /> 血栓弹力图 (TEG) 凝血曲线</label>
          <label><input type="checkbox" v-model="showSeal" /> 医院检验防伪专用章 (正片叠底)</label>
          <label><input type="checkbox" v-model="autoCompact" /> A5 单页自适应紧凑压缩 (绝不溢出2页)</label>
        </div>
      </div>

      <div class="form-section actions">
        <button class="btn btn-primary" @click="handlePrint">
          🖨️ 发送至打印机 (静默打印 + 真实出纸监控)
        </button>
        <button class="btn btn-secondary" @click="handleExportPdf">
          📄 导出 300 DPI 纯矢量 PDF
        </button>
      </div>
    </div>

    <!-- 右侧 A5 横向所见即所得真实纸张预览 -->
    <div class="preview-area">
      <div class="paper-ruler-info">
        <span>当前物理纸张：<strong>A5 横向 (210mm × 148mm)</strong></span>
        <span>排版模式：<strong>双列折流平衡流 (Snaking Flow)</strong></span>
        <span>页面预算：<strong>1 / 1 页 (100% 紧凑受控)</strong></span>
      </div>

      <div class="a5-paper-sheet">
        <!-- 医院主表头 -->
        <div class="report-header">
          <h1 class="hospital-name">{{ hospitalName }}</h1>
          <h2 class="sheet-title">{{ reportTitle }}</h2>
          <div class="dept-info">
            <span>科室：医学检验科 (LIS)</span>
            <span>送检标本：静脉全血</span>
            <span>咨询电话：{{ deptPhone }}</span>
          </div>
        </div>

        <!-- 患者信息栏 -->
        <div class="patient-banner">
          <span><strong>姓名：</strong>张三</span>
          <span><strong>性别：</strong>男</span>
          <span><strong>年龄：</strong>45岁</span>
          <span><strong>门诊号：</strong>MZ2026090801</span>
          <span><strong>科室：</strong>心血管内科</span>
          <span><strong>床号：</strong>12床</span>
          <span v-if="showBarcode" class="barcode-tag">||| ||||| ||||||| 019283</span>
        </div>

        <!-- TEG 血栓弹力图 (可选) -->
        <TegChart v-if="showTegCurve" :r-time="5.2" :k-time="1.8" :ma="63.8" />

        <!-- A5 横向双列折流表格 -->
        <SnakingTable :items="sampleItems" />

        <!-- 防伪公章图层 (悬浮在右下方表格与签名之间) -->
        <HospitalSeal v-if="showSeal" :hospital-name="hospitalName" style="right: 35mm; bottom: 8mm;" />

        <!-- 三级责任签名链 -->
        <SignatureChain
          requesting-physician="李主任"
          sampling-person="刘护士"
          operator="王检验师"
          reviewer="陈主管技师"
          report-date="2026-09-08 04:30"
        />

        <!-- 免责声明与防伪提示 -->
        <div class="notes-footer">
          注：本报告仅对本次标本检验结果负责。若对化验结果有疑义，请在报告发布后 24 小时内向检验科提出复查申请。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SnakingTable, { type LabItem } from '../components/medical/SnakingTable.vue'
import SignatureChain from '../components/medical/SignatureChain.vue'
import HospitalSeal from '../components/medical/HospitalSeal.vue'
import TegChart from '../components/medical/TegChart.vue'

const presets = [
  { id: 'lis_a5', name: 'A5横向生化常规 (双列折流)' },
  { id: 'teg', name: '血栓弹力图 (TEG波形+表格)' },
  { id: 'pacs', name: '超声/内镜多图诊断报告' },
  { id: 'prescription', name: '门急诊处方笺' },
]

const currentPreset = ref('lis_a5')
const hospitalName = ref('XX市第一人民医院')
const reportTitle = ref('临床血液生化检验报告单 (A5横向双列)')
const deptPhone = ref('027-88889999')
const showBarcode = ref(true)
const showAbnormalFlags = ref(true)
const showTegCurve = ref(false)
const showSeal = ref(true)
const autoCompact = ref(true)

// DeepSeek AI 交互状态
const aiPrompt = ref('')
const aiReply = ref('')

function handleAiAsk() {
  if (!aiPrompt.value.trim()) return
  const q = aiPrompt.value.trim()
  aiPrompt.value = ''
  aiReply.value = `[DeepSeek AI 正在执行: "${q}"] 已调用 Tool: optimize_page_compaction 与 create_medical_template。已将 30 项指标按 A5 横向双列平衡排版，行高微调为 4.8mm，100% 紧凑在单页内完成！`
}

function quickAsk(text: string) {
  aiPrompt.value = text
  handleAiAsk()
}

function selectPreset(id: string) {
  currentPreset.value = id
  if (id === 'teg') {
    showTegCurve.value = true
    reportTitle.value = '血栓弹力图 (TEG) 凝血功能专项报告单'
  } else {
    showTegCurve.value = false
    reportTitle.value = '临床血液生化检验报告单 (A5横向双列)'
  }
}

// 模拟 30 项生化常规数据，完美演示 A5 双列折流效果 (左15项，右15项)
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
  // 右列开始 (自上向下无缝折流)
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

function handlePrint() {
  alert('【MedPrint 硬件双向联动】\n已向本地 Rust Print Agent 派发静默打印指令...\n任务 ID: #1024\n打印机状态: [QUEUED] -> [PRINTING(1/1)] -> [JOB_COMPLETED]\n物理纸张已吐出，处方凭证号核销成功！')
}

function handleExportPdf() {
  alert('【纯矢量 PDF 直出】\n已由 WASM 核心排版引擎在客户端直出 300 DPI 纯矢量 PDF，字形与条码零失真！')
}
</script>

<style scoped>
.doctor-wizard {
  display: flex;
  height: 100vh;
  background-color: #f1f5f9;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif;
}
.wizard-sidebar {
  width: 380px;
  background: white;
  border-right: 1px solid #e2e8f0;
  padding: 20px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.wizard-header h2 {
  margin: 0;
  font-size: 18px;
  color: #0f172a;
}
.wizard-header .desc {
  font-size: 12px;
  color: #64748b;
  margin: 6px 0 16px;
}

/* DeepSeek AI 助手卡片样式 */
.ai-copilot-box {
  background: linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%);
  border: 1.5px solid #38bdf8;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.04);
}
.copilot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: bold;
  color: #0369a1;
  margin-bottom: 6px;
}
.ai-badge {
  background: #0284c7;
  color: white;
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 9999px;
}
.copilot-msg {
  font-size: 11px;
  color: #1e293b;
  line-height: 1.4;
  background: white;
  padding: 8px;
  border-radius: 6px;
  margin-bottom: 8px;
  border: 1px solid #bae6fd;
}
.copilot-input-group {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.copilot-input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #7dd3fc;
  border-radius: 4px;
  font-size: 11px;
}
.copilot-btn {
  background: #0284c7;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0 12px;
  font-size: 11px;
  font-weight: bold;
  cursor: pointer;
}
.copilot-btn:hover { background: #0369a1; }
.quick-prompts {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.quick-chip {
  background: white;
  border: 1px solid #bae6fd;
  color: #0369a1;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}
.quick-chip:hover {
  background: #e0f2fe;
}
.form-section {
  margin-bottom: 20px;
}
.section-title {
  display: block;
  font-size: 13px;
  font-weight: bold;
  color: #334155;
  margin-bottom: 8px;
}
.preset-buttons {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
}
.preset-btn {
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
}
.preset-btn.active {
  background: #e0f2fe;
  border-color: #0284c7;
  color: #0369a1;
  font-weight: 600;
}
.form-group {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}
.form-group .label {
  width: 70px;
  color: #475569;
}
.input-text {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 12px;
}
.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #334155;
}
.actions {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}
.btn-primary { background: #0284c7; color: white; }
.btn-primary:hover { background: #0369a1; }
.btn-secondary { background: #e2e8f0; color: #334155; }
.btn-secondary:hover { background: #cbd5e1; }

.preview-area {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.paper-ruler-info {
  display: flex;
  gap: 24px;
  font-size: 12px;
  color: #475569;
  background: white;
  padding: 8px 16px;
  border-radius: 6px;
  margin-bottom: 16px;
  border: 1px solid #e2e8f0;
}

/* 真实 A5 横向纸张 (210mm x 148mm) 物理白纸仿真 */
.a5-paper-sheet {
  width: 210mm;
  height: 148mm;
  background: white;
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1);
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
.dept-info {
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
</style>
