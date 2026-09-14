//! 声明式渐进约束规格定义 (Progressive Constraint Specification)
//!
//! 核心理念：
//! 1. 未约束时自由流淌（自适应纸张与内容）；
//! 2. 约束后严格遵循（如相对锚定对齐、空间几何避让、单页硬预算）。

use serde::{Deserialize, Serialize};

/// 空间九宫格锚点定位
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AnchorPosition {
    TopLeft,
    TopCenter,
    TopRight,
    CenterLeft,
    Center,
    CenterRight,
    BottomLeft,
    BottomCenter,
    BottomRight,
}

/// 相对对齐类型
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum RelativeAlignmentType {
    VerticalCenter,   // 垂直居中对齐 (如 Logo 与医院名称)
    HorizontalCenter, // 水平居中对齐
    TopEdge,          // 顶边对齐
    BottomEdge,       // 底边对齐
    LeftEdge,         // 左边对齐
    RightEdge,        // 右边对齐
}

/// 相对锚定对齐约束
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RelativeAlignment {
    pub target_element_id: String,
    pub align_type: RelativeAlignmentType,
    pub offset_mm: f32,
}

/// 几何排斥障碍物定义 (如 TEG 图表、PACS 影像切面)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ObstacleConstraint {
    pub is_obstacle: bool,
    pub padding_mm: f32, // 障碍物四周留白保护间距
}

impl Default for ObstacleConstraint {
    fn default() -> Self {
        Self {
            is_obstacle: false,
            padding_mm: 3.0,
        }
    }
}

/// 流动与排版行为
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum FlowBehavior {
    /// 自由流式堆叠 (Unconstrained Document Stream)
    FlowFree,
    /// 经典 A5 横向双列折流
    FlowSnaking { columns: usize },
    /// 空间障碍避让折流：动态切片并绕行障碍物
    FlowAvoidObstacles {
        avoid_obstacle_ids: Vec<String>,
        base_columns: usize,
    },
}

/// 纸张单页预算硬约束
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PageBudgetConstraint {
    /// 严格单页锁定：溢出时启发式自动压缩行高字号，绝不跨页
    SinglePageHard,
    /// 允许多页自然跨页
    MultiPageAllowed,
}

/// 元素综合约束规则包
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ElementConstraint {
    pub anchor: Option<AnchorPosition>,
    pub relative_align: Option<RelativeAlignment>,
    pub obstacle: Option<ObstacleConstraint>,
    pub flow: Option<FlowBehavior>,
    pub keep_with_next: bool,
}

impl Default for ElementConstraint {
    fn default() -> Self {
        Self {
            anchor: None,
            relative_align: None,
            obstacle: None,
            flow: None,
            keep_with_next: false,
        }
    }
}
