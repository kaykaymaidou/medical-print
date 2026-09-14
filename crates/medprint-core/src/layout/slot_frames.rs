//! 封闭 AST 槽位框排版：由引擎计算物理毫米框，供设计器投影。
//!
//! 打印几何的源真相在这里，不在画布拖拽坐标。
//! Seal 为叠放层；Signatures / NotesFooter 使用 KeepWithNext，不单独落到空白页。

use crate::layout::snaking_table::SnakingTableEngine;
use crate::schema::{AlertFlag, LabItemRow};
use crate::units::{Margins, PhysicalLength, PhysicalSize};
use serde::{Deserialize, Serialize};

const GAP_UM: u32 = 1_000;
const HEADER_H_UM: u32 = 14_000;
const BANNER_H_UM: u32 = 10_000;
const TEG_H_UM: u32 = 36_000;
const NOTES_H_UM: u32 = 7_000;
const SIG_H_UM: u32 = 12_000;
const SIG_W_UM: u32 = 140_000;
const SNAKING_HEADER_UM: u32 = 6_500;
const SNAKING_ROW_DEFAULT_UM: u32 = 5_500;
const SNAKING_EMPTY_H_UM: u32 = 40_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum SlotKind {
    HospitalHeader,
    PatientBanner,
    SnakingTable,
    TegCurveChart,
    PacsGrid,
    Signatures,
    Seal,
    NotesFooter,
}

impl SlotKind {
    pub fn parse(name: &str) -> Option<Self> {
        match name {
            "HospitalHeader" => Some(Self::HospitalHeader),
            "PatientBanner" => Some(Self::PatientBanner),
            "SnakingTable" => Some(Self::SnakingTable),
            "TegCurveChart" => Some(Self::TegCurveChart),
            "PacsGrid" => Some(Self::PacsGrid),
            "Signatures" => Some(Self::Signatures),
            "Seal" => Some(Self::Seal),
            "NotesFooter" => Some(Self::NotesFooter),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::HospitalHeader => "HospitalHeader",
            Self::PatientBanner => "PatientBanner",
            Self::SnakingTable => "SnakingTable",
            Self::TegCurveChart => "TegCurveChart",
            Self::PacsGrid => "PacsGrid",
            Self::Signatures => "Signatures",
            Self::Seal => "Seal",
            Self::NotesFooter => "NotesFooter",
        }
    }

    fn is_overlay(self) -> bool {
        matches!(self, Self::Seal)
    }

    fn keep_with_next(self) -> bool {
        matches!(self, Self::Signatures | Self::Seal | Self::NotesFooter)
    }
}

const FLOW_ORDER: [SlotKind; 5] = [
    SlotKind::HospitalHeader,
    SlotKind::PatientBanner,
    SlotKind::TegCurveChart,
    SlotKind::PacsGrid,
    SlotKind::SnakingTable,
];

const FOOTER_ORDER: [SlotKind; 2] = [SlotKind::NotesFooter, SlotKind::Signatures];

