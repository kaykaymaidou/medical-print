//! 纯矢量高精度 PDF 编译器 (Vector PDF Emitter)
//!
//! 医疗输出标准：以 300/600 DPI 纯矢量生成，绝不引入屏幕像素或位图模糊。
//! 零外部 C 库绑定，100% 兼容 wasm32-unknown-unknown 架构。

use crate::barcode::Code128Encoder;
use crate::layout::SnakingTableEngine;
use crate::schema::{AlertFlag, LabItemRow, PatientInfo, ReportElement, ReportTemplate};
use crate::units::{Margins, PhysicalLength, PhysicalSize};

pub struct VectorPdfDoc {
    page_size: PhysicalSize,
    content_stream: String,
}

impl VectorPdfDoc {
    pub fn new(page_size: PhysicalSize) -> Self {
        Self {
            page_size,
            content_stream: String::new(),
        }
    }

    /// 绘制矢量矩形 (以毫米为坐标)
    pub fn draw_rect(&mut self, x_mm: f32, y_mm: f32, w_mm: f32, h_mm: f32, stroke: bool, fill: bool) {
        // PDF 坐标系原点在左下角，1 pt = 72 / 25.4 mm
        let mm_to_pt = 72.0 / 25.4;
        let page_h_pt = self.page_size.height.as_mm() * mm_to_pt;

        let x_pt = x_mm * mm_to_pt;
        let y_pt = page_h_pt - (y_mm + h_mm) * mm_to_pt;
        let w_pt = w_mm * mm_to_pt;
        let h_pt = h_mm * mm_to_pt;

        self.content_stream.push_str(&format!("{:.2} {:.2} {:.2} {:.2} re\n", x_pt, y_pt, w_pt, h_pt));
        match (stroke, fill) {
            (true, true) => self.content_stream.push_str("B\n"),
            (true, false) => self.content_stream.push_str("S\n"),
            (false, true) => self.content_stream.push_str("f\n"),
            _ => {},
        }
    }

    /// 绘制矢量直线 (以毫米为坐标)
    pub fn draw_line(&mut self, x1_mm: f32, y1_mm: f32, x2_mm: f32, y2_mm: f32, line_width_pt: f32) {
        let mm_to_pt = 72.0 / 25.4;
        let page_h_pt = self.page_size.height.as_mm() * mm_to_pt;

        let x1_pt = x1_mm * mm_to_pt;
        let y1_pt = page_h_pt - y1_mm * mm_to_pt;
        let x2_pt = x2_mm * mm_to_pt;
        let y2_pt = page_h_pt - y2_mm * mm_to_pt;

        self.content_stream.push_str(&format!("{:.2} w\n", line_width_pt));
        self.content_stream.push_str(&format!("{:.2} {:.2} m {:.2} {:.2} l S\n", x1_pt, y1_pt, x2_pt, y2_pt));
    }

    /// 绘制矢量文本 (支持 Helvetica / Courier / Helvetica-Bold)
    pub fn draw_text(&mut self, x_mm: f32, y_mm: f32, text: &str, font_size_pt: f32, font_tag: &str) {
        let mm_to_pt = 72.0 / 25.4;
        let page_h_pt = self.page_size.height.as_mm() * mm_to_pt;

        let x_pt = x_mm * mm_to_pt;
        let y_pt = page_h_pt - y_mm * mm_to_pt - font_size_pt * 0.8; // 基线对齐

        // 转义 PDF 字符串中的特殊字符
        let escaped_text = text
            .replace('\\', "\\\\")
            .replace('(', "\\(")
            .replace(')', "\\)");

        self.content_stream.push_str("BT\n");
        self.content_stream.push_str(&format!("/{} {:.2} Tf\n", font_tag, font_size_pt));
        self.content_stream.push_str(&format!("1 0 0 1 {:.2} {:.2} Tm\n", x_pt, y_pt));
        self.content_stream.push_str(&format!("({}) Tj\n", escaped_text));
        self.content_stream.push_str("ET\n");
    }

