---
name: physical-layout
description: Physical millimeter/micrometer layout invariants for MedPrint. Use when touching coordinates, paper size, snaking tables, compaction, PDF/WASM export, canvas zoom, rulers, or any CSS sizing that might affect print layout.
---

# 物理排版不变量

## 单位

- 计算与存储：`PhysicalLength` 微米整数（`crates/medprint-core/src/units.rs`）
- 对外：毫米。1 mm = 1000 µm；1 pt ≈ 352.778 µm
- 禁止用 CSS `px` 做打印布局运算。屏幕预览可以把 mm 换成 px（当前预览系数约 3.7795 px/mm @96DPI），但导出/打印不得走这条链路

## 输出

- 300/600 DPI 纯矢量 PDF，或 ESC/P2 / TSPL
- 条码是矢量路径，不是位图
- 禁止 `html2canvas`、截图、DOM 栅格化

## A5 双列折流

`SnakingTableEngine`：左列自上而下排满 → 折入右列并克隆表头 → 两列都满才分页。溢出 1–4 行且可读性 ≥ 原行高 80% 时 Auto-Compaction 微调行高，尽量 1 页。

签名与印章：`PageBreakPolicy::KeepWithNext`，禁止单独落到空白页。

## 设计器含义

Wizard / Canvas 上的纸张是 **210mm×148mm 的投影**，不是 CSS 画板。改行高、边距只改 AST/引擎输入。
