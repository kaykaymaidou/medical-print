//! 报告单模板与数据 AST 结构定义 (Report Template Schema)

use crate::units::{Margins, PhysicalLength, PhysicalSize};
use serde::{Deserialize, Serialize};

/// 患者人口学与就诊业务信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatientInfo {
    pub name: String,
    pub gender: Gender,
    pub age: u32,
    pub age_unit: AgeUnit, // 岁/月/天 (新生儿使用天/月)
    pub is_pregnant: bool,
    pub gestational_weeks: Option<u32>, // 孕周
    pub medical_record_no: String,      // 病案号/门诊号
    pub inpatient_no: Option<String>,   // 住院号
    pub bed_no: Option<String>,         // 床号
    pub department: String,             // 送检科室
    pub barcode: String,                // 标本条码/采血管号 (Code128)
    pub sample_type: String,            // 标本种类 (如 静脉血、血清、尿液)
    pub sampling_time: Option<String>,  // 采样时间
    pub receiving_time: Option<String>, // 接收时间
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Gender {
    Male,
    Female,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgeUnit {
    Year,
    Month,
    Day,
}

/// 检验单项目数据行
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabItemRow {
    pub index: u32,
    pub item_name: String,
    pub item_abbr: String,
    pub result_value: String,
    pub unit: String,
    pub ref_range_display: String,
    pub alert_flag: AlertFlag, // 偏高 ↑, 偏低 ↓, 危急值, 正常
    pub is_critical: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AlertFlag {
    Normal,
    High,     // ↑
    Low,      // ↓
    Critical, // ★ 危急值
}

/// 三级医疗责任签名链
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureChain {
    pub requesting_physician: String, // 送检医师
    pub sampling_person: Option<String>, // 采样人
    pub operator: String,             // 检验操作人
    pub reviewer: String,             // 审核医师
    pub report_date: String,          // 报告日期
    pub doctor_signature_images: Vec<DoctorSignImage>, // 医生手写电子签名透明图片
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorSignImage {
    pub role: String, // "operator" 或 "reviewer"
    pub image_base64: String,
}

/// 医院专用防伪红章定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HospitalSeal {
    pub hospital_name: String, // 环形文字: "XX市第一人民医院"
    pub seal_title: String,    // 中间横排: "检验专用章"
    pub seal_code: String,     // 底部印章防伪编号
    pub diameter_mm: f32,      // 直径，如 38.0mm
    pub angle_jitter_deg: f32, // 随机防伪微小倾斜角 (-5° ~ +5°)
    pub opacity: f32,          // 透明度 (0.75 ~ 0.9)，正片叠底透出文字
}

/// 医疗报告模板主定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportTemplate {
    pub id: String,
    pub name: String,
    pub version: String,
    pub paper_size: PhysicalSize,
    pub margins: Margins,
    pub report_type: MedicalReportType,
    pub elements: Vec<ReportElement>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MedicalReportType {
    LisBloodRoutine,     // 检验科血常规 / 生化 (典型 A5 横向双列)
    PacsImagingReport,   // 超声 / X光 / 内镜图文
    EcgDiagnosticReport, // 心电图 1mm 网格
    OutpatientPrescription, // 门诊处方笺
    InpatientThreePartForm, // 住院三联穿孔折叠纸
    TegThromboelastogram,   // 血栓弹力图
}

/// 模板元素节点枚举
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReportElement {
    HospitalHeader {
        hospital_name: String,
        sub_title: String,
        report_title: String,
    },
    PatientBanner,
    /// A5 横向双列折流化验单表格
    SnakingTable {
        columns_count: usize, // 默认为 2
        column_gap: PhysicalLength,
        left_ratio: f32,      // 左右列宽比例，默认 0.5
        items: Vec<LabItemRow>,
    },
    /// 血栓弹力图
    TegCurveChart {
        r_time_min: f32,     // R 反应时间
        k_time_min: f32,     // K 凝固时间
        alpha_angle_deg: f32,// Angle 凝固角
        ma_amplitude_mm: f32,// MA 最大振幅
        ly30_percent: f32,   // 30分钟纤溶率
    },
    /// PACS 超声/X光图像多联拼版网格
    PacsGrid {
        grid_cols: usize,
        grid_rows: usize,
        image_urls: Vec<String>,
        show_scale_ruler: bool,
    },
    /// 三级医生签名链
    Signatures(SignatureChain),
    /// 医院检验防伪专用红章
    Seal(HospitalSeal),
    /// 提醒声明 / 免责标语
    NotesFooter(String),
}
