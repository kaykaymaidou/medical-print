<template>
  <div class="constraint-inspector">
    <div class="panel-header">
      <div class="header-left">
        <h3 class="panel-title">约束驱动排版规格 (Constraint Spec)</h3>
      </div>
      <span class="engine-badge">几何约束求解</span>
    </div>

    <!-- 顶层单页硬预算 -->
    <div class="section-box">
      <div class="section-title">
        <span>单页预算约束 (Page Budget)</span>
        <span class="hint">控制报表在单页内完整呈现</span>
      </div>
      <div class="segmented-control">
        <button
          type="button"
          :class="{ active: currentBudget === 'SinglePageHard' }"
          @click="setBudget('SinglePageHard')"
        >
          硬锁定单页
        </button>
        <button
          type="button"
          :class="{ active: currentBudget === 'SinglePageSoft' }"
          @click="setBudget('SinglePageSoft')"
        >
          自适应微调
        </button>
        <button
          type="button"
          :class="{ active: currentBudget === 'MultiPageNatural' }"
          @click="setBudget('MultiPageNatural')"
        >
          自然跨页
        </button>
      </div>
    </div>

    <!-- 目标元素选择 -->
    <div class="section-box">
      <div class="section-title">
        <span>约束目标元素</span>
      </div>
      <div class="element-pills">
        <button
          v-for="(el, idx) in template.elements"
          :key="idx"
          type="button"
          class="pill-btn"
          :class="{ active: activeIndex === idx }"
          @click="activeIndex = idx"
        >
          {{ elementLabel(el.kind) }}
        </button>
      </div>
    </div>

    <!-- 当前选中元素的约束配置 -->
    <div v-if="currentElement" class="element-constraints">
      <!-- 1. 九宫格锚点定位 -->
      <div class="section-box">
        <div class="section-title">
          <span>纸张锚定位置 (Anchor Position)</span>
          <span class="hint">{{ currentConstraints.anchor_position || '未指定 (流式排版)' }}</span>
        </div>
        <div class="nine-grid">
          <button
            v-for="pos in ANCHOR_POSITIONS"
            :key="pos"
            type="button"
            class="grid-dot"
            :class="{ active: currentConstraints.anchor_position === pos }"
            :title="pos"
            @click="setAnchor(pos)"
          >
            <span class="dot-inner"></span>
          </button>
        </div>
        <button
          v-if="currentConstraints.anchor_position"
          type="button"
          class="clear-btn"
          @click="setAnchor(undefined)"
        >
          恢复自然流式
        </button>
      </div>

      <!-- 2. 相对基准几何对齐 (如 Logo 居中对齐标题) -->
      <div class="section-box">
        <div class="section-title">
          <span>相对基准几何对齐 (Relative Alignment)</span>
        </div>
        <div class="field-row">
          <label>基准目标</label>
          <select v-model="targetRefId" class="apple-select" @change="updateAlignment">
            <option value="">无 (不设相对对齐)</option>
            <option
              v-for="(el, idx) in otherElements"
              :key="idx"
              :value="el.kind"
            >
              {{ elementLabel(el.kind) }}
            </option>
          </select>
        </div>

        <template v-if="targetRefId">
          <div class="field-row">
            <label>对齐方式</label>
            <select v-model="targetAlignType" class="apple-select" @change="updateAlignment">
              <option value="AlignCenterVertical">垂直居中对齐 (如 Logo 与标题中线)</option>
              <option value="AlignTop">顶部边缘对齐</option>
              <option value="AlignBottom">底部边缘对齐</option>
              <option value="AlignLeft">左侧对齐</option>
              <option value="AlignRight">右侧对齐</option>
              <option value="AlignCenterHorizontal">水平居中对齐</option>
            </select>
          </div>
          <div class="field-row">
            <label>物理偏移 (mm)</label>
            <input
              v-model.number="targetOffsetMm"
              type="number"
              step="0.5"
              class="apple-input"
              @input="updateAlignment"
            />
          </div>
        </template>
      </div>

      <!-- 3. 空间障碍物避让与折流 (如化验表格避让 TEG 图表) -->
      <div class="section-box">
        <div class="section-title">
          <span>空间障碍物与避让折流 (Obstacle & Flow)</span>
        </div>
        <div class="field-row">
          <label>声明为障碍禁区</label>
          <AppleSwitch
            :model-value="isObstacle"
            @update:model-value="toggleObstacle"
          />
        </div>

        <template v-if="isObstacle">
          <div class="field-row">
            <label>安全缓冲间距 (mm)</label>
            <input
              v-model.number="obstaclePadding"
              type="number"
              step="0.5"
              min="0"
              class="apple-input"
              @input="updateObstacle"
            />
          </div>
          <div class="field-row">
            <label>列表折流避让策略</label>
            <select v-model="obstacleFlow" class="apple-select" @change="updateObstacle">
              <option value="AvoidAndNarrow">绕开并自适应收窄折流</option>
              <option value="BreakColumnAround">整列跨过避让 (避让禁区下移)</option>
              <option value="StopAbove">遇阻截断在上方</option>
            </select>
          </div>
          <div class="flow-preview-tip">
            注：表格流经此区域时，几何引擎将动态扣减可用宽度以避免重叠。
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppleSwitch from './AppleSwitch.vue'
import type {
  AlignmentType,
  AnchorPosition,
  ElementConstraints,
  FlowBehavior,
  PageBudgetConstraint,
  ReportElement,
  ReportTemplate,
} from '../../domain/reportAst'

