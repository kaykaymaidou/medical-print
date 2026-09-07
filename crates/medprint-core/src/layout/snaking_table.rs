//! A5 横向双列折流平衡排版算法 (Snaking Table Layout)
//!
//! 医疗检验单主流标准：左列排满自上而下折入右列并自动克隆表头；两列均满才允许分页；
//! 若仅超出 1~2 行，启发式自动微调行距，保证 100% 紧凑在单张 A5 纸内打印。

use crate::schema::LabItemRow;
use crate::units::PhysicalLength;

#[derive(Debug, Clone)]
pub struct SnakingPageColumn {
    pub column_index: usize, // 0: 左列, 1: 右列
    pub start_item_index: usize,
    pub items: Vec<LabItemRow>,
}

#[derive(Debug, Clone)]
pub struct SnakingPageLayout {
    pub page_number: usize,
    pub columns: Vec<SnakingPageColumn>,
    pub effective_row_height: PhysicalLength,
}

pub struct SnakingTableEngine;

impl SnakingTableEngine {
    /// 执行双列折流排版算法
    ///
    /// * `items`: 全部待排版化验项列表 (如 25 ~ 45 项)
    /// * `available_height`: 当前页面扣除页眉、患者信息条、页脚签名后的可用净物理高度
    /// * `nominal_row_height`: 标准行高 (默认如 5.5mm)
    /// * `header_row_height`: 子表头行高 (默认如 6.5mm)
    /// * `allow_auto_compact`: 是否启用单页强制弹性压缩 (若溢出 1~3 行则自动微调行高保证1页)
    pub fn layout_snaking_table(
        items: &[LabItemRow],
        available_height: PhysicalLength,
        nominal_row_height: PhysicalLength,
        header_row_height: PhysicalLength,
        allow_auto_compact: bool,
    ) -> Vec<SnakingPageLayout> {
        let total_items = items.len();
        if total_items == 0 {
            return Vec::new();
        }

        let avail_um = available_height.as_um();
        let header_um = header_row_height.as_um();
        let mut row_height_um = nominal_row_height.as_um();

        // 基础单列可容纳行数
        let body_avail_um = avail_um.saturating_sub(header_um);
        let mut max_rows_per_col = (body_avail_um / row_height_um) as usize;

        // 触发单页弹性压缩算法 (Auto-Compaction)
        if allow_auto_compact && max_rows_per_col > 0 {
            let two_col_capacity = max_rows_per_col * 2;
            if total_items > two_col_capacity && total_items <= two_col_capacity + 4 {
                // 需要放 total_items 行，每列放 ceil(total_items / 2)
                let needed_rows_per_col = (total_items + 1) / 2;
                let compacted_row_height = body_avail_um / (needed_rows_per_col as u32);
                // 压缩不能过小 (保留原行高的 80% 以上可读性底线)
                if compacted_row_height >= (nominal_row_height.as_um() * 80 / 100) {
                    row_height_um = compacted_row_height;
                    max_rows_per_col = needed_rows_per_col;
                }
            }
        }

        let mut pages = Vec::new();
        let mut item_cursor = 0;
        let mut page_no = 1;

        while item_cursor < total_items {
            let mut page_columns = Vec::new();

            for col_idx in 0..2 {
                if item_cursor >= total_items {
                    break;
                }

                let remaining = total_items - item_cursor;
                let count_this_col = remaining.min(max_rows_per_col);
                let col_items = items[item_cursor..item_cursor + count_this_col].to_vec();

                page_columns.push(SnakingPageColumn {
                    column_index: col_idx,
                    start_item_index: item_cursor,
                    items: col_items,
                });

                item_cursor += count_this_col;
            }

            pages.push(SnakingPageLayout {
                page_number: page_no,
                columns: page_columns,
                effective_row_height: PhysicalLength::from_um(row_height_um),
            });

            page_no += 1;
        }

        pages
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::AlertFlag;

    fn make_dummy_items(n: usize) -> Vec<LabItemRow> {
        (0..n)
            .map(|i| LabItemRow {
                index: (i + 1) as u32,
                item_name: format!("生化检验项目_{}", i + 1),
                item_abbr: format!("ITEM_{}", i + 1),
                result_value: "5.21".to_string(),
                unit: "mmol/L".to_string(),
                ref_range_display: "3.50 - 6.50".to_string(),
                alert_flag: AlertFlag::Normal,
                is_critical: false,
            })
            .collect()
    }

    #[test]
    fn test_a5_snaking_flow() {
        // A5 横向总高 148mm，除去页眉与页脚留出 95mm 可用高度
        let avail_h = PhysicalLength::from_mm(95.0);
        let row_h = PhysicalLength::from_mm(5.5);
        let header_h = PhysicalLength::from_mm(6.5);

        // 32 项数据
        let items = make_dummy_items(32);
        let pages = SnakingTableEngine::layout_snaking_table(&items, avail_h, row_h, header_h, false);

        // 95 - 6.5 = 88.5mm, 88.5 / 5.5 ≈ 16 行每列。两列正好容纳 32 行！应该正好是 1 页！
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0].columns.len(), 2);
        assert_eq!(pages[0].columns[0].items.len(), 16);
        assert_eq!(pages[0].columns[1].items.len(), 16);
    }

    #[test]
    fn test_auto_compaction_squeezes_into_single_page() {
        let avail_h = PhysicalLength::from_mm(95.0);
        let row_h = PhysicalLength::from_mm(5.5);
        let header_h = PhysicalLength::from_mm(6.5);

        // 34 项数据 (按原行高每列16行，两列共32行，本来会多出2行溢出到第2页)
        let items = make_dummy_items(34);
        let pages = SnakingTableEngine::layout_snaking_table(&items, avail_h, row_h, header_h, true);

        // 启用了弹性自适应，自动轻微压缩行高，成功在一页内排完！
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0].columns[0].items.len(), 17);
        assert_eq!(pages[0].columns[1].items.len(), 17);
    }
}
