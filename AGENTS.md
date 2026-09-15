# MedPrint Developer & AI Agent Collaboration Guide (AGENTS.md)

This document is the universal specification, invariant guide, and operational manual for human developers and all AI coding assistants (including **DeepSeek Harness, Claude, Cursor, Copilot, ChatGPT, Antigravity, and Gemini**).

---

## 🎯 本次迭代的核心目的与领域使命 (Iteration Mission & Domain Context)

MedPrint 是专为医疗健康与高精单据打造的下一代跨平台打印引擎与排版系统（基于 **Rust + WebAssembly + Vue 3 + RAG/Pi-Agent**）。

### 为什么必须替换传统报表（葡萄城 ActiveReports / C-Lodop / FastReport）？
1. **死坐标陷阱与模板爆炸**：在实际医院工程（如 `poct-gethostpdfapi`）中，传统 RDLX 报表每个元素强行写死绝对坐标。医院微调 Logo 位置或插入图表时，表格无法动态避让，导致工程内堆积了 40+ 个孤立模板文件；
2. **商业闭源授权与脱机断网瘫痪**：依赖商业授权（`licenses.licx`），医院内网脱机时常因证书异常弹窗中断，迫切需要 100% 自主可控、Apache-2.0 商业友好的全开源引擎；
3. **平台锁定与信创绝缘**：强依赖 Windows GDI+ 与 .NET Framework，无法在统信 UOS、银河麒麟、龙芯、飞腾等信创环境及浏览器 WASM 中原生脱机运行；
4. **单页预算失守与医疗纠纷**：化验项溢出时机械分页，造成医生责任签名孤立打印在空纸上；
5. **DOM 96 DPI 栅格化模糊**：条形码边缘发虚导致采血台扫码枪拒读。

### 本次里程碑达成的四大突破：
- ✅ **葡萄城 ActiveReports (RDLX) 100% 无损迁移**：原生 `rdlxParser.ts`，15ms 内解构 `dataset1`（化验项）与 `dataset2`（25 项患者元数据），自动转为 MedPrint 闭环 AST；
- ✅ **医院本地 7B/8B 小模型 RAG 骨架逆向与 Pi Agent 最小化填槽**：彻底解决端侧弱算力小模型（Qwen2.5-7B/DeepSeek-R1-Distill-7B）从零生成排版 AST 时的幻觉截断与越界崩溃；
- ✅ **全标准 MCP (Model Context Protocol) 与 CLI 落地**：提供 `medprint-mcp` 与 `medprint-cli`，无缝接入 Cursor、Claude Desktop、Antigravity 与本地 Ollama/vLLM；
- ✅ **极简单二进制（20MB）与浏览器端 WASM（2ms）双轨交付**。

---

## 🗺️ 全景代码地图与 AI 导航指南 (AI Navigation Roadmap)

AI 助手在查看、修改或扩展代码时，必须严格遵守以下目录职责与单一事实真相（Source of Truth）：

