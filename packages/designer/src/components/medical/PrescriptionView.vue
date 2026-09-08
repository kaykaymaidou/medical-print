<template>
  <div class="prescription-container">
    <!-- 处方顶部特征红标 -->
    <div class="rx-watermark">普通处方</div>
    <div class="rx-header">
      <h1 class="hospital-name">{{ hospitalName }}</h1>
      <h2 class="rx-title">门 急 诊 处 方 笺</h2>
      <div class="rx-meta-row">
        <span><strong>费别：</strong>城镇医保</span>
        <span><strong>医疗机构代码：</strong>420106001</span>
        <span><strong>处方编号：</strong>{{ rxNo || 'RX202609088892' }}</span>
      </div>
    </div>

    <!-- 患者信息横格 -->
    <div class="rx-patient-box">
      <div class="row">
        <span><strong>姓名：</strong>张三</span>
        <span><strong>性别：</strong>男</span>
        <span><strong>年龄：</strong>45岁</span>
        <span><strong>门诊号：</strong>MZ2026090801</span>
      </div>
      <div class="row">
        <span><strong>科室：</strong>心血管内科门诊</span>
        <span><strong>就诊日期：</strong>2026-09-08</span>
        <span><strong>临床诊断：</strong>原发性高血压 (2级，很高危)</span>
      </div>
    </div>

    <!-- Rp. 处方药品清单 -->
    <div class="rp-body">
      <div class="rp-mark">Rp.</div>
      <div class="medicine-list">
        <div v-for="(med, idx) in medicines" :key="idx" class="medicine-item">
          <div class="med-main">
            <span class="med-index">{{ idx + 1 }}.</span>
            <span class="med-name">{{ med.name }}</span>
            <span class="med-spec">{{ med.spec }}</span>
            <span class="med-qty">× {{ med.qty }}</span>
          </div>
          <div class="med-usage">
            Sig: {{ med.usage }}
          </div>
        </div>
      </div>
    </div>

    <!-- 处方划界终止线 -->
    <div class="rx-divider">
      <span class="end-text">--- 以下空白 ---</span>
    </div>

    <!-- 处方底部责任签名与盖章区 -->
    <div class="rx-signatures">
      <div class="sig-item">
        <span class="label">医师签章：</span>
        <span class="val">李医生 (印)</span>
      </div>
      <div class="sig-item">
        <span class="label">金额：</span>
        <span class="val">￥86.40</span>
      </div>
      <div class="sig-item">
        <span class="label">审核药师：</span>
        <span class="val">周药师</span>
      </div>
      <div class="sig-item">
        <span class="label">调配/发药药师：</span>
        <span class="val">吴主管药师</span>
      </div>
    </div>

    <div class="rx-footer-note">
      注意：1. 本处方开具当日有效；2. 处方一律取药后当面清点，药品一经发出概不退换。
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  hospitalName?: string
  rxNo?: string
}>()

const medicines = [
  {
    name: '苯磺酸氨氯地平片 (络活喜)',
    spec: '5mg * 7片 / 盒',
    qty: '2 盒',
    usage: '口服 一日一次 一次一片 (5mg) 早晨饭后',
  },
  {
    name: '缬沙坦胶囊 (代文)',
    spec: '80mg * 7粒 / 盒',
    qty: '2 盒',
    usage: '口服 一日一次 一次一粒 (80mg)',
  },
  {
    name: '阿司匹林肠溶片 (拜阿司匹灵)',
    spec: '100mg * 30片 / 盒',
    qty: '1 盒',
    usage: '口服 一日一次 一次一片 (100mg) 睡前服用',
  },
]
</script>

<style scoped>
.prescription-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Songti SC", serif;
  color: #1a1a1a;
}
.rx-watermark {
  position: absolute;
  top: 0;
  right: 0;
  border: 1.5px solid #dc2626;
  color: #dc2626;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
}
.rx-header {
  text-align: center;
  border-bottom: 2px solid #000;
  padding-bottom: 4px;
}
.hospital-name {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.5px;
}
.rx-title {
  margin: 2px 0 6px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 4px;
}
.rx-meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 10.5px;
  color: #333;
}
.rx-patient-box {
  border-bottom: 1.5px solid #000;
  padding: 4px 0;
  font-size: 11px;
}
.rx-patient-box .row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2px;
}
.rx-patient-box .row:last-child {
  margin-bottom: 0;
}
.rp-body {
  flex: 1;
  padding: 6px 0;
  display: flex;
  flex-direction: column;
}
.rp-mark {
  font-size: 18px;
  font-weight: 900;
  font-family: Georgia, serif;
  font-style: italic;
  margin-bottom: 4px;
  line-height: 1;
}
.medicine-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 12px;
}
.med-main {
  display: flex;
  align-items: baseline;
  font-size: 12px;
}
.med-index { font-weight: bold; margin-right: 4px; }
.med-name { font-weight: 700; margin-right: 8px; }
.med-spec { color: #555; font-size: 11px; margin-right: auto; }
.med-qty { font-weight: bold; }
.med-usage {
  font-size: 11px;
  color: #444;
  padding-left: 16px;
  font-style: italic;
}
.rx-divider {
  text-align: center;
  margin: auto 0 4px;
  border-bottom: 1px dashed #999;
  line-height: 0.1em;
}
.end-text {
  background: white;
  padding: 0 10px;
  font-size: 10px;
  color: #888;
}
.rx-signatures {
  display: flex;
  justify-content: space-between;
  border-top: 1.5px solid #000;
  padding-top: 4px;
  font-size: 10.5px;
}
.sig-item .label { font-weight: bold; }
.rx-footer-note {
  font-size: 9px;
  color: #666;
  margin-top: 4px;
  text-align: center;
}
</style>
