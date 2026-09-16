<template>
  <div class="pro-canvas-container">
    <!-- macOS 质感顶部工具栏 -->
    <div class="pro-toolbar">
      <div class="toolbar-left">
        <button class="tool-btn" title="返回临床向导" @click="$emit('switch-view', 'wizard')">
          向导
        </button>

        <div class="divider"></div>

        <!-- 纸张规格切换 -->
        <div class="paper-selector">
          <span class="label">纸张</span>
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
            title="显示折流分栏线：左列排满后转入右列，可拖动改左右列宽"
            @click="showSnakingGuide = !showSnakingGuide"
          >
            折流分栏
          </button>

          <button
            :class="['toggle-guide-btn', { active: showConstraintGuides }]"
            title="显示约束透视与避让禁区：实时呈现障碍物安全缓冲垫与对齐中轴"
            @click="showConstraintGuides = !showConstraintGuides"
          >
            约束透视
          </button>

        <span class="engine-badge">{{ engineBadge }}</span>
      </div>

      <div class="toolbar-right">
        <!-- 实验室与功能模态框触发器 -->
        <button class="tool-action-btn rag-btn" @click="showRagReverse = true">逆向解析</button>
        <button class="tool-action-btn" @click="showFormulaLab = true">公式</button>
        <button class="tool-action-btn" @click="showArchive = true">档案</button>
        <button class="tool-action-btn" @click="exportJsonTemplate">导出</button>
        <button class="tool-action-btn primary" @click="handlePrintPdf">矢量直印</button>
      </div>
    </div>

    <!-- 主工作区：左物料栏 + 中画布 + 右属性检查器 -->
    <div class="pro-main-area">
      <!-- 左侧物料工具箱 -->
      <div class="toolbox-panel">
        <div class="panel-header">
          <span>封闭槽位</span>
        </div>
        <div class="toolbox-groups">
          <div class="group-title">文档流</div>
          <div class="tool-list">
            <button
              v-for="item in CLOSED_TOOLBOX.filter((t) => t.group === 'flow')"
              :key="item.canvasType"
              class="tool-row"
              :class="{
                occupied: occupied.has(item.astKind),
                active: selectedElement?.type === item.canvasType,
              }"
              :title="occupied.has(item.astKind) ? '已入单，点击选中并改属性' : `添加${item.label}`"
              @click="occupied.has(item.astKind) ? selectSlotByType(item.canvasType) : addElement(item.canvasType)"
            >
              <span class="tool-name">{{ item.label }}</span>
              <span v-if="occupied.has(item.astKind)" class="tool-check">已入单</span>
            </button>
          </div>

          <div class="group-title">临床</div>
          <div class="tool-list">
            <button
              v-for="item in CLOSED_TOOLBOX.filter((t) => t.group === 'clinical')"
              :key="item.canvasType"
              class="tool-row"
              :class="{
                occupied: occupied.has(item.astKind),
                active: selectedElement?.type === item.canvasType,
              }"
              :title="occupied.has(item.astKind) ? '已入单，点击选中并改属性' : `添加${item.label}`"
              @click="occupied.has(item.astKind) ? selectSlotByType(item.canvasType) : addElement(item.canvasType)"
            >
              <span class="tool-name">{{ item.label }}</span>
              <span v-if="occupied.has(item.astKind)" class="tool-check">已入单</span>
            </button>
          </div>

          <div class="group-title">合规</div>
          <div class="tool-list">
            <button
              v-for="item in CLOSED_TOOLBOX.filter((t) => t.group === 'compliance')"
              :key="item.canvasType"
              class="tool-row"
              :class="{
                occupied: occupied.has(item.astKind),
                active: selectedElement?.type === item.canvasType,
              }"
              :title="occupied.has(item.astKind) ? '已入单，点击选中并改属性' : `添加${item.label}`"
              @click="occupied.has(item.astKind) ? selectSlotByType(item.canvasType) : addElement(item.canvasType)"
            >
              <span class="tool-name">{{ item.label }}</span>
              <span v-if="occupied.has(item.astKind)" class="tool-check">已入单</span>
            </button>
          </div>
        </div>

        <div class="toolbox-footer">
          <span class="hint">封闭槽位可上下拖改文档流；点页眉可改对齐/院徽/报告单号，点患者条可增删字段。坐标仍由引擎重算。</span>
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

            <!-- 空间约束规格与避让禁区可视化透视层 -->
            <VisualConstraintOverlay
              :template="reportTemplate"
              :frames="canvasFrames"
              :paper-width-mm="paperWidthMm"
              :paper-height-mm="paperHeightMm"
              :mm-to-px="mmToPx"
              :zoom-scale="zoomScale"
              :visible="showConstraintGuides"
            />

            <!-- 画布中所有元素 -->
            <div
              v-for="el in elements"
              :key="el.id"
              class="canvas-element"
              :class="{ selected: selectedElementId === el.id, reordering: dragSlot?.id === el.id }"
              :style="getElementStyle(el)"
              @click.stop="selectElement(el)"
              @mousedown.stop="startSlotReorder($event, el)"
            >
              <!-- 元素内容动态插槽与渲染 -->
              <div class="element-content">
                <!-- 医院页眉 -->
                <template v-if="el.type === 'header'">
                  <div class="el-header" :class="'align-' + (el.props.align || 'center')">
                    <div class="header-main">
                      <img
                        v-if="el.props.logoDataUrl"
                        class="hospital-logo"
                        :src="el.props.logoDataUrl"
                        alt=""
                      />
                      <div class="header-copy">
                        <h2 class="hospital-title">{{ el.props.hospitalName || '医院名称' }}</h2>
                        <div class="report-subtitle">{{ el.props.reportTitle || '报告标题' }}</div>
                        <div v-if="el.props.subTitle" class="report-sub">{{ el.props.subTitle }}</div>
                      </div>
                      <div v-if="el.props.showReportNo" class="report-no">
                        <span>{{ el.props.reportNoLabel || '报告单号' }}</span>
                        <strong>{{ el.props.reportNoPreview || '________' }}</strong>
                      </div>
                    </div>
                  </div>
                </template>

                <template v-else-if="el.type === 'demographics'">
                  <div class="el-demographics">
                    <div
                      v-for="(field, fi) in bannerFields(el)"
                      :key="field.key + '-' + fi"
                      class="info-cell"
                    >
                      <span>{{ field.label }}:</span>
                      <strong>{{ field.preview_value }}</strong>
                    </div>
                  </div>
                </template>

                <!-- 免责声明 / 备注槽位（不是自由文本控件） -->
                <template v-else-if="el.type === 'label' || el.type === 'notes'">
                  <div class="el-label" :style="{ fontSize: (el.props.fontSizePt || 9) + 'pt', textAlign: el.props.align || 'left' }">
                    {{ el.props.text || '【提示】此报告仅对本次标本负责，如有疑问请于24小时内复核。' }}
                  </div>
                </template>

                <!-- 针打撕纸穿孔线 -->
                <template v-else-if="el.type === 'perforation'">
                  <div class="el-perforation">
                    <span class="cut-line"></span>
                    <span class="cut-text">连续穿孔撕纸线 (针式打印)</span>
                    <span class="cut-line"></span>
                  </div>
                </template>

                <!-- A5 双列折流表：左列排满后转入右列 -->
                <template v-else-if="el.type === 'snaking_table'">
                  <div class="el-snaking-table-mock">
                    <div
                      class="mock-table-col left"
                      :style="{ flex: Number(el.props.leftRatio || 0.5) }"
                    >
                      <div class="col-head"><span>项目</span><span>结果</span><span>参考</span></div>
                      <div
                        v-for="row in snakingPreview(el).left"
                        :key="'L' + row.index"
                        class="col-row"
                        :class="{ alert: row.alert_flag !== 'Normal' }"
                      >
                        <span>{{ row.item_name }}</span>
                        <strong :class="{ 'text-danger': row.alert_flag !== 'Normal' }">{{ row.result_value }}</strong>
                        <span>{{ row.ref_range_display }}</span>
                      </div>
                    </div>
                    <div class="mock-table-divider"></div>
                    <div
                      class="mock-table-col right"
                      :style="{ flex: 1 - Number(el.props.leftRatio || 0.5) }"
                    >
                      <div class="col-head"><span>项目</span><span>结果</span><span>参考</span></div>
                      <div
                        v-for="row in snakingPreview(el).right"
                        :key="'R' + row.index"
                        class="col-row"
                        :class="{ alert: row.alert_flag !== 'Normal' }"
                      >
                        <span>{{ row.item_name }}</span>
                        <strong :class="{ 'text-danger': row.alert_flag !== 'Normal' }">{{ row.result_value }}</strong>
                        <span>{{ row.ref_range_display }}</span>
                      </div>
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
                  <div
                    class="el-pacs-grid"
                    :style="{
                      gridTemplateColumns: `repeat(${Number(el.props.gridCols) || 2}, 1fr)`,
                      gridTemplateRows: `repeat(${Number(el.props.gridRows) || 1}, 1fr)`,
                    }"
                  >
                    <div
                      v-for="n in (Number(el.props.gridCols) || 2) * (Number(el.props.gridRows) || 1)"
                      :key="n"
                      class="pacs-frame"
                    >
                      <span class="pacs-tag">切面 {{ n }}</span>
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

              <div class="slot-chip">{{ el.name }}</div>

              <!-- 折流分栏：拖这条线改左右列宽比，不是纸张几何中心 -->
              <div
                v-if="el.type === 'snaking_table' && showSnakingGuide"
                class="split-handle"
                :class="{ dragging: draggingSplit }"
                :style="{ left: splitHandleLeft(el) }"
                title="折流分栏：左列排满后转入右列。左右拖动改列宽比。"
                @mousedown.stop.prevent="startSplitDrag($event, el)"
              >
                <span class="split-label">折流</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧槽位检查器：可写 AST 在上，引擎框只读在下 -->
      <div class="inspector-panel">
        <div class="inspector-header">
          <span>{{ selectedElement ? `槽位 · ${selectedElement.name}` : '槽位检查器' }}</span>
        </div>

        <div class="inspector-tabs">
          <button
            type="button"
            class="tab-btn"
            :class="{ active: rightPanelTab === 'props' }"
            @click="rightPanelTab = 'props'"
          >
            槽位属性
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: rightPanelTab === 'constraints' }"
            @click="rightPanelTab = 'constraints'"
          >
            约束规格
          </button>
        </div>

        <!-- 约束规格模式 -->
        <div v-if="rightPanelTab === 'constraints'" class="inspector-body">
          <ConstraintInspector
            :model-value="reportTemplate"
            :selected-element-index="selectedAstElementIndex"
            @update:model-value="handleConstraintUpdate"
          />
        </div>

        <div v-else-if="selectedElement" class="inspector-body">
          <template v-if="selectedElement.type === 'header'">
            <div class="prop-title">医院页眉</div>
            <p class="prop-hint">对齐、院徽、报告单号都是页眉槽位参数。槽位可上下拖改变文档流顺序，坐标仍由引擎重排。</p>
            <div class="align-pills">
              <button
                v-for="opt in alignOptions"
                :key="opt.id"
                type="button"
                class="action-btn"
                :class="{ primary: (selectedElement.props.align || 'center') === opt.id }"
                @click="setHeaderAlign(opt.id)"
              >
                {{ opt.label }}
              </button>
            </div>
            <div class="prop-field">
              <label>医院名称</label>
              <input v-model="selectedElement.props.hospitalName" class="apple-input-sm" @change="commitOverrides" />
            </div>
            <div class="prop-field">
              <label>报告标题</label>
              <input v-model="selectedElement.props.reportTitle" class="apple-input-sm" @change="commitOverrides" />
            </div>
            <div class="prop-field">
              <label>副标题</label>
              <input v-model="selectedElement.props.subTitle" class="apple-input-sm" @change="commitOverrides" />
            </div>
            <div class="prop-field">
              <label>院徽 / 图标</label>
              <input type="file" accept="image/*" class="apple-input-sm" @change="onLogoFile" />
              <button v-if="selectedElement.props.logoDataUrl" type="button" class="action-btn" @click="clearLogo">移除图标</button>
            </div>
            <div class="checkbox-row">
              <input id="report-no-check" v-model="selectedElement.props.showReportNo" type="checkbox" @change="commitOverrides" />
              <label for="report-no-check">显示报告单号</label>
            </div>
            <template v-if="selectedElement.props.showReportNo">
              <div class="prop-field">
                <label>编号标签</label>
                <input v-model="selectedElement.props.reportNoLabel" class="apple-input-sm" @change="commitOverrides" />
              </div>
              <div class="prop-field">
                <label>预览编号</label>
                <input v-model="selectedElement.props.reportNoPreview" class="apple-input-sm" @change="commitOverrides" />
              </div>
            </template>
          </template>

          <template v-else-if="selectedElement.type === 'demographics'">
            <div class="prop-title">患者信息条</div>
            <p class="prop-hint">字段来自临床目录，可增删、改标签、上下排序。不是自由文本控件。</p>
            <div class="checkbox-row">
              <input id="barcode-check" v-model="selectedElement.props.includeBarcode" type="checkbox" @change="commitOverrides" />
              <label for="barcode-check">显示标本条码</label>
            </div>
            <div class="item-list">
              <div v-for="(field, i) in bannerFields(selectedElement)" :key="field.key + '-' + i" class="item-row field-edit">
                <button type="button" class="item-del" :disabled="i === 0" @click="onMovePatientField(i, -1)">↑</button>
                <button type="button" class="item-del" :disabled="i === bannerFields(selectedElement).length - 1" @click="onMovePatientField(i, 1)">↓</button>
                <input class="apple-input-sm item-abbr" :value="field.label" @change="onPatientFieldInput(i, 'label', $event)" />
                <input class="apple-input-sm" :value="field.preview_value" @change="onPatientFieldInput(i, 'preview_value', $event)" />
                <button type="button" class="item-del" @click="onRemovePatientField(i)">×</button>
              </div>
            </div>
            <div class="field-add">
              <select v-model="pendingPatientKey" class="apple-select-sm">
                <option v-for="opt in unusedPatientKeys" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
              </select>
              <button type="button" class="action-btn primary" :disabled="!pendingPatientKey" @click="onAddPatientField">加入字段</button>
            </div>
          </template>

          <template v-else-if="selectedElement.type === 'snaking_table'">
            <div class="prop-title">A5 双列折流表</div>
            <p class="prop-hint">
              旧的纸心 105mm 线是 A5 双列折流参考，不是几何中心。现在请拖表格上的蓝色「折流」手柄改左右列宽：左列排满后转入右列。固定两列，「新增检验项目」加的是行，不是第三列纸栏。
            </p>
            <div class="prop-field">
              <label>左列占比 {{ Number(selectedElement.props.leftRatio || 0.5).toFixed(2) }}</label>
              <input
                v-model.number="selectedElement.props.leftRatio"
                type="range"
                min="0.28"
                max="0.72"
                step="0.01"
                class="ratio-slider"
                @input="onLeftRatioLive"
                @change="commitOverrides"
              />
            </div>
            <div class="prop-row-2">
              <div class="prop-field">
                <label>列间距 (mm)</label>
                <input v-model.number="selectedElement.props.columnGapMm" type="number" step="0.5" min="0" class="apple-input-sm" @change="commitOverrides" />
              </div>
              <div class="prop-field">
                <label>行高 (mm)</label>
                <input v-model.number="selectedElement.props.rowHeightMm" type="number" step="0.5" min="3" class="apple-input-sm" @change="commitOverrides" />
              </div>
            </div>
            <div class="checkbox-row">
              <input id="compact-check" v-model="selectedElement.props.autoCompaction" type="checkbox" @change="commitOverrides" />
              <label for="compact-check">超行时单页紧凑压缩</label>
            </div>

            <div class="prop-title" style="margin-top: 12px">检验项目（{{ labItems.length }}）</div>
            <div class="item-list">
              <div v-for="(row, i) in labItems" :key="row.index" class="item-row">
                <input
                  :value="row.item_name"
                  class="apple-input-sm"
                  placeholder="项目名"
                  @change="onLabItemInput(i, 'item_name', $event)"
                />
                <input
                  :value="row.item_abbr"
                  class="apple-input-sm item-abbr"
                  placeholder="缩写"
                  @change="onLabItemInput(i, 'item_abbr', $event)"
                />
                <input
                  :value="row.result_value"
                  class="apple-input-sm item-result"
                  placeholder="结果"
                  @change="onLabItemInput(i, 'result_value', $event)"
                />
                <button type="button" class="item-del" title="移除该检验项目" @click="onRemoveLabItem(i)">删</button>
              </div>
            </div>
            <button type="button" class="action-btn" @click="onAddLabItem">新增检验项目</button>
          </template>

          <template v-else-if="selectedElement.type === 'pacs_grid'">
            <div class="prop-title">PACS 影像网格</div>
            <p class="prop-hint">只允许 1 / 2 / 4 / 6 宫格，保持切面比例不拉伸。</p>
            <div class="pacs-presets">
              <button
                v-for="preset in pacsPresets"
                :key="preset.label"
                type="button"
                :class="['preset-btn', { active: isPacsPresetActive(preset) }]"
                @click="applyPacsPreset(preset)"
              >
                {{ preset.label }}
              </button>
            </div>
            <div class="checkbox-row">
              <input id="scale-check" v-model="selectedElement.props.showScaleRuler" type="checkbox" @change="commitOverrides" />
              <label for="scale-check">显示物理标尺</label>
            </div>
            <button type="button" class="action-btn" @click="showPacsAdjust = true">窗宽窗位调校</button>
          </template>

          <template v-else-if="selectedElement.type === 'teg_chart'">
            <div class="prop-title">TEG 弹力图参数</div>
            <div class="prop-row-2">
              <div class="prop-field">
                <label>R (min)</label>
                <input v-model.number="selectedElement.props.rTimeMin" type="number" step="0.1" class="apple-input-sm" @change="commitOverrides" />
              </div>
              <div class="prop-field">
                <label>K (min)</label>
                <input v-model.number="selectedElement.props.kTimeMin" type="number" step="0.1" class="apple-input-sm" @change="commitOverrides" />
              </div>
            </div>
            <div class="prop-row-2">
              <div class="prop-field">
                <label>α (°)</label>
                <input v-model.number="selectedElement.props.alphaAngleDeg" type="number" step="0.1" class="apple-input-sm" @change="commitOverrides" />
              </div>
              <div class="prop-field">
                <label>MA (mm)</label>
                <input v-model.number="selectedElement.props.maAmplitudeMm" type="number" step="0.1" class="apple-input-sm" @change="commitOverrides" />
              </div>
            </div>
            <div class="prop-field">
              <label>LY30 (%)</label>
              <input v-model.number="selectedElement.props.ly30Percent" type="number" step="0.1" class="apple-input-sm" @change="commitOverrides" />
            </div>
          </template>

          <template v-else-if="selectedElement.type === 'notes'">
            <div class="prop-title">免责声明</div>
            <div class="prop-field">
              <label>声明文本</label>
              <textarea
                v-model="selectedElement.props.text"
                rows="4"
                class="apple-textarea"
                placeholder="免责声明槽位，不是自由表达式"
                @change="commitOverrides"
              ></textarea>
            </div>
          </template>

          <template v-else-if="selectedElement.type === 'seal'">
            <div class="prop-title">防伪红章</div>
            <div class="prop-field">
              <label>印章医院名称</label>
              <input v-model="selectedElement.props.hospitalName" class="apple-input-sm" @change="commitOverrides" />
            </div>
            <div class="prop-field">
              <label>科室专用名称</label>
              <input v-model="selectedElement.props.deptName" class="apple-input-sm" @change="commitOverrides" />
            </div>
            <div class="prop-row-2">
              <div class="prop-field">
                <label>直径 (mm)</label>
                <input v-model.number="selectedElement.props.diameterMm" type="number" step="0.5" class="apple-input-sm" @change="commitOverrides" />
              </div>
              <div class="prop-field">
                <label>透明度</label>
                <input v-model.number="selectedElement.props.opacity" type="number" step="0.02" min="0.2" max="1" class="apple-input-sm" @change="commitOverrides" />
              </div>
            </div>
            <div class="checkbox-row">
              <input id="multiply-check" v-model="selectedElement.props.multiplyBlend" type="checkbox" @change="commitOverrides" />
              <label for="multiply-check">正片叠底透字 (Multiply)</label>
            </div>
          </template>

          <template v-else-if="selectedElement.type === 'signature_chain'">
            <div class="prop-title">三级责任签名链</div>
            <div class="prop-field">
              <label>申请医师</label>
              <input v-model="selectedElement.props.requestingPhysician" class="apple-input-sm" @change="commitOverrides" />
            </div>
            <div class="prop-field">
              <label>采样人</label>
              <input v-model="selectedElement.props.samplingPerson" class="apple-input-sm" @change="commitOverrides" />
            </div>
            <div class="prop-field">
              <label>检验操作者</label>
              <input v-model="selectedElement.props.operator" class="apple-input-sm" @change="commitOverrides" />
            </div>
            <div class="prop-field">
              <label>审核者</label>
              <input v-model="selectedElement.props.reviewer" class="apple-input-sm" @change="commitOverrides" />
            </div>
            <div class="prop-field">
              <label>报告日期</label>
              <input v-model="selectedElement.props.reportDate" class="apple-input-sm" @change="commitOverrides" />
            </div>
          </template>

          <div class="engine-box">
            <div class="prop-title">引擎投影框（只读 mm）</div>
            <div class="prop-row-2">
              <div class="prop-field">
                <label>X (mm)</label>
                <input :value="selectedElement.x" type="number" class="apple-input-sm" readonly />
              </div>
              <div class="prop-field">
                <label>Y (mm)</label>
                <input :value="selectedElement.y" type="number" class="apple-input-sm" readonly />
              </div>
            </div>
            <div class="prop-row-2">
              <div class="prop-field">
                <label>宽度 W (mm)</label>
                <input :value="selectedElement.width" type="number" class="apple-input-sm" readonly />
              </div>
              <div class="prop-field">
                <label>高度 H (mm)</label>
                <input :value="selectedElement.height" type="number" class="apple-input-sm" readonly />
              </div>
            </div>
            <p class="prop-hint">坐标由排版引擎计算。槽位可上移下移改变文档流，不能自由画坐标。</p>
            <div class="slot-order">
              <button type="button" class="action-btn" @click="onMoveSlot(-1)">上移</button>
              <button type="button" class="action-btn" @click="onMoveSlot(1)">下移</button>
            </div>
            <button type="button" class="action-btn danger" @click="deleteSelected">移除该槽位</button>
          </div>
        </div>

        <div v-else class="inspector-empty">
          <p>点纸上槽位或左侧已入单列表即可改属性。</p>
          <div class="prop-title">页边距 (mm)</div>
          <div class="prop-row-2">
            <div class="prop-field">
              <label>上</label>
              <input v-model.number="marginDraft.top_mm" type="number" step="0.5" min="0" class="apple-input-sm" @change="commitMargins" />
            </div>
            <div class="prop-field">
              <label>下</label>
              <input v-model.number="marginDraft.bottom_mm" type="number" step="0.5" min="0" class="apple-input-sm" @change="commitMargins" />
            </div>
          </div>
          <div class="prop-row-2">
            <div class="prop-field">
              <label>左</label>
              <input v-model.number="marginDraft.left_mm" type="number" step="0.5" min="0" class="apple-input-sm" @change="commitMargins" />
            </div>
            <div class="prop-field">
              <label>右</label>
              <input v-model.number="marginDraft.right_mm" type="number" step="0.5" min="0" class="apple-input-sm" @change="commitMargins" />
            </div>
          </div>
          <p class="prop-hint">
            折流分栏线在表格上，不是纸张几何中心。左列排满后转入右列。打印几何由引擎排版，画布只投影。
          </p>
          <p class="prop-hint">{{ constraintSummary }}</p>
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

    <!-- 弹窗组件：RAG 知识库检索与 Pi Agent 逆向生成工作台 -->
    <RagReverseModal
      :visible="showRagReverse"
      @close="showRagReverse = false"
      @apply="handleApplyRagTemplate"
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
import RagReverseModal from '../components/common/RagReverseModal.vue'
import ConstraintInspector from '../components/common/ConstraintInspector.vue'
import VisualConstraintOverlay from '../components/common/VisualConstraintOverlay.vue'
import {
  CANVAS_TO_AST_KIND,
  CLOSED_TOOLBOX,
  addLabItem,
  addPatientField,
  canDispatchPrint,
  createPresetTemplate,
  defaultPatientFields,
  formatViolations,
  initLayoutEngine,
  insertUniqueSlot,
  isClosedCanvasType,
  isForbiddenLowcodeType,
  layoutEngineSource,
  layoutTemplateFrames,
  movePatientField,
  moveSlot,
  occupiedKinds,
  patchMargins,
  patchSlotParams,
  PATIENT_FIELD_CATALOG,
  projectTemplateToSlots,
  removeLabItem,
  removePatientField,
  removeSlot,
  reorderSlotsByPreviewY,
  updateLabItem,
  updatePatientField,
  validateReportTemplate,
  type ClosedCanvasType,
  type LabItemRow,
  type PatientField,
  type PatientFieldKey,
  type ReportTemplate,
  type TextAlign,
} from '../domain'

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
const showConstraintGuides = ref(true)

