<template>
  <div v-if="visible" class="apple-modal-overlay" @click.self="$emit('close')">
    <div class="batch-modal-card">
      <div class="modal-header">
        <div class="title-wrap">
          <h3>批量打印与 Spooler 硬件监控</h3>
        </div>
        <button class="btn-close" @click="$emit('close')">✕</button>
      </div>

      <div class="control-bar">
        <div class="batch-selector">
          <span class="label">批量任务数量：</span>
          <select v-model="batchCount" :disabled="isPrinting" class="apple-select">
            <option :value="5">5 张化验单</option>
            <option :value="10">10 张化验单</option>
            <option :value="20">20 张化验单 (门诊高峰)</option>
            <option :value="50">50 张化验单 (批量抽血)</option>
          </select>
        </div>

        <div class="hardware-sim-group">
          <span class="label">硬件状态测试：</span>
          <button
            class="sim-btn"
            :class="{ active: simulatePaperOut }"
            @click="simulatePaperOut = !simulatePaperOut"
          >
            模拟缺纸 (PAPER_OUT)
          </button>
          <button
            class="sim-btn"
            :class="{ active: simulatePaperJam }"
            @click="simulatePaperJam = !simulatePaperJam"
          >
            模拟卡纸 (PAPER_JAM)
          </button>
        </div>
      </div>

      <!-- 打印进度与状态条 -->
      <div class="progress-section">
        <div class="progress-info">
          <span>当前作业进度: <strong>{{ currentPrinted }} / {{ batchCount }} 页</strong></span>
          <span class="status-pill" :class="statusClass">{{ currentStatusText }}</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar" :style="{ width: progressPercent + '%' }"></div>
        </div>
      </div>

      <!-- 实时硬件队列监视表格 -->
      <div class="queue-table-wrap">
        <table class="queue-table">
          <thead>
            <tr>
              <th>作业 ID</th>
              <th>患者姓名</th>
              <th>病历号</th>
              <th>处方/单据流水号</th>
              <th>Spooler 硬件状态</th>
              <th>出纸回执</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in queueJobs" :key="job.id" :class="job.rowClass">
              <td>#{{ job.id }}</td>
              <td>{{ job.patientName }}</td>
              <td>{{ job.mrn }}</td>
              <td>{{ job.serialNo }}</td>
              <td>
                <span class="job-status" :class="job.statusClass">{{ job.statusText }}</span>
              </td>
              <td>{{ job.receiptText }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 底部控制按钮 -->
      <div class="modal-footer">
        <button
          v-if="!isPrinting"
          class="apple-btn-primary"
          @click="startBatchPrint"
        >
          ▶ 开始批量静默打印 (直通硬件)
        </button>
        <button
          v-else
          class="apple-btn-danger"
          @click="cancelBatchPrint"
        >
          ⏹ 紧急暂停队列
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

defineEmits<{
  (e: 'close'): void
}>()

const batchCount = ref(10)
const isPrinting = ref(false)
const currentPrinted = ref(0)
const simulatePaperOut = ref(false)
const simulatePaperJam = ref(false)
const currentStatusText = ref('就绪等待中')
const queueJobs = ref<any[]>([])

const progressPercent = computed(() => {
  return Math.floor((currentPrinted.value / batchCount.value) * 100)
})

const statusClass = computed(() => {
  if (simulatePaperOut.value || simulatePaperJam.value) return 'status-error'
  if (isPrinting.value) return 'status-active'
  if (currentPrinted.value >= batchCount.value && batchCount.value > 0) return 'status-done'
  return 'status-idle'
})

function initQueue() {
  const patientNames = ['张伟', '王芳', '李静', '赵强', '陈红', '刘洋', '孙俪', '周杰', '吴昊', '郑敏']
  queueJobs.value = Array.from({ length: batchCount.value }, (_, i) => ({
    id: 1024 + i,
    patientName: patientNames[i % patientNames.length],
    mrn: `MZ${2026090800 + i}`,
    serialNo: `MED${Date.now() + i}`,
    statusText: '排队中 (QUEUED)',
    statusClass: 'queued',
    receiptText: '等待硬件调度',
    rowClass: '',
  }))
}

let timer: any = null

function startBatchPrint() {
  initQueue()
  isPrinting.value = true
  currentPrinted.value = 0
  currentStatusText.value = '硬件打印机高速吐纸中...'

  let idx = 0
  timer = setInterval(() => {
    if (idx >= batchCount.value) {
      clearInterval(timer)
      isPrinting.value = false
      currentStatusText.value = '批量打印完毕，单据处理完成。'
      return
    }

    if (simulatePaperOut.value) {
      clearInterval(timer)
      isPrinting.value = false
      currentStatusText.value = '警告：检测到打印机缺纸 (PAPER_OUT)，作业已暂停。'
      queueJobs.value[idx].statusText = '物理缺纸阻断'
      queueJobs.value[idx].statusClass = 'error'
      queueJobs.value[idx].rowClass = 'row-error'
      return
    }

    if (simulatePaperJam.value) {
      clearInterval(timer)
      isPrinting.value = false
      currentStatusText.value = '警告：检测到打印机卡纸 (PAPER_JAM)，作业已暂停。'
      queueJobs.value[idx].statusText = '机械卡纸报警'
      queueJobs.value[idx].statusClass = 'error'
      queueJobs.value[idx].rowClass = 'row-error'
      return
    }

    queueJobs.value[idx].statusText = '出纸完毕 (JOB_COMPLETED)'
    queueJobs.value[idx].statusClass = 'done'
    queueJobs.value[idx].receiptText = '已完成出纸 / 状态确认'
    queueJobs.value[idx].rowClass = 'row-done'

    idx++
    currentPrinted.value = idx
  }, 400)
}

function cancelBatchPrint() {
  clearInterval(timer)
  isPrinting.value = false
  currentStatusText.value = '队列已人工中止'
}
</script>

<style scoped>
.apple-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.batch-modal-card {
  width: 780px;
  max-width: 95vw;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: saturate(180%) blur(20px);
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08);
  padding: 24px;
  display: flex;
  flex-direction: column;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.title-wrap h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1d1d1f;
}
.btn-close {
  background: none;
  border: none;
  color: #86868b;
  font-size: 16px;
  cursor: pointer;
}
.control-bar {
  display: flex;
  justify-content: space-between;
  background: #f2f2f7;
  padding: 10px 14px;
  border-radius: 10px;
  margin-bottom: 16px;
  font-size: 12px;
}
.batch-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}
.apple-select {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #d1d1d6;
  font-size: 12px;
  background: white;
}
.hardware-sim-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sim-btn {
  background: white;
  border: 1px solid #d1d1d6;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
}
.sim-btn.active {
  background: #fee2e2;
  border-color: #ef4444;
  color: #b91c1c;
  font-weight: bold;
}
.progress-section {
  margin-bottom: 16px;
}
.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 6px;
}
.status-pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
}
.status-pill.status-idle { background: #f2f2f7; color: #86868b; }
.status-pill.status-active { background: #e0f2fe; color: #0284c7; font-weight: bold; }
.status-pill.status-error { background: #fee2e2; color: #dc2626; font-weight: bold; }
.status-pill.status-done { background: #dcfce7; color: #15803d; font-weight: bold; }
.progress-track {
  height: 8px;
  background: #e5e5ea;
  border-radius: 9999px;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background: #34c759;
  transition: width 0.3s ease;
}
.queue-table-wrap {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid #e5e5ea;
  border-radius: 10px;
  background: white;
}
.queue-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  text-align: left;
}
.queue-table th {
  background: #f9f9fb;
  padding: 8px 12px;
  border-bottom: 1px solid #e5e5ea;
  color: #636366;
  font-weight: 600;
}
.queue-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #f2f2f7;
  color: #1d1d1f;
}
.job-status.queued { color: #86868b; }
.job-status.done { color: #16a34a; font-weight: bold; }
.job-status.error { color: #dc2626; font-weight: bold; }
.row-error { background: #fff1f2; }
.row-done { background: #f0fdf4; }
.modal-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.apple-btn-primary {
  background: #0071e3;
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.apple-btn-danger {
  background: #ff3b30;
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
</style>
