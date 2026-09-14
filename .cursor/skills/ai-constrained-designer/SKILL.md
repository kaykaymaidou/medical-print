---
name: ai-constrained-designer
description: Constrains MedPrint designer so it never becomes a traditional low-code builder. Use when editing DoctorWizard, ProCanvas, designer toolbox/inspector, template JSON, ReportElement, or when adding UI widgets, drag-drop, expressions, or canvas tools.
---

# AI 约束设计器（产品约束，不是代码冻死）

MedPrint **不是** Grapecity / FineReport 式开放低代码，但也不是「标题只能居中、患者条不能改」的死模板。

约束放在**产品词表与合规**上：组件种类封闭、打印几何归引擎；槽位内部参数、字段目录、文档流顺序应对信息科足够灵活。

## 唯一合法数据流

```
临床意图（自然语言 / Wizard 开关 / 预设 / 图片）
        ↓
AI Agent（只能调用 MEDPRINT_TOOLS，产出 AST patch）
        ↓
封闭 ReportTemplate AST（Rust `ReportElement` 有限枚举）
        ↓
Rust 排版引擎（折流 / 压缩 / KeepWithNext / 物理毫米）
        ↓
矢量 PDF / ESC/P2 / TSPL
        ↓
Vue 设计器（投影 AST；允许拖封闭槽位改文档流顺序）
```

打印几何的源真相仍是引擎。画布上的绝对 `x/y` **不是**打印源真相；拖动封闭槽位只改 **AST 元素顺序**，松手后由引擎重算毫米框。

## 双轨职责

| 表面 | 谁用 | 允许 | 禁止 |
| :--- | :--- | :--- | :--- |
| Doctor Wizard | 医生 / 护士长 | 预设、模块开关、意图/识图、页眉与患者字段等常用 AST 覆写 | 开放物料市场、自由表达式 |
| Pro Canvas | 医院信息科 | 拖封闭槽位改文档流、覆写槽位参数（对齐/院徽/报告单号/患者字段目录/行高/列比…） | 任意新控件类型、事件绑定、以自由坐标为模板源 |

详细禁用清单见 [forbidden.md](forbidden.md)。槽位与词表见 skill `template-ast`。

## 灵活 vs 开放（产品边界）

**允许（在封闭槽位内）：**

- `HospitalHeader`：左/中/右对齐、院徽图标、报告单号标签与预览值
- `PatientBanner`：从临床字段目录增删改排序；允许少量「自定义」标签字段
- `SnakingTable`：行项目增删、左右列宽比、行高；列数仍由产品定为双列折流
- 槽位上下拖 / 上移下移：改 `elements[]` 顺序，引擎重排

**仍禁止：**

- 工具箱发明未进 Rust `ReportElement` 的新控件
- 把自由画点坐标导出为打印源
- 通用表达式、工作流、自定义组件上传协议

## 做功能前先问

1. 能否用「已有 `ReportElement` 的字段 / 参数」表达？能则**扩展该槽位参数**，不要新开开放控件。
2. 若必须新视觉类型：先改 Rust schema + 引擎，再投影到 UI。
3. 用户拖组件：只允许封闭槽位；导出必须仍是 AST + 引擎框。

## 实现检查

- [ ] 新能力映射到已有或已扩展的 `ReportElement` 字段
- [ ] 未新增开放式 widget / 表达式 / 工作流协议
- [ ] 布局计算未使用 CSS `px` 作为打印度量
- [ ] AI 路径产出 `ReportTemplate` JSON，不是一串绝对坐标
- [ ] 合规项由约束器检查（签名链、条码等）