const props = defineProps<{
  modelValue: ReportTemplate
  selectedElementIndex?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: ReportTemplate): void
  (e: 'update:selectedElementIndex', value: number): void
}>()

const template = computed(() => props.modelValue)
const activeIndex = ref<number>(props.selectedElementIndex ?? 0)

watch(
  () => props.selectedElementIndex,
  (idx) => {
    if (idx !== undefined && idx >= 0 && idx < template.value.elements.length) {
      activeIndex.value = idx
    }
  },
)

watch(activeIndex, (idx) => {
  emit('update:selectedElementIndex', idx)
})

const currentElement = computed<ReportElement | undefined>(() => {
  return template.value.elements[activeIndex.value]
})

const otherElements = computed(() => {
  return template.value.elements.filter((_, idx) => idx !== activeIndex.value)
})

const currentBudget = computed<PageBudgetConstraint>(() => {
  return template.value.page_budget || 'SinglePageHard'
})

const currentConstraints = computed<ElementConstraints>(() => {
  return currentElement.value?.constraints || {}
})

const ANCHOR_POSITIONS: AnchorPosition[] = [
  'TopLeft',
  'TopCenter',
  'TopRight',
  'MiddleLeft',
  'Center',
  'MiddleRight',
  'BottomLeft',
  'BottomCenter',
  'BottomRight',
]

function elementLabel(kind: string): string {
  const map: Record<string, string> = {
    HospitalHeader: '医院页眉 (Header)',
    PatientBanner: '患者条码栏 (Banner)',
    SnakingTable: '双列折流表 (Table)',
    TegCurveChart: 'TEG 曲线图 (Chart)',
    PacsGrid: 'PACS 影像网格 (PACS)',
    Signatures: '三级签名链 (Signatures)',
    Seal: '防伪印章 (Seal)',
    NotesFooter: '免责页脚 (Footer)',
  }
  return map[kind] || kind
}

function setBudget(budget: PageBudgetConstraint) {
  const updated: ReportTemplate = {
    ...template.value,
    page_budget: budget,
  }
  emit('update:modelValue', updated)
}

function mutateCurrentConstraints(patch: Partial<ElementConstraints>) {
  if (activeIndex.value < 0 || activeIndex.value >= template.value.elements.length) return
  const elements = [...template.value.elements]
  const target = { ...elements[activeIndex.value] }
  target.constraints = {
    ...target.constraints,
    ...patch,
  }
  elements[activeIndex.value] = target as ReportElement
  emit('update:modelValue', {
    ...template.value,
    elements,
  })
}

function setAnchor(pos: AnchorPosition | undefined) {
  mutateCurrentConstraints({ anchor_position: pos })
}

// 相对对齐状态绑定
const targetRefId = ref(currentConstraints.value.relative_alignment?.target_id || '')
const targetAlignType = ref<AlignmentType>(
  currentConstraints.value.relative_alignment?.align_type || 'AlignCenterVertical',
)
const targetOffsetMm = ref<number>(currentConstraints.value.relative_alignment?.offset_mm || 0)

watch(
  currentElement,
  (el) => {
    const rel = el?.constraints?.relative_alignment
    targetRefId.value = rel?.target_id || ''
    targetAlignType.value = rel?.align_type || 'AlignCenterVertical'
    targetOffsetMm.value = rel?.offset_mm || 0
  },
  { immediate: true },
)

function updateAlignment() {
  if (!targetRefId.value) {
    mutateCurrentConstraints({ relative_alignment: undefined })
  } else {
    mutateCurrentConstraints({
      relative_alignment: {
        target_id: targetRefId.value,
        align_type: targetAlignType.value,
        offset_mm: Number(targetOffsetMm.value) || 0,
      },
    })
  }
}

