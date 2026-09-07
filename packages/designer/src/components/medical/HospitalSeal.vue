<template>
  <div
    class="hospital-seal"
    :style="{
      width: diameterMm + 'mm',
      height: diameterMm + 'mm',
      transform: `rotate(${angleJitterDeg}deg)`,
      opacity: opacity,
    }"
  >
    <svg viewBox="0 0 160 160" class="seal-svg">
      <!-- 外环红圈 -->
      <circle cx="80" cy="80" r="74" fill="none" stroke="#dc2626" stroke-width="3" />
      <circle cx="80" cy="80" r="70" fill="none" stroke="#dc2626" stroke-width="1.2" stroke-dasharray="2 1" />
      
      <!-- 五角星徽记 -->
      <polygon
        points="80,50 84,62 96,62 86,70 90,82 80,74 70,82 74,70 64,62 76,62"
        fill="#dc2626"
      />
      
      <!-- 环形医院全称文字路径 -->
      <path id="sealTextPath" d="M 18,80 A 62,62 0 1,1 142,80" fill="none" />
      <text fill="#dc2626" font-size="13" font-weight="bold" letter-spacing="1">
        <textPath href="#sealTextPath" startOffset="50%" text-anchor="middle">
          {{ hospitalName }}
        </textPath>
      </text>

      <!-- 中间印章业务名称 -->
      <text x="80" y="102" fill="#dc2626" font-size="15" font-weight="bold" text-anchor="middle">
        {{ sealTitle }}
      </text>

      <!-- 底部防伪编码 -->
      <text x="80" y="128" fill="#dc2626" font-size="9" text-anchor="middle" letter-spacing="1.5">
        {{ sealCode }}
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    hospitalName?: string
    sealTitle?: string
    sealCode?: string
    diameterMm?: number
    angleJitterDeg?: number
    opacity?: number
  }>(),
  {
    hospitalName: 'XX市第一人民医院',
    sealTitle: '检验专用章',
    sealCode: 'NO. 42010619800',
    diameterMm: 38,
    angleJitterDeg: -3.5,
    opacity: 0.85,
  }
)
</script>

<style scoped>
.hospital-seal {
  position: absolute;
  pointer-events: none;
  mix-blend-mode: multiply; /* 正片叠底，保证下方化验数值清晰可见 */
  user-select: none;
}
.seal-svg {
  width: 100%;
  height: 100%;
}
</style>
