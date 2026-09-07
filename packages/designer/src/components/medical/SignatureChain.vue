<template>
  <div class="signature-chain">
    <div class="sig-col">
      <span class="label">送检医师：</span>
      <span class="value">{{ requestingPhysician || '李医生' }}</span>
    </div>
    <div class="sig-col">
      <span class="label">采样/送检：</span>
      <span class="value">{{ samplingPerson || '王护士' }}</span>
    </div>
    <div class="sig-col">
      <span class="label">检验者：</span>
      <span class="value">{{ operator || '张技师' }}</span>
    </div>
    <div class="sig-col">
      <span class="label">审核/报告：</span>
      <span class="value">{{ reviewer || '赵主管技师' }}</span>
    </div>
    <div class="sig-col time">
      <span class="label">报告日期：</span>
      <span class="value">{{ reportDate || '2026-09-08 04:30' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  requestingPhysician?: string
  samplingPerson?: string
  operator?: string
  reviewer?: string
  reportDate?: string
}>()
</script>

<style scoped>
.signature-chain {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1.5px solid #0f172a;
  padding-top: 4px;
  margin-top: 6px;
  font-size: 11px;
  color: #0f172a;
  break-inside: avoid; /* 防孤行：严禁签名栏单独溢出到空白页 */
}
.sig-col {
  display: flex;
  align-items: center;
}
.label {
  font-weight: bold;
}
.value {
  margin-left: 2px;
}
</style>