```
medprint/
├── crates/
│   ├── medprint-core/                  # 【核心物理排版与 PDF 编译层】 (Rust)
│   │   ├── src/schema/mod.rs           # 🌟 唯一排版 AST 物理定义 (毫米/微米)，新增元素必须首先改此文件！
│   │   ├── src/pdf/mod.rs              # 🌟 自研纯矢量 PDF 动态编译器 (%PDF-1.4, ISO 15417 Code 128, Type 1 字体)
│   │   ├── src/layout/mod.rs           # A5 横向双列折流平衡算法 (Snaking Table) 与单页预算硬守卫
│   │   └── src/formula/mod.rs          # 临床医学公式引擎 (eGFR, LDL-C, BMI, Anion Gap)
│   ├── medprint-wasm/                  # 【浏览器前端 WASM 桥接层】
│   │   └── src/lib.rs                  # wasm-bindgen 导出，供前端在浏览器内 2ms 本地排版直出 PDF
│   ├── medprint-server/                # 【单二进制独立微服务层】
│   │   └── src/main.rs                 # 20MB 单可执行文件，内置 rust-embed 托管 Vue 3，提供 REST/WS API 与离线存储
│   └── medprint-spooler/               # 【底层硬件状态监听层】
│       └── src/lib.rs                  # 监听 Windows Spooler / CUPS 真实物理缺纸 (Paper Out)、卡纸、出纸完毕
│
├── packages/
│   ├── ai-agent/                       # 【临床 AI 智能体与工具链】 (TypeScript)
│   │   ├── src/rag/
│   │   │   ├── rdlxParser.ts           # 🌟 葡萄城 ActiveReports XML (.rdlx) 深度解析器 (单位归一化/双数据集映射)
│   │   │   ├── fingerprinter.ts        # 异构文档结构指纹抽取器 (拓扑/模态/行数列数嗅探)
│   │   │   ├── knowledgeBase.ts        # 5 大合规黄金排版骨架知识库 (A5双列、A5生化、TEG弹力图、PACS超声)
│   │   │   ├── retriever.ts            # 混合加权多维 RAG 检索器 (置信度评估)
│   │   │   └── slotFiller.ts           # Pi Agent 最小化槽位填充器与单页弹性压缩守卫 (Compaction Guard)
│   │   ├── src/tools.ts                # 智能体工具注册表 (create_medical_template, medprint_parse_rdlx 等)
│   │   ├── src/mcp.ts                  # 🌟 Model Context Protocol (MCP) JSON-RPC 2.0 stdio 服务端
│   │   ├── src/cli.ts                  # 🌟 medprint-cli 命令行工具 (批量解析、RAG逆向、PDF编译)
│   │   └── src/provider.ts             # 本地模型提供方封装 (Ollama, vLLM, LMStudio, DeepSeek)
│   │
│   ├── designer/                       # 【Vue 3 医疗设计器】
│   │   ├── src/components/doctor/      # DoctorWizard.vue: 医生向导模式 (零拖拽、自然语言意图)
│   │   ├── src/components/canvas/      # ProCanvas.vue: 极客画布模式 (参数覆写审查，非自由拖拽低代码)
│   │   ├── src/components/common/      # RagReverseModal.vue: 智能逆向弹窗 (含葡萄城 RDLX 导入与四步流水线)
│   │   └── src/domain/                 # 模板 AST 与 RAG 逆向领域逻辑
│   │
│   └── extension/                      # 【Chrome/Edge 浏览器扩展】 (Native Messaging 免除端口/SSL 证书困扰)
│
├── skills/                             # 【AI 智能体专属技能规范】
│   └── medprint-report-agent/SKILL.md  # 智能排版、RDLX 迁移与 MCP 调度标准技能
│
└── docs/                               # 深度白皮书与排版规范
```

---

## 🧠 AI 智能体技能 (Skills) 编写指南与执行规范

当为 MedPrint 编写或扩展新的 Agent Skill 时，必须遵循以下标准：

### 1. 结构契约 (Structure Contract)
所有技能文件存放在 `skills/<skill-name>/SKILL.md`，必须包含标准 YAML Frontmatter：
```markdown
---
name: medprint-report-agent
description: 描述该技能专精的领域场景（如临床化验单折流排版、葡萄城 RDLX 模板迁移、本地小模型槽位填空）
---
```

### 2. 最小化智能体（Pi-Agent）工程范式
* **绝对禁止事项**：**永远不要** 让模型直接输出任意 `x/y` 绝对坐标，永远不要让本地小模型从零生成完整报表 JSON！
* **标准流程**：
  1. **指纹提取 (10ms)**：调用 `DocumentFingerprinter` 提取模态与表格拓扑；
  2. **骨架召回 (99% 置信度)**：调用 `TemplateRetriever` 从黄金标准库召回已闭环验证的 AST 骨架；
  3. **最小化填槽**：模型只负责填写 `patient_info`、`items` 以及 `signatures`，不触碰空间布局；
  4. **几何闭环校验**：由 Rust 几何求解器自动执行行高压缩与单页硬预算守护。

---

## 🔌 本地医院模型部署与 CLI / MCP 接入规范

医院内网物理隔离环境下，通常采用单卡（RTX 3090/4090/A10）部署开源小模型（如 `Qwen2.5-7B-Instruct`、`DeepSeek-R1-Distill-Qwen-7B`）。

### 1. 启动本地推理后端 (Ollama / vLLM)
```bash
# 使用 Ollama 运行本地模型
ollama run qwen2.5:7b

# 或使用 vLLM 启动高性能 OpenAI 兼容服务
python -m vllm.entrypoints.openai.api_server --model Qwen/Qwen2.5-7B-Instruct --port 11434
```

