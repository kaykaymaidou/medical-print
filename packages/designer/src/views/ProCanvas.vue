<template>
  <div class="pro-canvas-container">
    <!-- macOS 质感顶部工具栏 -->
    <div class="pro-toolbar">
      <div class="toolbar-left">
        <button class="tool-btn" title="返回医生向导" @click="$emit('switch-view', 'wizard')">
          <span class="icon">🩺</span>
          <span>医生向导</span>
        </button>

        <div class="divider"></div>

        <!-- 纸张规格切换 -->
        <div class="paper-selector">
          <span class="label">纸张尺寸:</span>
          <select v-model="currentPaperKey" class="apple-select-sm" @change="handlePaperChange">
            <option value="a5_landscape">A5 横向 (210 × 148 mm) - 推荐化验单</option>
            <option value="a4_portrait">A4 纵向 (210 × 297 mm) - 综合大病历</option>
            <option value="a4_landscape">A4 横向 (297 × 210 mm) - 宽幅处方/检查</option>
            <option value="continuous_120">针打穿孔连续纸 (120 × 140 mm)</option>
            <option value="thermal_80">80mm 热敏标签 (80 × 50 mm)</option>
          </select>
        </div>

        <div class="divider"></div>

        <!-- 缩放控制 -->
        <div class="zoom-controls">
          <button class="zoom-btn" @click="adjustZoom(-0.1)">−</button>
          <span class="zoom-text">{{ Math.round(zoomScale * 100) }}%</span>
          <button class="zoom-btn" @click="adjustZoom(0.1)">+</button>
          <button class="zoom-reset-btn" @click="zoomScale = 1.0">100%</button>
        </div>
      </div>

      <div class="toolbar-center">
        <!-- 网格吸附控制 -->
        <div class="grid-controls">
          <button
            :class="['grid-pill', { active: snapGridMm === 0 }]"
            @click="snapGridMm = 0"
          >
            无吸附
          </button>
          <button
            :class="['grid-pill', { active: snapGridMm === 1 }]"
            @click="snapGridMm = 1"
          >
            1mm 精确
          </button>
          <button
            :class="['grid-pill', { active: snapGridMm === 5 }]"
            @click="snapGridMm = 5"
          >
            5mm 网格
          </button>
        </div>

        <button
          :class="['toggle-guide-btn', { active: showSnakingGuide }]"
          title="显示/隐藏 A5 双列中轴参考线"
          @click="showSnakingGuide = !showSnakingGuide"
        >
          双列中轴线
        </button>
      </div>

      <div class="toolbar-right">
        <!-- 实验室与功能模态框触发器 -->
        <button class="tool-action-btn" @click="showFormulaLab = true">
          <span>⚗️ 公式实验室</span>
        </button>

        <button class="tool-action-btn" @click="showArchive = true">
          <span>📁 本地档案库</span>
        </button>

        <button class="tool-action-btn" @click="exportJsonTemplate">
          <span>📤 导出模板</span>
        </button>

        <button class="tool-action-btn primary" @click="handlePrintPdf">
          <span>🖨️ 矢量直印</span>
        </button>
      </div>
    </div>

    <!-- 主工作区：左物料栏 + 中画布 + 右属性检查器 -->
    <div class="pro-main-area">
      <!-- 左侧物料工具箱 -->
      <div class="toolbox-panel">
        <div class="panel-header">
          <span>医疗物料库 (Toolbox)</span>
        </div>
        <div class="toolbox-groups">
          <div class="group-title">排版与基础</div>
          <div class="tool-grid">
            <button class="tool-item" @click="addElement('header')">
              <span class="icon">🏥</span>
              <span>医院页眉</span>
            </button>
            <button class="tool-item" @click="addElement('demographics')">
              <span class="icon">👤</span>
              <span>患者信息条</span>
            </button>
            <button class="tool-item" @click="addElement('label')">
              <span class="icon">📝</span>
              <span>文本/表达式</span>
            </button>
            <button class="tool-item" @click="addElement('perforation')">
              <span class="icon">✂️</span>
              <span>针打撕纸线</span>
            </button>
          </div>

          <div class="group-title">医疗数据与折流</div>
          <div class="tool-grid">
            <button class="tool-item" @click="addElement('snaking_table')">
              <span class="icon">📊</span>
              <span>A5双列折流表</span>
            </button>
            <button class="tool-item" @click="addElement('grid_table')">
              <span class="icon">📋</span>
              <span>常规项目表</span>
            </button>
            <button class="tool-item" @click="addElement('barcode')">
              <span class="icon">🔲</span>
              <span>条码/二维码</span>
            </button>
          </div>

          <div class="group-title">临床影像与责任</div>
          <div class="tool-grid">
            <button class="tool-item" @click="addElement('teg_chart')">
              <span class="icon">📈</span>
              <span>TEG 弹力图</span>
            </button>
            <button class="tool-item" @click="addElement('pacs_grid')">
              <span class="icon">🖼️</span>
              <span>PACS 影像网格</span>
            </button>
            <button class="tool-item" @click="addElement('seal')">
              <span class="icon">🔴</span>
              <span>防伪检验红章</span>
            </button>
            <button class="tool-item" @click="addElement('signature_chain')">
              <span class="icon">✍️</span>
              <span>三级签名链</span>
            </button>
          </div>
        </div>

        <div class="toolbox-footer">
          <span class="hint">💡 点击物料即可直接放置到画布</span>
        </div>
      </div>

      <!-- 中间物理毫米画布工作区 -->
      <div class="canvas-viewport-area" @mousedown.self="clearSelection">
        <!-- 物理毫米参考标尺与光标十字线 -->
        <div class="ruler-container-wrap">
          <PhysicalRuler
            :cursor-x="cursorX * mmToPx"
            :cursor-y="cursorY * mmToPx"
          />

          <!-- 真实打印纸张模拟白板 -->
          <div
            ref="paperRef"
            class="paper-sheet"
            :style="paperStyle"
            @mousemove="handlePaperMouseMove"
            @dragover.prevent
            @click.self="clearSelection"
          >
            <!-- 5mm 物理网格背景 -->
            <div
              v-if="snapGridMm > 0"
              class="paper-grid-overlay"
              :style="gridOverlayStyle"
            ></div>

            <!-- A5 横向双列中轴参考辅助线 (X = 105mm) -->
            <div
              v-if="showSnakingGuide && currentPaperKey === 'a5_landscape'"
              class="snaking-center-guide"
              :style="{ left: 105 * mmToPx + 'px' }"
            >
              <span class="guide-tag">折流中轴线 105mm</span>
            </div>

            <!-- 画布中所有元素 -->
            <div
              v-for="el in elements"
              :key="el.id"
              class="canvas-element"
              :class="{ selected: selectedElementId === el.id }"
              :style="getElementStyle(el)"
              @mousedown.stop="startDrag(el, $event)"
              @click.stop="selectElement(el)"
            >
              <!-- 元素内容动态插槽与渲染 -->
              <div class="element-content">
                <!-- 医院页眉 -->
                <template v-if="el.type === 'header'">
                  <div class="el-header">
                    <h2 class="hospital-title">{{ el.props.hospitalName || '北京协和医学院附属第一医院' }}</h2>
                    <div class="report-subtitle">{{ el.props.reportTitle || '临床生化检验报告单 (CLINICAL BIOCHEMISTRY)' }}</div>
                  </div>
                </template>

                <!-- 患者信息条 -->
                <template v-else-if="el.type === 'demographics'">
                  <div class="el-demographics">
                    <div class="info-cell"><span>姓名:</span> <strong>张伟</strong></div>
                    <div class="info-cell"><span>性别:</span> <strong>男</strong></div>
                    <div class="info-cell"><span>年龄:</span> <strong>45岁</strong></div>
                    <div class="info-cell"><span>病历号:</span> <strong>MZ809214</strong></div>
                    <div class="info-cell"><span>科室:</span> <strong>内分泌门诊</strong></div>
                    <div class="info-cell"><span>标本:</span> <strong>静脉血清</strong></div>
                  </div>
                </template>

                <!-- 文本 / 表达式 -->
                <template v-else-if="el.type === 'label'">
                  <div class="el-label" :style="{ fontSize: (el.props.fontSizePt || 9) + 'pt', textAlign: el.props.align || 'left' }">
                    {{ el.props.text || '【提示】此报告仅对本次标本负责，如有疑问请于24小时内复核。' }}
                  </div>
                </template>

                <!-- 针打撕纸穿孔线 -->
                <template v-else-if="el.type === 'perforation'">
                  <div class="el-perforation">
                    <span class="cut-icon">✂️</span>
                    <span class="cut-line"></span>
                    <span class="cut-text">针打连续穿孔撕纸线 (LQ-630K)</span>
                    <span class="cut-line"></span>
                  </div>
                </template>

                <!-- A5 双列折流表 -->
                <template v-else-if="el.type === 'snaking_table'">
                  <div class="el-snaking-table-mock">
                    <div class="mock-table-col left">
                      <div class="col-head"><span>项目名称</span><span>结果</span><span>参考值</span></div>
                      <div class="col-row"><span>丙氨酸氨基转移酶 ALT</span><strong>42</strong><span>9~50</span></div>
                      <div class="col-row"><span>天门冬氨酸转移酶 AST</span><strong>28</strong><span>15~40</span></div>
                      <div class="col-row alert"><span>总胆固醇 TC</span><strong class="text-danger">6.42 ↑</strong><span>< 5.2</span></div>
                    </div>
                    <div class="mock-table-divider"></div>
                    <div class="mock-table-col right">
                      <div class="col-head"><span>项目名称</span><span>结果</span><span>参考值</span></div>
                      <div class="col-row"><span>甘油三酯 TG</span><strong>1.65</strong><span>< 1.7</span></div>
                      <div class="col-row alert"><span>低密度脂蛋白 LDL</span><strong class="text-danger">3.98 ↑</strong><span>< 3.4</span></div>
                      <div class="col-row"><span>尿素氮 BUN</span><strong>6.2</strong><span>3.2~7.1</span></div>
                    </div>
                  </div>
                </template>

                <!-- 常规网格表 -->
                <template v-else-if="el.type === 'grid_table'">
                  <div class="el-grid-table-mock">
                    <div class="grid-header">
                      <span>序号</span><span>项目代号</span><span>检测项目名称</span><span>测定结果</span><span>单位</span><span>参考区间</span>
                    </div>
                    <div class="grid-row"><span>1</span><span>GLU</span><span>空腹血糖</span><strong>5.4</strong><span>mmol/L</span><span>3.9~6.1</span></div>
                    <div class="grid-row"><span>2</span><span>HbA1c</span><span>糖化血红蛋白</span><strong>5.8</strong><span>%</span><span>4.0~6.0</span></div>
                  </div>
                </template>

                <!-- 条形码 / 二维码 -->
                <template v-else-if="el.type === 'barcode'">
                  <div class="el-barcode">
                    <div class="barcode-lines">||| | |||| | || ||| || ||| | |||</div>
                    <div class="barcode-val">*{{ el.props.codeValue || '20260908001' }}*</div>
                  </div>
                </template>

                <!-- TEG 血栓弹力图 -->
                <template v-else-if="el.type === 'teg_chart'">
                  <div class="el-teg-chart">
                    <TegChart :width="el.width * mmToPx" :height="el.height * mmToPx" />
                  </div>
                </template>

                <!-- PACS 影像网格 -->
                <template v-else-if="el.type === 'pacs_grid'">
                  <div class="el-pacs-grid">
                    <div class="pacs-frame">
                      <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='120'><rect width='160' height='120' fill='%23111'/><circle cx='80' cy='60' r='35' fill='%23333'/><text x='10' y='20' fill='%23aaa' font-size='10'>US B-Mode</text></svg>" />
                      <span class="pacs-tag">超声切面 A</span>
                    </div>
                    <div class="pacs-frame">
                      <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='120'><rect width='160' height='120' fill='%23111'/><ellipse cx='80' cy='60' rx='40' ry='25' fill='%23444'/><text x='10' y='20' fill='%23aaa' font-size='10'>CDFI Flow</text></svg>" />
                      <span class="pacs-tag">彩色多普勒 B</span>
                    </div>
                  </div>
                </template>

                <!-- 医院防伪红章 -->
                <template v-else-if="el.type === 'seal'">
                  <div class="el-seal-wrapper">
                    <HospitalSeal
                      :hospital-name="el.props.hospitalName || '北京协和医学院附属第一医院'"
                      :department-name="el.props.deptName || '检验科防伪专用章'"
                    />
                  </div>
                </template>

                <!-- 三级责任签名链 -->
                <template v-else-if="el.type === 'signature_chain'">
                  <div class="el-sig-chain">
                    <SignatureChain />
                  </div>
                </template>
              </div>

              <!-- 8个控制调整手柄 (仅选中时显示) -->
              <template v-if="selectedElementId === el.id">
                <div class="handle nw" @mousedown.stop="startResize(el, 'nw', $event)"></div>
                <div class="handle n" @mousedown.stop="startResize(el, 'n', $event)"></div>
                <div class="handle ne" @mousedown.stop="startResize(el, 'ne', $event)"></div>
                <div class="handle e" @mousedown.stop="startResize(el, 'e', $event)"></div>
                <div class="handle se" @mousedown.stop="startResize(el, 'se', $event)"></div>
                <div class="handle s" @mousedown.stop="startResize(el, 's', $event)"></div>
                <div class="handle sw" @mousedown.stop="startResize(el, 'sw', $event)"></div>
                <div class="handle w" @mousedown.stop="startResize(el, 'w', $event)"></div>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧 Apple 质感极客属性检查器 -->
      <div class="inspector-panel">
        <div class="inspector-header">
          <span>属性检查器 (Inspector)</span>
        </div>

        <template v-if="selectedElement">
          <!-- 属性分段切换 -->
          <div class="inspector-tabs">
            <button
              :class="['tab-btn', { active: inspectorTab === 'geo' }]"
              @click="inspectorTab = 'geo'"
            >
              📐 几何布局
            </button>
            <button
              :class="['tab-btn', { active: inspectorTab === 'style' }]"
              @click="inspectorTab = 'style'"
            >
              🎨 样式字体
            </button>
            <button
              :class="['tab-btn', { active: inspectorTab === 'medical' }]"
              @click="inspectorTab = 'medical'"
            >
              🩺 医疗专项
            </button>
          </div>

          <div class="inspector-body">
            <!-- 几何布局 Tab -->
            <div v-if="inspectorTab === 'geo'" class="prop-group">
              <div class="prop-title">绝对物理毫米坐标 (mm)</div>
              
              <div class="prop-row-2">
                <div class="prop-field">
                  <label>X (mm)</label>
                  <input v-model.number="selectedElement.x" type="number" step="0.5" class="apple-input-sm" />
                </div>
                <div class="prop-field">
                  <label>Y (mm)</label>
                  <input v-model.number="selectedElement.y" type="number" step="0.5" class="apple-input-sm" />
                </div>
              </div>

              <div class="prop-row-2">
                <div class="prop-field">
                  <label>宽度 W (mm)</label>
                  <input v-model.number="selectedElement.width" type="number" step="0.5" class="apple-input-sm" />
                </div>
                <div class="prop-field">
                  <label>高度 H (mm)</label>
                  <input v-model.number="selectedElement.height" type="number" step="0.5" class="apple-input-sm" />
                </div>
              </div>

              <div class="prop-title" style="margin-top: 14px">对齐与图层层级</div>
              <div class="align-btn-grid">
                <button class="action-btn" title="居中对齐" @click="alignElement('center-x')">水平居中</button>
                <button class="action-btn" title="左对齐" @click="alignElement('left')">左对齐</button>
                <button class="action-btn" title="右对齐" @click="alignElement('right')">右对齐</button>
                <button class="action-btn" title="移至顶层" @click="bringToFront">置于顶层</button>
                <button class="action-btn" title="移至底层" @click="sendToBack">置于底层</button>
                <button class="action-btn danger" title="删除元素" @click="deleteSelected">🗑️ 删除</button>
              </div>
            </div>

            <!-- 样式与字体 Tab -->
            <div v-else-if="inspectorTab === 'style'" class="prop-group">
              <div class="prop-title">字体与排版</div>

              <div class="prop-field">
                <label>字号 (pt)</label>
                <input v-model.number="selectedElement.props.fontSizePt" type="number" step="0.5" class="apple-input-sm" />
              </div>

              <div class="prop-field">
                <label>对齐方式</label>
                <select v-model="selectedElement.props.align" class="apple-select-sm">
                  <option value="left">左对齐 (Left)</option>
                  <option value="center">居中对齐 (Center)</option>
                  <option value="right">右对齐 (Right)</option>
                </select>
              </div>

              <div class="prop-field">
                <label>文字内容 / 表达式</label>
                <textarea
                  v-model="selectedElement.props.text"
                  rows="3"
                  class="apple-textarea"
                  placeholder="支持变量绑定如: {patient.name}"
                ></textarea>
              </div>
            </div>

            <!-- 医疗专项参数 Tab -->
            <div v-else-if="inspectorTab === 'medical'" class="prop-group">
              <!-- 表格专属 -->
              <template v-if="selectedElement.type === 'snaking_table' || selectedElement.type === 'grid_table'">
                <div class="prop-title">A5 双列折流 (Snaking Flow)</div>
                <div class="checkbox-row">
                  <input id="snake-check" v-model="selectedElement.props.snakingFlow" type="checkbox" />
                  <label for="snake-check">启用两列折流平衡排版</label>
                </div>

                <div class="checkbox-row">
                  <input id="compact-check" v-model="selectedElement.props.autoCompaction" type="checkbox" />
                  <label for="compact-check">超行时启发式单页紧凑压缩</label>
                </div>

                <div class="prop-title" style="margin-top: 14px">行高与克隆表头</div>
                <div class="prop-field">
                  <label>基础行高 (mm)</label>
                  <input v-model.number="selectedElement.props.rowHeightMm" type="number" step="0.5" class="apple-input-sm" />
                </div>
              </template>

              <!-- 印章专属 -->
              <template v-else-if="selectedElement.type === 'seal'">
                <div class="prop-title">防伪红章参数</div>
                <div class="prop-field">
                  <label>印章医院名称</label>
                  <input v-model="selectedElement.props.hospitalName" class="apple-input-sm" />
                </div>
                <div class="prop-field">
                  <label>科室专用名称</label>
                  <input v-model="selectedElement.props.deptName" class="apple-input-sm" />
                </div>
                <div class="checkbox-row">
                  <input id="multiply-check" v-model="selectedElement.props.multiplyBlend" type="checkbox" />
                  <label for="multiply-check">正片叠底透字模式 (Multiply)</label>
                </div>
              </template>

              <!-- 条形码专属 -->
              <template v-else-if="selectedElement.type === 'barcode'">
                <div class="prop-title">条码标准与绑定</div>
                <div class="prop-field">
                  <label>码制类型</label>
                  <select v-model="selectedElement.props.barcodeType" class="apple-select-sm">
                    <option value="code128">Code 128 (国家卫健委推荐)</option>
                    <option value="qr">QR Code (二维码)</option>
                    <option value="ean13">EAN-13</option>
                  </select>
                </div>
                <div class="prop-field">
                  <label>条码数据值</label>
                  <input v-model="selectedElement.props.codeValue" class="apple-input-sm" />
                </div>
              </template>

              <!-- PACS 专属 -->
              <template v-else-if="selectedElement.type === 'pacs_grid'">
                <div class="prop-title">PACS 影像调校</div>
                <p class="prop-hint">针对激光打印机和胶片优化窗宽窗位，避免大片发黑</p>
                <button class="action-btn primary" @click="showPacsAdjust = true">
                  🔬 打开 DICOM 窗宽窗位调校器
                </button>
              </template>

              <template v-else>
                <div class="empty-state">
                  <span>当前组件无特殊医疗专项属性</span>
                </div>
              </template>
            </div>
          </div>
        </template>

        <div v-else class="inspector-empty">
          <div class="icon">👆</div>
          <p>在画布中单击选中任意医疗组件，即可在此处精确微调绝对物理坐标与参数。</p>
        </div>
      </div>
    </div>

    <!-- 弹窗组件：临床公式实验室 -->
    <FormulaLabModal
      :visible="showFormulaLab"
      @close="showFormulaLab = false"
      @insert="handleFormulaInsert"
    />

    <!-- 弹窗组件：PACS 影像窗位调校器 -->
    <PacsAdjustModal
      :visible="showPacsAdjust"
      @close="showPacsAdjust = false"
      @apply="handlePacsApply"
    />

    <!-- 弹窗组件：本地内网档案库 -->
    <ArchiveModal
      :visible="showArchive"
      :templates="savedTemplates"
      @close="showArchive = false"
      @load="handleLoadArchiveTemplate"
      @delete="handleDeleteArchiveTemplate"
      @export-bundle="handleExportBundle"
      @import-file="handleImportFile"
    />

    <!-- 弹窗组件：批量打印队列监视器 -->
    <BatchPrintModal
      :visible="showBatchPrint"
      @close="showBatchPrint = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import PhysicalRuler from '../components/common/PhysicalRuler.vue'
