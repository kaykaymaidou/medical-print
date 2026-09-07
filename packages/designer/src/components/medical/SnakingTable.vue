<template>
  <div class="snaking-table-container">
    <!-- 左列 -->
    <div class="table-column left-col">
      <table class="med-table">
        <thead>
          <tr>
            <th style="width: 22px;">No</th>
            <th>项目名称</th>
            <th style="width: 45px;">代号</th>
            <th style="width: 45px;">结果</th>
            <th style="width: 25px;">提示</th>
            <th style="width: 45px;">单位</th>
            <th style="width: 65px;">参考区间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in leftItems" :key="item.index" :class="{ 'critical-row': item.is_critical }">
            <td class="center">{{ item.index }}</td>
            <td class="bold">{{ item.item_name }}</td>
            <td class="center">{{ item.item_abbr }}</td>
            <td class="right bold" :class="getResultClass(item.alert_flag)">
              {{ item.result_value }}
            </td>
            <td class="center bold" :class="getResultClass(item.alert_flag)">
              {{ getFlagSymbol(item.alert_flag) }}
            </td>
            <td class="center">{{ item.unit }}</td>
            <td class="center ref-col">{{ item.ref_range_display }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 垂直中轴分割线 -->
    <div class="column-divider"></div>

    <!-- 右列 (自上而下折流继续排) -->
    <div class="table-column right-col">
      <table class="med-table">
        <thead>
          <tr>
            <th style="width: 22px;">No</th>
            <th>项目名称</th>
            <th style="width: 45px;">代号</th>
            <th style="width: 45px;">结果</th>
            <th style="width: 25px;">提示</th>
            <th style="width: 45px;">单位</th>
            <th style="width: 65px;">参考区间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in rightItems" :key="item.index" :class="{ 'critical-row': item.is_critical }">
            <td class="center">{{ item.index }}</td>
            <td class="bold">{{ item.item_name }}</td>
            <td class="center">{{ item.item_abbr }}</td>
            <td class="right bold" :class="getResultClass(item.alert_flag)">
              {{ item.result_value }}
            </td>
            <td class="center bold" :class="getResultClass(item.alert_flag)">
              {{ getFlagSymbol(item.alert_flag) }}
            </td>
            <td class="center">{{ item.unit }}</td>
            <td class="center ref-col">{{ item.ref_range_display }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface LabItem {
  index: number
  item_name: string
  item_abbr: string
  result_value: string
  unit: string
  ref_range_display: string
  alert_flag: 'Normal' | 'High' | 'Low' | 'Critical'
  is_critical?: boolean
}

const props = defineProps<{
  items: LabItem[]
  splitIndex?: number
}>()

const leftItems = computed(() => {
  const mid = props.splitIndex || Math.ceil(props.items.length / 2)
  return props.items.slice(0, mid)
})

const rightItems = computed(() => {
  const mid = props.splitIndex || Math.ceil(props.items.length / 2)
  return props.items.slice(mid)
})

function getFlagSymbol(flag: string) {
  if (flag === 'High') return '↑'
  if (flag === 'Low') return '↓'
  if (flag === 'Critical') return '★'
  return ''
}

function getResultClass(flag: string) {
  if (flag === 'High' || flag === 'Critical') return 'text-high'
  if (flag === 'Low') return 'text-low'
  return ''
}
</script>

<style scoped>
.snaking-table-container {
  display: flex;
  width: 100%;
  gap: 4px;
}
.table-column {
  flex: 1;
}
.column-divider {
  width: 1px;
  background-color: #cbd5e1;
  margin: 0 2px;
}
.med-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
  line-height: 1.25;
}
.med-table th {
  background-color: #f1f5f9;
  border-bottom: 1.5px solid #0f172a;
  border-top: 1px solid #0f172a;
  padding: 2.5px 1px;
  font-weight: 700;
  color: #0f172a;
  text-align: center;
}
.med-table td {
  padding: 2px 1px;
  border-bottom: 0.5px dashed #e2e8f0;
  color: #1e293b;
}
.center { text-align: center; }
.right { text-align: right; }
.bold { font-weight: 600; }
.ref-col { font-size: 9px; color: #475569; }
.text-high { color: #dc2626; font-weight: bold; }
.text-low { color: #2563eb; font-weight: bold; }
.critical-row { background-color: #fef2f2; }
</style>
