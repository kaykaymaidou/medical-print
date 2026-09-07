//! 针式打印机 (ESC/P2) 与热敏标签机 (TSPL) 原生指令驱动
//!
//! 专为医疗三联复写纸、穿孔折叠纸、采血管标签直接生成微秒级硬件指令，杜绝光栅驱动降速与穿孔线累积漂移。

/// 爱普生针式打印机 (如 LQ-630K / 得实) ESC/P2 指令生成器
pub struct EscP2Driver;

impl EscP2Driver {
    /// 初始化打印机 (ESC @)
    pub fn init() -> Vec<u8> {
        vec![0x1B, 0x40]
    }

    /// 设置页长为指定行数 (ESC C n)
    pub fn set_page_length_lines(lines: u8) -> Vec<u8> {
        vec![0x1B, 0x43, lines]
    }

    /// 设置跳过穿孔线边距 (ESC N n，单位为行)
    pub fn set_skip_perforation(skip_lines: u8) -> Vec<u8> {
        vec![0x1B, 0x4E, skip_lines]
    }

    /// 执行换页与自动进退纸到撕纸位 (FF)
    pub fn form_feed_to_tear_off() -> Vec<u8> {
        vec![0x0C]
    }
}

/// 热敏条码打印机 TSPL 指令生成器 (如斑马/新北洋/佳博 采血管标签)
pub struct TsplDriver;

impl TsplDriver {
    /// 设置标签物理尺寸与间距 (mm)
    pub fn setup_label_mm(width_mm: u32, height_mm: u32, gap_mm: u32) -> String {
        format!("SIZE {} mm, {} mm\nGAP {} mm, 0 mm\nCLS\n", width_mm, height_mm, gap_mm)
    }

    /// 绘制高精 Code128 条码
    pub fn draw_code128(x: u32, y: u32, height: u32, data: &str) -> String {
        format!("BARCODE {}, {}, \"128\", {}, 1, 0, 2, 2, \"{}\"\n", x, y, height, data)
    }

    /// 触发打印单张
    pub fn print_one() -> String {
        "PRINT 1, 1\n".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_drivers() {
        let esc = EscP2Driver::init();
        assert_eq!(esc, vec![0x1B, 0x40]);

        let tspl = TsplDriver::setup_label_mm(50, 30, 2);
        assert!(tspl.contains("SIZE 50 mm, 30 mm"));
    }
}
