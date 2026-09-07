//! # MedPrint Core Engine
//!
//! 面向医疗健康与高精单据的下一代跨平台打印排版内核。
//!
//! 核心原则：
//! 1. 物理毫米绝对精度存储 (微米整数运算)
//! 2. 纯矢量输出 (300/600 DPI Vector PDF)
//! 3. A5 横向双列折流平衡算法 (Snaking Flow)
//! 4. 临床医疗公式与动态人口学参考值计算
//! 5. 三级医疗责任签名链与防伪专用红章合规
//! 6. 零 C 库依赖，完全跨平台 (WASM + Native)

pub mod charts;
pub mod drivers;
pub mod expr;
pub mod layout;
pub mod pdf;
pub mod schema;
pub mod units;

pub use charts::{PacsGridLayout, TegChartGenerator};
pub use expr::{ClinicalFormulas, DemographicEvaluator};
pub use layout::{PageBreakPolicy, SnakingTableEngine};
pub use pdf::VectorPdfDoc;
pub use schema::{
    AgeUnit, AlertFlag, Gender, HospitalSeal, LabItemRow, MedicalReportType, PatientInfo,
    ReportElement, ReportTemplate, SignatureChain,
};
pub use units::{Margins, PhysicalLength, PhysicalSize};