import HospitalSeal from '../components/medical/HospitalSeal.vue'
import SignatureChain from '../components/medical/SignatureChain.vue'
import TegChart from '../components/medical/TegChart.vue'
import FormulaLabModal from '../components/medical/FormulaLabModal.vue'
import PacsAdjustModal from '../components/medical/PacsAdjustModal.vue'
import ArchiveModal from '../components/common/ArchiveModal.vue'
import BatchPrintModal from '../components/common/BatchPrintModal.vue'

defineEmits<{
  (e: 'switch-view', view: 'wizard' | 'canvas'): void
}>()

// 纸张尺寸定义 (单位 mm)
const paperPresets = {
  a5_landscape: { name: 'A5 横向', width: 210, height: 148 },
  a4_portrait: { name: 'A4 纵向', width: 210, height: 297 },
  a4_landscape: { name: 'A4 横向', width: 297, height: 210 },
  continuous_120: { name: '针打穿孔连续纸', width: 120, height: 140 },
  thermal_80: { name: '80mm 热敏标签', width: 80, height: 50 }
}

const currentPaperKey = ref<keyof typeof paperPresets>('a5_landscape')
const zoomScale = ref(1.0)
const snapGridMm = ref(1) // 0 = 无吸附, 1 = 1mm, 5 = 5mm
const showSnakingGuide = ref(true)