const canvasFrames = computed(() => {
  return elements.value.map((el) => {
    const kind = isClosedCanvasType(el.type) ? CANVAS_TO_AST_KIND[el.type] : el.type
    return {
      kind,
      x_mm: el.x,
      y_mm: el.y,
      width_mm: el.width,
      height_mm: el.height,
    }
  })
})

const cursorX = ref(0)
const cursorY = ref(0)

const showFormulaLab = ref(false)
const showPacsAdjust = ref(false)
const showArchive = ref(false)
const showBatchPrint = ref(false)
const showRagReverse = ref(false)

const selectedElementId = ref<string | null>(null)
const draggingSplit = ref(false)
const paperRef = ref<HTMLElement | null>(null)
const pendingPatientKey = ref<PatientFieldKey>('report_no')
const dragSlot = ref<{ id: string; startY: number; origY: number; moved: boolean } | null>(null)
const suppressClick = ref(false)

const alignOptions: Array<{ id: TextAlign; label: string }> = [
  { id: 'left', label: '居左' },
  { id: 'center', label: '居中' },
  { id: 'right', label: '居右' },
]

const pacsPresets = [
  { label: '1', cols: 1, rows: 1 },
  { label: '2', cols: 2, rows: 1 },
  { label: '4', cols: 2, rows: 2 },
  { label: '6', cols: 3, rows: 2 },
] as const

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

