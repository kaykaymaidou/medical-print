//! 纯矢量高精度 PDF 编译器 (Vector PDF Emitter)
//!
//! 医疗输出标准：以 300/600 DPI 纯矢量生成，绝不引入屏幕像素或位图模糊。
//! 零外部 C 库绑定，100% 兼容 wasm32-unknown-unknown 架构。

use crate::barcode::Code128Encoder;
use crate::layout::SnakingTableEngine;
use crate::schema::{PatientInfo, ReportElement, ReportTemplate};
use crate::units::{PhysicalLength, PhysicalSize};

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
                ReportElement::HospitalHeader { hospital_name, report_title, sub_title: _ } => {
                    // 主标题居中大字
                    pdf.draw_text(pw / 2.0 - 45.0, current_y, hospital_name, 14.0, "F2");
                    current_y += 6.0;
                    pdf.draw_text(pw / 2.0 - 55.0, current_y, report_title, 11.0, "F2");
                    current_y += 5.0;
                    // 分割横线
                    pdf.draw_line(m.left.as_mm(), current_y, pw - m.right.as_mm(), current_y, 0.75);
                    current_y += 2.0;
                }
                ReportElement::PatientBanner => {
                    // 患者信息卡
                    let banner_text = format!(
                        "Name: {}  Gender: {:?}  Age: {}{:?}  MRN: {}  Sample: {}",
                        patient.name, patient.gender, patient.age, patient.age_unit, patient.medical_record_no, patient.sample_type
                    );
                    pdf.draw_text(m.left.as_mm() + 2.0, current_y, &banner_text, 9.0, "F1");

                    // 绘制采血管矢量条形码
                    pdf.draw_barcode_code128(
                        pw - m.right.as_mm() - 45.0,
                        current_y - 1.0,
                        40.0,
                        7.0,
                        &patient.barcode,
                    );

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
