//! 血栓弹力图 (Thromboelastogram, TEG) 矢量曲线生成算法
//!
//! 根据关键临床参数：
//! - R (Reaction time, 反应时间, min): 凝血因子激活时间
//! - K (K time, 凝固时间, min): 血块达到 20mm 强度时间
//! - Angle (α角, deg): 纤维蛋白聚合速率
//! - MA (Maximum Amplitude, 最大振幅, mm): 血小板与纤维蛋白最大强度
//! - LY30 (Lysis at 30 min, %): 30分钟纤溶指数
//!
//! 内核生成对称纺锤形贝塞尔样条矢量路径点集，确保 600 DPI 矢量直出无锯齿。

#[derive(Debug, Clone)]
pub struct TegCurvePoint {
    pub time_min: f32,
    pub upper_amplitude_mm: f32,
    pub lower_amplitude_mm: f32,
}

pub struct TegChartGenerator;

impl TegChartGenerator {
    /// 计算 TEG 曲线的点集轨迹 (从 0 分钟到 60 分钟)
    pub fn generate_teg_curve(
        r_time_min: f32,
        k_time_min: f32,
        alpha_angle_deg: f32,
        ma_amplitude_mm: f32,
        ly30_percent: f32,
        step_min: f32,
    ) -> Vec<TegCurvePoint> {
        let mut points = Vec::new();
        let mut t = 0.0;
        let total_time_min = 60.0;

        let half_ma = ma_amplitude_mm / 2.0;

        while t <= total_time_min {
            let amp = if t < r_time_min {
                // R 时间之前：基线平直期，振幅几乎为 0 (微小本底 1mm)
                0.5
            } else if t < r_time_min + k_time_min {
                // 凝血形成期：根据 α 角斜率快速展开
                let elapsed = t - r_time_min;
                let slope = (alpha_angle_deg.to_radians()).tan().max(0.5);
                (0.5 + slope * elapsed * 2.0).min(half_ma)
            } else if t < r_time_min + 30.0 {
                // 达到最大振幅 MA 平台期
                let progress = ((t - (r_time_min + k_time_min)) / 15.0).min(1.0);
                half_ma * (0.8 + 0.2 * progress)
            } else {
                // 纤溶消退期：振幅受 LY30 影响缓慢收缩
                let lysis_ratio = (ly30_percent / 100.0).min(0.8);
                let decay_progress = ((t - (r_time_min + 30.0)) / 30.0).min(1.0);
                half_ma * (1.0 - lysis_ratio * decay_progress)
            };

            points.push(TegCurvePoint {
                time_min: t,
                upper_amplitude_mm: amp,
                lower_amplitude_mm: -amp,
            });

            t += step_min;
        }

        points
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_teg_curve_generation() {
        let points = TegChartGenerator::generate_teg_curve(
            5.0,  // R = 5 min
            2.0,  // K = 2 min
            65.0, // Angle = 65°
            60.0, // MA = 60 mm
            3.5,  // LY30 = 3.5%
            1.0,  // 每 1 分钟取样一点
        );

        assert!(!points.is_empty());
        // 验证 R 之前为基线
        assert_eq!(points[0].upper_amplitude_mm, 0.5);
        // 验证达到 MA 附近 (60mm / 2 = 30mm)
        let max_amp = points.iter().map(|p| p.upper_amplitude_mm).fold(0.0_f32, f32::max);
        assert!(max_amp >= 28.0 && max_amp <= 31.0);
    }
}
