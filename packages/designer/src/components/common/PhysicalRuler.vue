<template>
  <div class="ruler-container">
    <!-- 标尺左上角原点与坐标指示器 -->
    <div class="origin-box">
      <span class="coord-tag">{{ coordText }}</span>
    </div>

    <!-- 顶部水平毫米标尺 (0 ~ 210mm) -->
    <div class="horizontal-ruler" ref="hRulerRef">
      <div v-for="tick in hTicks" :key="tick" class="h-tick" :style="{ left: tick + 'mm' }">
        <span v-if="tick % 20 === 0" class="tick-label">{{ tick }}</span>
        <span v-else-if="tick % 10 === 0" class="tick-label micro">{{ tick }}</span>
      </div>
      <!-- 光标垂直十字准星红线 -->
      <div v-if="cursorX >= 0" class="cursor-line-v" :style="{ left: cursorX + 'px' }"></div>
    </div>

    <!-- 左侧垂直毫米标尺 (0 ~ 148mm) -->
    <div class="vertical-ruler" ref="vRulerRef">
      <div v-for="tick in vTicks" :key="tick" class="v-tick" :style="{ top: tick + 'mm' }">
        <span v-if="tick % 20 === 0" class="tick-label">{{ tick }}</span>
        <span v-else-if="tick % 10 === 0" class="tick-label micro">{{ tick }}</span>
      </div>
      <!-- 光标水平十字准星红线 -->
      <div v-if="cursorY >= 0" class="cursor-line-h" :style="{ top: cursorY + 'px' }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  cursorX: number
  cursorY: number
}>()

// A5 横向纸张：宽 210mm，高 148mm
const hTicks = Array.from({ length: 22 }, (_, i) => i * 10)
const vTicks = Array.from({ length: 16 }, (_, i) => i * 10)

const coordText = computed(() => {
  if (props.cursorX < 0 || props.cursorY < 0) return 'mm'
  // 1px 约对应 0.264583 mm (96 DPI下)
  const mmX = (props.cursorX * 0.264583).toFixed(1)
  const mmY = (props.cursorY * 0.264583).toFixed(1)
  return `${mmX}, ${mmY}`
})
</script>

<style scoped>
.ruler-container {
  pointer-events: none;
  user-select: none;
}
.origin-box {
  position: absolute;
  top: 0;
  left: 0;
  width: 24px;
  height: 20px;
  background: #ebebeb;
  border-right: 1px solid #d1d1d6;
  border-bottom: 1px solid #d1d1d6;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
}
.coord-tag {
  font-size: 8px;
  color: #636366;
  font-family: monospace;
}
.horizontal-ruler {
  position: absolute;
  top: 0;
  left: 24px;
  right: 0;
  height: 20px;
  background: #f2f2f7;
  border-bottom: 1px solid #d1d1d6;
  overflow: hidden;
  z-index: 20;
}
.h-tick {
  position: absolute;
  top: 0;
  height: 8px;
  border-left: 1px solid #8e8e93;
}
.h-tick .tick-label {
  position: absolute;
  top: 7px;
  left: 2px;
  font-size: 8px;
  font-family: -apple-system, monospace;
  color: #636366;
}
.h-tick .tick-label.micro {
  font-size: 7px;
  color: #aeaeb2;
}
.vertical-ruler {
  position: absolute;
  top: 20px;
  left: 0;
  bottom: 0;
  width: 24px;
  background: #f2f2f7;
  border-right: 1px solid #d1d1d6;
  overflow: hidden;
  z-index: 20;
}
.v-tick {
  position: absolute;
  left: 0;
  width: 8px;
  border-top: 1px solid #8e8e93;
}
.v-tick .tick-label {
  position: absolute;
  left: 9px;
  top: 1px;
  font-size: 8px;
  font-family: -apple-system, monospace;
  color: #636366;
}
.v-tick .tick-label.micro {
  font-size: 7px;
  color: #aeaeb2;
}
.cursor-line-v {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #ff3b30;
  opacity: 0.8;
}
.cursor-line-h {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: #ff3b30;
  opacity: 0.8;
}
</style>
