/**
 * 医疗多源异构文档结构指纹分析器 (Document Fingerprinter)
 *
 * 负责从 Word 提取文本、PDF OCR 文本、历史 DSL JSON/XML 或医生自由描述中，
 * 提取核心实体、版面维度、表格形状与排版约束指纹。
 */

export type MedicalReportCategory =
  | 'LisBloodRoutine'
  | 'LisBiochemistry'
  | 'PacsImaging'
  | 'TegThromboelastogram'
  | 'OutpatientPrescription'
  | 'GenericMedical'

export interface ParsedItemPreview {
  name: string
  abbr?: string
  value: string
  unit?: string
  refRange?: string
}

export interface DocumentFingerprint {
  category: MedicalReportCategory
  categoryConfidence: number
  hospitalName?: string
  reportTitle?: string
  subTitle?: string
  paperHint: 'A5_Landscape' | 'A4_Portrait'
  detectedPatientFields: string[]
  hasBarcode: boolean
  hasSeal: boolean
  signatures: {
    requester?: string
    operator?: string
    reviewer?: string
  }
  tableStructure: {
    estimatedRowCount: number
    estimatedColumnCount: number
    parsedItems: ParsedItemPreview[]
  }
  constraints: {
    logoPosition?: 'TopLeft' | 'Center' | 'BottomLeft'
    hasObstacleChart: boolean
    obstacleType?: 'TegCurve' | 'PacsImage'
    pageBudget: 'SinglePageHard' | 'SinglePageSoft' | 'MultiPageNatural'
  }
}

// 常见化验项特征关键词
const BLOOD_KEYWORDS = ['白细胞', '红细胞', '血小板', '血红蛋白', '中性粒细胞', '淋巴细胞', 'WBC', 'RBC', 'HGB', 'PLT', 'NEUT']
const BIOCHEM_KEYWORDS = ['谷丙转氨酶', '谷草转氨酶', '丙氨酸氨基转移酶', '天门冬氨酸氨基转移酶', '总胆红素', '肌酐', '尿素氮', '血糖', 'ALT', 'AST', 'TBIL', 'CREA', 'BUN', 'GLU']
const TEG_KEYWORDS = ['血栓弹力图', 'TEG', '凝血反应时间', '凝固角', '最大振幅', '纤溶', 'MA', 'LY30', 'CI']
const PACS_KEYWORDS = ['超声', 'CT', '核磁', 'DR', '放射', '影像表现', '影像诊断', '检查部位', '所见', '印象']
const RX_KEYWORDS = ['处方', 'Rp', '用法', '用量', '每次剂量', '频次', '剂型', '药品名称', '规格']

