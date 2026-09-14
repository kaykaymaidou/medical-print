//! 空间障碍避让求解引擎 (Obstacle-Aware Spatial Layout Solver)
//!
//! 解决临床复杂版面需求：图表插入报表中时，化验单表格自动收窄、绕行障碍物折流，
//! 并支持相对锚点（如 Logo 与标题垂直居中对齐）与单页硬约束。

use crate::schema::LabItemRow;
use crate::units::{Margins, PhysicalSize};

/// 几何矩形区域 (以毫米为物理单位)
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PhysicalRect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

impl PhysicalRect {
    pub fn new(x: f32, y: f32, width: f32, height: f32) -> Self {
        Self { x, y, width, height }
    }

    pub fn right(&self) -> f32 {
        self.x + self.width
    }

    pub fn bottom(&self) -> f32 {
        self.y + self.height
    }

    /// 两个矩形是否发生空间碰撞
    pub fn intersects(&self, other: &PhysicalRect) -> bool {
        self.x < other.right()
            && self.right() > other.x
            && self.y < other.bottom()
            && self.bottom() > other.y
    }
}

/// 注册的几何避让障碍物
#[derive(Debug, Clone)]
pub struct ObstacleBox {
    pub id: String,
    pub rect: PhysicalRect,
    pub padding_mm: f32,
}

impl ObstacleBox {
    /// 包含安全间距的有效禁区
    pub fn bounding_box(&self) -> PhysicalRect {
        PhysicalRect {
            x: self.rect.x - self.padding_mm,
            y: self.rect.y - self.padding_mm,
            width: self.rect.width + self.padding_mm * 2.0,
            height: self.rect.height + self.padding_mm * 2.0,
        }
    }
}

/// 某一行化验单单元格排布的物理几何坐标
#[derive(Debug, Clone)]
pub struct SolvedCellPlacement {
    pub item: LabItemRow,
    pub rect: PhysicalRect,
    pub column_index: usize,
}

/// 求解出的单页排版结果
#[derive(Debug, Clone)]
pub struct SolvedObstaclePage {
    pub page_number: usize,
    pub cells: Vec<SolvedCellPlacement>,
    pub effective_row_height_mm: f32,
    pub obstacles_present: Vec<String>,
}

pub struct ObstacleLayoutSolver;

impl ObstacleLayoutSolver {
    /// 计算两个元素之间的相对垂直居中 Y 坐标
    ///
    /// * `reference_rect`: 参考物矩形 (如标题区域)
    /// * `target_height_mm`: 目标物高度 (如 Logo 高度)
    /// * `offset_mm`: 微调偏移量
    pub fn solve_vertical_center(reference_rect: &PhysicalRect, target_height_mm: f32, offset_mm: f32) -> f32 {
        let center_y = reference_rect.y + reference_rect.height / 2.0;
        center_y - target_height_mm / 2.0 + offset_mm
    }

