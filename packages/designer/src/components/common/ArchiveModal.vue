<template>
  <div v-if="visible" class="apple-modal-overlay" @click.self="$emit('close')">
    <div class="apple-modal-card">
      <div class="modal-header">
        <div class="title-wrap">
          <div class="traffic-lights">
            <span class="dot red" @click="$emit('close')"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
          </div>
          <h3>🗄️ 医院内网本地模板档案库 (Offline Archive)</h3>
        </div>
        <button class="btn-close" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-sub">
        <span class="badge">SQLite / 离线文件存储模式</span>
        <span class="sub-desc">专为医院内网隔离环境设计，无需外网，所有模板与历史均持久化在本地终端</span>
      </div>

      <div class="archive-list">
        <div v-for="item in templates" :key="item.id" class="archive-row">
          <div class="item-info">
            <span class="item-name">{{ item.name }}</span>
            <span class="item-meta">{{ item.paper }} | 更新时间: {{ item.updated_at }}</span>
          </div>
          <div class="item-actions">
            <button class="apple-btn-secondary" @click="$emit('load', item)">载入使用</button>
            <button class="apple-btn-danger" @click="$emit('delete', item.id)">删除</button>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="apple-btn-primary" @click="$emit('export-bundle')">
          📦 导出全量内网归档备份包 (.json)
        </button>
        <label class="apple-btn-secondary file-btn">
          📂 导入模板文件
          <input type="file" accept=".json,.medprint" @change="$emit('import-file', $event)" style="display: none;" />
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface SavedTemplate {
  id: string
  name: string
  paper: string
  updated_at: string
  data?: any
}

defineProps<{
  visible: boolean
  templates: SavedTemplate[]
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'load', item: SavedTemplate): void
  (e: 'delete', id: string): void
  (e: 'export-bundle'): void
  (e: 'import-file', event: Event): void
}>()
</script>

<style scoped>
.apple-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}
.apple-modal-card {
  width: 640px;
  max-width: 90vw;
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
  margin-bottom: 8px;
}
.title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}
.traffic-lights {
  display: flex;
  gap: 6px;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  cursor: pointer;
}
.dot.red { background: #ff5f56; }
.dot.yellow { background: #ffbd2e; }
.dot.green { background: #27c93f; }
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
  padding: 4px;
}
.modal-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.badge {
  background: #e8f2ff;
  color: #0071e3;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
}
.sub-desc {
  font-size: 12px;
  color: #86868b;
}
.archive-list {
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  background: white;
}
.archive-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f2f2f7;
}
.archive-row:last-child {
  border-bottom: none;
}
.item-info {
  display: flex;
  flex-direction: column;
}
.item-name {
  font-size: 13px;
  font-weight: 600;
  color: #1d1d1f;
}
.item-meta {
  font-size: 11px;
  color: #86868b;
  margin-top: 2px;
}
.item-actions {
  display: flex;
  gap: 8px;
}
.modal-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
}
.apple-btn-primary {
  background: #0071e3;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
.apple-btn-secondary {
  background: #f2f2f7;
  color: #1d1d1f;
  border: 1px solid rgba(0, 0, 0, 0.05);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.apple-btn-danger {
  background: #fff1f0;
  color: #ff3b30;
  border: 1px solid rgba(255, 59, 48, 0.2);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
}
.file-btn {
  display: inline-flex;
  align-items: center;
}
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
</style>