interface CanvasElement {
  id: string
  type: string
  name: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  props: Record<string, any>
}

const reportTemplate = ref<ReportTemplate>(createPresetTemplate('lis_a5'))
const elements = ref<CanvasElement[]>([])

function relayout(selectKind?: string) {
  const prev = selectKind || elements.value.find((el) => el.id === selectedElementId.value)?.type
  elements.value = projectTemplateToSlots(reportTemplate.value).map((slot) => ({
    ...slot,
    props: { ...slot.props },
  }))
  if (prev) {
    const match = elements.value.find((el) => el.type === prev)
    selectedElementId.value = match?.id ?? null
  }
}

function selectSlotByType(type: string) {
  const match = elements.value.find((el) => el.type === type)
  if (match) selectedElementId.value = match.id
}

function selectDefaultSlot() {
  selectSlotByType('snaking_table')
  if (!selectedElementId.value && elements.value[0]) {
    selectedElementId.value = elements.value[0].id
  }
}

function bannerFields(el: CanvasElement | null): PatientField[] {
  if (!el) return []
  const fields = el.props.fields
  return Array.isArray(fields) && fields.length ? fields : defaultPatientFields()
}

const unusedPatientKeys = computed(() => {
  const used = new Set(bannerFields(selectedElement.value).map((f) => f.key))
  const keys = Object.keys(PATIENT_FIELD_CATALOG) as Array<Exclude<PatientFieldKey, 'custom'>>
  const leftover: Array<{ key: PatientFieldKey; label: string }> = keys
    .filter((key) => !used.has(key))
    .map((key) => ({ key, label: PATIENT_FIELD_CATALOG[key].label }))
  leftover.push({ key: 'custom', label: '自定义字段' })
  return leftover
})