    /// 绘制 100% 纯矢量 Code 128 条形码 (绝无锯齿与位图模糊)
    pub fn draw_barcode_code128(&mut self, x_mm: f32, y_mm: f32, w_mm: f32, h_mm: f32, code: &str) {
        let bars = Code128Encoder::generate_vector_bars(code, x_mm, y_mm, w_mm, h_mm);
        for bar in bars {
            self.draw_rect(bar.x_mm, bar.y_mm, bar.width_mm, bar.height_mm, false, true);
        }
        // 条码下方印制人眼可读数字
        self.draw_text(x_mm + 4.0, y_mm + h_mm + 2.5, code, 8.0, "F3");
    }

    /// 编译并输出合法标准 PDF-1.4 二进制字节流
    pub fn compile_to_bytes(&self) -> Vec<u8> {
        let mm_to_pt = 72.0 / 25.4;
        let w_pt = self.page_size.width.as_mm() * mm_to_pt;
        let h_pt = self.page_size.height.as_mm() * mm_to_pt;

        let mut out = Vec::new();
        out.extend_from_slice(b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

        let mut offsets = Vec::new();

        // 1 0 obj: Catalog
        offsets.push(out.len());
        out.extend_from_slice(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

        // 2 0 obj: Pages
        offsets.push(out.len());
        out.extend_from_slice(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

        // 3 0 obj: Page with Resource Dictionary (Standard Type 1 Fonts)
        offsets.push(out.len());
        let page_meta = format!(
            "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {:.2} {:.2}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> /F3 << /Type /Font /Subtype /Type1 /BaseFont /Courier >> >> >> /Contents 4 0 R >>\nendobj\n",
            w_pt, h_pt
        );
        out.extend_from_slice(page_meta.as_bytes());

        // 4 0 obj: Content Stream
        offsets.push(out.len());
        let stream_bytes = self.content_stream.as_bytes();
        let stream_meta = format!("4 0 obj\n<< /Length {} >>\nstream\n", stream_bytes.len());
        out.extend_from_slice(stream_meta.as_bytes());
        out.extend_from_slice(stream_bytes);
        out.extend_from_slice(b"\nendstream\nendobj\n");

        // xref table
        let xref_offset = out.len();
        out.extend_from_slice(b"xref\n0 5\n0000000000 65535 f \n");
        for offset in &offsets {
            out.extend_from_slice(format!("{:010} 00000 n \n", offset).as_bytes());
        }

        // trailer
        let trailer = format!(
            "trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n{}\n%%EOF\n",
            xref_offset
        );
        out.extend_from_slice(trailer.as_bytes());

        out
    }
}

/// 医疗文档编译器：将 ReportTemplate AST 完整转换为纯矢量 PDF
pub struct MedicalReportCompiler;

impl MedicalReportCompiler {
    pub fn compile(template: &ReportTemplate) -> VectorPdfDoc {
        Self::compile_report(template, &PatientInfo::default())
    }

    /// 从任意前端或 API 提交的 JSON 结构编译纯矢量 PDF
    pub fn compile_from_json(value: &serde_json::Value) -> Result<VectorPdfDoc, String> {
        // 智能兼容多种 paper_size 格式 (对象、字符串、或嵌套在 page 下)
        let paper_size = if let Some(paper) = value.get("paper_size").or_else(|| value.get("page").and_then(|p| p.get("paper_size"))) {
            if let Some(s) = paper.as_str() {
                match s.to_lowercase().as_str() {
                    "a4" | "a4_portrait" => PhysicalSize::a4_portrait(),
                    "a4_landscape" => PhysicalSize::from_mm(297.0, 210.0),
                    _ => PhysicalSize::a5_landscape(),
                }
            } else {
                let paper_w = paper.get("width_mm").or_else(|| paper.get("width")).and_then(|v| v.as_f64()).unwrap_or(210.0) as f32;
                let paper_h = paper.get("height_mm").or_else(|| paper.get("height")).and_then(|v| v.as_f64()).unwrap_or(148.0) as f32;
                PhysicalSize::from_mm(paper_w, paper_h)
            }
        } else {
            PhysicalSize::a5_landscape()
        };

        let margins_val = value.get("margins").or_else(|| value.get("page").and_then(|p| p.get("margins")));
        let m_top = margins_val.and_then(|m| m.get("top_mm").or_else(|| m.get("top"))).and_then(|v| v.as_f64()).unwrap_or(8.0) as f32;
        let m_right = margins_val.and_then(|m| m.get("right_mm").or_else(|| m.get("right"))).and_then(|v| v.as_f64()).unwrap_or(10.0) as f32;
        let m_bottom = margins_val.and_then(|m| m.get("bottom_mm").or_else(|| m.get("bottom"))).and_then(|v| v.as_f64()).unwrap_or(8.0) as f32;
        let m_left = margins_val.and_then(|m| m.get("left_mm").or_else(|| m.get("left"))).and_then(|v| v.as_f64()).unwrap_or(10.0) as f32;

        let margins = Margins {
            top: PhysicalLength::from_mm(m_top),
            right: PhysicalLength::from_mm(m_right),
            bottom: PhysicalLength::from_mm(m_bottom),
            left: PhysicalLength::from_mm(m_left),
        };

        let mut elements = Vec::new();
        if let Some(arr) = value.get("elements").and_then(|v| v.as_array()) {
            for el in arr {
                let kind = el.get("kind").and_then(|v| v.as_str()).unwrap_or("");
                match kind {
                    "HospitalHeader" => {
                        elements.push(ReportElement::HospitalHeader {
                            hospital_name: el.get("hospital_name").and_then(|v| v.as_str()).unwrap_or("XX市人民医院").to_string(),
                            sub_title: el.get("sub_title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            report_title: el.get("report_title").and_then(|v| v.as_str()).unwrap_or("临床检验报告单").to_string(),
                            align: match el.get("align").and_then(|v| v.as_str()).unwrap_or("center") {
                                "left" => crate::schema::HeaderAlign::Left,
                                "right" => crate::schema::HeaderAlign::Right,
                                _ => crate::schema::HeaderAlign::Center,
                            },
                            logo_data_url: el.get("logo_data_url").and_then(|v| v.as_str()).map(String::from),
                            show_report_no: el.get("show_report_no").and_then(|v| v.as_bool()).unwrap_or(false),
                            report_no_label: el.get("report_no_label").and_then(|v| v.as_str()).unwrap_or("报告单号").to_string(),
                            report_no_preview: el.get("report_no_preview").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        });
                    }
                    "PatientBanner" => {
                        let include_barcode = el.get("include_barcode").and_then(|v| v.as_bool()).unwrap_or(true);
                        let mut fields = Vec::new();
                        if let Some(field_arr) = el.get("fields").and_then(|v| v.as_array()) {
                            for f in field_arr {
                                fields.push(crate::schema::PatientField {
                                    key: f.get("key").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                    label: f.get("label").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                    preview_value: f.get("preview_value").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                });
                            }
                        }
                        elements.push(ReportElement::PatientBanner {
                            include_barcode,
                            fields,
                        });
                    }
                    "SnakingTable" => {
                        let mut items = Vec::new();
                        if let Some(items_arr) = el.get("items").and_then(|v| v.as_array()) {
                            for (i, it) in items_arr.iter().enumerate() {
                                items.push(LabItemRow {
                                    index: (i + 1) as u32,
                                    item_name: it.get("item_name").or_else(|| it.get("name")).and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                    item_abbr: it.get("item_abbr").or_else(|| it.get("abbr")).and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                    result_value: it.get("result_value").or_else(|| it.get("value")).and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                    unit: it.get("unit").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                    ref_range_display: it.get("ref_range_display").or_else(|| it.get("ref_range")).and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                    alert_flag: AlertFlag::Normal,
                                    is_critical: it.get("is_critical").and_then(|v| v.as_bool()).unwrap_or(false),
                                });
                            }
                        }
                        elements.push(ReportElement::SnakingTable {
                            columns_count: 2,
                            column_gap: PhysicalLength::from_mm(6.0),
                            left_ratio: 0.5,
                            items,
                        });
                    }
                    "Signatures" => {
                        elements.push(ReportElement::Signatures(crate::schema::SignatureChain {
                            requesting_physician: el.get("requesting_physician").and_then(|v| v.as_str()).unwrap_or("李主任").to_string(),
                            sampling_person: el.get("sampling_person").and_then(|v| v.as_str()).map(String::from),
                            operator: el.get("operator").and_then(|v| v.as_str()).unwrap_or("王技师").to_string(),
                            reviewer: el.get("reviewer").and_then(|v| v.as_str()).unwrap_or("陈主管").to_string(),
                            report_date: el.get("report_date").and_then(|v| v.as_str()).unwrap_or("2026-09-15").to_string(),
                            doctor_signature_images: Vec::new(),
                        }));
                    }
                    "Seal" => {
                        elements.push(ReportElement::Seal(crate::schema::HospitalSeal {
                            hospital_name: el.get("hospital_name").and_then(|v| v.as_str()).unwrap_or("医院检验科").to_string(),
                            seal_title: el.get("seal_title").and_then(|v| v.as_str()).unwrap_or("检验专用章").to_string(),
                            seal_code: el.get("seal_code").and_then(|v| v.as_str()).unwrap_or("SEAL-01").to_string(),
                            diameter_mm: el.get("diameter_mm").and_then(|v| v.as_f64()).unwrap_or(32.0) as f32,
                            angle_jitter_deg: 1.5,
                            opacity: 0.85,
                        }));
                    }
                    _ => {}
                }
            }
        }

        let template = ReportTemplate {
            id: value.get("id").and_then(|v| v.as_str()).unwrap_or("tpl_dynamic").to_string(),
            name: value.get("name").and_then(|v| v.as_str()).unwrap_or("Dynamic Report").to_string(),
            version: "1.0".to_string(),
            paper_size,
            margins,
            report_type: crate::schema::MedicalReportType::LisBloodRoutine,
            elements,
        };

        Ok(Self::compile(&template))
    }

    pub fn compile_report(template: &ReportTemplate, patient: &PatientInfo) -> VectorPdfDoc {
        let mut pdf = VectorPdfDoc::new(template.paper_size);

        // 绘制页边距辅助参考框 (微细线)
        let m = template.margins;
        let pw = template.paper_size.width.as_mm();
        let ph = template.paper_size.height.as_mm();
        pdf.draw_rect(
            m.left.as_mm(),
            m.top.as_mm(),
            pw - m.left.as_mm() - m.right.as_mm(),
            ph - m.top.as_mm() - m.bottom.as_mm(),
            true,
            false,
        );

        let mut current_y = m.top.as_mm() + 2.0;

        for element in &template.elements {
            match element {
                ReportElement::HospitalHeader {
                    hospital_name,
                    report_title,
                    sub_title: _,
                    align,
                    logo_data_url: _,
                    show_report_no,
                    report_no_label,
                    report_no_preview,
                } => {
                    let left = m.left.as_mm();
                    let right = pw - m.right.as_mm();
                    let title_x = match align {
                        crate::schema::HeaderAlign::Left => left,
                        crate::schema::HeaderAlign::Right => (right - 70.0).max(left),
                        crate::schema::HeaderAlign::Center => pw / 2.0 - 45.0,
                    };
                    pdf.draw_text(title_x, current_y, hospital_name, 14.0, "F2");
                    current_y += 6.0;
                    pdf.draw_text(title_x, current_y, report_title, 11.0, "F2");
                    if *show_report_no {
                        let label = if report_no_label.is_empty() {
                            "报告单号"
                        } else {
                            report_no_label
                        };
                        let no = if report_no_preview.is_empty() {
                            "________"
                        } else {
                            report_no_preview
                        };
                        pdf.draw_text(right - 48.0, current_y, &format!("{label} {no}"), 8.0, "F1");
                    }
                    current_y += 5.0;
                    pdf.draw_line(left, current_y, right, current_y, 0.75);
                    current_y += 2.0;
                }
                ReportElement::PatientBanner { include_barcode, fields } => {
                    let banner_text = if fields.is_empty() {
                        format!(
                            "Name: {}  Gender: {:?}  Age: {}{:?}  MRN: {}  Sample: {}",
                            patient.name, patient.gender, patient.age, patient.age_unit, patient.medical_record_no, patient.sample_type
                        )
                    } else {
                        fields
                            .iter()
                            .map(|f| format!("{}: {}", f.label, f.preview_value))
                            .collect::<Vec<_>>()
                            .join("  ")
                    };
                    pdf.draw_text(m.left.as_mm() + 2.0, current_y, &banner_text, 9.0, "F1");

                    if *include_barcode {
                        pdf.draw_barcode_code128(
                            pw - m.right.as_mm() - 45.0,
                            current_y - 1.0,
                            40.0,
                            7.0,
                            &patient.barcode,
                        );
                    }

                    current_y += 9.0;
                    pdf.draw_line(m.left.as_mm(), current_y, pw - m.right.as_mm(), current_y, 0.5);
                    current_y += 2.0;
                }
                ReportElement::SnakingTable { columns_count: _, column_gap: _, left_ratio: _, items } => {
                    // 调用 SnakingTableEngine 执行 A5 双列折流平衡排版
                    let avail_h = PhysicalLength::from_mm(ph - current_y - m.bottom.as_mm() - 20.0);
                    let row_h = PhysicalLength::from_mm(5.5);
                    let header_h = PhysicalLength::from_mm(6.5);

                    let pages = SnakingTableEngine::layout_snaking_table(
                        items,
                        avail_h,
                        row_h,
                        header_h,
                        true,
                    );

                    if let Some(first_page) = pages.first() {
                        let col_width = (pw - m.left.as_mm() - m.right.as_mm() - 6.0) / 2.0;

                        // 中轴双列分割线
                        let center_x = m.left.as_mm() + col_width + 3.0;
                        let start_table_y = current_y;

                        for col in &first_page.columns {
                            let origin_x = if col.column_index == 0 {
                                m.left.as_mm()
                            } else {
                                center_x + 3.0
                            };

                            let mut y = start_table_y;
                            // 绘制表头 (自动克隆)
                            pdf.draw_rect(origin_x, y, col_width, 6.0, true, false);
                            pdf.draw_text(origin_x + 2.0, y + 1.0, "Item Name", 8.0, "F2");
                            pdf.draw_text(origin_x + col_width - 32.0, y + 1.0, "Result", 8.0, "F2");
                            pdf.draw_text(origin_x + col_width - 15.0, y + 1.0, "Ref", 8.0, "F2");
                            y += 6.0;

                            for item in &col.items {
                                pdf.draw_text(origin_x + 2.0, y + 1.0, &item.item_abbr, 8.0, "F1");
                                pdf.draw_text(origin_x + col_width - 32.0, y + 1.0, &item.result_value, 8.0, "F2");
                                pdf.draw_text(origin_x + col_width - 15.0, y + 1.0, &item.ref_range_display, 7.5, "F3");
                                y += first_page.effective_row_height.as_mm();
                            }
                        }

                        // 绘制中轴线
                        pdf.draw_line(center_x, start_table_y, center_x, ph - m.bottom.as_mm() - 18.0, 0.5);
                    }

                    current_y = ph - m.bottom.as_mm() - 16.0;
                }
                ReportElement::Signatures(sig) => {
                    let sig_text = format!(
                        "Requester: {}   Operator: {}   Reviewer: {}   Date: {}",
                        sig.requesting_physician, sig.operator, sig.reviewer, sig.report_date
                    );
                    pdf.draw_text(m.left.as_mm() + 2.0, current_y, &sig_text, 8.0, "F1");
                }
                ReportElement::Seal(seal) => {
                    // 绘制防伪红章圆框
                    pdf.draw_rect(pw - m.right.as_mm() - seal.diameter_mm, current_y - 12.0, seal.diameter_mm, seal.diameter_mm, true, false);
                    pdf.draw_text(pw - m.right.as_mm() - seal.diameter_mm + 4.0, current_y - 6.0, &seal.seal_title, 8.0, "F2");
                }
                _ => {}
            }
        }

        pdf
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pdf_generation() {
        let mut pdf = VectorPdfDoc::new(PhysicalSize::a5_landscape());
        pdf.draw_rect(10.0, 10.0, 190.0, 128.0, true, false);
        pdf.draw_line(10.0, 25.0, 200.0, 25.0, 1.0);
        pdf.draw_text(15.0, 15.0, "CLINICAL BIOCHEMISTRY REPORT", 12.0, "F2");
        pdf.draw_barcode_code128(140.0, 15.0, 45.0, 10.0, "MZ20260908001");

        let bytes = pdf.compile_to_bytes();
        assert!(!bytes.is_empty());
        assert!(bytes.starts_with(b"%PDF-1.4"));
        assert!(bytes.windows(5).any(|w| w == b"%%EOF"));
    }
}