const cursorX = ref(0)
const cursorY = ref(0)

const showFormulaLab = ref(false)
const showPacsAdjust = ref(false)
const showArchive = ref(false)
const showBatchPrint = ref(false)

const inspectorTab = ref<'geo' | 'style' | 'medical'>('geo')
const selectedElementId = ref<string | null>(null)

// 屏幕渲染比例：以 96 DPI 为基准 (1 inch = 25.4mm, 96 / 25.4 = 3.7795 px/mm)
const mmToPx = 3.7795

const paperWidthMm = computed(() => paperPresets[currentPaperKey.value].width)
const paperHeightMm = computed(() => paperPresets[currentPaperKey.value].height)

const paperStyle = computed(() => ({
  width: `${paperWidthMm.value * mmToPx * zoomScale.value}px`,
  height: `${paperHeightMm.value * mmToPx * zoomScale.value}px`,
  transformOrigin: '0 0'
}))

const gridOverlayStyle = computed(() => {
  const step = (snapGridMm.value === 5 ? 5 : 1) * mmToPx * zoomScale.value
  return {
    backgroundSize: `${step}px ${step}px`
  }
})

// 画布元素模型接口
interface CanvasElement {
  id: string
  type: string
  name: string
  x: number // mm
  y: number // mm
  width: number // mm
  height: number // mm
  zIndex: number
  props: Record<string, any>
}

