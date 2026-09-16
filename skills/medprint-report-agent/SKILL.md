---
name: medprint-report-agent
description: 临床报告单排版、葡萄城 ActiveReports (RDLX) 迁移、RAG 骨架逆向与物理矢量编译核心技能
---

# MedPrint 医疗排版与智能体协作规范技能 (MedPrint Report Agent Skill)

本技能指导 AI 编码智能体（DeepSeek Harness、Claude、Cursor、Antigravity）以及本地部署开源模型（如 Qwen2.5、DeepSeek-R1 系列）在 MedPrint 项目中执行医疗报告单的解析、规划、排版求解与纯矢量渲染。

---

## 核心设计准则与约束 (Core Invariants)

1. **绝对物理单位基准 (Physical Length Invariant)**：
   - 全程以物理毫米（`mm`）或微米（$\mu\text{m}$）作为排版单位；
   - 杜绝依赖 DOM/Canvas 栅格化（如 `html2canvas` 截图），确保条形码与网格在高 DPI 输出下边缘锐利。
2. **结构化槽位与几何约束 (Intent & Constraint Invariant)**：
   - 避免生成任意无约束的绝对坐标；
   - 采用“分区槽位（Header / Patient / Table / Signatures）+ 几何约束（对齐、避让、折流）”定义版面。
3. **本地模型两阶段逆向 (Two-stage Reverse Generation)**：
   - 针对 7B/14B 等端侧模型输出较长 JSON 易截断的特点，采用“确定性指纹抽取 $\rightarrow$ 黄金骨架知识库检索 $\rightarrow$ 槽位实体填充”流程，提高结构稳定性。

---

## 智能体可用工具链 (Tool Catalog)

智能体可通过 **Model Context Protocol (MCP)**、**DeepSeek Harness (dsh)** 或标准 Tool Calling 调用以下工具：

### 1. 葡萄城模板解析 (`medprint_parse_rdlx`)
- **场景**：输入 ActiveReports `.rdlx` XML 模板文件。
- **功能**：提取页面尺寸、页边距、`dataset1`（检验明细项）及 `dataset2`（患者字段），转换为 MedPrint 声明式 AST。
- **参数**：
  ```json
  { "rdlx_xml": "<Report ...>...</Report>" }
  ```

### 2. 异构文档 RAG 逆向 (`medprint_reverse_rag`)
- **场景**：输入 Word 表格文本、PDF 识别文本或结构化数据字符串。
- **功能**：提取医学拓扑指纹，从黄金知识库中加权召回匹配骨架并填充实体槽位。
- **参数**：
  ```json
  { "raw_content": "全血细胞分析报告单 姓名:李四 WBC 11.5 10^9/L ..." }
  ```

### 3. 几何空间约束定义 (`apply_layout_constraints`)
- **场景**：为特定元素配置空间锚定、对齐或障碍物避让策略。
- **参数**：
  - `target_element`: `'logo' | 'barcode' | 'chart' | 'table' | 'signatures'`
  - `anchor_position`: `'TopLeft' | 'BottomRight' | 'TopCenter' ...`
  - `obstacle_avoidance`: `{ is_obstacle: true, safe_padding_mm: 2.0, flow_behavior: 'AvoidAndNarrow' }`
  - `page_budget`: `'SinglePageHard' | 'SinglePageSoft'`

### 4. 单页预算与折流微调 (`optimize_page_compaction`)
- **场景**：检测表格项目数量与可用纸张净高度，微调行高或启用双列折流以控制在单页内排布。

### 5. 纯矢量 PDF 编译 (`POST /api/v1/render/compile_pdf`)
- **场景**：将 AST 发送至 `medprint-server`（Rust 引擎）编译输出纯矢量 PDF 字节流。

---

## CLI 与 MCP 接入指南

### 1. CLI 批量处理
```bash
# 解析现存葡萄城 RDLX 模板
pnpm --filter @medprint/ai-agent cli rdlx-parse ./template.rdlx -o ./template.ast.json

# 逆向生成报告 AST
pnpm --filter @medprint/ai-agent cli reverse ./report_ocr.txt -o ./output.json

# 编译生成 300 DPI 纯矢量 PDF
pnpm --filter @medprint/ai-agent cli compile ./output.json -o ./report.pdf
```

### 2. MCP Server 配置
在 Cursor (`.cursor/mcp.json`) 或 Claude Desktop (`claude_desktop_config.json`) 中添加：
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
配置后，客户端即可直接调度 MedPrint 工具集执行模板解析与排版生成。
