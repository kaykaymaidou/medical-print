# MedPrint 开发者与 AI 协作规范指南 (AGENTS.md)

本文件是 MedPrint 项目的架构设计规约、核心不变式及 AI 辅助编码（DeepSeek Harness、Claude、Cursor、Antigravity 等）的执行指南。

---

## 业务背景与系统定位

MedPrint 面向医疗健康与高精单据打印排版，采用 **Rust + WebAssembly + Vue 3 + RAG/Pi-Agent** 架构。

### 传统医疗报表系统 (ActiveReports / C-Lodop / FastReport) 的痛点与改进
1. **绝对坐标硬编码与模板冗余**：传统 RDLX 报表对每个元素使用绝对坐标配置，遇版式微调或图表插入时无法自适应避让，容易导致模板文件急剧膨胀；
2. **商业闭源授权依赖**：依赖 `licenses.licx` 等商业授权凭据，内网脱机环境下存在证书失效风险；
3. **平台与信创环境兼容性**：传统方案强依赖 Windows GDI+ 与 .NET Framework，难以原生适配国产信创操作系统（统信 UOS、银河麒麟）及 ARM64/LoongArch 芯片；
4. **分页控制与签名断裂**：多项目溢出时机械切页，易导致医师责任签名跨页孤立打印；
5. **DOM 栅格化失真**：通过 HTML 截图打印易导致条码边缘模糊，影响扫码设备识别率。

### 本工程技术实现：
- **ActiveReports (RDLX) 模板解析**：提供 `rdlxParser.ts`，解析 `dataset1`（检验明细）与 `dataset2`（患者元数据），转换为声明式 AST；
- **小参数本地模型两阶段逆向**：针对端侧 7B/14B 模型处理长 JSON 的稳定性问题，采用“结构指纹抽取 $\rightarrow$ 黄金骨架知识库检索 $\rightarrow$ 增量槽位填充”方案；
- **MCP (Model Context Protocol) 与 CLI 工具支持**：提供 `medprint-mcp` 服务与 `medprint-cli` 命令行工具；
- **单二进制与浏览器 WASM 双轨交付**：提供独立编译的微服务及纯前端 WASM 排版运行库。

---

## 模块全景与代码职责划分

修改或扩展代码时，请遵守以下目录职责划分与单一事实源（Source of Truth）：

```
medprint/
├── crates/
│   ├── medprint-core/                  # 核心物理排版与 PDF 编译层 (Rust)
│   │   ├── src/schema/mod.rs           # 报表 AST 物理模型定义 (新增排版元素须先定义于此)
│   │   ├── src/pdf/mod.rs              # 矢量 PDF 动态编译器 (%PDF-1.4, ISO 15417 Code 128, Type 1 字体)
│   │   ├── src/layout/mod.rs           # A5 横向双列折流算法 (Snaking Table) 与单页预算守卫
│   │   └── src/formula/mod.rs          # 临床医学公式引擎 (eGFR, LDL-C, BMI, Anion Gap)
│   ├── medprint-wasm/                  # 浏览器前端 WASM 桥接层
│   │   └── src/lib.rs                  # wasm-bindgen 导出接口
│   ├── medprint-server/                # 独立微服务层
│   │   └── src/main.rs                 # 单可执行文件微服务，内置静态资源托管、REST API 与离线存储
│   └── medprint-spooler/               # 硬件打印状态监听层
│       └── src/lib.rs                  # 操作系统 Spooler 事件捕获 (缺纸、卡纸、作业完成)
│
├── packages/
│   ├── ai-agent/                       # 临床 AI 智能体与工具链 (TypeScript)
│   │   ├── src/rag/
│   │   │   ├── rdlxParser.ts           # ActiveReports XML (.rdlx) 解析器
│   │   │   ├── fingerprinter.ts        # 文档结构指纹抽取器
│   │   │   ├── knowledgeBase.ts        # 黄金排版骨架知识库 (A5双列、生化、TEG、超声等)
│   │   │   ├── retriever.ts            # 多维加权 RAG 检索器
│   │   │   └── slotFiller.ts           # 槽位填充器与单页弹性压缩守卫
│   │   ├── src/tools.ts                # 工具注册表 (create_medical_template, medprint_parse_rdlx 等)
│   │   ├── src/mcp.ts                  # Model Context Protocol (MCP) JSON-RPC 2.0 stdio 服务端
│   │   ├── src/cli.ts                  # medprint-cli 命令行工具
│   │   └── src/provider.ts             # 模型接口封装 (Ollama, vLLM, LMStudio, DeepSeek 等)
│   │
│   ├── designer/                       # Vue 3 医疗设计器
│   │   ├── src/views/DoctorWizard.vue  # 向导配置视图
│   │   ├── src/views/ProCanvas.vue     # 画布视图与参数检查器
│   │   ├── src/components/common/      # RagReverseModal, ArchiveModal, BatchPrintModal 等弹窗
│   │   └── src/domain/                 # 模板 AST 与 RAG 领域逻辑
│   │
│   └── extension/                      # 浏览器扩展 (Native Messaging)
│
├── skills/
│   └── medprint-report-agent/SKILL.md  # 智能排版与调度规范
│
└── docs/                               # 白皮书与架构设计文档
```