// 初始默认 A5 横向化验单元素集合
const elements = ref<CanvasElement[]>([
  {
    id: 'el-1',
    type: 'header',
    name: '医院主标头',
    x: 10,
    y: 8,
    width: 190,
    height: 18,
    zIndex: 1,
    props: {
      hospitalName: '北京协和医学院附属第一医院',
      reportTitle: '临床生化检验报告单 (CLINICAL BIOCHEMISTRY)'
    }
  },
  {
    id: 'el-2',
    type: 'demographics',
    name: '患者信息卡',
    x: 10,
    y: 28,
    width: 190,
    height: 12,
    zIndex: 2,
    props: {}
  },
  {
    id: 'el-3',
    type: 'snaking_table',
    name: 'A5 双列折流表',
    x: 10,
    y: 42,
    width: 190,
    height: 75,
    zIndex: 3,
    props: {
      snakingFlow: true,
      autoCompaction: true,
      rowHeightMm: 5.5
    }
  },
  {
    id: 'el-4',
    type: 'barcode',
    name: '条形码',
    x: 145,
    y: 9,
    width: 50,
    height: 16,
    zIndex: 10,
    props: {
      barcodeType: 'code128',
      codeValue: 'MZ20260908001'
    }
  },
  {
    id: 'el-5',
    type: 'seal',
    name: '防伪检验红章',
    x: 155,
    y: 110,
    width: 32,
    height: 32,
    zIndex: 20,
    props: {
      hospitalName: '北京协和医学院附属第一医院',
      deptName: '检验科防伪专用章',
      multiplyBlend: true
    }
  },
  {
    id: 'el-6',
    type: 'signature_chain',
    name: '三级责任医师签名',
    x: 10,
    y: 124,
    width: 140,
    height: 14,
    zIndex: 5,
    props: {}
  }
])