export function analyzeDocumentFingerprint(rawInput: string): DocumentFingerprint {
  const text = rawInput.trim()

  // 1. 嗅探医院名称
  let hospitalName: string | undefined
  const hospitalMatch = text.match(/([^\n\r]{2,20}(?:医院|妇幼保健院|医疗中心|卫生院|诊所|中心卫生院))/i)
  if (hospitalMatch) {
    hospitalName = hospitalMatch[1].trim()
  }

  // 2. 嗅探报告标题
  let reportTitle: string | undefined
  const titleMatch = text.match(/([^\n\r]{2,30}(?:检验报告单|检验报告|化验单|检查报告单|超声检查报告|影像诊断报告|处方笺|处方单|血栓弹力图))/i)
  if (titleMatch) {
    reportTitle = titleMatch[1].trim()
  }

  // 3. 嗅探报告单类别与置信度
  let category: MedicalReportCategory = 'GenericMedical'
  let categoryConfidence = 0.5

  const tegHits = TEG_KEYWORDS.filter(k => text.includes(k)).length
  const bloodHits = BLOOD_KEYWORDS.filter(k => text.includes(k)).length
  const biochemHits = BIOCHEM_KEYWORDS.filter(k => text.includes(k)).length
  const pacsHits = PACS_KEYWORDS.filter(k => text.includes(k)).length
  const rxHits = RX_KEYWORDS.filter(k => text.includes(k)).length

  if (tegHits >= 2 || text.includes('TEG') || text.includes('血栓弹力图')) {
    category = 'TegThromboelastogram'
    categoryConfidence = 0.95
  } else if (pacsHits >= 2 || text.includes('超声') || text.includes('影像')) {
    category = 'PacsImaging'
    categoryConfidence = 0.92
  } else if (rxHits >= 2 || text.includes('处方') || text.includes('Rp')) {
    category = 'OutpatientPrescription'
    categoryConfidence = 0.90
  } else if (biochemHits >= bloodHits && biochemHits > 0) {
    category = 'LisBiochemistry'
    categoryConfidence = 0.88 + Math.min(0.1, biochemHits * 0.02)
  } else if (bloodHits > 0) {
    category = 'LisBloodRoutine'
    categoryConfidence = 0.88 + Math.min(0.1, bloodHits * 0.02)
  }

  // 4. 嗅探纸张尺寸倾向
  // 检验、处方、TEG 在国内 90% 以上采用 A5 横向节约纸张；影像 PACS 采用 A4 纵向
  const paperHint: 'A5_Landscape' | 'A4_Portrait' =
    text.includes('A4') || category === 'PacsImaging' ? 'A4_Portrait' : 'A5_Landscape'

  // 5. 嗅探患者信息字段
  const detectedPatientFields: string[] = []
  const patientFieldPatterns: Array<{ key: string; regex: RegExp }> = [
    { key: 'name', regex: /(?:姓名|患者姓名|病人姓名)[:：\s]+([^\s\n\r,，|]+)/ },
    { key: 'gender', regex: /(?:性别)[:：\s]+([男|女])/ },
    { key: 'age', regex: /(?:年龄)[:：\s]+([0-9]{1,3}\s*(?:岁|月|天)?)/ },
    { key: 'department', regex: /(?:科别|科室|申请科室)[:：\s]+([^\s\n\r,，|]+)/ },
    { key: 'bed_no', regex: /(?:床号|床位)[:：\s]+([^\s\n\r,，|]+)/ },
    { key: 'inpatient_no', regex: /(?:住院号|病案号|门诊号|ID号)[:：\s]+([0-9a-zA-Z\-_]+)/ },
    { key: 'sample_type', regex: /(?:标本种类|标本类型|标本)[:：\s]+([^\s\n\r,，|]+)/ },
  ]

  for (const p of patientFieldPatterns) {
    if (p.regex.test(text)) {
      detectedPatientFields.push(p.key)
    }
  }

  // 6. 嗅探条形码、印章、签名
  const hasBarcode = /(?:条码|条形码|barcode|采血管|标本号|LIS[0-9]+)/i.test(text)
  const hasSeal = /(?:印章|防伪|公章|检验专用章|盖章|审核章)/i.test(text)

  const signatures: DocumentFingerprint['signatures'] = {}
  const opMatch = text.match(/(?:检验者|检验人|检验师|技师|操作者|检测者)[:：\s]+([^\s\n\r,，|]+)/)
  if (opMatch) signatures.operator = opMatch[1].trim()

  const revMatch = text.match(/(?:审核者|审核人|主管技师|复核人|核对人)[:：\s]+([^\s\n\r,，|]+)/)
  if (revMatch) signatures.reviewer = revMatch[1].trim()

  const reqMatch = text.match(/(?:送检医师|申请医生|主治医师|开单医师)[:：\s]+([^\s\n\r,，|]+)/)
  if (reqMatch) signatures.requester = reqMatch[1].trim()

  // 7. 解析表格结构与行数据
  const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean)
  const parsedItems: ParsedItemPreview[] = []

  for (const line of lines) {
    // 匹配常规化验行: "ALT 谷丙转氨酶 45.0 U/L 9.0-50.0" 或 "1 白细胞计数 6.5 10^9/L 4.0-10.0"
    // 或表格分隔符 | ALT | 45.0 | U/L | 9.0-50.0 |
    const cleaned = line.replace(/^[0-9]+[\.、\s]+/, '').replace(/^\|/, '').replace(/\|$/, '')
    const parts = cleaned.split(/[\t|,\s]{2,}|\t|\|/).map(s => s.trim()).filter(Boolean)

    if (parts.length >= 2) {
      // 判断第一项是否为中文或指标缩写
      const first = parts[0]
      // 排除表头 (如 "项目 结果 参考值")
      if (/^(?:项目|名称|代号|指标|检验项目|序号)/.test(first)) continue

      // 提取数值
      const valCandidate = parts.find(p => /^[+\-]?[0-9]+(?:\.[0-9]+)?$/.test(p) || /^(?:阴性|阳性|\+|\-)/.test(p))
      if (valCandidate) {
        parsedItems.push({
          name: first,
          value: valCandidate,
          unit: parts.length > 2 ? parts[2] : undefined,
          refRange: parts.length > 3 ? parts[3] : undefined,
        })
      }
    }
  }

  // 8. 空间与几何约束嗅探
  const hasObstacleChart = category === 'TegThromboelastogram' || text.includes('绕开') || text.includes('避让') || text.includes('图表')
  let logoPosition: DocumentFingerprint['constraints']['logoPosition'] = 'Center'
  if (text.includes('左上角') || text.includes('左侧')) {
    logoPosition = 'TopLeft'
  } else if (text.includes('左下角')) {
    logoPosition = 'BottomLeft'
  }

  const pageBudget = text.includes('单页') || text.includes('绝不超页') || text.includes('一页')
    ? 'SinglePageHard'
    : 'SinglePageSoft'

  return {
    category,
    categoryConfidence,
    hospitalName: hospitalName || 'XX市人民医院',
    reportTitle: reportTitle || defaultTitleFor(category),
    subTitle: '检验科 / 临床实验室',
    paperHint,
    detectedPatientFields: detectedPatientFields.length > 0 ? detectedPatientFields : ['name', 'gender', 'age', 'inpatient_no', 'department', 'bed_no'],
    hasBarcode: hasBarcode || true,
    hasSeal: hasSeal || true,
    signatures: {
      requester: signatures.requester || '李主治',
      operator: signatures.operator || '王检验师',
      reviewer: signatures.reviewer || '陈主管技师',
    },
    tableStructure: {
      estimatedRowCount: parsedItems.length,
      estimatedColumnCount: parsedItems.length > 10 ? 2 : 1,
      parsedItems,
    },
    constraints: {
      logoPosition,
      hasObstacleChart,
      obstacleType: category === 'TegThromboelastogram' ? 'TegCurve' : (category === 'PacsImaging' ? 'PacsImage' : undefined),
      pageBudget,
    },
  }
}

function defaultTitleFor(category: MedicalReportCategory): string {
  switch (category) {
    case 'LisBloodRoutine':
      return '全血细胞分析 (血常规24项) 报告单'
    case 'LisBiochemistry':
      return '临床生化检验综合报告单'
    case 'TegThromboelastogram':
      return '血栓弹力图 (TEG) 专项检验报告'
    case 'PacsImaging':
      return '彩色多普勒超声检查报告单'
    case 'OutpatientPrescription':
      return '医疗机构门诊处方笺'
    default:
      return '临床医学检验报告单'
  }
}