---

## AI 技能 (Skills) 编写与执行规范

### 1. 结构规范
技能文件统一维护于 `skills/<skill-name>/SKILL.md`，包含标准 YAML Frontmatter：
```markdown
---
name: medprint-report-agent
description: 描述技能适用场景 (如临床化验单折流排版、RDLX 模板迁移等)
---
```

### 2. 槽位提取与模板填充规范
* **避免直接输出自由绝对坐标**；
* **执行步骤**：
  1. **指纹提取**：调用 `DocumentFingerprinter` 提取模态与表格列结构；
  2. **骨架召回**：调用 `TemplateRetriever` 从预置知识库召回已验证的 AST 骨架；
  3. **槽位填充**：提取 `patient_info`、`items` 以及 `signatures` 字段，不直接修改底层几何排版；
  4. **几何校验**：通过求解器校验行高与单页预算。

---

## 本地模型部署与 CLI / MCP 配置

### 1. 本地模型推理服务启动 (Ollama / vLLM)
```bash
# Ollama 方式
ollama run qwen2.5:7b

# vLLM 启动兼容接口
python -m vllm.entrypoints.openai.api_server --model Qwen/Qwen2.5-7B-Instruct --port 11434
```

### 2. CLI 命令行批量处理
```bash
# 解析现存旧版葡萄城 RDLX 模板
pnpm --filter @medprint/ai-agent cli rdlx-parse ./template.rdlx -o ./output.ast.json

# 非结构化文本逆向生成 AST
pnpm --filter @medprint/ai-agent cli reverse ./report_ocr.txt -o ./output.ast.json

# 编译为 300 DPI 矢量 PDF
pnpm --filter @medprint/ai-agent cli compile ./output.ast.json -o ./report.pdf
```

### 3. Model Context Protocol (MCP) 配置
在 `.cursor/mcp.json` 或 `claude_desktop_config.json` 中配置：
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
配置后支持调用的核心工具：
* `medprint_parse_rdlx`: 解析 ActiveReports XML 报表；
* `medprint_reverse_rag`: 多源文档 RAG 骨架逆向生成；
* `create_medical_template`: 意图驱动生成 A5 双列/PACS/TEG/处方模板；
* `apply_layout_constraints`: 声明式空间避让与对齐约束；
* `optimize_page_compaction`: A5 单页预算微调；
* `calculate_clinical_formula`: eGFR/LDL-C/BMI 等临床公式计算；
* `verify_compliance`: 签名链与要素完整性审查。

---

## 核心设计准则 (Core Invariants)

维护本工程代码时，请遵守以下设计原则：

1. **绝对物理单位基准**：
   - 排版以物理点或毫米为基准（$1\,\text{pt} \approx 0.352778\,\text{mm}$）；
   - 输出纯矢量 PDF 或打印机原始指令，避免 DOM 截图方案。
2. **参数化约束驱动布局**：
   - 采用结构化约束与求解器计算绝对坐标，绝对坐标为求解器输出结果而非唯一事实源；
   - 扩展视觉元素时优先在 `crates/medprint-core/src/schema/mod.rs` 中增补定义。
3. **A5 双列折流与单页控制**：
   - 左列排满后折入右列并克隆表头，双列均满再执行切页；
   - 配合行高与字号阶梯策略，保持常规化验单在单页内完整排布。
4. **底层硬件状态监听**：
   - 监听操作系统 Spooler 硬件事件（`PAPER_OUT`、`PAPER_JAM`、`JOB_COMPLETED`）。
5. **高保真医学图形与物理网格**：
   - TEG 弹力图曲线拟合、心电图 $1\text{mm} \times 1\text{mm}$ 物理网格、PACS 影像保持原始宽高比。
6. **签名链与要素合规**：
   - 保障送检、检验、审核责任签名完整，签名区块与表格保持紧邻绑定以避免跨页断裂。
7. **跨平台与单二进制交付**：
   - 支持独立单二进制运行及浏览器纯前端 WASM 运行；
   - 兼容主流 Linux 发行版与国产操作系统（统信 UOS、银河麒麟）。