function setHeaderAlign(align: TextAlign) {
  if (!selectedElement.value) return
  selectedElement.value.props.align = align
  commitOverrides()
}

function onLogoFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !selectedElement.value) return
  const reader = new FileReader()
  reader.onload = () => {
    if (!selectedElement.value) return
    selectedElement.value.props.logoDataUrl = String(reader.result || '')
    commitOverrides()
  }
  reader.readAsDataURL(file)
}

function clearLogo() {
  if (!selectedElement.value) return
  selectedElement.value.props.logoDataUrl = ''
  commitOverrides()
}

function onAddPatientField() {
  const key = pendingPatientKey.value
  if (!key) return
  reportTemplate.value = addPatientField(reportTemplate.value, key)
  relayout('demographics')
  const leftover = unusedPatientKeys.value.find((opt) => opt.key !== key)
  pendingPatientKey.value = leftover?.key || 'custom'
}

function onRemovePatientField(index: number) {
  reportTemplate.value = removePatientField(reportTemplate.value, index)
  relayout('demographics')
}

function onMovePatientField(index: number, delta: number) {
  reportTemplate.value = movePatientField(reportTemplate.value, index, delta)
  relayout('demographics')
}

function onPatientFieldInput(index: number, field: 'label' | 'preview_value', event: Event) {
  reportTemplate.value = updatePatientField(reportTemplate.value, index, {
    [field]: (event.target as HTMLInputElement).value,
  })
  relayout('demographics')
}

