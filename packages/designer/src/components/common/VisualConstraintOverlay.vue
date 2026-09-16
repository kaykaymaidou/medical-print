<template>
  <div v-if="visible" class="visual-constraint-overlay" :style="overlayStyle">
    <!-- SVG 矢量连接与对齐辅助线 -->
    <svg class="guides-svg" :viewBox="`0 0 ${canvasWidthPx} ${canvasHeightPx}`">
      <!-- 1. 相对对齐辅助线 (Relative Alignment Lines) -->
      <g v-for="(line, idx) in alignmentLines" :key="'align-' + idx">
        <line
          :x1="line.x1"
          :y1="line.y1"
          :x2="line.x2"
          :y2="line.y2"
          class="align-axis-line"
        />
        <!-- 连线两端端点圆圈 -->
        <circle :cx="line.x1" :cy="line.y1" r="3.5" class="axis-dot" />
        <circle :cx="line.x2" :cy="line.y2" r="3.5" class="axis-dot" />
      </g>

      <!-- 2. 9 宫格锚点引线 (Anchor Connection Lines) -->
      <g v-for="(anchor, idx) in anchorPins" :key="'anchor-line-' + idx">
        <line
          :x1="anchor.pinX"
          :y1="anchor.pinY"
          :x2="anchor.elCenterX"
          :y2="anchor.elCenterY"
          class="anchor-guide-line"
        />
        <circle :cx="anchor.pinX" :cy="anchor.pinY" r="4.5" class="anchor-pin-dot" />
      </g>
    </svg>

    <!-- 3. 障碍物安全避让缓冲带 (Clearance Cushion Boxes) -->
    <div
      v-for="(obs, idx) in obstacleBoxes"
      :key="'obs-' + idx"
      class="clearance-box"
      :style="obs.style"
    >
      <div class="cushion-badge">
        <span>避让禁区 +{{ obs.paddingMm }}mm ({{ obs.flowLabel }})</span>
      </div>
      <div class="hatch-pattern"></div>
    </div>

    <!-- 4. 相对对齐浮动标签 (Alignment Badges) -->
    <div
      v-for="(line, idx) in alignmentLines"
      :key="'align-badge-' + idx"
      class="align-badge"
      :style="{ left: `${(line.x1 + line.x2) / 2}px`, top: `${line.y1 - 10}px` }"
    >
      {{ line.label }}
    </div>

    <!-- 5. 9 宫格锚点徽标 (Anchor Badges) -->
    <div
      v-for="(anchor, idx) in anchorPins"
      :key="'anchor-badge-' + idx"
      class="anchor-badge"
      :style="{ left: `${anchor.pinX}px`, top: `${anchor.pinY}px` }"
    >
      {{ anchor.label }}
    </div>

    <!-- 6. 单页硬预算守卫状态浮条 (Page Budget Guard Bar) -->
    <div v-if="template.page_budget === 'SinglePageHard'" class="hard-budget-pill">
      <span class="pulse-dot"></span>
      <span>单页预算守卫 · 自适应流式排版</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ReportTemplate } from '../../domain/reportAst'

export interface ElementFrame {
  kind: string
  x_mm: number
  y_mm: number
  width_mm: number
  height_mm: number
}

const props = withDefaults(
  defineProps<{
    template: ReportTemplate
    frames: ElementFrame[]
    paperWidthMm: number
    paperHeightMm: number
    mmToPx?: number
    zoomScale?: number
    visible?: boolean
  }>(),
  {
    mmToPx: 3.7795,
    zoomScale: 1.0,
    visible: true,
  },
)

const scale = computed(() => props.mmToPx * props.zoomScale)
const canvasWidthPx = computed(() => props.paperWidthMm * scale.value)
const canvasHeightPx = computed(() => props.paperHeightMm * scale.value)

const overlayStyle = computed(() => ({
  position: 'absolute' as const,
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  pointerEvents: 'none' as const,
  zIndex: 40,
}))

