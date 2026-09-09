//! Code 128 纯矢量条形码生成器 (ISO/IEC 15417)
//!
//! 支持医疗采血管条码 (如 MZ20260908001) 与住院病人腕带编号。
//! 计算校验位并输出由纯物理毫米矩形构成的条码矢量路径。

/// 单个黑色条块的几何定义 (以毫米为单位)
#[derive(Debug, Clone, PartialEq)]
pub struct BarcodeBar {
    pub x_mm: f32,
    pub y_mm: f32,
    pub width_mm: f32,
    pub height_mm: f32,
}

pub struct Code128Encoder;

impl Code128Encoder {
    /// 标准 Code 128 图案表 (0 到 106)
    /// 每一项代表 3条3空 (共6个数字，表示模块宽度 1~4，Stop 码有7个数字)
    const PATTERNS: [&'static str; 107] = [
        "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
        "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
        "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
        "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
        "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
        "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
        "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
        "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
        "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
        "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
        "114131", "311141", "411131", "211412", "211214", "211232", "2331112", // 100-106 (104=Start B, 106=Stop)
    ];

    const START_B: usize = 104;
    const STOP: usize = 106;

    /// 将 ASCII 字符串编码为 Code 128B 符号索引数组 (包含起始符、数据符、校验符、终止符)
    pub fn encode_symbols(text: &str) -> Vec<usize> {
        let mut symbols = Vec::new();
        symbols.push(Self::START_B);

        let mut checksum: usize = Self::START_B;

        for (pos, ch) in text.chars().enumerate() {
            let val = if ch as usize >= 32 && ch as usize <= 126 {
                (ch as usize) - 32
            } else {
                0 // 非法字符替换为空格
            };
            symbols.push(val);
            checksum += (pos + 1) * val;
        }

        let check_symbol = checksum % 103;
        symbols.push(check_symbol);
        symbols.push(Self::STOP);

        symbols
    }

    /// 将文本编码为一系列物理毫米矩形 (纯矢量黑条)
    ///
    /// * `text`: 待编码文本 (如采血管流水号 "MZ20260908001")
    /// * `origin_x_mm`: 起始 X 坐标 (毫米)
    /// * `origin_y_mm`: 起始 Y 坐标 (毫米)
    /// * `total_width_mm`: 条码期望总宽度 (毫米)
    /// * `height_mm`: 条码条高 (毫米，通常 10mm ~ 15mm)
    pub fn generate_vector_bars(
        text: &str,
        origin_x_mm: f32,
        origin_y_mm: f32,
        total_width_mm: f32,
        height_mm: f32,
    ) -> Vec<BarcodeBar> {
        let symbols = Self::encode_symbols(text);

        // 计算总模块数 (每个普通符号11模块，Stop符号13模块，加左右各10模块静区)
        let quiet_zone_modules = 10.0;
        let data_modules = ((symbols.len() - 1) * 11 + 13) as f32;
        let total_modules = data_modules + quiet_zone_modules * 2.0;

        let module_width_mm = total_width_mm / total_modules;

        let mut bars = Vec::new();
        let mut current_x = origin_x_mm + quiet_zone_modules * module_width_mm;

        for &sym in &symbols {
            let pattern = Self::PATTERNS[sym];
            let mut is_bar = true;

            for char_width in pattern.chars() {
                let width_in_modules = char_width.to_digit(10).unwrap_or(1) as f32;
                let segment_width_mm = width_in_modules * module_width_mm;

                if is_bar {
                    bars.push(BarcodeBar {
                        x_mm: current_x,
                        y_mm: origin_y_mm,
                        width_mm: segment_width_mm,
                        height_mm,
                    });
                }

                current_x += segment_width_mm;
                is_bar = !is_bar; // 交互为空
            }
        }

        bars
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_code128_encode_symbols() {
        let text = "TEST123";
        let symbols = Code128Encoder::encode_symbols(text);
        assert_eq!(symbols[0], 104); // Start B
        assert_eq!(*symbols.last().unwrap(), 106); // Stop
        assert_eq!(symbols.len(), text.len() + 3); // Start + text + Checksum + Stop
    }

    #[test]
    fn test_code128_vector_bars_generation() {
        let text = "MZ20260908001";
        let bars = Code128Encoder::generate_vector_bars(text, 10.0, 10.0, 60.0, 12.0);
        assert!(!bars.is_empty());
        // 所有黑条必须在合法坐标范围内
        for bar in &bars {
            assert!(bar.x_mm >= 10.0);
            assert!(bar.x_mm + bar.width_mm <= 70.0);
            assert_eq!(bar.height_mm, 12.0);
        }
    }
}
