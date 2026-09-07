<template>
  <div class="teg-chart-container">
    <div class="teg-header">
      <span class="teg-title">血栓弹力图 (TEG) 反应曲线</span>
      <span class="teg-params">R: {{ rTime }} min | K: {{ kTime }} min | α角: {{ alphaAngle }}° | MA: {{ ma }} mm | LY30: {{ ly30 }}%</span>
    </div>
    <svg viewBox="0 0 400 120" class="teg-svg">
      <!-- 坐标基准轴线 -->
      <line x1="20" y1="60" x2="380" y2="60" stroke="#94a3b8" stroke-dasharray="2 2" stroke-width="0.75" />
      <line x1="30" y1="10" x2="30" y2="110" stroke="#64748b" stroke-width="1" />
      
      <!-- TEG 纺锤形对称凝血曲线 -->
      <path
        :d="`M 30,60 
            L 70,60 
            C 90,60 110,25 150,25 
            L 240,25 
            C 300,25 340,35 370,40
            L 370,80
            C 340,85 300,95 240,95
            L 150,95
            C 110,95 90,60 70,60
            Z`"
        fill="rgba(2, 132, 199, 0.15)"
        stroke="#0284c7"
        stroke-width="1.5"
      />

      <!-- 参数标注点与垂直指示线 -->
      <line x1="70" y1="50" x2="70" y2="70" stroke="#dc2626" stroke-width="1" />
      <text x="70" y="45" fill="#dc2626" font-size="9" text-anchor="middle">R点</text>
      
      <line x1="150" y1="20" x2="150" y2="100" stroke="#16a34a" stroke-width="1" stroke-dasharray="1 1" />
      <text x="150" y="16" fill="#16a34a" font-size="9" text-anchor="middle">MA ({{ ma }}mm)</text>
    </svg>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    rTime?: number
    kTime?: number
    alphaAngle?: number
    ma?: number
    ly30?: number
  }>(),
  {
    rTime: 5.2,
    kTime: 1.8,
    alphaAngle: 66.5,
    ma: 63.8,
    ly30: 2.1,
  }
)
</script>

<style scoped>
.teg-chart-container {
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 4px 8px;
  background: white;
  margin: 4px 0;
}
.teg-header {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #334155;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 2px;
}
.teg-title {
  font-weight: bold;
  color: #0369a1;
}
.teg-params {
  font-family: monospace;
}
.teg-svg {
  width: 100%;
  height: 90px;
}
</style>
