//! 医疗条形码纯矢量生成模块 (Medical Vector Barcode Generator)
//!
//! 专为医疗采血管标本码、住院腕带与门诊处方流水号设计。
//! 遵循 ISO/IEC 15417 与国家卫健委条码规范，纯矢量几何计算，绝无位图模糊。

pub mod code128;

pub use code128::{BarcodeBar, Code128Encoder};
