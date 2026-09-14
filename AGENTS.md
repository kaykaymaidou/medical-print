# MedPrint Developer & AI Agent Collaboration Guide (AGENTS.md)

This document is the universal specification and invariant guide for human developers and all AI coding assistants (including **DeepSeek, Claude, Cursor, Copilot, ChatGPT, Codex, and Gemini**).

---

## 🏥 Project Overview & Mission

**MedPrint** is an open-source, next-generation medical report designer and cross-platform printing engine written in **Rust + WebAssembly + Vue 3**.
It solves the core pain points that commercial legacy tools (GrapeCity ActiveReports/SpreadJS, C-Lodop, FastReport) fail to address in hospital clinical settings:
1. **Resolution Degradation**: DOM rasterization blurs采血管 barcodes, ECG grids, and ultrasound images.
2. **Two-Service Deployment Hell**: Needing both a web frontend and an individual Windows print service across thousands of hospital terminals.
3. **A5 Landscape Dual-Column Flow (Snaking Table)**: Filling column 1, then flowing into column 2, with cloned headers and auto 1-page compaction.
4. **Doctor Usability Barrier**: Clinical staff cannot use complex CAD/Photoshop-style coordinate designers.
5. **Loss of Hardware Spooler Status**: False "print success" callbacks causing duplicated or missing prescription/invoice serial numbers.
6. **Lack of Built-in Clinical Formulas**: eGFR, LDL-C, BMI, anion gap, and dynamic demographic reference ranges.
7. **Three-Tier Liability Signatures & Anti-Counterfeiting Seals**: Legal compliance for medical electronic records.

---

## ⚡ 7 Non-Negotiable Engineering Principles (Core Invariants)

When editing or extending code in this repository, all AI agents **MUST** strictly adhere to these seven rules:

### 1. Physical Precision & Vector Direct-Emit (No DOM Rasterization)
- All coordinates, margins, row heights, and font metrics must be stored in absolute physical units (`PhysicalLength::Micrometers` or `PhysicalLength::Millimeters`).
- Never use CSS screen pixels (`px`) for layout computation.
- Output formats must be **pure 300/600 DPI vector PDF** (with embedded TrueType glyphs and vector barcode paths) or raw printer control streams (ESC/P2, TSPL). Never downgrade to `html2canvas` or screen bitmaps.

### 2. Multi-Matrix Delivery & Single All-in-One Binary
- To eliminate deployment friction, the engine must support four delivery channels:
  1. `medprint-server`: A single static Rust binary (with embedded Vue 3 designer via `rust-embed`), serving both Web UI and REST/WebSocket printing APIs.
  2. `packages/extension`: Chrome/Edge extension using `NativeMessaging`, bypassing all local HTTPS certificate and port conflict issues.
  3. `apps/desktop`: Tauri 2.0 cross-platform desktop application (Windows + Xinchuang Linux: UOS / Kylin).
  4. `packages/designer`: Pure WASM npm SDK for seamless embedding into existing Vue 3 / React HIS systems.

### 3. A5 Landscape Dual-Column Snaking Flow
- Medical lab reports primarily target A5 Landscape ($210\text{mm} \times 148\text{mm}$).
- Items fill the left column vertically up to the bottom margin, then snake into the right column with cloned subheaders. A new page is ONLY created when both columns are full.
- Implement **Auto-Compaction**: If 1–2 rows overflow, heuristically adjust line-height and font-size by 5–10% to guarantee fitting onto a single sheet of paper.

### 4. Bi-directional Physical Spooler Hardware Feedback
- The print agent must hook into the OS Print Spooler (Windows `FindNextPrinterChangeNotification` / Winspool API and Linux CUPS / IPP).
- Accurately report: `QUEUED`, `PRINTING`, `PAPER_OUT` (physical out of paper), `PAPER_JAM` (mechanical jam), and `JOB_COMPLETED` (physical sheet fully ejected).