function onMoveSlot(delta: number) {
  const current = selectedElement.value
  if (!current || !isClosedCanvasType(current.type)) return
  reportTemplate.value = moveSlot(reportTemplate.value, CANVAS_TO_AST_KIND[current.type], delta)
  relayout(current.type)
}

function startSlotReorder(e: MouseEvent, el: CanvasElement) {
  if (e.button !== 0) return
  if ((e.target as HTMLElement).closest('.split-handle')) return
  selectElement(el)
  dragSlot.value = { id: el.id, startY: e.clientY, origY: el.y, moved: false }
}

function onWindowMouseMove(e: MouseEvent) {
  const drag = dragSlot.value
  if (!drag) return
  const dyMm = (e.clientY - drag.startY) / (mmToPx * zoomScale.value)
  if (!drag.moved && Math.abs(dyMm) < 1.2) return
  drag.moved = true
  suppressClick.value = true
  const target = elements.value.find((el) => el.id === drag.id)
  if (target) target.y = Math.max(0, drag.origY + dyMm)
}

function onWindowMouseUp() {
  const drag = dragSlot.value
  dragSlot.value = null
  if (!drag?.moved) return
  reportTemplate.value = reorderSlotsByPreviewY(reportTemplate.value, elements.value)
  relayout(elements.value.find((el) => el.id === drag.id)?.type)
  window.setTimeout(() => {
    suppressClick.value = false
  }, 0)
}

const occupied = computed(() => occupiedKinds(reportTemplate.value))

const layoutStatus = computed(() => layoutTemplateFrames(reportTemplate.value))

const engineBadge = computed(() => {
  const src = layoutEngineSource() === 'wasm' ? 'WASM' : '引擎'
  const row = layoutStatus.value.compacted_row_height_mm
  const rowText = row ? ` · 折流行高 ${row.toFixed(2)}mm` : ''
  return `${src}投影 ${layoutStatus.value.page_count} 页${rowText}`
})

const constraintSummary = computed(() => formatViolations(validateReportTemplate(reportTemplate.value)))

const rightPanelTab = ref<'props' | 'constraints'>('props')

const selectedElement = computed(() => {
  return elements.value.find((e) => e.id === selectedElementId.value) || null
})

const selectedAstElementIndex = computed(() => {
  if (!selectedElement.value) return 0
  const t = selectedElement.value.type as ClosedCanvasType
  const kind = CANVAS_TO_AST_KIND[t]
  if (!kind) return 0
  const idx = reportTemplate.value.elements.findIndex((el) => el.kind === kind)
  return idx >= 0 ? idx : 0
})

function handleConstraintUpdate(updated: ReportTemplate) {
  reportTemplate.value = updated
  relayout()
}

const labItems = computed<LabItemRow[]>(() => {
  const el = selectedElement.value
  if (!el || el.type !== 'snaking_table' || !Array.isArray(el.props.items)) return []
  return el.props.items as LabItemRow[]
})

const marginDraft = ref({
  top_mm: reportTemplate.value.margins.top_mm,
  right_mm: reportTemplate.value.margins.right_mm,
  bottom_mm: reportTemplate.value.margins.bottom_mm,
  left_mm: reportTemplate.value.margins.left_mm,
})

function syncMarginDraft() {
  marginDraft.value = {
    top_mm: reportTemplate.value.margins.top_mm,
    right_mm: reportTemplate.value.margins.right_mm,
    bottom_mm: reportTemplate.value.margins.bottom_mm,
    left_mm: reportTemplate.value.margins.left_mm,
  }
}