### 2. 使用 CLI 命令行工具进行批量批处理
`@medprint/ai-agent` 提供了开箱即用的命令行工具：
```bash
# 1. 批量将现场旧版葡萄城 RDLX 模板转化为 MedPrint 生产级 AST
pnpm --filter @medprint/ai-agent cli rdlx-parse ./周口骨科医院.rdlx -o ./zhoukou.ast.json

# 2. 将 Word / PDF OCR 纯文本逆向反推为合规 AST
pnpm --filter @medprint/ai-agent cli reverse ./report_ocr.txt -o ./report.ast.json

# 3. 将 AST 提交至 medprint-server 编译为 300 DPI 纯矢量 PDF
pnpm --filter @medprint/ai-agent cli compile ./report.ast.json -o ./report.pdf
```

### 3. 配置 Model Context Protocol (MCP) Server
在 **Cursor** (`.cursor/mcp.json`) 或 **Claude Desktop** (`claude_desktop_config.json`) 中注册 MedPrint MCP：
```json
{
  "mcpServers": {
    "medprint": {
      "command": "node",
      "args": ["D:/Project/medprint/packages/ai-agent/dist/mcp.js"]
    }
  }
}
```
配置后，AI 智能体即可直接调用以下全套核心工具：
* `medprint_parse_rdlx`: 解析葡萄城 ActiveReports XML 报表；
* `medprint_reverse_rag`: 多源文档 RAG 骨架逆向生成；
* `create_medical_template`: 意图驱动生成 A5 双列/PACS/TEG/处方单据；
* `apply_layout_constraints`: 声明式空间避让与对齐约束；
* `optimize_page_compaction`: A5 单页弹性预算微调；
* `calculate_clinical_formula`: eGFR/LDL-C/BMI 临床医学公式计算；
* `verify_compliance`: 医疗三级责任制与防伪合规自动审查。

---

## ⚡ 7 大不可妥协的工程铁律 (Core Invariants)

在修改或扩展本代码库时，所有人与 AI **必须无条件遵守**：

1. **绝对物理微米排版，严禁 DOM/Canvas 栅格化 (No Rasterization)**：
   - 坐标与尺寸必须为物理点或毫米（$1\,\text{pt} \approx 0.352778\,\text{mm}$）；
   - 输出必须是纯矢量 PDF 或物理打印机原始指令，杜绝 `html2canvas` 96 DPI 截图导致的扫码枪拒读。
2. **禁止传统低代码拖拽画布范式 (No Free Drag-and-Drop Canvas)**：
   - 必须通过结构化参数投影，绝对坐标是求解器的**结果**，绝不是**源真相**；
   - 新增视觉元素必须先修改 `crates/medprint-core/src/schema/mod.rs`。
3. **A5 横向双列折流与单页预算硬守卫 (Snaking Table & Budget Guard)**：
   - 左列满折入右列并克隆表头，双列满才分页；
   - 严格执行行高微调与阶梯字号降级，确保整单 100% 紧凑在单张 A5 纸内。
4. **底层打印机硬件双向真实状态监听 (Bi-directional Hardware Spooler)**：
   - 严格监听操作系统物理 Spooler 事件，准确汇报 `PAPER_OUT`、`PAPER_JAM` 与 `JOB_COMPLETED`，杜绝处方发药虚假核销。
5. **高保真医学影像与物理网格 (High-Fidelity Medical Charts)**：
   - TEG 弹力图高精曲线拟合、心电图严格 $1\text{mm} \times 1\text{mm}$ 网格、PACS 影像保持真实比例。
6. **三级法定医疗责任签名链与防伪印章 (Medical Liability Compliance)**：
   - 严格绑定送检、检验、审核三级签名；防伪矢量红章自带微偏转角与正片叠底，严禁遮挡检验数值；严格执行 `KeepWithNext` 防签名孤立跨页。
7. **全场景同构与极简单二进制交付 (Sovereign All-in-One Delivery)**：
   - 20MB 单可执行文件直接内置前端 Web，支持脱机离线开箱即用；
   - 全面兼容信创统信 UOS、银河麒麟，原生适配龙芯 LoongArch64 与飞腾 ARM64。
