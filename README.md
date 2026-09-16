<div align="center">

# MedPrint (medical-print)

**面向医疗健康与高精单据的跨平台打印引擎与排版系统**

*Next-Generation Medical Report Designer & Cross-Platform Printing Engine (Rust + WASM + Vue 3 + RAG/Pi-Agent)*

[![GitHub Repo](https://img.shields.io/badge/GitHub-kaykaymaidou%2Fmedical--print-181717?logo=github)](https://github.com/kaykaymaidou/medical-print)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange.svg)](https://www.rust-lang.org/)
[![Vue 3](https://img.shields.io/badge/vue-3.4%2B-green.svg)](https://vuejs.org/)
[![WASM](https://img.shields.io/badge/WebAssembly-Wasm32-purple.svg)](https://webassembly.org/)
[![信创适配](https://img.shields.io/badge/信创支持-统信UOS%20%7C%20银河麒麟-red.svg)](#五信创全平台同构与极简单二进制交付)
[![GrapeCity Migration](https://img.shields.io/badge/GrapeCity%20ActiveReports-RDLX%20无损迁移-emerald.svg)](#四葡萄城-activereports-rdlx-模板解析与数据映射)
[![MCP Protocol](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-blueviolet.svg)](#cli-命令行工具与-mcp-本地模型接入指南)

<p align="center">
  <b>纯 Rust 矢量直出</b> | <b>葡萄城 ActiveReports (RDLX) 解析迁移</b> | <b>A5 双列折流平衡</b> | <b>单页高度预算守卫</b><br/>
  <b>RAG 骨架检索 + Pi-Agent 槽位填充</b> | <b>运行时数据动态绑定</b> | <b>Model Context Protocol (MCP)</b> | <b>信创全平台兼容</b>
</p>

</div>

---

## 领域技术词与检索标签

为了便于医院信息化团队（HIS / LIS / PACS / EMR）、医疗仪器厂商（POCT / 生化 / 免疫 / 凝血）以及信创集成商查找，本项目技术栈涵盖以下领域：

* **系统功能**：`medical-print`、医疗报表设计器、医院化验单打印系统、处方笺打印引擎、检验科质控报告、心电图绝对物理网格、PACS 影像排版、血栓弹力图 (TEG) 反应曲线；
* **历史架构与格式迁移**：ActiveReports 12/14 RDLX 转换解析、C-Lodop 替代方案、FastReport 国产化适配、SpreadJS 医疗打印集成；
* **几何排版算法**：A5 横向双列折流平衡算法（Snaking Flow Table）、单页高度预算控制（Single-Page Budget Guard）、空间多边形障碍物避让（Obstacle Avoidance）、无框线表格 X 轴直方图投影切分；
* **核心编译与渲染**：纯 Rust 矢量 PDF 动态编译器 (%PDF-1.4)、ISO/IEC 15417 Code 128 矢量条码、浏览器端 WebAssembly (WASM) 离线排版；
* **AI 智能体与协议**：Model Context Protocol (MCP) Server、DeepSeek Harness (dsh) 医疗排版插件、RAG 骨架知识库检索、Pi-Agent 增量槽位填充、私有化模型支持 (Ollama / vLLM / Qwen2.5 / DeepSeek-R1)；
* **数据绑定与接口**：运行时动态数据绑定引擎 (Runtime Data Interpolator)、自动参考区间比对与危急值标注、eGFR (CKD-EPI 2021) 临床公式自动运算、REST API (`POST /api/v1/report/render`)、CLI 批处理工具。

---

## 目录

- [行业背景与设计初衷](#行业背景与设计初衷)
- [医疗打印与日常临床运维的 9 大痛点及系统级解法](#医疗打印与日常临床运维的-9-大痛点及系统级解法)
- [核心技术与工程攻坚](#核心技术与工程攻坚)
  - [一、声明式物理几何约束求解引擎 vs 传统死坐标模板](#一声明式物理几何约束求解引擎-vs-传统死坐标模板)
  - [二、纯数学微米级矢量直出（解决扫码枪识别率问题）](#二纯数学微米级矢量直出解决扫码枪识别率问题)
  - [三、医院本地小模型适配：RAG 骨架检索 + Pi Agent 槽位填充](#三医院本地小模型适配rag-骨架检索--pi-agent-槽位填充)
  - [四、葡萄城 ActiveReports (RDLX) 模板解析与数据映射](#四葡萄城-activereports-rdlx-模板解析与数据映射)
  - [五、信创全平台同构与单二进制交付](#五信创全平台同构与单二进制交付)
- [架构对比：传统方案 vs MedPrint](#架构对比传统方案-vs-medprint)
- [葡萄城 RDLX 数据映射模型与绑定规范](#葡萄城-rdlx-数据映射模型与绑定规范)
- [CLI 命令行工具与 MCP 本地模型接入指南](#cli-命令行工具与-mcp-本地模型接入指南)
- [工程架构与模块划分 (Monorepo)](#工程架构与模块划分-monorepo)
- [常见问题与排错指南 (FAQ)](#常见问题与排错指南-faq)
- [快速开始与本地构建](#快速开始与本地构建)
- [开源许可证](#开源许可证)

---

## 行业背景与设计初衷

在医院信息化系统（HIS、LIS 检验、PACS 影像、心电、门急诊处方）中，**医疗报告单打印直接关乎医疗合规、法律效力与临床诊断效率**。

国内医院现场长期使用 Windows 时代的传统报表套件，如 **葡萄城 ActiveReports（C# / .NET + RDLX 模板）**、**C-Lodop** 及 **FastReport**。在现场实际系统的运行中，传统技术路线逐渐显现出局限性：
- 强依赖 Windows GDI+ 驱动体系，信创国产化环境迁移成本高；
- 模板采用绝对坐标硬编码，单据微调需要反复创建派生模板；
- 前端截图栅格化打印使条码边缘发虚，导致扫码拒读；
- 检验项增加时容易发生机械切页，使医师签名孤立落于次页。

**MedPrint 针对上述工程瓶颈而设计**：采用 **Rust 高性能内核 + 微米级纯矢量排版 + 声明式物理几何约束求解器 + RAG/Pi-Agent 结构化逆向**，提供一套标准化、跨平台、高保真的医疗报告单处理链路。

---

## 医疗打印与日常临床运维的 9 大痛点及系统级解法

| # | 临床/运维痛点 | 传统报表方案表现 (ActiveReports / C-Lodop) | MedPrint 系统级解法 |
| :- | :--- | :--- | :--- |
| **1** | **绝对坐标硬编码导致模板冗余** | 每个元素写死绝对坐标；Logo 位置微调或插入图表时表格无法自适应避让，模板文件成倍增加。 | **声明式物理几何约束求解器**：声明相对锚定与避让策略，表格自动动态折流绕行，单套 AST 适应多种版式需求。 |
| **2** | **机械分页与责任签名跨页脱落** | 检验项目略微超出页面时被动切出第 2 页，医生签名孤立在次页，不符合病历书写规范。 | **A5 横向双列折流（Snaking Flow） + 三级单页预算控制**：行高微调与双列平衡折排，结合 `KeepWithNext` 签名防断裂锚定。 |
| **3** | **脱机断网环境授权失效** | 依赖商业授权凭据（`licenses.licx`），局域网离线使用易因证书异常提示弹窗或覆盖水印。 | **Apache-2.0 开源协议**，零授权凭证依赖，医院局域网离线脱机稳定运行。 |
| **4** | **信创操作系统与架构壁垒** | 依赖 Windows GDI+ 与 .NET Framework，难以原生部署于国产 Linux 及国产 CPU。 | **纯 Rust 原生跨平台与 WebAssembly**，原生支持统信 UOS、银河麒麟、龙芯 LoongArch64、飞腾 ARM64 及 x86_64。 |
| **5** | **位图栅格化导致扫码枪拒读** | 采用 HTML 截图（96 DPI）或驱动转发位图，条码边缘毛刺发虚，采血台扫码枪拒读率达 $15\%\sim30\%$。 | **纯算法微米级 ISO 15417 Code 128 矢量直出**，300/600/1200 DPI 任意缩放边缘清晰，扫码识别率稳定。 |
| **6** | **急诊加急 (STAT) 与危急值标示** | 普通黑白表格输出，急诊抢救时无法醒目突出 STAT 标识，危急值仅有普通箭头不易辨认。 | **原生 STAT 急诊标识 + 危急值高亮与警示标签**，契合急危重症质控规范。 |
| **7** | **超长化验项名称撑破布局** | 遇到超长名称时文字被截断或挤压相邻行高，引起整页排版漂移。 | **自适应字号微缩（Auto-shrink to fit）与单行高度锁定**，确保表体高度稳定可控。 |
| **8** | **预印红头套打纸重影与漂移** | 医院已有印刷好的红色抬头单据，打印时无法隐藏固定标题，缺少物理偏移微调能力。 | **套打模式（Pre-printed overlay）**：隐藏固定抬头/院徽，仅输出动态数据槽位，支持 $\pm 0.1\text{mm}$ 进纸机械偏移校准。 |
| **9** | **端侧小模型长 JSON 排版崩溃** | 医院物理内网无法调用云端大模型，本地 7B/8B 小模型从零生成长 AST 易产生坐标幻觉与括号截断。 | **确定性指纹 + 黄金骨架 RAG 召回 + Pi Agent 槽位填充**：小模型仅提取实体槽位，排版结构由内核几何求解器闭环保证。 |

---

## 核心技术与工程攻坚

### 一、声明式物理几何约束求解引擎 vs 传统死坐标模板

#### 背景与需求
在医疗单据中，业务需求差异频繁：
- 不同院区或科室要求院徽 Logo 位于左上、居中或右下；
- 检验项目从血常规 24 项到生化全项 35 项不等；
- 凝血或心血管单据需在版面中间嵌入血栓弹力图（TEG）波形，要求数据列表自适应绕开图表（**空间避让**）。

绝对坐标方案中，每次微调通常需要派生新的模板文件。

#### 工程实现
MedPrint 采用 **声明式物理几何约束求解器（Declarative Geometric Constraint Solver）**：

```
┌─────────────────────────────────────────────────────────────┐
│ 声明式约束 AST (空间分区 + 相对锚定 + 避让语义)              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 物理几何求解引擎 (Physical Geometric Solver)                 │
│  ├─ 1. 空间障碍物多边形碰撞检测 (Obstacle Detection)        │
│  │   • 图表/标注区域注册为障碍区 Rect(x, y, w, h)           │
│  │   • 表格根据障碍物轮廓动态调整可用打印带 (Flow Band)     │
│  ├─ 2. A5 横/纵向双列折流平衡算法 (Snaking Flow Solver)     │
│  │   • 优先单列铺满 -> 触及底部安全边界 -> 自动折入右列     │
│  │   • 自动克隆表头 (Cloned Header)，双列均满才执行分页     │
│  └─ 3. 三级单页预算控制 (Single-Page Budget Guard)          │
│      • Level 1: 压缩行内间距 (Row Padding: 2mm -> 1mm)      │
│      • Level 2: 降级字体阶梯 (Font: 10pt -> 8.5pt -> 7.5pt) │
│      • Level 3: 触发双列智能折流分栏                        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 绝对物理毫米 (mm) 渲染帧 -> 控制在单页内完整输出            │
└─────────────────────────────────────────────────────────────┘
```

- **参数化约束**：声明 `placement: "top-left"` 或 `avoid_overlap: true`，求解器计算可用边界，表格自动绕行；
- **签名链绑定**：支持 `Keep-With-Next` 策略，保障送检、检验、审核等责任签名链与化验项末尾保持在同一页面。

---

### 二、纯数学微米级矢量直出（解决扫码枪识别率问题）

#### 背景与需求
基于 `html2canvas`、Headless Chrome 截图或浏览器原生打印的方案，本质上将页面转换为屏幕像素位图（96 DPI）。在热敏打印机或普通激光打印机上：
- 条码黑白条纹边缘发虚，宽窄比失真，导致扫码枪识别困难；
- 心电图等要求的 $1\text{mm} \times 1\text{mm}$ 网格因屏幕 DPI 换算误差产生周期性网纹漂移。

#### 工程实现
MedPrint 在 `crates/medprint-core/src/pdf/mod.rs` 中实现了 **纯 Rust 矢量 PDF 动态编译器**：

1. **绝对物理点运算**：全程采用标准物理点（$1\,\text{pt} = \frac{1}{72}\,\text{in} \approx 0.352778\,\text{mm}$）进行浮点运算，避免操作系统分辨率及 DPI 缩放影响；
2. **算法生成标准条码**：内置 **ISO/IEC 15417 Code 128**、**DataMatrix**、**QR Code** 矢量生成算法，直接在 PDF 字节流中输出精确的矩形填充路径（`re`、`f` 操作符），支持 300 / 600 / 1200 DPI 输出；
3. **零外部 C 库依赖**：纯 Rust 构造标准 `%PDF-1.4` 结构，包含交叉引用表（`xref`）、Type 1 字体字典嵌入、印章半透明正片叠底（`BM /Multiply`）与旋转变换矩阵（`cm`）；
4. **编译性能**：单份矢量 PDF 生成耗时在数毫秒内，产物尺寸仅约 $5 \sim 25\,\text{KB}$。

---

### 三、医院本地小模型适配：RAG 骨架检索 + Pi Agent 槽位填充

#### 背景与需求
医院网络通常物理隔离，患者数据不可外发至公网。院内服务器主要部署 7B/14B 等端侧开源模型（如 Qwen2.5、DeepSeek-R1-Distill 等）。端侧模型在直接从零生成包含数十项指标的长 JSON AST 时，容易产生括号截断、非法字段与格式漂移。

#### 工程实现
MedPrint 采用两阶段增量填充管线（Pi-Agent 模式）：

```
输入文本/Word/PDF/XML
         │
         ▼
【Step 1: 确定性结构指纹分析器 (DocumentFingerprinter)】
 • 提取：医院名称、业务类型 (LIS/ECG/TEG/PACS)、列数、行数、患者属性
         │
         ▼
【Step 2: 黄金骨架知识库与 RAG 召回 (TemplateRetriever)】
 • 从合规黄金骨架 (A5双列折流、A5生化、A5弹力图、A4超声) 中检索匹配
 • 综合加权评分 (类别 + 关键词 + 拓扑 + 字段匹配度)
 • 输出: Top-1 骨架 AST
         │
         ▼
【Step 3: Pi Agent 增量槽位填充 (PiSlotFillingAgent)】
 • 提取化验项目、参考区间、患者属性与医生签名
 • 仅填充业务数据槽位，不改动版面空间约束
         │
         ▼
【Step 4: 物理几何守卫闭环校验 (PhysicalVerifier)】
 • 校验行高、边距、预算策略与签名链
 • 输出符合规范的报表 AST
```

---

### 四、葡萄城 ActiveReports (RDLX) 模板解析与数据映射

#### 背景与需求
许多现有医院信息系统积累了大量 ActiveReports `.rdlx` XML 模板资产。其结构中包含：
- `dataset1`：检验明细列表（`itemName`、`sampleValue`、`standard`、`unit`、`prompt`、`barcode` 等）；
- `dataset2`：患者基本信息（包含姓名、性别、年龄、床号、病案号、科室、检验医师等 25 个字段）；
- 命名空间繁杂，长度单位混杂（`cm`、`in`、`pt`），字段表达式采用 `=Fields!name.Value`。

#### 工程实现
MedPrint 在 `packages/ai-agent/src/rag/rdlxParser.ts` 中实现专用解析器：

1. **单位归一化**：自动将 RDLX 中的 `cm`、`in`、`pt` 等长度值统一换算为物理毫米（`mm`）；
2. **双数据集映射**：
   - 提取 `dataset1` 映射为检测明细项（解析 `↑`、`↓` 异常提示）；
   - 提取 `dataset2` 映射为患者属性与三级签名结构；
3. **版面重构**：将 RDLX 的 `PageHeader` 映射为页眉与条码区，将 `Table1` 映射为双列折流表格；
4. **解析效率**：以标准 A5 纵向 5 列表格模板为例，解析转换通常在数十毫秒内完成。

---

### 五、信创全平台同构与单二进制交付

#### 背景与需求
传统方案在客户端部署繁琐，往往需分别安装 Web 控件、打印服务程序及特定运行库（如 .NET Framework / VC++ Redistributable），且在国产操作系统上缺少对应驱动支持。

#### 工程实现
MedPrint 采用多目标跨平台架构：

1. **`medprint-server`（单二进制独立微服务）**：
   - 静态编译的独立可执行文件（约 20MB），内置 `rust-embed` 打包的前端 Vue 3 设计器；
   - 独立运行，提供 HTTP/WebSocket 接口、离线模板存储及矢量 PDF 编译能力，无需额外依赖 Node.js 或 .NET 运行库；
2. **`medprint-wasm`（纯前端离线排版）**：
   - Rust 内核编译为 WebAssembly，在浏览器端离线完成排版计算与矢量 PDF 生成；
3. **信创环境适配**：
   - 支持 **统信 UOS** 与 **银河麒麟 KylinOS**；
   - 架构覆盖 **龙芯 LoongArch64**、**飞腾/鲲鹏 ARM64** 与 **x86_64**。

---

## 架构对比：传统方案 vs MedPrint

| 评估维度 | 传统报表方案 (ActiveReports / C-Lodop) | MedPrint 架构 (Rust + WASM + RAG/Pi-Agent) |
| :--- | :--- | :--- |
| **运行依赖** | 依赖 Windows OS、.NET Framework、IIS 或 GDI+ 驱动环境。 | **纯 Rust 自研**，无外部 C 动态库依赖，编译为原生机器码或 WebAssembly。 |
| **信创国产化** | 难以在统信 UOS、银河麒麟及国产芯片上原生运行。 | **全平台支持**（Linux / Windows / macOS / WASM / LoongArch64 / ARM64）。 |
| **开源与授权** | 商业授权模式，局域网离线存在证书校验风险。 | **Apache-2.0 商业友好开源**，内网离线长期可用。 |
| **排版模型** | **固定绝对坐标**，元素间无相对感知。 | **声明式物理几何约束求解器**（空间分区、相对锚定、动态折流、障碍物避让）。 |
| **模板维护成本** | 单据微调易导致模板文件成倍增加。 | **参数与约束驱动**，同一套 AST 自适应不同避让与折流配置。 |
| **分页控制** | 缺少自动折流，多项时机械分页易导致孤立签名。 | **A5 双列折流平衡（Snaking Flow） + 单页高度预算控制**。 |
| **条码与图形精度** | 依赖位图截图或 GDI+ 转义，易失真。 | **ISO 15417 矢量条码纯算法生成**，支持 300/600/1200 DPI 输出。 |
| **存量模板迁移** | 需在桌面设计器上手工重新绘制与配置字段绑定。 | **支持 RDLX 原生解析与文本 RAG 逆向**，自动映射为合规 AST。 |
| **部署形态** | 需分发客户端代理、运行库及后台接口服务。 | **单二进制独立微服务（内置 Web）** 或前端 WASM 纯离线运行。 |

---

## 葡萄城 RDLX 数据映射模型与绑定规范

针对医院常用的双数据集模型，MedPrint 建立如下映射对应关系：

```
葡萄城 ActiveReports (RDLX)                    MedPrint AST 结构
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│ <ReportParameters>                   │ ----> │ meta: {                              │
│   ReportTitle = "检验报告单"         │       │   hospital_name: "第一人民医院",      │
│ </ReportParameters>                  │       │   report_title: "临床检验报告单",    │
│                                      │       │ }                                    │
│ <DataSet Name="dataset2"> (患者信息) │ ----> │ patient_info: {                      │
│   patientName = "张三"               │       │   name: "张三",                      │
│   age = "45岁", sex = "男"           │       │   age: "45岁", gender: "男",        │
│   bedNo = "032", caseHistoryNo       │       │   bed_no: "032", id: "P202609001",   │
│   submitter, inspector, reviewer     │       │   signatures: { ... }                │
│ </DataSet>                           │       │ }                                    │
│                                      │       │                                      │
│ <DataSet Name="dataset1"> (检验明细) │ ----> │ table_layout: {                      │
│   itemName = "白细胞计数 (WBC)"      │       │   columns: ["项目","结果","参考区间"],│
│   sampleValue = "11.5"               │       │   items: [                           │
│   standard = "3.5-9.5", unit = "10^9"│       │     { name: "WBC", val: "11.5", ... }│
│   prompt = "↑"                       │       │   ],                                 │
│ </DataSet>                           │       │   snaking_columns: 2                 │
└──────────────────────────────────────┘       └──────────────────────────────────────┘
```

---

## CLI 命令行工具与 MCP 本地模型接入指南

### 1. 使用 CLI 工具 (`medprint-cli`)
`@medprint/ai-agent` 提供命令行工具，支持批量转换、逆向解析与编译：

```bash
# 1. 解析存量葡萄城 RDLX 报表为 MedPrint AST
pnpm --filter @medprint/ai-agent cli rdlx-parse ./template.rdlx -o ./output.ast.json

# 2. 将非结构化文本反向生成为 AST
pnpm --filter @medprint/ai-agent cli reverse ./blood_report.txt -o ./blood_report.ast.json

# 3. 灌入真实患者数据并编译为 300 DPI 矢量 PDF
pnpm --filter @medprint/ai-agent cli render ./output.ast.json ./patient_data.json -o ./report.pdf

# 4. 直接将 AST JSON 编译为矢量 PDF
pnpm --filter @medprint/ai-agent cli compile ./output.ast.json -o ./report.pdf
```

### 2. 接入 Model Context Protocol (MCP)
MedPrint 实现了 MCP JSON-RPC 2.0 stdio 协议，可接入 Cursor、Claude Desktop、Antigravity 等开发工具。

在配置（如 `.cursor/mcp.json` 或 `claude_desktop_config.json`）中添加：
```json
{
  "mcpServers": {
    "medprint": {
      "command": "node",
      "args": ["packages/ai-agent/dist/mcp.js"]
    }
  }
}
```

### 3. 本地模型推理接入 (Ollama / vLLM)
```bash
# 启动本地 Ollama
ollama run qwen2.5:7b

# 或使用 vLLM 启动 OpenAI 兼容服务
python -m vllm.entrypoints.openai.api_server --model Qwen/Qwen2.5-7B-Instruct --port 11434
```

---

## 工程架构与模块划分 (Monorepo)

```
medprint/
├── crates/
│   ├── medprint-core/       # Rust 核心排版引擎 (毫米单位/A5折流/几何约束求解/矢量PDF生成)
│   ├── medprint-wasm/       # wasm-bindgen 浏览器前端桥接 (客户端本地排版输出)
│   ├── medprint-spooler/    # 底层打印监听 (Windows Spooler / CUPS 硬件状态监听)
│   └── medprint-server/     # 单二进制独立微服务 (内置 Vue3 静态资源 + REST API + 离线存储)
├── packages/
│   ├── designer/            # Vue 3 + TypeScript 医疗报告设计器
│   ├── ai-agent/            # 医疗排版 AI 智能体 (RAG 检索 + 槽位填充 + RDLX解析 + MCP/CLI)
│   └── extension/           # 浏览器扩展 (Native Messaging 直连打印)
├── apps/
│   └── desktop/             # Tauri 2.0 桌面客户端 (Windows / Linux 信创平台)
├── skills/
│   └── medprint-report-agent/ # AI 智能体排版与调度技能规范 (SKILL.md)
├── docs/                    # 架构与排版规范文档
├── AGENTS.md                # 跨开发环境与 AI 协作规范指南
└── README.md                # 本说明文件
```

---

## 常见问题与排错指南 (FAQ)

### Q1: 扫码设备无法识别打印条码？
* **原因**：常见原因是上游系统采用前端 Canvas 或屏幕截图（96 DPI）方式输出条码，热敏或激光打印时边缘采样产生毛刺。
* **处理**：MedPrint 基于 ISO/IEC 15417 直接计算黑白矢量填充路径。导出纯矢量 PDF 或通过 `medprint-spooler` 发送原始指令即可保证边缘清晰度。

### Q2: 检验项目较多时如何避免意外分页？
* **处理**：在模板 AST 中配置 `"page_budget": "SinglePageHard"`。排版求解器将执行以下压缩策略：
  1. 将行内间距从 `2.0mm` 压缩至 `1.2mm`；
  2. 启用双列折流（Snaking Table），左列排满后自动折入右列；
  3. 字号按阶梯微缩，将内容约束在单张 A5 页面内。

### Q3: 预印红头单据套打时如何校准？
* **处理**：在 AST 中将页眉配置为 `"mode": "overlay"`（套打模式）。系统将隐藏固定的医院抬头与 Logo，仅输出动态化验项与患者数据，并可在设置中配置物理进纸偏移（精确至 $0.1\text{mm}$）。

### Q4: 信创系统（统信 UOS / 银河麒麟）如何部署运行？
* **处理**：将编译好的 `medprint-server` 独立二进制文件复制至信创机器运行，无需安装 Node.js 或 .NET 运行库。可通过 systemd 配置为常驻服务，前端通过 HTTP/WebSocket 进行调用。

---

## 快速开始与本地构建

### 1. 编译前端与工具包
```bash
pnpm install
pnpm --filter @medprint/ai-agent build
pnpm build:designer
```

### 2. 启动独立微服务 (`medprint-server`)
```bash
cargo run -p medprint-server
# 访问地址：http://localhost:19800
```

### 3. 使用 RDLX 模板解析与逆向
1. 打开设计器页面，在控制栏点击 **【逆向解析 (RAG)】**；
2. 选择 **【葡萄城 ActiveReports (RDLX)】** 预设，或点击 **【导入外部模板】** 上传本地 `.rdlx` 文件；
3. 解析完成后即可查看流水线各阶段结果；
4. 点击 **【应用至设计器画布】** 加载排版；
5. 点击 **【导出矢量 PDF】** 输出纯矢量打印文件。

---

## 开源许可证

本项目采用 [Apache-2.0 许可证](LICENSE) 开源。