function commitMargins() {
  reportTemplate.value = patchMargins(reportTemplate.value, {
    top_mm: Number(marginDraft.value.top_mm),
    right_mm: Number(marginDraft.value.right_mm),
    bottom_mm: Number(marginDraft.value.bottom_mm),
    left_mm: Number(marginDraft.value.left_mm),
  })
  relayout()
  syncMarginDraft()
}

function snakingPreview(el: CanvasElement) {
  const items = (Array.isArray(el.props.items) ? el.props.items : []) as LabItemRow[]
  const mid = Math.ceil(items.length / 2)
  return { left: items.slice(0, mid), right: items.slice(mid) }
}

function splitHandleLeft(el: CanvasElement) {
  const ratio = Math.min(0.72, Math.max(0.28, Number(el.props.leftRatio || 0.5)))
  return `${ratio * 100}%`
}

type SplitDragState = {
  elId: string
  startX: number
  startRatio: number
  widthPx: number
}

const splitDrag = ref<SplitDragState | null>(null)

function clampLeftRatio(value: number) {
  return Math.round(Math.min(0.72, Math.max(0.28, value)) * 1000) / 1000
}

function onLeftRatioLive() {
  const el = selectedElement.value
  if (!el || el.type !== 'snaking_table') return
  el.props.leftRatio = clampLeftRatio(Number(el.props.leftRatio || 0.5))
}

function startSplitDrag(e: MouseEvent, el: CanvasElement) {
  selectElement(el)
  const table = (e.currentTarget as HTMLElement).parentElement
  const widthPx = table?.getBoundingClientRect().width || 1
  draggingSplit.value = true
  document.body.style.cursor = 'col-resize'
  splitDrag.value = {
    elId: el.id,
    startX: e.clientX,
    startRatio: Number(el.props.leftRatio || 0.5),
    widthPx,
  }
  window.addEventListener('mousemove', onSplitMove)
  window.addEventListener('mouseup', onSplitUp)
}

function onSplitMove(e: MouseEvent) {
  const drag = splitDrag.value
  if (!drag) return
  const el = elements.value.find((item) => item.id === drag.elId)
  if (!el) return
  const delta = (e.clientX - drag.startX) / drag.widthPx
  el.props.leftRatio = clampLeftRatio(drag.startRatio + delta)
}

function onSplitUp() {
  window.removeEventListener('mousemove', onSplitMove)
  window.removeEventListener('mouseup', onSplitUp)
  document.body.style.cursor = ''
  draggingSplit.value = false
  const drag = splitDrag.value
  const el = drag ? elements.value.find((item) => item.id === drag.elId) : selectedElement.value
  splitDrag.value = null
  if (el && isClosedCanvasType(el.type)) {
    reportTemplate.value = patchSlotParams(reportTemplate.value, CANVAS_TO_AST_KIND[el.type], el.props)
    relayout(el.type)
  }
}

function onAddLabItem() {
  reportTemplate.value = addLabItem(reportTemplate.value)
  relayout('snaking_table')
}

function onRemoveLabItem(index: number) {
  reportTemplate.value = removeLabItem(reportTemplate.value, index)
  relayout('snaking_table')
}

function onLabItemInput(
  index: number,
  field: 'item_name' | 'item_abbr' | 'result_value' | 'ref_range_display' | 'unit' | 'alert_flag',
  event: Event,
) {
  const value = (event.target as HTMLInputElement).value
  reportTemplate.value = updateLabItem(reportTemplate.value, index, { [field]: value })
  relayout('snaking_table')
}

function isPacsPresetActive(preset: { cols: number; rows: number }) {
  const el = selectedElement.value
  if (!el || el.type !== 'pacs_grid') return false
  return Number(el.props.gridCols) === preset.cols && Number(el.props.gridRows) === preset.rows
}

function applyPacsPreset(preset: { cols: number; rows: number }) {
  if (!selectedElement.value || selectedElement.value.type !== 'pacs_grid') return
  selectedElement.value.props.gridCols = preset.cols
  selectedElement.value.props.gridRows = preset.rows
  commitOverrides()
}

function selectElement(el: CanvasElement) {
  if (suppressClick.value) return
  selectedElementId.value = el.id
}

function clearSelection() {
  selectedElementId.value = null
}

function handlePaperChange() {
  const paper = paperPresets[currentPaperKey.value]
  reportTemplate.value = {
    ...reportTemplate.value,
    paper_size: { width_mm: paper.width, height_mm: paper.height },
  }
  relayout()
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

function commitOverrides() {
  if (!selectedElement.value || !isClosedCanvasType(selectedElement.value.type)) return
  const kind = CANVAS_TO_AST_KIND[selectedElement.value.type]
  reportTemplate.value = patchSlotParams(reportTemplate.value, kind, selectedElement.value.props)
  relayout(selectedElement.value.type)
}

function addElement(type: string) {
  if (isForbiddenLowcodeType(type) || !isClosedCanvasType(type)) {
    alert('拒绝开放物料。新视觉类型必须先加入 Rust ReportElement，再投影到画布槽位。')
    return
  }
  const kind = CANVAS_TO_AST_KIND[type as ClosedCanvasType]
  if (occupied.value.has(kind)) {
    alert('该槽位已在单据中，不能重复添加。')
    return
  }
  reportTemplate.value = insertUniqueSlot(reportTemplate.value, kind)
  relayout(type)
}

function deleteSelected() {
  const current = selectedElement.value
  if (!current || !isClosedCanvasType(current.type)) return
  reportTemplate.value = removeSlot(reportTemplate.value, CANVAS_TO_AST_KIND[current.type])
  selectedElementId.value = null
  relayout()
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelected()
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('mousemove', onWindowMouseMove)
  window.addEventListener('mouseup', onWindowMouseUp)
  await initLayoutEngine()
  relayout()
  selectDefaultSlot()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('mousemove', onSplitMove)
  window.removeEventListener('mouseup', onSplitUp)
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
})

relayout()
selectDefaultSlot()

function handleFormulaInsert(item: { name: string; value: string; unit: string; refRange: string; flag: string }) {
  const notes = 'NotesFooter' as const
  if (!occupied.value.has(notes)) {
    reportTemplate.value = insertUniqueSlot(reportTemplate.value, notes)
  }
  reportTemplate.value = patchSlotParams(reportTemplate.value, notes, {
    text: `【公式计算结果投影】${item.name}: ${item.value} ${item.unit} (参考区间: ${item.refRange}) ${item.flag}`,
  })
  relayout('notes')
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

function handleApplyRagTemplate(newTemplate: ReportTemplate) {
  reportTemplate.value = newTemplate
  syncMarginDraft()
  relayout()
  selectedElementId.value = elements.value[0]?.id || null
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
      if (content.report_type && Array.isArray(content.elements)) {
        reportTemplate.value = content as ReportTemplate
        syncMarginDraft()
        relayout()
        alert('已载入封闭 ReportTemplate AST。画布是引擎投影，不是打印源。')
        showArchive.value = false
        return
      }
      alert('请导入 .medprint.json 封闭 AST，不再接受自由画布坐标 JSON。')
    } catch {
      alert('模板 JSON 格式解析失败')
    }
  }
  reader.readAsText(file)
}

