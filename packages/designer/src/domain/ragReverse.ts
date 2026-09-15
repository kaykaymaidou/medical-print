/**
 * 前端 RAG 检索与 Pi Agent 逆向生成服务桥接
 */

import {
  reverseGenerateTemplate,
  type ReverseGenerationResult,
  type PipelineStepLog,
  type DocumentFingerprint,
} from '../../../ai-agent/src/rag/index'
import type { ModelProviderSettings } from './modelSettings'
import type { ReportTemplate } from './reportAst'

export { type ReverseGenerationResult, type PipelineStepLog, type DocumentFingerprint }

export interface PresetSample {
  id: string
  name: string
  sourceType: 'Word/文本表格' | 'PDF OCR' | '旧系统DSL'
  tag: string
  content: string
}

export const RAG_PRESET_SAMPLES: PresetSample[] = [
  {
    id: 'sample_blood_24',
    name: '全血细胞分析 (血常规24项) Word表格',
    sourceType: 'Word/文本表格',
    tag: 'A5 双列折流',
    content: `北京协和医院 临床检验中心
血液学检验报告单
姓名：周德发  性别：男  年龄：48岁  病案号：MR990182  科室：心内科  床号：15床
标本类型：全血  采血管条码：LIS20260915-9988

1  白细胞计数  WBC  11.5  10^9/L  3.5-9.5
2  红细胞计数  RBC  4.20  10^12/L  4.3-5.8
3  血红蛋白测定  HGB  135.0  g/L  130-175
4  红细胞压积  HCT  41.2  %  40-50
5  平均红细胞体积  MCV  91.0  fL  82-100
6  平均红细胞血红蛋白量  MCH  30.2  pg  27-34
7  平均血红蛋白浓度  MCHC  332.0  g/L  316-354
8  血小板计数  PLT  85.0  10^9/L  125-350
9  中性粒细胞百分比  NEUT%  78.2  %  40-75
10 淋巴细胞百分比  LYMPH%  15.4  %  20-50
11 单核细胞百分比  MONO%  5.1  %  3-10
12 嗜酸性粒细胞百分比  EO%  1.1  %  0.4-8
13 嗜碱性粒细胞百分比  BASO%  0.2  %  0-1
14 中性粒细胞绝对值  NEUT#  8.99  10^9/L  1.8-6.3
15 淋巴细胞绝对值  LYMPH#  1.77  10^9/L  1.1-3.2
16 单核细胞绝对值  MONO#  0.59  10^9/L  0.1-0.6
17 嗜酸性粒细胞绝对值  EO#  0.13  10^9/L  0.02-0.5
18 嗜碱性粒细胞绝对值  BASO#  0.02  10^9/L  0.0-0.1
19 红细胞分布宽度-CV  RDW-CV  13.1  %  11.5-14.5
20 红细胞分布宽度-SD  RDW-SD  42.5  fL  39-46
21 平均血小板体积  MPV  11.2  fL  9-13
22 血小板分布宽度  PDW  16.4  %  9-17
23 血小板压积  PCT  0.10  %  0.15-0.32
24 大血小板比率  P-LCR  32.5  %  13-43

送检医生：钱主任  检验人：李技师  审核人：王主管技师  报告时间：2026-09-15 10:20
排版要求：院徽Logo放左上角与标题对齐，单页硬预算绝不超页，右下角盖检验科专用章`,
  },
  {
    id: 'sample_biochem_18',
    name: '急诊临床生化全套 (18项) PDF OCR 文本',
    sourceType: 'PDF OCR',
    tag: '危急值预警',
    content: `复旦大学附属华山医院 检验医学科
急诊生化检验综合报告
姓名：陈阿妹  性别：女  年龄：62岁  住院号：HS202609-881  科室：急诊内科  床号：急诊02床
标本种类：促凝血清  条形码：MZ88712399

ALT 丙氨酸氨基转移酶 72.0 U/L 9.0-50.0
AST 天门冬氨酸氨基转移酶 58.5 U/L 15.0-40.0
TBIL 总胆红素 18.2 umol/L 3.4-20.5
DBIL 直接胆红素 5.1 umol/L 0.0-6.8
CREA 肌酐 135.0 umol/L 44.0-97.0
BUN 尿素氮 11.2 mmol/L 2.8-7.2
GLU 葡萄糖 18.5 mmol/L 3.90-6.10
K 钾 4.20 mmol/L 3.50-5.30
Na 钠 139.0 mmol/L 137.0-147.0
Cl 氯 101.0 mmol/L 99.0-110.0
CO2 二氧化碳结合力 22.0 mmol/L 22.0-29.0
UA 尿酸 460.0 umol/L 150.0-360.0

检验师：刘小军  审核主管：张敏  报告日期：2026-09-15 11:00
检验科红章加盖于右下角，A5横向，GLU超过15.0mmol/L触发危急值电话通知`,
  },
  {
    id: 'sample_teg_chart',
    name: '血栓弹力图 (TEG) 凝血图表避让',
    sourceType: 'Word/文本表格',
    tag: '空间避让折流',
    content: `中日友好医院 输血科 / 凝血监测室
血栓弹力图 (TEG) 专项检验报告
患者姓名：刘桂兰  性别：女  年龄：65岁  病案号：ZR88712  科室：心胸外科
中间插入TEG曲线图作为空间避让障碍物，右侧指标列表绕开图表排版，单页硬预算绝不超页
R 凝血反应时间 5.2 min 4.0-8.0
K 凝血形成时间 1.8 min 1.0-3.0
Angle 凝固角 66.5 deg 53.0-72.0
MA 最大振幅 63.8 mm 50.0-70.0
LY30 30分钟纤溶指数 2.1 % 0.0-7.5
CI 凝血综合指数 +1.2 正常 -3.0-+3.0
送检人：赵主任  操作人：孙检验师  审核人：周主管技师  盖输血检测专用章`,
  },
  {
    id: 'sample_pacs_ultrasound',
    name: '甲状腺彩色多普勒超声检查报告',
    sourceType: 'Word/文本表格',
    tag: 'A4 影像网格',
    content: `同济大学附属同济医院 超声医学科
彩色多普勒超声检查报告单
姓名：林芳  性别：女  年龄：35岁  门诊号：MZ981273  检查部位：甲状腺双侧叶及颈部淋巴结
检查设备：GE Voluson E10  探头频率：7.5-12.0MHz
超声所见：甲状腺左叶大小约42×15×13mm，右叶大小约45×16×14mm，峡部厚度约2.8mm。腺体组织回声欠均匀。右叶中下极可见一低回声结节，大小约6.5×4.8mm，边界尚清，形态规则，内见点状微钙化。CDFI：结节周边见点状血流信号。
超声提示：甲状腺右叶低回声结节伴微钙化 (TI-RADS 4a类)，建议FNA穿刺复查。
超声医师：吴医生  主任医师审核：郑教授  报告时间：2026-09-15 14:30
要求A4纵向排版，顶部包含2x2影像采集窗口，下方排列超声所见与诊断结论`,
  },
]

export async function executeRagReverse(
  rawInput: string,
  settings?: ModelProviderSettings
): Promise<ReverseGenerationResult> {
  const modelConfig = settings
    ? {
        mode: settings.mode,
        baseURL: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        vision: settings.vision,
      }
    : undefined

  return await reverseGenerateTemplate(rawInput, { modelConfig })
}

export function castToReportTemplate(tpl: Record<string, unknown>): ReportTemplate {
  return tpl as unknown as ReportTemplate
}
