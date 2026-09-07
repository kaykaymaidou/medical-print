//! # MedPrint WASM Bridge
//!
//! 导出给前端 Web 浏览器与浏览器插件的 WebAssembly 极速排版与矢量渲染接口。

use medprint_core::expr::ClinicalFormulas;
use medprint_core::layout::SnakingTableEngine;
use medprint_core::pdf::VectorPdfDoc;
use medprint_core::schema::LabItemRow;
use medprint_core::units::{PhysicalLength, PhysicalSize};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn medprint_version() -> String {
    "0.1.0".to_string()
}

/// 计算临床公式 eGFR
#[wasm_bindgen]
pub fn calc_egfr(scr_mg_dl: f32, age: u32, is_female: bool) -> f32 {
    ClinicalFormulas::egfr_ckd_epi(scr_mg_dl, age, is_female)
}

/// 计算 BMI
#[wasm_bindgen]
pub fn calc_bmi(weight_kg: f32, height_cm: f32) -> f32 {
    ClinicalFormulas::bmi(weight_kg, height_cm)
}

/// 计算 A5 双列折流排版布局 (输入 JSON 数组，输出分页分列布局 JSON)
#[wasm_bindgen]
pub fn layout_a5_snaking(
    items_json: &str,
    available_height_mm: f32,
    auto_compact: bool,
) -> Result<String, JsValue> {
    let items: Vec<LabItemRow> = serde_json::from_str(items_json)
        .map_err(|e| JsValue::from_str(&format!("JSON Parse Error: {}", e)))?;

    let avail_h = PhysicalLength::from_mm(available_height_mm);
    let row_h = PhysicalLength::from_mm(5.5);
    let header_h = PhysicalLength::from_mm(6.5);

    let pages = SnakingTableEngine::layout_snaking_table(
        &items,
        avail_h,
        row_h,
        header_h,
        auto_compact,
    );

    // 格式化输出为简单摘要 JSON
    let summary: Vec<_> = pages
        .iter()
        .map(|p| {
            serde_json::json!({
                "page_number": p.page_number,
                "columns": p.columns.iter().map(|c| {
                    serde_json::json!({
                        "col_idx": c.column_index,
                        "count": c.items.len(),
                    })
                }).collect::<Vec<_>>(),
                "row_height_mm": p.effective_row_height.as_mm(),
            })
        })
        .collect();

    serde_json::to_string(&summary)
        .map_err(|e| JsValue::from_str(&format!("Serialize Error: {}", e)))
}

/// 客户端纯矢量直出 A5 打印测试 PDF 字节流
#[wasm_bindgen]
pub fn export_demo_a5_pdf() -> Vec<u8> {
    let mut doc = VectorPdfDoc::new(PhysicalSize::a5_landscape());
    // 绘制标准页眉边框与分隔线
    doc.draw_rect(10.0, 8.0, 190.0, 132.0, true, false);
    doc.draw_line(10.0, 25.0, 200.0, 25.0, 0.75);
    // 绘制双列中轴分割线
    doc.draw_line(105.0, 25.0, 105.0, 125.0, 0.5);
    doc.compile_to_bytes()
}