const selectedElement = computed(() => {
  return elements.value.find((e) => e.id === selectedElementId.value) || null
})

function selectElement(el: CanvasElement) {
  selectedElementId.value = el.id
}

function clearSelection() {
  selectedElementId.value = null
}

function handlePaperChange() {
  clearSelection()
}

function adjustZoom(delta: number) {
  zoomScale.value = Math.max(0.5, Math.min(2.0, Math.round((zoomScale.value + delta) * 10) / 10))
}

function handlePaperMouseMove(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const pxX = (e.clientX - rect.left) / zoomScale.value
  const pxY = (e.clientY - rect.top) / zoomScale.value
  cursorX.value = Math.max(0, Math.min(paperWidthMm.value, Math.round((pxX / mmToPx) * 10) / 10))
  cursorY.value = Math.max(0, Math.min(paperHeightMm.value, Math.round((pxY / mmToPx) * 10) / 10))
}

function getElementStyle(el: CanvasElement) {
  return {
    left: `${el.x * mmToPx * zoomScale.value}px`,
    top: `${el.y * mmToPx * zoomScale.value}px`,
    width: `${el.width * mmToPx * zoomScale.value}px`,
    height: `${el.height * mmToPx * zoomScale.value}px`,
    zIndex: el.zIndex
  }
}

// 物料工具箱添加新元素
function addElement(type: string) {
  const id = `el-${Date.now().toString().slice(-4)}`
  let width = 60
  let height = 30
  let name = '新元素'
  const props: Record<string, any> = {}

  switch (type) {
    case 'header':
      name = '医院页眉'
      width = 190
      height = 18
      props.hospitalName = '北京协和医学院附属第一医院'
      props.reportTitle = '临床生化检验报告单'
      break
    case 'demographics':
      name = '患者信息条'
      width = 190
      height = 12
      break
    case 'label':
      name = '文本标签'
      width = 80
      height = 10
      props.text = '备注：请遵医嘱按时复查。'
      props.fontSizePt = 9
      props.align = 'left'
      break
    case 'perforation':
      name = '针打撕纸线'
      width = 190
      height = 6
      break
    case 'snaking_table':
      name = 'A5 双列折流表'
      width = 190
      height = 70
      props.snakingFlow = true
      props.autoCompaction = true
      props.rowHeightMm = 5.5
      break
    case 'grid_table':
      name = '常规项目表'
      width = 190
      height = 50
      break
    case 'barcode':
      name = '检验条形码'
      width = 45
      height = 15
      props.barcodeType = 'code128'
      props.codeValue = '20260908888'
      break
    case 'teg_chart':
      name = 'TEG 弹力图'
      width = 85
      height = 40
      break
    case 'pacs_grid':
      name = 'PACS 影像网格'
      width = 110
      height = 65
      break
    case 'seal':
      name = '防伪检验红章'
      width = 30
      height = 30
      props.hospitalName = '北京协和医学院附属第一医院'
      props.deptName = '检验科防伪专用章'
      props.multiplyBlend = true
      break
    case 'signature_chain':
      name = '三级签名链'
      width = 140
      height = 12
      break
  }

  // 放置在当前纸张视觉合理居中偏上位置
  const newEl: CanvasElement = {
    id,
    type,
    name,
    x: Math.max(5, Math.round((paperWidthMm.value - width) / 2)),
    y: Math.max(5, Math.round((paperHeightMm.value - height) / 2)),
    width,
    height,
    zIndex: elements.value.length + 1,
    props
  }

  elements.value.push(newEl)
  selectedElementId.value = newEl.id
}

// 拖拽与缩放逻辑 (绝对毫米坐标吸附)
let isDragging = false
let dragStartMouseX = 0
let dragStartMouseY = 0
let dragStartElX = 0
let dragStartElY = 0

function snapValue(val: number): number {
  if (snapGridMm.value <= 0) return Math.round(val * 10) / 10
  const step = snapGridMm.value
  return Math.round(val / step) * step
}

