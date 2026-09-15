---
name: medprint-report-agent
description: 临床报告单排版、葡萄城 ActiveReports (RDLX) 迁移、RAG 骨架逆向与物理矢量编译核心技能
---

# MedPrint 医疗排版与智能体协作规范技能 (MedPrint Report Agent Skill)

本技能专门指导 AI 编码智能体（DeepSeek Harness、Claude、Cursor、Antigravity、ChatGPT）以及医院私有化本地小模型（Qwen2.5-7B/14B、DeepSeek-R1-Distill-7B/8B）如何在 MedPrint 项目中执行医疗报告单的解析、规划、排版求解与纯矢量渲染。

---

## 🎯 核心使命与铁律 (Core Mission & Invariants)

1. **绝对物理单位与零 DOM 栅格化 (Physical Length Invariant)**：
   - 必须以物理毫米（`mm`）或微米（$\mu\text{m}$）作为排版真相；
   - 严禁输出 CSS 屏幕像素（`px`），严禁使用 `html2canvas` 截图打印，保证条码和心电网格在 300/600/1200 DPI 下绝对清晰；
2. **严禁自由坐标低代码模式 (Intent & Constraint Invariant)**：
   - AI Agent **绝不能** 输出天马行空的自由 `x/y` 绝对坐标；
   - 必须采用“意图分区（Header / Body / Footer）+ 相对几何约束（`apply_layout_constraints`）”；
3. **医院私有化 7B/8B 本地小模型防护律 (Pi-Agent Minimalist Invariant)**：
   - 7B/8B 级别的本地模型不可从零编写数百行复杂 AST（极易发生括号截断与坐标幻觉）；
   - **正确范式**：先提取确定性结构指纹（Fingerprinting） $\rightarrow$ RAG 召回经过数学验证的黄金骨架（Golden Skeleton） $\rightarrow$ 本地小模型仅做极简增量槽位填充（Slot Filling）。

---

## 🛠️ 智能体可用工具链 (Tool Calling Catalog)

智能体可通过 **Model Context Protocol (MCP)**、**DeepSeek Harness (dsh)** 或 **OpenAI-compatible Function Calling** 调用以下工具：

### 1. 葡萄城模板解析 (`medprint_parse_rdlx`)
- **场景**：用户提供了旧系统的 ActiveReports `.rdlx` XML 模板文件。
- **作用**：提取 `PageWidth`、`PageHeight`、`dataset1`（检验明细项）、`dataset2`（患者元数据），15ms 内无损转换为 MedPrint 强类型 AST。
- **参数**：
  ```json
  { "rdlx_xml": "<Report ...>...</Report>" }
  ```

### 2. 异构文档 RAG 逆向生成 (`medprint_reverse_rag`)
- **场景**：用户输入了 Word 表格文本、PDF 识别文本、HIS/LIS 导出的纯文本或医生口述要求。
- **作用**：提取医学结构指纹，从黄金知识库中混合加权召回最匹配的骨架（A5横向双列折流、A5生化18项、TEG曲线图、PACS双图等），并执行槽位填充。
- **参数**：
  ```json
  { "raw_content": "全血细胞分析报告单 姓名:李四 WBC 11.5 10^9/L ..." }
  ```

### 3. 几何空间约束定义 (`apply_layout_constraints`)
- **场景**：需要为特定元素配置空间锚定、相对对齐或避让行为。
- **参数**：
  - `target_element`: `'logo' | 'barcode' | 'chart' | 'table' | 'signatures'`
  - `anchor_position`: `'TopLeft' | 'BottomRight' | 'TopCenter' ...`
  - `obstacle_avoidance`: `{ is_obstacle: true, safe_padding_mm: 2.0, flow_behavior: 'AvoidAndNarrow' }`
  - `page_budget`: `'SinglePageHard' | 'SinglePageSoft'`

### 4. 单页预算与折流微调 (`optimize_page_compaction`)
- **场景**：化验项超出常规容量（如 18~24 项）。
- **作用**：检查可用净高度，自动执行行高弹性压缩（5.5mm $\rightarrow$ 4.8mm），确保整单 100% 紧凑在单张 A5 纸内，防止医生责任签名孤立跨页。

### 5. 纯矢量 PDF 即时编译 (`POST /api/v1/render/compile_pdf`)
- **场景**：将 AST 发送至 `medprint-server`（Rust 内核）编译直出纯矢量 PDF 字节流。

---

## 💻 CLI 与 MCP 本地模型接入快速指南

### 1. CLI 批量处理
```bash
# 解析现存葡萄城 RDLX 模板
pnpm --filter @medprint/ai-agent cli rdlx-parse ./template.rdlx -o ./template.ast.json

# 逆向生成任意文本报告
pnpm --filter @medprint/ai-agent cli reverse ./report_ocr.txt -o ./output.json

# 调用本地 Rust 引擎编译出 300 DPI 纯矢量 PDF
pnpm --filter @medprint/ai-agent cli compile ./output.json -o ./report.pdf
```

### 2. 作为 MCP Server 供本地模型 (Ollama / vLLM) 调度
在 Cursor、Claude Desktop 或院内私有 Agent 平台的 `mcpServers` 配置中增加：
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
本地模型即可自主通过标准 JSON-RPC 协议调用 `medprint_parse_rdlx` 和 `medprint_reverse_rag` 完成医疗排版！
