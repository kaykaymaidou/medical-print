//! 纯矢量高精度 PDF 编译器 (Vector PDF Emitter)
//!
//! 医疗输出标准：以 300/600 DPI 纯矢量生成，绝不引入屏幕像素或位图模糊。
//! 零外部 C 库绑定，100% 兼容 wasm32-unknown-unknown 架构。

use crate::units::PhysicalSize;

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
        // PDF 坐标系原点在左下角，1 pt = 25.4 / 72 mm
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

    /// 绘制矢量直线
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

    /// 编译并输出合法标准 PDF 二进制字节流 (PDF-1.4)
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

        // 3 0 obj: Page
        offsets.push(out.len());
        let page_meta = format!(
            "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {:.2} {:.2}] /Contents 4 0 R >>\nendobj\n",
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

        // xref
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pdf_generation() {
        let mut pdf = VectorPdfDoc::new(PhysicalSize::a5_landscape());
        pdf.draw_line(10.0, 10.0, 200.0, 10.0, 1.0);
        pdf.draw_rect(10.0, 15.0, 50.0, 20.0, true, false);

        let bytes = pdf.compile_to_bytes();
        assert!(bytes.starts_with(b"%PDF-1.4"));
        assert!(bytes.ends_with(b"%%EOF\n"));
    }
}
