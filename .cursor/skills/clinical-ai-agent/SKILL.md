---
name: clinical-ai-agent
description: MedPrint clinical AI agent tool-calling contract. Use when editing packages/ai-agent, DoctorWizard AI chat, DeepSeek/dsh tools, template generation from natural language, compliance checks, or compaction/print dispatch.
---

# 临床 AI Agent 契约

AI **不能**自由改 Vue 或画布坐标。它只能调用工具，工具只能读写封闭 AST 与引擎能力。

## 工具白名单

定义于 `packages/ai-agent/src/tools.ts`：

| 工具 | 作用 | 必须返回 |
| :--- | :--- | :--- |
| `create_medical_template` | 按临床类型生成 `ReportTemplate` | 完整 AST，元素 ∈ 封闭词表 |
| `calculate_clinical_formula` | eGFR / LDL-C / BMI / AG 等 | 数值 + 单位，不发明公式 |
| `optimize_page_compaction` | 询问引擎能否 1 页放下 | 行高建议，不手写坐标 |
| `verify_compliance` | 签名 / 条码 / 印章 / 免责声明 | 问题列表；缺签名或条码则不可打印 |
| `dispatch_silent_print` | 交给 spooler | 真实作业状态，不假装成功 |

前端 Wizard 的 AI 输入必须走同一编译器（`compileClinicalIntent`），禁止再写一套关键词 `if/else` 只切预设、不产出 AST。

## 规划顺序（典型化验单）

1. 必要时 `calculate_clinical_formula`
2. `create_medical_template` 得到 AST
3. `optimize_page_compaction` 校验纸张预算
4. `verify_compliance` 通过后才允许打印工具

## 禁止

- 模型直接输出任意 Vue/HTML/CSS
- 工具返回开放 widget 列表或绝对定位画布 JSON 作为源真相
- 绕过 `verify_compliance` 派发处方/发票打印