#[derive(Debug, Clone)]
pub struct SlotLayoutSpec {
    pub index: usize,
    pub kind: SlotKind,
    pub row_height: PhysicalLength,
    pub auto_compaction: bool,
    pub item_count: usize,
    pub diameter: PhysicalLength,
    pub grid_cols: usize,
    pub grid_rows: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlotFrame {
    pub element_index: usize,
    pub kind: String,
    pub x_mm: f32,
    pub y_mm: f32,
    pub width_mm: f32,
    pub height_mm: f32,
    pub page: usize,
    pub overlay: bool,
    pub keep_with_next: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlotLayoutResult {
    pub frames: Vec<SlotFrame>,
    pub page_count: usize,
    pub compacted_row_height_mm: Option<f32>,
    pub unique_kind_errors: Vec<String>,
}

pub struct SlotLayoutEngine;

impl SlotLayoutEngine {
    pub fn layout(
        paper: PhysicalSize,
        margins: Margins,
        specs: &[SlotLayoutSpec],
    ) -> SlotLayoutResult {
        let mut unique_kind_errors = Vec::new();
        let mut first_of_kind: Vec<SlotLayoutSpec> = Vec::new();
        let mut seen = std::collections::HashSet::new();
        for spec in specs {
            if !seen.insert(spec.kind) {
                unique_kind_errors.push(format!(
                    "槽位 {} 重复，已忽略后续实例。每类 ReportElement 只能出现一次",
                    spec.kind.as_str()
                ));
                continue;
            }
            first_of_kind.push(spec.clone());
        }

        let left = margins.left.as_um();
        let right = margins.right.as_um();
        let top = margins.top.as_um();
        let bottom_m = margins.bottom.as_um();
        let paper_w = paper.width.as_um();
        let paper_h = paper.height.as_um();
        let flow_w = paper_w.saturating_sub(left + right);
        let content_bottom = paper_h.saturating_sub(bottom_m);

        let footer: Vec<&SlotLayoutSpec> = FOOTER_ORDER
            .iter()
            .filter_map(|k| first_of_kind.iter().find(|s| s.kind == *k))
            .collect();
        let flow: Vec<&SlotLayoutSpec> = FLOW_ORDER
            .iter()
            .filter_map(|k| first_of_kind.iter().find(|s| s.kind == *k))
            .collect();
        let seal = first_of_kind.iter().find(|s| s.kind == SlotKind::Seal);

        let footer_h = footer_stack_height(&footer);
        let flow_gaps = if flow.len() > 1 {
            GAP_UM * (flow.len() as u32 - 1)
        } else {
            0
        };
        let gap_before_footer = if flow.is_empty() || footer.is_empty() {
            0
        } else {
            GAP_UM
        };

        let flex_kind = if flow.iter().any(|s| s.kind == SlotKind::SnakingTable) {
            Some(SlotKind::SnakingTable)
        } else if flow.iter().any(|s| s.kind == SlotKind::PacsGrid) {
            Some(SlotKind::PacsGrid)
        } else {
            None
        };

        let mut fixed_flow_h = 0_u32;
        for spec in &flow {
            if Some(spec.kind) == flex_kind {
                continue;
            }
            fixed_flow_h += intrinsic_height(spec, flow_w);
        }
        let remaining = content_bottom.saturating_sub(
            top + fixed_flow_h + flow_gaps + gap_before_footer + footer_h,
        );

        let mut compacted_row_height_mm = None;
        let mut page_count = 1_usize;
        let mut snaking_h = remaining;

        if let Some(table) = flow.iter().find(|s| s.kind == SlotKind::SnakingTable) {
            let (h, pages, row_mm) = snaking_frame_height(table, remaining);
            snaking_h = h.min(remaining.max(1));
            page_count = pages.max(1);
            compacted_row_height_mm = row_mm;
        }

        let mut frames = Vec::new();
        let mut cursor = top;
        for spec in &flow {
            let h = if Some(spec.kind) == flex_kind {
                if spec.kind == SlotKind::SnakingTable {
                    snaking_h
                } else {
                    remaining.max(intrinsic_height(spec, flow_w))
                }
            } else {
                intrinsic_height(spec, flow_w)
            };
            frames.push(frame(spec, left, cursor, flow_w, h, 1));
            cursor += h + GAP_UM;
        }

        if page_count == 1 {
            let mut footer_cursor = cursor;
            if !flow.is_empty() && !footer.is_empty() && footer_cursor + footer_h > content_bottom {
                footer_cursor = content_bottom.saturating_sub(footer_h);
            }
            for spec in &footer {
                let h = footer_height(spec.kind);
                let w = if spec.kind == SlotKind::Signatures {
                    SIG_W_UM.min(flow_w)
                } else {
                    flow_w
                };
                frames.push(frame(spec, left, footer_cursor, w, h, 1));
                footer_cursor += h + GAP_UM;
            }
        } else {
            // 折流多页：页脚与印章必须跟最后一页内容，禁止单独落到空白页
            let mut footer_cursor = top;
            for spec in &footer {
                let h = footer_height(spec.kind);
                let w = if spec.kind == SlotKind::Signatures {
                    SIG_W_UM.min(flow_w)
                } else {
                    flow_w
                };
                frames.push(frame(spec, left, footer_cursor, w, h, page_count));
                footer_cursor += h + GAP_UM;
            }
        }

        if let Some(spec) = seal {
            let d = spec.diameter.as_um().max(24_000);
            let sig = frames.iter().find(|f| f.kind == "Signatures");
            let (x, y, page) = if let Some(sig) = sig {
                let sig_y = (sig.y_mm * 1000.0).round() as u32;
                let sig_h = (sig.height_mm * 1000.0).round() as u32;
                let x = paper_w.saturating_sub(right + d);
                let y = sig_y + sig_h.saturating_sub(d * 70 / 100);
                (x, y, sig.page)
            } else {
                (
                    paper_w.saturating_sub(right + d),
                    content_bottom.saturating_sub(d),
                    page_count,
                )
            };
            frames.push(frame(spec, x, y, d, d, page));
        }

        SlotLayoutResult {
            frames,
            page_count,
            compacted_row_height_mm,
            unique_kind_errors,
        }
    }
}

fn footer_height(kind: SlotKind) -> u32 {
    match kind {
        SlotKind::NotesFooter => NOTES_H_UM,
        SlotKind::Signatures => SIG_H_UM,
        _ => 0,
    }
}

fn footer_stack_height(footer: &[&SlotLayoutSpec]) -> u32 {
    if footer.is_empty() {
        return 0;
    }
    let mut h = 0;
    for spec in footer {
        h += footer_height(spec.kind);
    }
    if footer.len() > 1 {
        h += GAP_UM * (footer.len() as u32 - 1);
    }
    h
}

fn intrinsic_height(spec: &SlotLayoutSpec, flow_w: u32) -> u32 {
    match spec.kind {
        SlotKind::HospitalHeader => HEADER_H_UM,
        SlotKind::PatientBanner => BANNER_H_UM,
        SlotKind::TegCurveChart => TEG_H_UM,
        SlotKind::PacsGrid => pacs_height(spec.grid_cols.max(1), spec.grid_rows.max(1), flow_w),
        SlotKind::SnakingTable => SNAKING_EMPTY_H_UM,
        SlotKind::NotesFooter => NOTES_H_UM,
        SlotKind::Signatures => SIG_H_UM,
        SlotKind::Seal => spec.diameter.as_um().max(24_000),
    }
}

fn pacs_height(cols: usize, rows: usize, flow_w: u32) -> u32 {
    let cell_w = flow_w / cols.max(1) as u32;
    let cell_h = cell_w * 3 / 4;
    (cell_h * rows as u32 + 4_000).min(90_000).max(36_000)
}

fn dummy_items(n: usize) -> Vec<LabItemRow> {
    (0..n)
        .map(|i| LabItemRow {
            index: (i + 1) as u32,
            item_name: format!("ITEM_{}", i + 1),
            item_abbr: format!("I{}", i + 1),
            result_value: "0".into(),
            unit: "".into(),
            ref_range_display: "".into(),
            alert_flag: AlertFlag::Normal,
            is_critical: false,
        })
        .collect()
}

fn snaking_frame_height(
    spec: &SlotLayoutSpec,
    available: u32,
) -> (u32, usize, Option<f32>) {
    let avail = PhysicalLength::from_um(available.max(1));
    let row_h = if spec.row_height.as_um() == 0 {
        PhysicalLength::from_um(SNAKING_ROW_DEFAULT_UM)
    } else {
        spec.row_height
    };
    let header = PhysicalLength::from_um(SNAKING_HEADER_UM);
    if spec.item_count == 0 {
        return (SNAKING_EMPTY_H_UM.min(available.max(1)), 1, Some(row_h.as_mm()));
    }
    let items = dummy_items(spec.item_count);
    let pages = SnakingTableEngine::layout_snaking_table(
        &items,
        avail,
        row_h,
        header,
        spec.auto_compaction,
    );
    if pages.is_empty() {
        return (SNAKING_EMPTY_H_UM.min(available.max(1)), 1, Some(row_h.as_mm()));
    }
    let page1 = &pages[0];
    let rows = page1
        .columns
        .iter()
        .map(|c| c.items.len() as u32)
        .max()
        .unwrap_or(0);
    let h = SNAKING_HEADER_UM + rows * page1.effective_row_height.as_um();
    (
        h.max(1),
        pages.len(),
        Some(page1.effective_row_height.as_mm()),
    )
}

fn frame(spec: &SlotLayoutSpec, x: u32, y: u32, w: u32, h: u32, page: usize) -> SlotFrame {
    SlotFrame {
        element_index: spec.index,
        kind: spec.kind.as_str().to_string(),
        x_mm: PhysicalLength::from_um(x).as_mm(),
        y_mm: PhysicalLength::from_um(y).as_mm(),
        width_mm: PhysicalLength::from_um(w).as_mm(),
        height_mm: PhysicalLength::from_um(h).as_mm(),
        page,
        overlay: spec.kind.is_overlay(),
        keep_with_next: spec.kind.keep_with_next(),
    }
}

/// 从设计器 TS `ReportTemplate` JSON（`{ kind: "HospitalHeader", ... }`）解析槽位规格。
pub fn specs_from_designer_json(value: &serde_json::Value) -> Result<(PhysicalSize, Margins, Vec<SlotLayoutSpec>), String> {
    let paper = value.get("paper_size").ok_or("missing paper_size")?;
    let margins = value.get("margins").ok_or("missing margins")?;
    let elements = value
        .get("elements")
        .and_then(|v| v.as_array())
        .ok_or("missing elements")?;

    let paper_size = PhysicalSize::from_mm(
        num_mm(paper, "width_mm").unwrap_or(210.0),
        num_mm(paper, "height_mm").unwrap_or(148.0),
    );
    let margins = Margins {
        top: PhysicalLength::from_mm(num_mm(margins, "top_mm").unwrap_or(8.0)),
        right: PhysicalLength::from_mm(num_mm(margins, "right_mm").unwrap_or(10.0)),
        bottom: PhysicalLength::from_mm(num_mm(margins, "bottom_mm").unwrap_or(8.0)),
        left: PhysicalLength::from_mm(num_mm(margins, "left_mm").unwrap_or(10.0)),
    };

    let mut specs = Vec::new();
    for (index, el) in elements.iter().enumerate() {
        let kind_name = el.get("kind").and_then(|v| v.as_str()).unwrap_or("");
        let Some(kind) = SlotKind::parse(kind_name) else {
            continue;
        };
        let items = el.get("items").and_then(|v| v.as_array());
        specs.push(SlotLayoutSpec {
            index,
            kind,
            row_height: PhysicalLength::from_mm(num_mm(el, "row_height_mm").unwrap_or(5.5)),
            auto_compaction: el
                .get("auto_compaction")
                .and_then(|v| v.as_bool())
                .unwrap_or(true),
            item_count: items.map(|a| a.len()).unwrap_or(0),
            diameter: PhysicalLength::from_mm(num_mm(el, "diameter_mm").unwrap_or(32.0)),
            grid_cols: el.get("grid_cols").and_then(|v| v.as_u64()).unwrap_or(2) as usize,
            grid_rows: el.get("grid_rows").and_then(|v| v.as_u64()).unwrap_or(1) as usize,
        });
    }
    Ok((paper_size, margins, specs))
}

fn num_mm(obj: &serde_json::Value, key: &str) -> Option<f32> {
    obj.get(key)?.as_f64().map(|n| n as f32)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spec(index: usize, kind: SlotKind, items: usize) -> SlotLayoutSpec {
        SlotLayoutSpec {
            index,
            kind,
            row_height: PhysicalLength::from_mm(5.5),
            auto_compaction: true,
            item_count: items,
            diameter: PhysicalLength::from_mm(32.0),
            grid_cols: 2,
            grid_rows: 1,
        }
    }

    #[test]
    fn lis_a5_unique_slots_fit_one_page() {
        let specs = vec![
            spec(0, SlotKind::HospitalHeader, 0),
            spec(1, SlotKind::PatientBanner, 0),
            spec(2, SlotKind::SnakingTable, 30),
            spec(3, SlotKind::Seal, 0),
            spec(4, SlotKind::Signatures, 0),
            spec(5, SlotKind::NotesFooter, 0),
        ];
        let result = SlotLayoutEngine::layout(
            PhysicalSize::a5_landscape(),
            Margins::medical_standard(),
            &specs,
        );
        assert!(result.unique_kind_errors.is_empty());
        assert_eq!(result.page_count, 1);
        assert_eq!(result.frames.len(), 6);

        let header = result.frames.iter().find(|f| f.kind == "HospitalHeader").unwrap();
        assert_eq!(header.x_mm, 10.0);
        assert_eq!(header.y_mm, 8.0);
        assert_eq!(header.width_mm, 190.0);

        let table = result.frames.iter().find(|f| f.kind == "SnakingTable").unwrap();
        assert!(table.height_mm > 40.0, "折流表应吃掉剩余高度，实际 {}", table.height_mm);

        let seal = result.frames.iter().find(|f| f.kind == "Seal").unwrap();
        assert!(seal.overlay);
        assert!(seal.keep_with_next);

        let sig = result.frames.iter().find(|f| f.kind == "Signatures").unwrap();
        assert_eq!(sig.page, 1);
        assert!(sig.y_mm + sig.height_mm <= 148.0 - 8.0 + 0.05);
    }

    #[test]
    fn duplicate_kind_is_rejected_but_first_kept() {
        let specs = vec![
            spec(0, SlotKind::HospitalHeader, 0),
            spec(1, SlotKind::HospitalHeader, 0),
            spec(2, SlotKind::Signatures, 0),
        ];
        let result = SlotLayoutEngine::layout(
            PhysicalSize::a5_landscape(),
            Margins::medical_standard(),
            &specs,
        );
        assert_eq!(result.unique_kind_errors.len(), 1);
        assert_eq!(
            result
                .frames
                .iter()
                .filter(|f| f.kind == "HospitalHeader")
                .count(),
            1
        );
    }

    #[test]
    fn designer_json_roundtrip_layout() {
        let json = serde_json::json!({
            "paper_size": { "width_mm": 210.0, "height_mm": 148.0 },
            "margins": { "top_mm": 8.0, "right_mm": 10.0, "bottom_mm": 8.0, "left_mm": 10.0 },
            "elements": [
                { "kind": "HospitalHeader", "hospital_name": "H", "sub_title": "", "report_title": "T" },
                { "kind": "PatientBanner", "include_barcode": true },
                { "kind": "SnakingTable", "columns_count": 2, "column_gap_mm": 4, "left_ratio": 0.5,
                  "row_height_mm": 5.5, "auto_compaction": true, "items": [{}, {}, {}] },
                { "kind": "NotesFooter", "text": "n" },
                { "kind": "Signatures", "requesting_physician": "", "operator": "", "reviewer": "", "report_date": "" }
            ]
        });
        let (paper, margins, specs) = specs_from_designer_json(&json).unwrap();
        let result = SlotLayoutEngine::layout(paper, margins, &specs);
        assert_eq!(result.page_count, 1);
        assert_eq!(result.frames.len(), 5);
    }
}
