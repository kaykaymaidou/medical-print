# ReportTemplate 字段参考

与 `crates/medprint-core/src/schema/mod.rs` 对齐。

## ReportTemplate

| 字段 | 含义 |
| :--- | :--- |
| `id` | 模板 id |
| `name` | 显示名 |
| `version` | 模板版本字符串 |
| `paper_size` | `{ width_mm, height_mm }`，内部存储微米 |
| `margins` | 上右下左，毫米 |
| `report_type` | `MedicalReportType` |
| `elements` | `ReportElement[]` 有序列表（文档流顺序） |

## 纸张预设

- A5 横向：210 × 148 mm（化验单默认）
- A4 纵向：210 × 297 mm
- A4 横向：297 × 210 mm

## 关键元素字段

- `HospitalHeader`：`align` left/center/right，可选 `logo_data_url`，`show_report_no` + 编号标签
- `PatientBanner`：`include_barcode`，`fields[]` 有序字段（姓名/门诊号/报告单号等临床目录，可自定义标签）
- `SnakingTable`：`columns_count` 默认 2，`column_gap`，`left_ratio` 默认 0.5，`items: LabItemRow[]`
- `PacsGrid`：`grid_cols` × `grid_rows` ∈ {1,2,4,6 槽}，`show_scale_ruler`，禁止拉伸
- `Seal`：`diameter_mm`，`angle_jitter_deg`，`opacity`，正片叠底
- `Signatures`：送检 / 采样 / 操作 / 审核 + 报告日期；分页策略 KeepWithNext

## LabItemRow

`index, item_name, item_abbr, result_value, unit, ref_range_display, alert_flag, is_critical`

`alert_flag`：`Normal | High | Low | Critical`