    /// 空间障碍避让折流求解算法
    ///
    /// * `items`: 待排版化验项集合
    /// * `paper_size`: 纸张规格 (如 A5 横向 210 x 148 mm)
    /// * `margins`: 边距
    /// * `start_y_mm`: 表格起始 Y 坐标
    /// * `bottom_boundary_y_mm`: 表格终止 Y 限制线 (如页脚签字栏上方)
    /// * `obstacles`: 障碍物列表 (如位于右侧的 TEG 图表或超声图)
    /// * `force_single_page`: 是否开启单页硬预算
    pub fn solve_snaking_avoid_obstacles(
        items: &[LabItemRow],
        paper_size: PhysicalSize,
        margins: Margins,
        start_y_mm: f32,
        bottom_boundary_y_mm: f32,
        obstacles: &[ObstacleBox],
        force_single_page: bool,
    ) -> Vec<SolvedObstaclePage> {
        if items.is_empty() {
            return Vec::new();
        }

        let page_w = paper_size.width.as_mm();
        let left_m = margins.left.as_mm();
        let right_m = margins.right.as_mm();
        let printable_width = page_w - left_m - right_m;

        let mut nominal_row_h = 5.5; // 标准行高 5.5mm
        let available_total_h = bottom_boundary_y_mm - start_y_mm;

        // 提取所有障碍物的禁区
        let obstacle_boxes: Vec<PhysicalRect> = obstacles.iter().map(|o| o.bounding_box()).collect();

        // 双列基准列宽与中轴间隔
        let col_gap = 6.0;
        let base_col_width = (printable_width - col_gap) / 2.0;
        let col_0_left = left_m;
        let col_1_left = left_m + base_col_width + col_gap;

        // 计算障碍物扣除后的有效可用高度
        let col_0_rect = PhysicalRect::new(col_0_left, start_y_mm, base_col_width, available_total_h);
        let col_1_rect = PhysicalRect::new(col_1_left, start_y_mm, base_col_width, available_total_h);

        let mut col_0_blocked_h = 0.0f32;
        let mut col_1_blocked_h = 0.0f32;

        for obs in &obstacle_boxes {
            if col_0_rect.intersects(obs) {
                let overlap_top = obs.y.max(start_y_mm);
                let overlap_bottom = obs.bottom().min(bottom_boundary_y_mm);
                if overlap_bottom > overlap_top {
                    col_0_blocked_h += overlap_bottom - overlap_top;
                }
            }
            if col_1_rect.intersects(obs) {
                let overlap_top = obs.y.max(start_y_mm);
                let overlap_bottom = obs.bottom().min(bottom_boundary_y_mm);
                if overlap_bottom > overlap_top {
                    col_1_blocked_h += overlap_bottom - overlap_top;
                }
            }
        }

        let effective_available_h = (available_total_h - col_0_blocked_h).max(0.0)
            + (available_total_h - col_1_blocked_h).max(0.0);

        // 启发式行高紧凑优化 (SinglePageHard 守卫)
        if force_single_page && !items.is_empty() {
            let estimated_capacity = effective_available_h / nominal_row_h;
            if (items.len() as f32) > estimated_capacity {
                // 弹性压缩行高，最高可压缩至 80% (约 4.4mm)
                let compressed_h = effective_available_h / (items.len() as f32);
                nominal_row_h = compressed_h.max(4.4).min(5.5);
            }
        }

        let mut cells = Vec::new();
        let mut item_idx = 0;

        // 列 0 扫描线
        let mut y0 = start_y_mm;
        // 列 1 扫描线
        let mut y1 = start_y_mm;

        // 折流策略：交替或先排左列后排右列，遇到障碍物时自动收窄并避让
        while item_idx < items.len() && (y0 + nominal_row_h <= bottom_boundary_y_mm || y1 + nominal_row_h <= bottom_boundary_y_mm) {
            // 优先填充左列，左列满或处于当前水平面时填充
            let place_in_col_0 = y0 <= y1 && y0 + nominal_row_h <= bottom_boundary_y_mm;

            if place_in_col_0 {
                let candidate_rect = PhysicalRect::new(col_0_left, y0, base_col_width, nominal_row_h);
                // 检查是否碰撞障碍物
                let hits_obstacle = obstacle_boxes.iter().any(|obs| candidate_rect.intersects(obs));

                if !hits_obstacle {
                    cells.push(SolvedCellPlacement {
                        item: items[item_idx].clone(),
                        rect: candidate_rect,
                        column_index: 0,
                    });
                    item_idx += 1;
                }
                y0 += nominal_row_h;
            } else if y1 + nominal_row_h <= bottom_boundary_y_mm {
                let candidate_rect = PhysicalRect::new(col_1_left, y1, base_col_width, nominal_row_h);
                // 检查右列是否碰撞障碍物
                let obstacle_collision = obstacle_boxes.iter().find(|obs| candidate_rect.intersects(obs));

                if let Some(obs) = obstacle_collision {
                    // 发生了碰撞！执行避让：
                    // 如果障碍物在右侧，右列自动跳过被占用的垂直区间，或者收窄避让
                    y1 = obs.bottom(); // 跳过障碍物垂直区间
                } else {
                    cells.push(SolvedCellPlacement {
                        item: items[item_idx].clone(),
                        rect: candidate_rect,
                        column_index: 1,
                    });
                    item_idx += 1;
                    y1 += nominal_row_h;
                }
            } else {
                break;
            }
        }

        let obstacle_ids = obstacles.iter().map(|o| o.id.clone()).collect();

        vec![SolvedObstaclePage {
            page_number: 1,
            cells,
            effective_row_height_mm: nominal_row_h,
            obstacles_present: obstacle_ids,
        }]
    }
}