// 1. 计算所有声明为空间障碍物的避让缓冲区
const obstacleBoxes = computed(() => {
  const result: Array<{
    paddingMm: number
    flowLabel: string
    style: Record<string, string>
  }> = []

  for (const el of props.template.elements) {
    const obs = el.constraints?.obstacle_constraint
    if (!obs || !obs.is_obstacle) continue

    const frame = props.frames.find((f) => f.kind === el.kind)
    if (!frame) continue

    const padding = obs.safe_padding_mm ?? 2.0
    const x = (frame.x_mm - padding) * scale.value
    const y = (frame.y_mm - padding) * scale.value
    const w = (frame.width_mm + padding * 2) * scale.value
    const h = (frame.height_mm + padding * 2) * scale.value

    const flowMap: Record<string, string> = {
      AvoidAndNarrow: '绕开并收窄',
      BreakColumnAround: '跨列避让',
      StopAbove: '遇阻截断',
      None: '仅禁区',
    }

    result.push({
      paddingMm: padding,
      flowLabel: flowMap[obs.flow_behavior] || '自适应绕行',
      style: {
        left: `${x}px`,
        top: `${y}px`,
        width: `${w}px`,
        height: `${h}px`,
      },
    })
  }

  return result
})

// 2. 计算相对几何对齐辅助线 (如垂直居中对齐线)
const alignmentLines = computed(() => {
  const lines: Array<{
    x1: number
    y1: number
    x2: number
    y2: number
    label: string
  }> = []

  for (const el of props.template.elements) {
    const rel = el.constraints?.relative_alignment
    if (!rel || !rel.target_id) continue

    const sourceFrame = props.frames.find((f) => f.kind === el.kind)
    const targetFrame = props.frames.find((f) => f.kind === rel.target_id)
    if (!sourceFrame || !targetFrame) continue

    if (rel.align_type === 'AlignCenterVertical') {
      const centerY = (targetFrame.y_mm + targetFrame.height_mm / 2.0 + rel.offset_mm) * scale.value
      const xStart = Math.min(sourceFrame.x_mm, targetFrame.x_mm) * scale.value - 10
      const xEnd =
        Math.max(
          sourceFrame.x_mm + sourceFrame.width_mm,
          targetFrame.x_mm + targetFrame.width_mm,
        ) * scale.value + 10

      lines.push({
        x1: xStart,
        y1: centerY,
        x2: xEnd,
        y2: centerY,
        label: `${el.kind} 相对 ${rel.target_id} 垂直居中轴 (偏移 ${rel.offset_mm}mm)`,
      })
    } else if (rel.align_type === 'AlignTop') {
      const topY = (targetFrame.y_mm + rel.offset_mm) * scale.value
      const xStart = Math.min(sourceFrame.x_mm, targetFrame.x_mm) * scale.value - 10
      const xEnd =
        Math.max(
          sourceFrame.x_mm + sourceFrame.width_mm,
          targetFrame.x_mm + targetFrame.width_mm,
        ) * scale.value + 10

      lines.push({
        x1: xStart,
        y1: topY,
        x2: xEnd,
        y2: topY,
        label: `${el.kind} 相对 ${rel.target_id} 顶端对齐`,
      })
    }
  }

  return lines
})

// 3. 计算 9 宫格绝对纸张锚点标记与引线
const anchorPins = computed(() => {
  const pins: Array<{
    pinX: number
    pinY: number
    elCenterX: number
    elCenterY: number
    label: string
  }> = []

  const margins = props.template.margins
  const w = props.paperWidthMm
  const h = props.paperHeightMm

  const getAnchorCoords = (pos: string): { x: number; y: number } => {
    switch (pos) {
      case 'TopLeft':
        return { x: margins.left_mm, y: margins.top_mm }
      case 'TopCenter':
        return { x: w / 2, y: margins.top_mm }
      case 'TopRight':
        return { x: w - margins.right_mm, y: margins.top_mm }
      case 'MiddleLeft':
        return { x: margins.left_mm, y: h / 2 }
      case 'Center':
        return { x: w / 2, y: h / 2 }
      case 'MiddleRight':
        return { x: w - margins.right_mm, y: h / 2 }
      case 'BottomLeft':
        return { x: margins.left_mm, y: h - margins.bottom_mm }
      case 'BottomCenter':
        return { x: w / 2, y: h - margins.bottom_mm }
      case 'BottomRight':
        return { x: w - margins.right_mm, y: h - margins.bottom_mm }
      default:
        return { x: margins.left_mm, y: margins.top_mm }
    }
  }

  for (const el of props.template.elements) {
    const pos = el.constraints?.anchor_position
    if (!pos) continue

    const frame = props.frames.find((f) => f.kind === el.kind)
    if (!frame) continue

    const anchorCoord = getAnchorCoords(pos)
    const pinX = anchorCoord.x * scale.value
    const pinY = anchorCoord.y * scale.value
    const elCenterX = (frame.x_mm + frame.width_mm / 2) * scale.value
    const elCenterY = (frame.y_mm + frame.height_mm / 2) * scale.value

    pins.push({
      pinX,
      pinY,
      elCenterX,
      elCenterY,
      label: `${el.kind} 锚定 ${pos}`,
    })
  }

  return pins
})
</script>