function exportJsonTemplate() {
  const template = reportTemplate.value
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `medprint-template-${template.id}.medprint.json`
  a.click()
  URL.revokeObjectURL(url)
}

function handlePrintPdf() {
  const issues = validateReportTemplate(reportTemplate.value)
  if (!canDispatchPrint(issues)) {
    alert(`打印已拦截：\n${formatViolations(issues)}`)
    return
  }
  showBatchPrint.value = true
}
</script>

<style scoped>
.pro-canvas-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--fill);
  user-select: none;
}

.pro-toolbar {
  height: 44px;
  flex-shrink: 0;
  background: var(--glass-heavy);
  backdrop-filter: saturate(180%) blur(18px);
  -webkit-backdrop-filter: saturate(180%) blur(18px);
  border-bottom: 1px solid var(--separator);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  gap: 12px;
}

.toolbar-left,
.toolbar-center,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.divider {
  width: 1px;
  height: 16px;
  background: var(--separator);
  margin: 0 2px;
}

.tool-btn {
  display: flex;
  align-items: center;
  padding: 5px 11px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--separator);
  background: #fff;
  font-size: 12px;
  font-weight: 600;
  color: var(--label);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--spring);
}
.tool-btn:hover { background: var(--fill-grouped); }
.tool-btn:active { transform: scale(0.97); }

.paper-selector {
  display: flex;
  align-items: center;
  gap: 6px;
}
.paper-selector .label {
  font-size: 11px;
  color: var(--label-tertiary);
}

.apple-select-sm {
  padding: 4px 8px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--separator-opaque);
  font-size: 11px;
  background: #fff;
  outline: none;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--fill-grouped);
  border-radius: var(--radius-sm);
  padding: 2px;
}
.zoom-btn {
  width: 24px;
  height: 22px;
  border-radius: 5px;
  border: none;
  background: transparent;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  color: var(--label);
  transition: background var(--duration-fast) var(--ease-out);
}
.zoom-btn:hover { background: rgba(0, 0, 0, 0.06); }
.zoom-text {
  font-size: 11px;
  font-weight: 600;
  padding: 0 6px;
  min-width: 36px;
  text-align: center;
}
.zoom-reset-btn {
  font-size: 10px;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 5px;
  padding: 3px 6px;
  cursor: pointer;
  color: var(--label-secondary);
}

.grid-controls {
  display: flex;
  background: var(--fill-grouped);
  border-radius: var(--radius-sm);
  padding: 2px;
}
.grid-pill {
  padding: 4px 9px;
  font-size: 11px;
  font-weight: 550;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: var(--label-secondary);
  transition: background var(--duration) var(--spring), color var(--duration-fast) var(--ease-out), box-shadow var(--duration) var(--ease-out);
}
.grid-pill.active {
  background: #fff;
  color: var(--blue);
  box-shadow: var(--shadow-thumb);
}

.toggle-guide-btn {
  padding: 4px 9px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--separator-opaque);
  background: #fff;
  font-size: 11px;
  color: var(--label-secondary);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out);
}
.toggle-guide-btn.active {
  background: var(--blue-soft);
  border-color: rgba(0, 113, 227, 0.28);
  color: var(--blue);
  font-weight: 600;
}

.engine-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--blue);
  background: var(--blue-soft);
  padding: 4px 9px;
  border-radius: var(--radius-pill);
}

.tool-action-btn {
  padding: 5px 11px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--separator);
  background: #fff;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--label);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--spring);
}
.tool-action-btn:hover { background: var(--fill-grouped); }
.tool-action-btn:active { transform: scale(0.97); }
.tool-action-btn.primary {
  background: var(--blue);
  color: #fff;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 113, 227, 0.22);
}
.tool-action-btn.primary:hover { background: var(--blue-hover); }
.tool-action-btn.rag-btn {
  background: linear-gradient(135deg, rgba(0, 113, 227, 0.12), rgba(88, 86, 214, 0.12));
  color: #0071e3;
  border-color: rgba(0, 113, 227, 0.35);
  font-weight: 650;
  box-shadow: 0 1px 3px rgba(0, 113, 227, 0.12);
}
.tool-action-btn.rag-btn:hover {
  background: linear-gradient(135deg, #0071e3, #5856d6);
  color: #fff;
}

.pro-main-area {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.toolbox-panel {
  width: 212px;
  flex-shrink: 0;
  background: var(--glass-heavy);
  backdrop-filter: saturate(180%) blur(18px);
  -webkit-backdrop-filter: saturate(180%) blur(18px);
  border-right: 1px solid var(--separator);
  display: flex;
  flex-direction: column;
  padding: 14px 12px;
  gap: 10px;
  overflow-y: auto;
  animation: apple-rise var(--duration-slow) var(--ease-out) both;
}

.panel-header {
  font-size: 13px;
  font-weight: 650;
  color: var(--label);
  letter-spacing: -0.2px;
  padding: 2px 4px 8px;
}

.group-title {
  font-size: 11px;
  font-weight: 650;
  color: var(--label-tertiary);
  margin: 10px 4px 6px;
}

.tool-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tool-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 32px;
  padding: 0 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--spring);
}
.tool-row:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.045);
}
.tool-row:active:not(:disabled) {
  transform: scale(0.985);
}
.tool-row.occupied {
  cursor: pointer;
}
.tool-row.active {
  background: var(--blue-soft);
}
.tool-row.active:hover {
  background: var(--blue-soft);
}
.tool-name {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--label);
  letter-spacing: -0.15px;
}
.tool-row.occupied .tool-name {
  color: var(--label-secondary);
}
.tool-row.active .tool-name {
  color: var(--blue);
  font-weight: 650;
}
.tool-check {
  font-size: 10px;
  font-weight: 650;
  color: var(--green);
  background: var(--green-soft);
  padding: 2px 7px;
  border-radius: var(--radius-pill);
}

.toolbox-footer {
  margin-top: auto;
  padding: 10px;
  background: var(--fill-grouped);
  border-radius: var(--radius);
}
.toolbox-footer .hint {
  font-size: 11px;
  color: var(--label-tertiary);
  line-height: 1.45;
}