function startDrag(el: CanvasElement, e: MouseEvent) {
  selectElement(el)
  isDragging = true
  dragStartMouseX = e.clientX
  dragStartMouseY = e.clientY
  dragStartElX = el.x
  dragStartElY = el.y

  window.addEventListener('mousemove', onDragging)
  window.addEventListener('mouseup', stopDrag)
}

function onDragging(e: MouseEvent) {
  if (!isDragging || !selectedElement.value) return
  const deltaPxX = e.clientX - dragStartMouseX
  const deltaPxY = e.clientY - dragStartMouseY

  const deltaMmX = deltaPxX / (mmToPx * zoomScale.value)
  const deltaMmY = deltaPxY / (mmToPx * zoomScale.value)

  let newX = dragStartElX + deltaMmX
  let newY = dragStartElY + deltaMmY

  newX = snapValue(newX)
  newY = snapValue(newY)

  // 边界保护
  newX = Math.max(0, Math.min(paperWidthMm.value - selectedElement.value.width, newX))
  newY = Math.max(0, Math.min(paperHeightMm.value - selectedElement.value.height, newY))

  selectedElement.value.x = newX
  selectedElement.value.y = newY
}

function stopDrag() {
  isDragging = false
  window.removeEventListener('mousemove', onDragging)
  window.removeEventListener('mouseup', stopDrag)
}

// 调整尺寸 (8向手柄)
let isResizing = false
let resizeHandle = ''
let resizeStartMouseX = 0
let resizeStartMouseY = 0
let resizeStartX = 0
let resizeStartY = 0
let resizeStartW = 0
let resizeStartH = 0

function startResize(el: CanvasElement, handle: string, e: MouseEvent) {
  selectElement(el)
  isResizing = true
  resizeHandle = handle
  resizeStartMouseX = e.clientX
  resizeStartMouseY = e.clientY
  resizeStartX = el.x
  resizeStartY = el.y
  resizeStartW = el.width
  resizeStartH = el.height

  window.addEventListener('mousemove', onResizing)
  window.addEventListener('mouseup', stopResize)
}

function onResizing(e: MouseEvent) {
  if (!isResizing || !selectedElement.value) return
  const deltaPxX = e.clientX - resizeStartMouseX
  const deltaPxY = e.clientY - resizeStartMouseY
  const deltaMmX = deltaPxX / (mmToPx * zoomScale.value)
  const deltaMmY = deltaPxY / (mmToPx * zoomScale.value)

  let x = resizeStartX
  let y = resizeStartY
  let w = resizeStartW
  let h = resizeStartH

  if (resizeHandle.includes('e')) w = snapValue(resizeStartW + deltaMmX)
  if (resizeHandle.includes('s')) h = snapValue(resizeStartH + deltaMmY)
  if (resizeHandle.includes('w')) {
    const diff = snapValue(deltaMmX)
    w = resizeStartW - diff
    x = resizeStartX + diff
  }
  if (resizeHandle.includes('n')) {
    const diff = snapValue(deltaMmY)
    h = resizeStartH - diff
    y = resizeStartY + diff
  }

  if (w >= 10 && x >= 0 && x + w <= paperWidthMm.value) {
    selectedElement.value.x = x
    selectedElement.value.width = w
  }
  if (h >= 5 && y >= 0 && y + h <= paperHeightMm.value) {
    selectedElement.value.y = y
    selectedElement.value.height = h
  }
}

function stopResize() {
  isResizing = false
  window.removeEventListener('mousemove', onResizing)
  window.removeEventListener('mouseup', stopResize)
}

// 对齐操作
function alignElement(mode: 'left' | 'right' | 'center-x') {
  if (!selectedElement.value) return
  if (mode === 'left') selectedElement.value.x = 10
  else if (mode === 'right') selectedElement.value.x = paperWidthMm.value - selectedElement.value.width - 10
  else if (mode === 'center-x') {
    selectedElement.value.x = Math.round((paperWidthMm.value - selectedElement.value.width) / 2)
  }
}

function bringToFront() {
  if (!selectedElement.value) return
  const maxZ = Math.max(...elements.value.map((e) => e.zIndex), 0)
  selectedElement.value.zIndex = maxZ + 1
}

function sendToBack() {
  if (!selectedElement.value) return
  selectedElement.value.zIndex = 0
}

function deleteSelected() {
  if (!selectedElementId.value) return
  elements.value = elements.value.filter((e) => e.id !== selectedElementId.value)
  selectedElementId.value = null
}

