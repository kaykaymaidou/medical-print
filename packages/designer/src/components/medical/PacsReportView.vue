<template>
  <div class="pacs-container">
    <header class="pacs-header">
      <h1 class="hospital-name">{{ hospitalName }}</h1>
      <h2 class="pacs-title">超 声 医 学 科 检 查 报 告 单</h2>
      <div class="pacs-meta-row">
        <span><strong>检查类别：</strong>常规腹部超声</span>
        <span><strong>设备型号：</strong>GE LOGIQ E9</span>
        <span><strong>检查号：</strong>US20260908003</span>
      </div>
    </header>

    <section class="patient-bar">
      <span><strong>姓名：</strong>李四</span>
      <span><strong>性别：</strong>女</span>
      <span><strong>年龄：</strong>52岁</span>
      <span><strong>病历号：</strong>BL992019</span>
      <span><strong>送检科室：</strong>消化内科</span>
      <span><strong>床号：</strong>08床</span>
    </section>

    <!-- 超声多图网格 (PACS Image Grid) -->
    <div class="images-section">
      <div class="us-image-card">
        <div class="us-screen">
          <svg viewBox="0 0 200 120" class="us-svg">
            <rect width="200" height="120" fill="#050505" />
            <!-- 扇形超声声束轮廓 -->
            <path d="M 100,10 L 20,110 A 110,110 0 0,0 180,110 Z" fill="#1e293b" opacity="0.6" />
            <!-- 肝脏光点与微小囊肿斑块 -->
            <circle cx="105" cy="65" r="14" fill="#0f172a" stroke="#38bdf8" stroke-dasharray="2 2" />
            <text x="125" y="65" fill="#38bdf8" font-size="8">12.5mm × 9.8mm</text>
            <!-- 刻度线与时间 -->
            <text x="25" y="22" fill="#22c55e" font-size="7">GE LOGIQ / 3.5MHz</text>
            <text x="25" y="32" fill="#94a3b8" font-size="7">MI: 1.1 / TIS: 0.4</text>
          </svg>
        </div>
        <span class="img-caption">图1：肝右叶实质横断面探查</span>
      </div>

      <div class="us-image-card">
        <div class="us-screen">
          <svg viewBox="0 0 200 120" class="us-svg">
            <rect width="200" height="120" fill="#050505" />
            <!-- 彩色多普勒血流信号取样框 -->
            <path d="M 100,10 L 30,110 A 105,105 0 0,0 170,110 Z" fill="#1e293b" opacity="0.6" />
            <rect x="80" y="50" width="40" height="35" fill="rgba(2, 132, 199, 0.2)" stroke="#f59e0b" stroke-width="0.75" />
            <circle cx="100" cy="68" r="8" fill="rgba(239, 68, 68, 0.4)" />
            <text x="25" y="22" fill="#ef4444" font-size="7">CDFI: 门静脉主干彩色血流</text>
            <text x="25" y="32" fill="#22c55e" font-size="7">Vmax: 22.4 cm/s</text>
          </svg>
        </div>
        <span class="img-caption">图2：胆囊切面及彩色多普勒血流</span>
      </div>
    </div>

    <!-- 影像学所见与诊断意见 -->
    <div class="findings-box">
      <div class="finding-group">
        <span class="group-title">【超声所见】</span>
        <p class="group-content">
          肝脏大小形态正常，包膜光滑，实质回声致密均质，光点稍粗，血管纹理清晰。于肝右前叶实质内可见一大小约 12.5mm × 9.8mm 无回声区，边界清晰整齐，后方回声增强。CDFI：其内未见明显异常血流信号。胆囊壁光滑，未见异常光团。脾脏未见肿大。
        </p>
      </div>

      <div class="finding-group diagnosis">
        <span class="group-title">【超声提示 / 诊断意见】</span>
        <p class="group-content bold">
          1. 肝右前叶囊肿（轻度，良性声像图表现）；<br />
          2. 脂肪肝声像图改变；<br />
          3. 胆囊、胰腺、脾脏未见明显异常声像。
        </p>
      </div>
    </div>

    <!-- 底部医师签名链 -->
    <div class="pacs-footer">
      <span><strong>检查医师：</strong>孙主治医师</span>
      <span><strong>报告医师：</strong>孙主治医师</span>
      <span><strong>审核医师：</strong>钱主任医师</span>
      <span><strong>报告日期：</strong>2026-09-08 08:30</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  hospitalName?: string
}>()
</script>

<style scoped>
.pacs-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif;
  color: #0f172a;
}
.pacs-header {
  text-align: center;
  border-bottom: 2px solid #0f172a;
  padding-bottom: 4px;
}
.hospital-name {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
}
.pacs-title {
  margin: 2px 0 4px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1px;
}
.pacs-meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #475569;
}
.patient-bar {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid #0f172a;
  padding: 3px 0;
  font-size: 10.5px;
  margin-bottom: 6px;
}
.images-section {
  display: flex;
  gap: 12px;
  margin-bottom: 6px;
}
.us-image-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.us-screen {
  width: 100%;
  background: black;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 0 10px rgba(0,0,0,0.8);
}
.us-svg {
  width: 100%;
  height: 88px;
  display: block;
}
.img-caption {
  font-size: 9.5px;
  color: #64748b;
  margin-top: 2px;
}
.findings-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 10.5px;
  line-height: 1.35;
}
.finding-group .group-title {
  font-weight: bold;
  color: #0369a1;
}
.finding-group .group-content {
  margin: 1px 0 0;
  color: #1e293b;
}
.diagnosis .group-title {
  color: #b91c1c;
}
.diagnosis .group-content.bold {
  font-weight: 600;
}
.pacs-footer {
  display: flex;
  justify-content: space-between;
  border-top: 1.5px solid #0f172a;
  padding-top: 4px;
  font-size: 10px;
  margin-top: auto;
}
</style>
