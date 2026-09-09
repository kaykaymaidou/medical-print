//! # MedPrint Core Engine Comprehensive Integration Tests
//!
//! 验证物理度量衡、Code128 矢量条码、A5 双列折流平衡、临床公式计算与模板编译管线。

use medprint_core::barcode::Code128Encoder;
use medprint_core::expr::ClinicalFormulas;
use medprint_core::layout::SnakingTableEngine;
use medprint_core::pdf::MedicalReportCompiler;
use medprint_core::schema::{
    AgeUnit, AlertFlag, Gender, HospitalSeal, LabItemRow, MedicalReportType, PatientInfo,
    ReportElement, ReportTemplate, SignatureChain,
};
use medprint_core::units::{Margins, PhysicalLength, PhysicalSize};

#[test]
fn test_physical_units_precision() {
    let mm = PhysicalLength::from_mm(210.0);
    assert_eq!(mm.as_um(), 210_000);
    assert_eq!(mm.as_mm(), 210.0);

    let a5 = PhysicalSize::a5_landscape();
    assert_eq!(a5.width.as_mm(), 210.0);
    assert_eq!(a5.height.as_mm(), 148.0);
}

#[test]
fn test_code128_barcode_generation() {
    let sample_barcode = "MZ20260908888";
    let bars = Code128Encoder::generate_vector_bars(sample_barcode, 10.0, 10.0, 45.0, 8.0);
    assert!(!bars.is_empty());

    // 检查所有条的尺寸与位置在合理物理范围内
    for bar in &bars {
        assert!(bar.x_mm >= 10.0);
        assert!(bar.x_mm + bar.width_mm <= 56.0);
        assert_eq!(bar.height_mm, 8.0);
    }
}

#[test]
fn test_snaking_table_pagination_and_compaction() {
    // 构造 36 个生化指标行
    let items: Vec<LabItemRow> = (1..=36)
        .map(|i| LabItemRow {
            index: i,
            item_name: format!("化验项目_{}", i),
            item_abbr: format!("ITEM_{}", i),
            result_value: "5.2".to_string(),
            unit: "mmol/L".to_string(),
            ref_range_display: "3.5~6.0".to_string(),
            alert_flag: AlertFlag::Normal,
            is_critical: false,
        })
        .collect();

    // 可用高度 100mm, 行高 5.5mm, 单列放约 17 行, 两列可放 34 行
    // 36 行略微超出两列容量 (超出 2 行)
    // 开启 auto-compact 时，必须启发式自适应微调压缩进 1 页内！
    let pages = SnakingTableEngine::layout_snaking_table(
        &items,
        PhysicalLength::from_mm(100.0),
        PhysicalLength::from_mm(5.5),
        PhysicalLength::from_mm(6.5),
        true,
    );

    assert_eq!(pages.len(), 1, "36 项化验指标应自适应压缩在单页 A5 内！");
    assert_eq!(pages[0].columns.len(), 2, "应折流为左右双列！");
    assert_eq!(pages[0].columns[0].items.len(), 18);
    assert_eq!(pages[0].columns[1].items.len(), 18);
}

#[test]
fn test_clinical_formulas_kdigo_egfr() {
    // 男性 50 岁，肌酐 1.0 mg/dL
    let egfr_male = ClinicalFormulas::egfr_ckd_epi(1.0, 50, false);
    assert!(egfr_male >= 80.0 && egfr_male <= 100.0);

    // 女性 65 岁，肌酐 1.4 mg/dL (肾功能中重度下降)
    let egfr_female = ClinicalFormulas::egfr_ckd_epi(1.4, 65, true);
    assert!(egfr_female < 60.0);

    // BMI 测算
    let bmi = ClinicalFormulas::bmi(70.0, 175.0);
    assert!((bmi - 22.86).abs() < 0.1);
}

#[test]
fn test_full_report_template_compilation_to_vector_pdf() {
    let items: Vec<LabItemRow> = (1..=28)
        .map(|i| LabItemRow {
            index: i,
            item_name: format!("生化指标_{}", i),
            item_abbr: format!("BIO_{}", i),
            result_value: "14.2".to_string(),
            unit: "umol/L".to_string(),
            ref_range_display: "5~20".to_string(),
            alert_flag: AlertFlag::Normal,
            is_critical: false,
        })
        .collect();

    let template = ReportTemplate {
        id: "tpl_lis_a5_01".to_string(),
        name: "A5 横向双列生化化验单".to_string(),
        version: "1.0".to_string(),
        paper_size: PhysicalSize::a5_landscape(),
        margins: Margins {
            top: PhysicalLength::from_mm(8.0),
            bottom: PhysicalLength::from_mm(8.0),
            left: PhysicalLength::from_mm(10.0),
            right: PhysicalLength::from_mm(10.0),
        },
        report_type: MedicalReportType::LisBloodRoutine,
        elements: vec![
            ReportElement::HospitalHeader {
                hospital_name: "国家级医学院附属第一医院".to_string(),
                sub_title: "检验科报告单".to_string(),
                report_title: "临床生化检验报告单 (A5横向双列)".to_string(),
            },
            ReportElement::PatientBanner,
            ReportElement::SnakingTable {
                columns_count: 2,
                column_gap: PhysicalLength::from_mm(6.0),
                left_ratio: 0.5,
                items,
            },
            ReportElement::Signatures(SignatureChain {
                requesting_physician: "王主任".to_string(),
                sampling_person: Some("李护师".to_string()),
                operator: "张检验技师".to_string(),
                reviewer: "陈副主任技师".to_string(),
                report_date: "2026-09-08 09:30".to_string(),
                doctor_signature_images: Vec::new(),
            }),
            ReportElement::Seal(HospitalSeal {
                hospital_name: "国家级医学院附属第一医院".to_string(),
                seal_title: "检验专用章".to_string(),
                seal_code: "1101089921".to_string(),
                diameter_mm: 36.0,
                angle_jitter_deg: 2.5,
                opacity: 0.85,
            }),
        ],
    };

    let patient = PatientInfo {
        name: "赵国强".to_string(),
        gender: Gender::Male,
        age: 48,
        age_unit: AgeUnit::Year,
        is_pregnant: false,
        gestational_weeks: None,
        medical_record_no: "MRN2026090881".to_string(),
        inpatient_no: None,
        bed_no: None,
        department: "急诊医学科".to_string(),
        barcode: "MZ20260908888".to_string(),
        sample_type: "静脉血清".to_string(),
        sampling_time: Some("2026-09-08 08:00".to_string()),
        receiving_time: Some("2026-09-08 08:30".to_string()),
    };

    let pdf = MedicalReportCompiler::compile_report(&template, &patient);
    let bytes = pdf.compile_to_bytes();

    assert!(!bytes.is_empty());
    assert!(bytes.starts_with(b"%PDF-1.4"));
    assert!(bytes.windows(5).any(|w| w == b"%%EOF"));
    println!("Compiled Vector PDF size: {} bytes", bytes.len());
}