// 键盘快捷键监听
function handleKeyDown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

  if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelected()
  } else if (selectedElement.value) {
    const step = e.shiftKey ? 5 : 1
    if (e.key === 'ArrowLeft') selectedElement.value.x = Math.max(0, selectedElement.value.x - step)
    if (e.key === 'ArrowRight') selectedElement.value.x = Math.min(paperWidthMm.value - selectedElement.value.width, selectedElement.value.x + step)
    if (e.key === 'ArrowUp') selectedElement.value.y = Math.max(0, selectedElement.value.y - step)
    if (e.key === 'ArrowDown') selectedElement.value.y = Math.min(paperHeightMm.value - selectedElement.value.height, selectedElement.value.y + step)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

// 弹窗回调与交互
function handleFormulaInsert(item: { name: string; value: string; unit: string; refRange: string; flag: string }) {
  addElement('label')
  if (selectedElement.value) {
    selectedElement.value.props.text = `【公式计算】${item.name}: ${item.value} ${item.unit} (参考区间: ${item.refRange}) ${item.flag}`
  }
}

function handlePacsApply() {
  alert('已成功保存并同步 PACS 窗宽窗位与 300 DPI 打印增强配置！')
}

const savedTemplates = ref([
  { id: 'tpl-1', name: 'A5 横向生化常规两列平衡折流模板', paper: 'A5 (210×148mm)', updated_at: '2026-09-08 08:30' },
  { id: 'tpl-2', name: '全自动急诊凝血 TEG 弹力图报告', paper: 'A5 (210×148mm)', updated_at: '2026-09-08 08:32' },
  { id: 'tpl-3', name: '超声高精多图图文诊断报告', paper: 'A4 (210×297mm)', updated_at: '2026-09-08 08:33' }
])

function handleLoadArchiveTemplate(item: any) {
  showArchive.value = false
  alert(`已载入本地模板【${item.name}】！`)
}

function handleDeleteArchiveTemplate(id: string) {
  savedTemplates.value = savedTemplates.value.filter(t => t.id !== id)
}

function handleExportBundle() {
  exportJsonTemplate()
}

function handleImportFile(e: Event) {
  const target = e.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return
  const file = target.files[0]
  const reader = new FileReader()
  reader.onload = (event) => {
    try {
      const content = JSON.parse(event.target?.result as string)
      if (content.elements) {
        elements.value = content.elements
        if (content.paper) currentPaperKey.value = content.paper
        alert('成功导入本地模板！')
        showArchive.value = false
      }
    } catch {
      alert('模板 JSON 格式解析失败')
    }
  }
  reader.readAsText(file)
}

function exportJsonTemplate() {
  const data = JSON.stringify({
    paper: currentPaperKey.value,
    widthMm: paperWidthMm.value,
    heightMm: paperHeightMm.value,
    elements: elements.value
  }, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `medprint-template-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function handlePrintPdf() {
  showBatchPrint.value = true
}
</script>

<style scoped>
.pro-canvas-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #eef0f3;
  user-select: none;
}

/* 顶部 macOS 质感工具条 */
.pro-toolbar {
  height: 48px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.toolbar-left,
.toolbar-center,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.divider {
  width: 1px;
  height: 20px;
  background: rgba(0, 0, 0, 0.1);
  margin: 0 4px;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid #d2d2d7;
  background: #ffffff;
  font-size: 12px;
  font-weight: 600;
  color: #1d1d1f;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tool-btn:hover {
  background: #f5f5f7;
}

.paper-selector {
  display: flex;
  align-items: center;
  gap: 6px;
}

.paper-selector .label {
  font-size: 11px;
  color: #6e6e73;
}

.apple-select-sm {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #d2d2d7;
  font-size: 11px;
  background: #ffffff;
  outline: none;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  background: #f0f0f2;
  border-radius: 6px;
  padding: 2px;
}

.zoom-btn {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: none;
  background: transparent;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  color: #333;
}

.zoom-btn:hover {
  background: rgba(0, 0, 0, 0.08);
}

.zoom-text {
  font-size: 11px;
  font-weight: 600;
  padding: 0 4px;
  color: #1d1d1f;
}

.zoom-reset-btn {
  font-size: 10px;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
  padding: 2px 4px;
  cursor: pointer;
  color: #555;
}

.grid-controls {
  display: flex;
  background: #f0f0f2;
  border-radius: 6px;
  padding: 2px;
}

.grid-pill {
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: #666;
}

.grid-pill.active {
  background: #ffffff;
  color: #0071e3;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.toggle-guide-btn {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #d2d2d7;
  background: #ffffff;
  font-size: 11px;
  color: #666;
  cursor: pointer;
}

.toggle-guide-btn.active {
  background: #e8f2ff;
  border-color: #0071e3;
  color: #0071e3;
  font-weight: 600;
}

.tool-action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid #d2d2d7;
  background: #ffffff;
  font-size: 11px;
  font-weight: 600;
  color: #1d1d1f;
  cursor: pointer;
}

.tool-action-btn:hover {
  background: #f5f5f7;
}

.tool-action-btn.primary {
  background: #0071e3;
  color: #ffffff;
  border: none;
  box-shadow: 0 2px 5px rgba(0, 113, 227, 0.25);
}

.tool-action-btn.primary:hover {
  background: #0077ed;
}

/* 主工作区布局 */
.pro-main-area {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左侧物料工具箱 */
.toolbox-panel {
  width: 200px;
  background: #ffffff;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 12px;
  overflow-y: auto;
}

.panel-header {
  font-size: 12px;
  font-weight: 700;
  color: #1d1d1f;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.group-title {
  font-size: 10px;
  font-weight: 700;
  color: #86868b;
  text-transform: uppercase;
  margin: 6px 0 4px;
}

.tool-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.tool-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
  background: #fbfbfd;
  border: 1px solid #e5e5ea;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  gap: 4px;
}

.tool-item:hover {
  background: #f0f0f5;
  border-color: #0071e3;
}

.tool-item .icon {
  font-size: 16px;
}

.tool-item span {
  font-size: 10px;
  font-weight: 600;
  color: #333;
}

.toolbox-footer {
  margin-top: auto;
  padding: 8px;
  background: #f8f8fa;
  border-radius: 6px;
}

.toolbox-footer .hint {
  font-size: 10px;
  color: #86868b;
  line-height: 1.3;
}

/* 中间画布视口 */
.canvas-viewport-area {
  flex: 1;
  overflow: auto;
  position: relative;
  background: #eef0f3;
  padding: 30px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.ruler-container-wrap {
  position: relative;
}

.paper-sheet {
  position: relative;
  background: #ffffff;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15), 0 2px 6px rgba(0, 0, 0, 0.06);
  border-radius: 2px;
  overflow: hidden;
  cursor: crosshair;
}

.paper-grid-overlay {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(to right, rgba(0, 0, 0, 0.04) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(0, 0, 0, 0.04) 1px, transparent 1px);
  pointer-events: none;
}

.snaking-center-guide {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #0071e3;
  opacity: 0.6;
  border-left: 1px dashed #0071e3;
  pointer-events: none;
  z-index: 100;
}

.guide-tag {
  position: absolute;
  top: 4px;
  left: 4px;
  background: rgba(0, 113, 227, 0.85);
  color: #ffffff;
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
}

/* 画布元素与选中手柄 */
.canvas-element {
  position: absolute;
  cursor: move;
  border: 1px solid transparent;
  transition: box-shadow 0.1s ease;
}

.canvas-element.selected {
  border: 1px solid #0071e3;
  box-shadow: 0 0 0 2px rgba(0, 113, 227, 0.25);
}

.element-content {
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}

.handle {
  position: absolute;
  width: 7px;
  height: 7px;
  background: #ffffff;
  border: 1.5px solid #0071e3;
  border-radius: 50%;
  z-index: 101;
}

.handle.nw { top: -4px; left: -4px; cursor: nwse-resize; }
.handle.n { top: -4px; left: calc(50% - 3.5px); cursor: ns-resize; }
.handle.ne { top: -4px; right: -4px; cursor: nesw-resize; }
.handle.e { top: calc(50% - 3.5px); right: -4px; cursor: ew-resize; }
.handle.se { bottom: -4px; right: -4px; cursor: nwse-resize; }
.handle.s { bottom: -4px; left: calc(50% - 3.5px); cursor: ns-resize; }
.handle.sw { bottom: -4px; left: -4px; cursor: nesw-resize; }
.handle.w { top: calc(50% - 3.5px); left: -4px; cursor: ew-resize; }

/* 元素样式渲染 */
.el-header {
  text-align: center;
  padding-top: 2px;
}

.hospital-title {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: #111;
  letter-spacing: 0.5px;
}

.report-subtitle {
  font-size: 10px;
  font-weight: 700;
  color: #444;
  margin-top: 2px;
}

.el-demographics {
  display: flex;
  justify-content: space-between;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  padding: 2px 8px;
  font-size: 10px;
  border-radius: 3px;
}

.info-cell {
  display: flex;
  gap: 3px;
}

.info-cell span {
  color: #666;
}

.el-label {
  color: #333;
  line-height: 1.3;
}

.el-perforation {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 100%;
}

.cut-icon {
  font-size: 11px;
}

.cut-line {
  flex: 1;
  border-bottom: 1px dashed #999;
}

.cut-text {
  font-size: 9px;
  color: #888;
}

.el-snaking-table-mock {
  display: flex;
  width: 100%;
  height: 100%;
  border: 1px solid #333;
  font-size: 9px;
}

.mock-table-col {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.mock-table-divider {
  width: 1px;
  background: #333;
}

.col-head {
  display: flex;
  justify-content: space-between;
  background: #eee;
  padding: 2px 4px;
  font-weight: 700;
  border-bottom: 1px solid #333;
}

.col-row {
  display: flex;
  justify-content: space-between;
  padding: 2px 4px;
  border-bottom: 1px solid #eee;
}

.col-row.alert {
  background: #fff5f5;
}

.text-danger {
  color: #e53e3e;
  font-weight: 700;
}

.el-grid-table-mock {
  width: 100%;
  height: 100%;
  border: 1px solid #333;
  font-size: 9px;
}

.grid-header {
  display: flex;
  background: #eee;
  padding: 2px 4px;
  font-weight: 700;
  border-bottom: 1px solid #333;
}

.grid-header span,
.grid-row span {
  flex: 1;
}

.grid-row {
  display: flex;
  padding: 2px 4px;
  border-bottom: 1px solid #eee;
}

.el-barcode {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.barcode-lines {
  font-family: monospace;
  font-size: 14px;
  letter-spacing: 1px;
  font-weight: 900;
}

.barcode-val {
  font-size: 9px;
  font-family: monospace;
}

.el-teg-chart {
  width: 100%;
  height: 100%;
}

.el-pacs-grid {
  display: flex;
  gap: 4px;
  width: 100%;
  height: 100%;
}

.pacs-frame {
  flex: 1;
  position: relative;
  background: #000;
  overflow: hidden;
  border-radius: 2px;
}

.pacs-frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pacs-tag {
  position: absolute;
  bottom: 2px;
  left: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 8px;
  padding: 1px 3px;
}

.el-seal-wrapper {
  width: 100%;
  height: 100%;
}

.el-sig-chain {
  width: 100%;
  height: 100%;
}

/* 右侧属性检查器面板 */
.inspector-panel {
  width: 250px;
  background: #ffffff;
  border-left: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.inspector-header {
  padding: 12px 14px;
  font-size: 12px;
  font-weight: 700;
  color: #1d1d1f;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.inspector-tabs {
  display: flex;
  background: #f5f5f7;
  padding: 3px;
  margin: 10px 12px 4px;
  border-radius: 7px;
}

.tab-btn {
  flex: 1;
  padding: 5px 0;
  font-size: 10px;
  font-weight: 600;
  border: none;
  background: transparent;
  border-radius: 5px;
  cursor: pointer;
  color: #666;
  text-align: center;
}

.tab-btn.active {
  background: #ffffff;
  color: #0071e3;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.inspector-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.prop-title {
  font-size: 11px;
  font-weight: 700;
  color: #333;
  margin-bottom: 4px;
}

.prop-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.prop-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 6px;
}

.prop-field label {
  font-size: 10px;
  color: #6e6e73;
}

.apple-input-sm,
.apple-textarea {
  padding: 4px 6px;
  border-radius: 5px;
  border: 1px solid #d2d2d7;
  font-size: 11px;
  background: #ffffff;
  outline: none;
}

.apple-input-sm:focus,
.apple-textarea:focus {
  border-color: #0071e3;
}

.align-btn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 6px;
}

.action-btn {
  padding: 5px;
  border-radius: 6px;
  border: 1px solid #d2d2d7;
  background: #ffffff;
  font-size: 10px;
  font-weight: 600;
  color: #333;
  cursor: pointer;
}

.action-btn:hover {
  background: #f5f5f7;
}

.action-btn.primary {
  background: #0071e3;
  color: #fff;
  border: none;
}

.action-btn.danger {
  color: #ff3b30;
  border-color: #ffcdd2;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #333;
  margin: 4px 0;
  cursor: pointer;
}

.prop-hint {
  font-size: 10px;
  color: #888;
  margin: 4px 0 8px;
}

.inspector-empty {
  padding: 30px 16px;
  text-align: center;
  color: #86868b;
}

.inspector-empty .icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.inspector-empty p {
  font-size: 11px;
  line-height: 1.4;
  margin: 0;
}
</style>