// 障碍物避让状态绑定
const isObstacle = computed(() => Boolean(currentConstraints.value.obstacle_constraint?.is_obstacle))
const obstaclePadding = ref(currentConstraints.value.obstacle_constraint?.safe_padding_mm ?? 2.0)
const obstacleFlow = ref<FlowBehavior>(
  currentConstraints.value.obstacle_constraint?.flow_behavior || 'AvoidAndNarrow',
)

watch(
  currentElement,
  (el) => {
    const obs = el?.constraints?.obstacle_constraint
    obstaclePadding.value = obs?.safe_padding_mm ?? 2.0
    obstacleFlow.value = obs?.flow_behavior || 'AvoidAndNarrow'
  },
  { immediate: true },
)

function toggleObstacle(val: boolean) {
  if (!val) {
    mutateCurrentConstraints({ obstacle_constraint: undefined })
  } else {
    mutateCurrentConstraints({
      obstacle_constraint: {
        is_obstacle: true,
        safe_padding_mm: Number(obstaclePadding.value) || 2.0,
        flow_behavior: obstacleFlow.value,
      },
    })
  }
}

function updateObstacle() {
  if (isObstacle.value) {
    mutateCurrentConstraints({
      obstacle_constraint: {
        is_obstacle: true,
        safe_padding_mm: Number(obstaclePadding.value) || 2.0,
        flow_behavior: obstacleFlow.value,
      },
    })
  }
}
</script>

<style scoped>
.constraint-inspector {
  background: var(--fill-elevated);
  border: 1px solid var(--separator);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-card);
  font-family: var(--font);
  color: var(--label);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--separator);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-icon {
  font-size: 16px;
}

.panel-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.2px;
}

.engine-badge {
  font-size: 11px;
  color: var(--blue);
  background: var(--blue-soft);
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  font-weight: 500;
}

.section-box {
  background: var(--fill);
  padding: 12px;
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--label);
}

.section-title .hint {
  font-size: 11px;
  font-weight: normal;
  color: var(--label-secondary);
}

.segmented-control {
  display: flex;
  background: var(--fill-control);
  padding: 2px;
  border-radius: var(--radius-sm);
  gap: 2px;
}

.segmented-control button {
  flex: 1;
  border: none;
  background: transparent;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--label-secondary);
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.segmented-control button.active {
  background: var(--fill-elevated);
  color: var(--label);
  box-shadow: var(--shadow-sm);
  font-weight: 600;
}

.element-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pill-btn {
  border: 1px solid var(--separator);
  background: var(--fill-elevated);
  color: var(--label-secondary);
  font-size: 11px;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.pill-btn:hover {
  border-color: var(--blue);
  color: var(--blue);
}

.pill-btn.active {
  background: var(--blue);
  color: white;
  border-color: var(--blue);
  font-weight: 600;
}

.nine-grid {
  display: grid;
  grid-template-columns: repeat(3, 36px);
  grid-gap: 6px;
  justify-content: center;
  background: var(--fill-elevated);
  padding: 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--separator);
  margin: 4px auto;
}

.grid-dot {
  width: 36px;
  height: 36px;
  border: 1px solid var(--separator);
  background: var(--fill);
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring);
}

.grid-dot .dot-inner {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--label-tertiary);
  transition: all var(--duration-fast) var(--spring);
}

.grid-dot:hover .dot-inner {
  background: var(--blue);
  transform: scale(1.3);
}

.grid-dot.active {
  background: var(--blue-soft);
  border-color: var(--blue);
}

.grid-dot.active .dot-inner {
  background: var(--blue);
  transform: scale(1.5);
}

.clear-btn {
  border: none;
  background: transparent;
  color: var(--blue);
  font-size: 11px;
  cursor: pointer;
  align-self: center;
  padding: 2px 6px;
}

.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}

.field-row label {
  color: var(--label-secondary);
}

.apple-select,
.apple-input {
  border: 1px solid var(--separator);
  background: var(--fill-elevated);
  color: var(--label);
  border-radius: var(--radius-xs);
  padding: 5px 8px;
  font-size: 12px;
  transition: border-color var(--duration-fast);
}

.apple-select:focus,
.apple-input:focus {
  border-color: var(--blue);
}

.flow-preview-tip {
  font-size: 11px;
  color: var(--label-tertiary);
  line-height: 1.4;
  margin-top: 4px;
}
</style>
