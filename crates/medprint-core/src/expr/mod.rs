//! 临床医疗公式与动态人口学参考值计算引擎 (Clinical Formulas & Dynamic Evaluators)

use crate::schema::{AgeUnit, AlertFlag, Gender, PatientInfo};

/// 临床公式计算库
pub struct ClinicalFormulas;

impl ClinicalFormulas {
    /// 估算肾小球滤过率 (eGFR) - 基于国际推荐标准 CKD-EPI 2021 公式 (无种族差异最新版)
    ///
    /// * `scr_mg_dl`: 血清肌酐 (mg/dL，若为 umol/L 需除以 88.4)
    /// * `age`: 年龄 (岁)
    /// * `is_female`: 是否女性
    pub fn egfr_ckd_epi(scr_mg_dl: f32, age: u32, is_female: bool) -> f32 {
        let (kappa, alpha, factor) = if is_female {
            (0.7, -0.241, 1.012)
        } else {
            (0.9, -0.302, 1.0)
        };

        let min_val = (scr_mg_dl / kappa).min(1.0).powf(alpha);
        let max_val = (scr_mg_dl / kappa).max(1.0).powf(-1.200);
        let age_factor = 0.9938_f32.powi(age as i32);

        142.0 * min_val * max_val * age_factor * factor
    }

    /// 低密度脂蛋白胆固醇 (LDL-C) - Friedewald 公式
    /// LDL-C = TC - HDL-C - (TG / 2.2) [mmol/L]
    pub fn ldl_c_friedewald(tc_mmol: f32, hdl_mmol: f32, tg_mmol: f32) -> Option<f32> {
        // 当甘油三酯 > 4.52 mmol/L (400 mg/dL) 时该公式不再适用
        if tg_mmol > 4.52 {
            return None;
        }
        Some((tc_mmol - hdl_mmol - (tg_mmol / 2.2)).max(0.0))
    }

    /// 体质指数 (BMI) = 体重(kg) / [身高(m)]^2
    pub fn bmi(weight_kg: f32, height_cm: f32) -> f32 {
        let height_m = height_cm / 100.0;
        if height_m <= 0.0 {
            return 0.0;
        }
        weight_kg / (height_m * height_m)
    }

    /// 阴离子间隙 (Anion Gap, AG) = Na+ - (Cl- + HCO3-) [mmol/L]
    pub fn anion_gap(na_mmol: f32, cl_mmol: f32, hco3_mmol: f32) -> f32 {
        na_mmol - (cl_mmol + hco3_mmol)
    }

    /// 校正血清钙 (Corrected Calcium) = 实测钙 + 0.8 * (40 - 白蛋白 g/L) / 10
    pub fn corrected_calcium(total_ca_mmol: f32, albumin_g_l: f32) -> f32 {
        total_ca_mmol + 0.02 * (40.0 - albumin_g_l)
    }

    /// 氧合指数 (PaO2 / FiO2)
    /// * `pao2_mmhg`: 动脉氧分压 (mmHg)
    /// * `fio2_percent`: 吸氧浓度百分比 (21% ~ 100%)
    pub fn oxygenation_index(pao2_mmhg: f32, fio2_percent: f32) -> f32 {
        if fio2_percent <= 0.0 {
            return 0.0;
        }
        pao2_mmhg / (fio2_percent / 100.0)
    }
}

/// 人口学动态参考区间规则
#[derive(Debug, Clone)]
pub struct DemographicRefRangeRule {
    pub min_val: f32,
    pub max_val: f32,
    pub critical_low: Option<f32>,
    pub critical_high: Option<f32>,
}

/// 动态参考区间匹配与判定
pub struct DemographicEvaluator;

impl DemographicEvaluator {
    /// 评估某数值在患者人口学特征下的状态 (正常, 偏高↑, 偏低↓, 危急值★)
    pub fn evaluate(
        value: f32,
        rule: &DemographicRefRangeRule,
    ) -> AlertFlag {
        // 先判定危急值
        if let Some(crit_low) = rule.critical_low {
            if value < crit_low {
                return AlertFlag::Critical;
            }
        }
        if let Some(crit_high) = rule.critical_high {
            if value > crit_high {
                return AlertFlag::Critical;
            }
        }

        // 再判定常规偏高偏低
        if value < rule.min_val {
            AlertFlag::Low
        } else if value > rule.max_val {
            AlertFlag::High
        } else {
            AlertFlag::Normal
        }
    }

    /// 示例：血红蛋白 (Hb) 根据性别/年龄动态获取参考范围
    pub fn get_hemoglobin_ref(patient: &PatientInfo) -> (f32, f32, String) {
        if patient.age_unit == AgeUnit::Day && patient.age <= 28 {
            (170.0, 200.0, "170.0 - 200.0 g/L".to_string()) // 新生儿
        } else if patient.is_pregnant {
            (110.0, 150.0, "110.0 - 150.0 g/L (孕期)".to_string()) // 孕妇
        } else if patient.gender == Gender::Male {
            (130.0, 175.0, "130.0 - 175.0 g/L".to_string()) // 成年男性
        } else {
            (115.0, 150.0, "115.0 - 150.0 g/L".to_string()) // 成年女性
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_medical_formulas() {
        // 测试 BMI
        let bmi = ClinicalFormulas::bmi(70.0, 175.0);
        assert!((bmi - 22.86).abs() < 0.1);

        // 测试 eGFR (男性 45岁，肌酐 1.0 mg/dL)
        let egfr = ClinicalFormulas::egfr_ckd_epi(1.0, 45, false);
        assert!(egfr > 80.0 && egfr < 100.0);

        // 测试阴离子间隙 (Na: 140, Cl: 102, HCO3: 24) => AG: 14
        let ag = ClinicalFormulas::anion_gap(140.0, 102.0, 24.0);
        assert_eq!(ag, 14.0);
    }

    #[test]
    fn test_demographic_evaluator() {
        let rule = DemographicRefRangeRule {
            min_val: 130.0,
            max_val: 175.0,
            critical_low: Some(60.0),
            critical_high: Some(210.0),
        };

        assert_eq!(DemographicEvaluator::evaluate(150.0, &rule), AlertFlag::Normal);
        assert_eq!(DemographicEvaluator::evaluate(180.0, &rule), AlertFlag::High);
        assert_eq!(DemographicEvaluator::evaluate(120.0, &rule), AlertFlag::Low);
        assert_eq!(DemographicEvaluator::evaluate(55.0, &rule), AlertFlag::Critical);
    }
}