<style scoped>
.visual-constraint-overlay {
  overflow: hidden;
  user-select: none;
}

.guides-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.align-axis-line {
  stroke: #0071e3;
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
  filter: drop-shadow(0 1px 2px rgba(0, 113, 227, 0.35));
  animation: dash-move 30s linear infinite;
}

.axis-dot {
  fill: #0071e3;
  stroke: #ffffff;
  stroke-width: 1.5;
}

.anchor-guide-line {
  stroke: #ff9500;
  stroke-width: 1.2;
  stroke-dasharray: 3 3;
  opacity: 0.85;
}

.anchor-pin-dot {
  fill: #ff9500;
  stroke: #ffffff;
  stroke-width: 1.5;
  filter: drop-shadow(0 1px 3px rgba(255, 149, 0, 0.4));
}

.clearance-box {
  position: absolute;
  border: 1.5px dashed #0071e3;
  background: rgba(0, 113, 227, 0.04);
  border-radius: 6px;
  box-shadow: 0 0 0 1px rgba(0, 113, 227, 0.15), inset 0 0 12px rgba(0, 113, 227, 0.05);
  box-sizing: border-box;
  animation: clearance-glow 2.8s ease-in-out infinite alternate;
}

.hatch-pattern {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 6px,
    rgba(0, 113, 227, 0.05) 6px,
    rgba(0, 113, 227, 0.05) 12px
  );
  border-radius: inherit;
}

.cushion-badge {
  position: absolute;
  top: -10px;
  left: 8px;
  background: #0071e3;
  color: #ffffff;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 2px 5px rgba(0, 113, 227, 0.35);
  letter-spacing: -0.1px;
}

.shield-icon {
  font-size: 10px;
}

.align-badge {
  position: absolute;
  transform: translate(-50%, -100%);
  background: rgba(0, 113, 227, 0.92);
  backdrop-filter: blur(8px);
  color: #ffffff;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  letter-spacing: -0.2px;
}

.anchor-badge {
  position: absolute;
  transform: translate(-50%, -100%);
  margin-top: -4px;
  background: rgba(255, 149, 0, 0.95);
  backdrop-filter: blur(8px);
  color: #ffffff;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(255, 149, 0, 0.35);
  letter-spacing: -0.2px;
}

.hard-budget-pill {
  position: absolute;
  bottom: 8px;
  right: 12px;
  background: rgba(52, 199, 89, 0.94);
  backdrop-filter: blur(12px);
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 8px rgba(52, 199, 89, 0.35);
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.4);
  animation: pulse 1.6s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(0.9);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.3);
    opacity: 1;
  }
  100% {
    transform: scale(0.9);
    opacity: 0.8;
  }
}

@keyframes clearance-glow {
  0% {
    box-shadow: 0 0 0 1px rgba(0, 113, 227, 0.15), inset 0 0 8px rgba(0, 113, 227, 0.04);
  }
  100% {
    box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.28), inset 0 0 16px rgba(0, 113, 227, 0.08);
  }
}

@keyframes dash-move {
  to {
    stroke-dashoffset: -100;
  }
}
</style>
