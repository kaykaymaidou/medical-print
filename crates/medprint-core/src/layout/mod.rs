//! 布局排版与分页计算核心

pub mod snaking_table;

pub use snaking_table::{SnakingPageColumn, SnakingPageLayout, SnakingTableEngine};

/// 语义化防孤立与分页控制
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PageBreakPolicy {
    Auto,
    AlwaysBefore,
    AlwaysAfter,
    /// 防孤立原则：本元素必须与下一个元素保留在同页（如签名栏/印章紧跟表格末尾，绝不单独溢出到新空白页）
    KeepWithNext,
}
