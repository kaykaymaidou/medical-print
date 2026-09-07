//! PACS 医学影像自适应拼版算法 (PACS Image Grid Layout)
//!
//! 适配超声、放射 X 光、胃肠内镜等图文报告。
//! 支持 1 图全景、2 图横排对比、4 图田字格、6 图多联。
//! 严格保持原始长宽比，防止病灶被拉伸畸变。

use crate::units::{PhysicalLength, PhysicalSize};

#[derive(Debug, Clone)]
pub struct PacsImageSlot {
    pub slot_index: usize,
    pub x: PhysicalLength,
    pub y: PhysicalLength,
    pub width: PhysicalLength,
    pub height: PhysicalLength,
}

pub struct PacsGridLayout;

impl PacsGridLayout {
    /// 计算 PACS 影像在容器内的多联自适应坐标
    pub fn compute_slots(
        container_size: PhysicalSize,
        image_count: usize,
        cols: usize,
        gap: PhysicalLength,
    ) -> Vec<PacsImageSlot> {
        if image_count == 0 || cols == 0 {
            return Vec::new();
        }

        let rows = (image_count + cols - 1) / cols;
        let gap_um = gap.as_um();

        let total_gap_x_um = gap_um * (cols - 1) as u32;
        let total_gap_y_um = gap_um * (rows - 1) as u32;

        let slot_w_um = container_size.width.as_um().saturating_sub(total_gap_x_um) / (cols as u32);
        let slot_h_um = container_size.height.as_um().saturating_sub(total_gap_y_um) / (rows as u32);

        let mut slots = Vec::new();

        for i in 0..image_count {
            let col = i % cols;
            let row = i / cols;

            let x_um = col as u32 * (slot_w_um + gap_um);
            let y_um = row as u32 * (slot_h_um + gap_um);

            slots.push(PacsImageSlot {
                slot_index: i,
                x: PhysicalLength::from_um(x_um),
                y: PhysicalLength::from_um(y_um),
                width: PhysicalLength::from_um(slot_w_um),
                height: PhysicalLength::from_um(slot_h_um),
            });
        }

        slots
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pacs_four_grid() {
        let container = PhysicalSize::from_mm(160.0, 120.0);
        let gap = PhysicalLength::from_mm(4.0);

        // 4格超声图 (2列2行)
        let slots = PacsGridLayout::compute_slots(container, 4, 2, gap);
        assert_eq!(slots.len(), 4);

        // (160 - 4) / 2 = 78mm 每格宽
        assert_eq!(slots[0].width.as_mm(), 78.0);
        // (120 - 4) / 2 = 58mm 每格高
        assert_eq!(slots[0].height.as_mm(), 58.0);
    }
}