### 5. Dual-Mode UX: Intent Wizard vs AST Review（禁止传统低代码）
- **Doctor Wizard (`DoctorWizard.vue`)**：临床意图表面。选预设、开关模块、对 AI 说自然语言。零拖拽。AI 只能产出封闭 `ReportTemplate` AST。
- **Pro Canvas (`ProCanvas`)**：信息科审查引擎投影框，覆写已有槽位参数（页边距、行高、模块开关）。**不是**开放物料画布，**不是**以自由 `x/y` 为打印源真相。
- 合法链路：临床意图 → AI 工具 → `ReportElement` 有限枚举 → `medprint-core` 物理毫米排版 → Vue 只投影。
- 新增视觉类型必须先改 `crates/medprint-core/src/schema/mod.rs`，禁止只在 Vue 工具箱加按钮。

### 6. High-Fidelity Medical Charts & PACS Imaging
- Native vector calculation for **Thromboelastogram (TEG)** reaction curves ($R, K, \alpha, MA, LY30$).
- Strict **12-lead ECG** $1\text{mm} \times 1\text{mm}$ physical grid.
- **PACS Image Grids** (1, 2, 4, 6 slots) strictly maintaining aspect ratios without stretching, supporting micrometer lesion scales.

### 7. Built-in Clinical Formulas & Compliant Signatures/Seals
- Built-in clinical formula engine: eGFR (CKD-EPI 2021), LDL-C (Friedewald), BMI, Anion Gap, Corrected Calcium, with automatic demographic routing (age, sex, pregnancy) for $\uparrow / \downarrow$ flags.
- Three-tier liability chain: Requesting Physician, Sampling Tech, Lab Operator, Reviewer/Reporter.
- Vector hospital seal with anti-counterfeiting micro-angle jitter and multiply blend mode (must never obscure lab values).
- Enforce `KeepWithNext` pagination policy so signatures and seals never spill alone onto an empty page.

---

## 🏛️ 4-Tier Monorepo Architecture & Responsibilities

```
┌────────────────────────────────────────────────────────────────────────┐
│ Tier 4: Applications (终端展现层)                                      │
│   • packages/designer: Vue 3 Apple Studio (Doctor Wizard + Pro Canvas) │
│   • packages/extension: Chrome / Edge MV3 Native Messaging Extension  │
│   • apps/desktop: Tauri 2.0 Desktop Standalone Application             │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────┴─────────────────────────────────────┐
│ Tier 3: Clinical AI Agent (临床智能体层)                               │
│   • packages/ai-agent: DeepSeek Harness / ReAct Tool Calling Engine    │
│     (模板自主规划合成、A5折流压缩优化、临床合规自动化审查)            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────┴─────────────────────────────────────┐
│ Tier 2: Hardware & Host Services (硬件与宿主服务层)                     │
│   • crates/medprint-spooler: 原生打印机硬件桥接与 Native Messaging 宿主 │
│     (Windows Spooler / Linux CUPS 物理缺纸、卡纸与出纸监听，非 AI)     │
│   • crates/medprint-server: 单二进制独立微服务 (内置 Web 托管与存储)   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────┴─────────────────────────────────────┐
│ Tier 1: Core Domain & Rendering (核心领域与矢量排版层)                 │
│   • crates/medprint-core: 纯物理微米 AST、Snaking 折流、Code128 矢量条码│
│     标准 Type 1 字体矢量 PDF 编译器、临床医学公式。0 平台外部依赖。     │
│   • crates/medprint-wasm: 纯 WebAssembly 导出，无网络离线极速排版与直出 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🤖 DeepSeek Harness & AI Agent Integration

MedPrint is designed to be agentic-ready:
- Exposes standard tool calling interfaces for **DeepSeek Harness (`dsh`)**, OpenAI-compatible function calling, and MCP (Model Context Protocol).
- Allows AI models to generate template ASTs from natural clinical prompts (e.g. "Create an A5 2-column blood routine with ALT/AST highlighted in red").
- Autonomously executes clinical formula calculations and verifies single-page fit.

---

## 💻 Common Commands

```powershell
# Run Cargo checks
cargo check

# Run Frontend Dev Designer
pnpm dev:designer

# Build Frontend Designer
pnpm build:designer

# Build Browser Extension
pnpm build:extension

# Run Standalone Server
cargo run -p medprint-server
```
