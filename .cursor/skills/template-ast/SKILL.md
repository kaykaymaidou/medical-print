---
name: template-ast
description: Closed medical ReportTemplate AST vocabulary for MedPrint. Use when adding report elements, template JSON, ProCanvas toolbox items, Wizard presets, WASM/schema types, or syncing TypeScript with crates/medprint-core/src/schema.
---

# 封闭模板 AST

权威定义：`crates/medprint-core/src/schema/mod.rs`。前端 TypeScript 镜像：`packages/designer/src/domain/reportAst.ts`。两边必须同构，禁止只改一侧。

## 词表（禁止私自扩展 UI）

`ReportElement` 仅允许：

- `HospitalHeader`
- `PatientBanner`
- `SnakingTable`（A5 双列折流，LIS 默认）
- `TegCurveChart`
- `PacsGrid`
- `Signatures`（三级责任链）
- `Seal`（防伪红章）
- `NotesFooter`

`MedicalReportType` 仅允许：LIS 生化双列、PACS、ECG、门诊处方、住院三联单、TEG。

新增变体流程：Rust schema → 引擎布局/PDF → WASM 导出 → TS `reportAst.ts` → Wizard 投影 / Canvas 槽位。禁止倒过来。

完整字段与纸张见 [schema-reference.md](schema-reference.md)。

## 槽位 vs 自由坐标

AST **不**把每个控件的绝对 x/y 当作一等公民。元素是语义槽位，由引擎按纸张、边距、折流、KeepWithNext 计算物理框。

信息科可覆写槽位参数（对齐、院徽、报告单号、患者字段目录、`row_height_mm`、`margins`…），也可拖封闭槽位改变 `elements` 顺序。禁止把自由画点坐标当成打印源。

## JSON 导出

设计器导入/导出必须是 `ReportTemplate`（`.medprint.json`），不要把 ProCanvas 内部 `CanvasElement[]` 当成交换格式。预览层坐标可存在 `preview_frames`（可选、非打印源）。