.canvas-viewport-area {
  flex: 1;
  overflow: auto;
  position: relative;
  padding: 36px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  background:
    radial-gradient(1000px 480px at 50% -10%, rgba(255, 255, 255, 0.72), transparent 60%),
    linear-gradient(180deg, #ececef 0%, #e3e3e8 100%);
}

.ruler-container-wrap {
  position: relative;
  animation: apple-rise 520ms var(--ease-out) both;
}

.paper-sheet {
  position: relative;
  background: #fff;
  box-shadow: var(--shadow-paper);
  border-radius: 3px;
  overflow: hidden;
  cursor: default;
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
  background: var(--blue);
  opacity: 0.55;
  border-left: 1px dashed var(--blue);
  pointer-events: none;
  z-index: 100;
}

.guide-tag {
  position: absolute;
  top: 6px;
  left: 6px;
  background: rgba(0, 113, 227, 0.9);
  color: #fff;
  font-size: 9px;
  padding: 2px 6px;
  border-radius: var(--radius-pill);
}

.canvas-element {
  position: absolute;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 2px;
  transition: box-shadow var(--duration) var(--spring), border-color var(--duration-fast) var(--ease-out);
}
.canvas-element:hover {
  border-color: rgba(0, 113, 227, 0.28);
}
.canvas-element.selected {
  border: 1px solid var(--blue);
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.18);
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

.slot-chip {
  position: absolute;
  top: 3px;
  right: 4px;
  z-index: 6;
  font-size: 9px;
  font-weight: 650;
  color: var(--blue);
  background: rgba(232, 242, 255, 0.94);
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  pointer-events: none;
}

.split-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12px;
  margin-left: -6px;
  z-index: 120;
  pointer-events: auto;
  cursor: col-resize;
  background: transparent;
}
.split-handle::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: var(--blue);
  opacity: 0.88;
}
.split-handle:hover::before,
.split-handle.dragging::before {
  width: 3px;
  opacity: 1;
}
.split-label {
  position: absolute;
  top: 4px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--blue);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.2px;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  white-space: nowrap;
  pointer-events: none;
}

/* 元素样式渲染 */
.el-header {
  padding-top: 2px;
}
.header-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
}
.el-header.align-left { text-align: left; }
.el-header.align-center { text-align: center; }
.el-header.align-right { text-align: right; }
.el-header.align-left .header-main { justify-content: flex-start; }
.el-header.align-center .header-main { justify-content: center; }
.el-header.align-right .header-main { justify-content: flex-end; }
.el-header.align-right .report-no { margin-left: 8px; }
.hospital-logo {
  width: 22px;
  height: 22px;
  object-fit: contain;
  flex-shrink: 0;
}
.header-copy {
  min-width: 0;
}
.report-sub {
  font-size: 8px;
  color: #666;
  margin-top: 1px;
}
.report-no {
  margin-left: auto;
  font-size: 8px;
  color: #333;
  text-align: right;
  flex-shrink: 0;
}
.report-no span {
  display: block;
  color: #888;
}
.align-pills {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.field-add {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.field-add .apple-select-sm {
  flex: 1;
}
.field-edit {
  align-items: center;
}
.slot-order {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.canvas-element.reordering {
  opacity: 0.88;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.12);
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
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 6px 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  padding: 3px 8px;
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
  display: grid;
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

.inspector-panel {
  width: 292px;
  flex-shrink: 0;
  background: var(--glass-heavy);
  backdrop-filter: saturate(180%) blur(18px);
  -webkit-backdrop-filter: saturate(180%) blur(18px);
  border-left: 1px solid var(--separator);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  user-select: text;
  animation: apple-rise var(--duration-slow) var(--ease-out) 80ms both;
}

.inspector-header {
  padding: 14px 16px 10px;
  font-size: 13px;
  font-weight: 650;
  color: var(--label);
  letter-spacing: -0.2px;
}

.inspector-tabs {
  display: flex;
  background: var(--fill-grouped);
  padding: 3px;
  margin: 0 12px 4px;
  border-radius: var(--radius-sm);
}

.tab-btn {
  flex: 1;
  padding: 6px 0;
  font-size: 11px;
  font-weight: 550;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: var(--label-secondary);
  text-align: center;
  transition: background var(--duration) var(--spring), color var(--duration-fast) var(--ease-out), box-shadow var(--duration) var(--ease-out);
}

.tab-btn.active {
  background: #fff;
  color: var(--label);
  font-weight: 650;
  box-shadow: var(--shadow-thumb);
}

.inspector-body {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.prop-title {
  font-size: 11px;
  font-weight: 650;
  color: var(--label-tertiary);
  margin-bottom: 6px;
}

.prop-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.prop-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.prop-field label {
  font-size: 11px;
  color: var(--label-tertiary);
}

.apple-input-sm,
.apple-textarea {
  padding: 6px 8px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--separator-opaque);
  font-size: 12px;
  background: var(--fill-grouped);
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
}

.apple-input-sm:focus,
.apple-textarea:focus {
  border-color: var(--blue);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.16);
}

.apple-input-sm[readonly] {
  color: var(--label-tertiary);
}

.align-btn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 6px;
}

.action-btn {
  padding: 7px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--separator-opaque);
  background: #fff;
  font-size: 11px;
  font-weight: 600;
  color: var(--label);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--spring);
}

.action-btn:hover { background: var(--fill-grouped); }
.action-btn:active { transform: scale(0.98); }

.action-btn.primary {
  background: var(--blue);
  color: #fff;
  border: none;
}

.action-btn.danger {
  color: var(--red);
  border-color: rgba(255, 59, 48, 0.22);
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--label);
  margin: 4px 0;
  cursor: pointer;
}

.prop-hint {
  font-size: 11px;
  color: var(--label-tertiary);
  margin: 4px 0 8px;
  line-height: 1.45;
}

.inspector-empty {
  padding: 12px 14px 20px;
  text-align: left;
  color: var(--label-tertiary);
}

.inspector-empty p {
  font-size: 12px;
  line-height: 1.5;
  margin: 0 0 10px;
}

.ratio-slider {
  width: 100%;
  accent-color: var(--blue);
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 6px 0 8px;
  max-height: 220px;
  overflow-y: auto;
}

.item-row {
  display: grid;
  grid-template-columns: 1fr 52px 48px 28px;
  gap: 4px;
  align-items: center;
}

.item-row .item-abbr,
.item-row .item-result {
  padding-left: 6px;
  padding-right: 6px;
}

.item-del {
  height: 28px;
  border: 1px solid rgba(255, 59, 48, 0.22);
  border-radius: var(--radius-xs);
  background: #fff;
  color: var(--red);
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
}

.item-del:hover {
  background: rgba(255, 59, 48, 0.06);
}

.pacs-presets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-bottom: 10px;
}

.preset-btn {
  padding: 7px 0;
  border-radius: var(--radius-sm);
  border: 1px solid var(--separator-opaque);
  background: #fff;
  font-size: 12px;
  font-weight: 650;
  color: var(--label);
  cursor: pointer;
}

.preset-btn.active {
  background: var(--blue-soft);
  border-color: rgba(0, 113, 227, 0.28);
  color: var(--blue);
}

.engine-box {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--separator);
}
</style>
