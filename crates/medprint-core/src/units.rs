//! 物理度量衡单位系统 (Physical Units System)
//!
//! 医疗打印严格以物理毫米（mm）为绝对基准，存储使用微米（um）以完全规避浮点累积误差和屏幕 CSS 像素缩放歧义。

use serde::{Deserialize, Serialize};

/// 物理长度单位，内部以微米 (Micrometers) 整数形式精确存储
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct PhysicalLength(u32);

impl PhysicalLength {
    pub const ZERO: Self = Self(0);

    /// 从微米构造
    #[inline]
    pub const fn from_um(um: u32) -> Self {
        Self(um)
    }

    /// 从毫米 (mm) 构造 (1 mm = 1000 um)
    #[inline]
    pub fn from_mm(mm: f32) -> Self {
        Self((mm * 1000.0).round() as u32)
    }

    /// 从印刷点 (pt) 构造 (1 pt = 25400 / 72 um ≈ 352.778 um)
    #[inline]
    pub fn from_pt(pt: f32) -> Self {
        Self((pt * (25400.0 / 72.0)).round() as u32)
    }

    /// 获取微米数值
    #[inline]
    pub const fn as_um(&self) -> u32 {
        self.0
    }

    /// 转换为毫米 (mm)
    #[inline]
    pub fn as_mm(&self) -> f32 {
        self.0 as f32 / 1000.0
    }

    /// 转换为印刷点 (pt)
    #[inline]
    pub fn as_pt(&self) -> f32 {
        self.0 as f32 * (72.0 / 25400.0)
    }
}

/// 二维物理矩形尺寸
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct PhysicalSize {
    pub width: PhysicalLength,
    pub height: PhysicalLength,
}

impl PhysicalSize {
    #[inline]
    pub fn from_mm(width_mm: f32, height_mm: f32) -> Self {
        Self {
            width: PhysicalLength::from_mm(width_mm),
            height: PhysicalLength::from_mm(height_mm),
        }
    }

    /// 医疗最主流：A5 横向 (210mm x 148mm)
    pub fn a5_landscape() -> Self {
        Self::from_mm(210.0, 148.0)
    }

    /// A4 纵向 (210mm x 297mm)
    pub fn a4_portrait() -> Self {
        Self::from_mm(210.0, 297.0)
    }

    /// A4 横向 (297mm x 210mm)
    pub fn a4_landscape() -> Self {
        Self::from_mm(297.0, 210.0)
    }
}

/// 边距定义 (Margins)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Margins {
    pub top: PhysicalLength,
    pub right: PhysicalLength,
    pub bottom: PhysicalLength,
    pub left: PhysicalLength,
}

impl Margins {
    pub fn uniform_mm(mm: f32) -> Self {
        let length = PhysicalLength::from_mm(mm);
        Self {
            top: length,
            right: length,
            bottom: length,
            left: length,
        }
    }

    pub fn medical_standard() -> Self {
        Self {
            top: PhysicalLength::from_mm(8.0),
            right: PhysicalLength::from_mm(10.0),
            bottom: PhysicalLength::from_mm(8.0),
            left: PhysicalLength::from_mm(10.0),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unit_conversions() {
        let mm10 = PhysicalLength::from_mm(10.0);
        assert_eq!(mm10.as_um(), 10000);
        assert!((mm10.as_mm() - 10.0).abs() < 1e-4);

        let a5 = PhysicalSize::a5_landscape();
        assert_eq!(a5.width.as_um(), 210000);
        assert_eq!(a5.height.as_um(), 148000);
    }
}
