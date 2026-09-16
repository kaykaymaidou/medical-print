# @medprint/ai-agent

**MedPrint AI 医疗排版 Agent 与 DeepSeek Harness (`dsh`) / MCP 集成包**

*Medical Report Agent & Tool Plugin for DeepSeek Harness, Claude, Cursor, Antigravity & OpenAI-compatible Models*

---

## 功能特性

通过标准 Tool Calling 与 MCP 协议，将 MedPrint 核心排版引擎的能力暴露给上层模型与智能体应用：

1. **医疗报告模板生成 (`create_medical_template`)**：根据结构化需求或语义描述，生成符合医疗规范的封闭 AST，支持 A5 横向双列折流、PACS 多联影像及处方笺；
2. **临床医学公式计算 (`calculate_clinical_formula`)**：解析输入指标，调用内核执行 eGFR (CKD-EPI 2021)、LDL-C、BMI 等公式计算并评估参考区间状态；
3. **单页预算自适应微调 (`optimize_page_compaction`)**：评估纸张净高度，微调行高与字号阶梯，确保在物理单页内排布；
4. **底层打印状态监控 (`dispatch_silent_print`)**：对接 Spooler 打印队列，提供缺纸、卡纸与任务完成状态反馈；
5. **葡萄城 ActiveReports XML 解析 (`medprint_parse_rdlx`)**：解析旧版 `.rdlx` 模板中的 `dataset1` / `dataset2` 并映射为 MedPrint AST；
6. **多源文档 RAG 逆向 (`medprint_reverse_rag`)**：基于结构指纹与黄金骨架检索，完成非结构化文本的槽位提取与排版重建。

---

## Model Context Protocol (MCP) 配置

本包内置符合 JSON-RPC 2.0 规范的 stdio MCP 服务端，可直接接入支持 MCP 的平台：

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

---

## DeepSeek Harness (`dsh`) 集成

在 `dsh.config.json` 或自定义脚本中注册工具集：

```typescript
import { MEDPRINT_TOOLS, MedPrintToolExecutor } from '@medprint/ai-agent'

export default {
  plugins: [
    {
      name: 'medprint-medical-printer',
      tools: MEDPRINT_TOOLS,
      handler: async ({ tool, args }) => {
        return await MedPrintToolExecutor.executeTool(tool, args)
      }
    }
  ]
}
```

---

## CLI 命令行用法

```bash
# 启动 MCP 服务
pnpm --filter @medprint/ai-agent cli mcp

# 解析旧版葡萄城 RDLX 模板
pnpm --filter @medprint/ai-agent cli rdlx-parse ./template.rdlx -o ./template.ast.json

# 逆向生成 AST
pnpm --filter @medprint/ai-agent cli reverse ./report_ocr.txt -o ./output.json

# 绑定运行时数据并渲染为矢量 PDF
pnpm --filter @medprint/ai-agent cli render ./template.ast.json ./data.json -o ./report.pdf
```
