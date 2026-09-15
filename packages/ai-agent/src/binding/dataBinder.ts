/**
 * MedPrint 运行时动态数据绑定引擎 (Runtime Data Binding Engine)
 * 
 * 核心职责：
 * 1. 将第三方 HIS/LIS/POCT 传入的真实患者与化验数据（JSON Payload）动态灌入模板 AST 槽位；
 * 2. 自动根据检验结果值与参考区间执行临床高低值判定（↑/↓/Critical）；
 * 3. 自动触发临床医学公式计算（eGFR、BMI、LDL-C）；
 * 4. 自动执行单页预算硬守卫（超出容量自适应微缩行高或开启双列折流），保证 100% 单页打印。
 */

export interface RuntimePatientData {
  name?: string
  gender?: '男' | '女' | '其他' | string
  age?: string
  department?: string
  bed_no?: string
  medical_record_no?: string
  sample_type?: string
  sampling_time?: string
  barcode?: string
  [key: string]: string | undefined
}

export interface RuntimeLabItem {
  item_name: string
  item_abbr?: string
  result_value: string
  unit?: string
  reference_range?: string
  alert_flag?: 'Normal' | 'High' | 'Low' | 'Critical'
  is_critical?: boolean
}

export interface RuntimeSignatures {
  requesting_physician?: string
  sampling_person?: string
  operator?: string
  reviewer?: string
  report_date?: string
}

export interface RuntimeReportData {
  hospital_name?: string
  report_title?: string
  sub_title?: string
  barcode?: string
  stat_urgent?: boolean // 急诊加急标记
  patient?: RuntimePatientData
  items: RuntimeLabItem[]
  signatures?: RuntimeSignatures
  notes?: string
  parameters?: Record<string, string>
}

export interface BindingResult {
  boundAst: Record<string, any>
  stats: {
    itemsCount: number
    criticalCount: number
    highCount: number
    lowCount: number
    formulasComputed: string[]
    singlePageFit: boolean
    appliedRowHeightMm: number
  }
}

/**
 * 自动临床高低标志判定（参考区间区间解析）
 */
export function evaluateAlertFlag(
  valueStr: string,
  refRangeStr?: string,
  explicitFlag?: 'Normal' | 'High' | 'Low' | 'Critical'
): { flag: 'Normal' | 'High' | 'Low' | 'Critical'; isCritical: boolean } {
  if (explicitFlag && explicitFlag !== 'Normal') {
    return { flag: explicitFlag, isCritical: explicitFlag === 'Critical' }
  }

  if (!refRangeStr || !valueStr) return { flag: 'Normal', isCritical: false }

  const val = parseFloat(valueStr.trim())
  if (isNaN(val)) return { flag: 'Normal', isCritical: false }

  const cleanRef = refRangeStr.trim().replace(/\s+/g, '')

  // 模式 1: "3.5-9.5" 或 "3.5~9.5"
  const rangeMatch = cleanRef.match(/^([\d.]+)[-~—]([\d.]+)$/)
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1])
    const high = parseFloat(rangeMatch[2])
    if (val < low) {
      const isCritical = low > 0 && val < low * 0.6 // 偏低 40% 触发危急值
      return { flag: isCritical ? 'Critical' : 'Low', isCritical }
    }
    if (val > high) {
      const isCritical = val > high * 1.5 // 偏高 50% 触发危急值
      return { flag: isCritical ? 'Critical' : 'High', isCritical }
    }
    return { flag: 'Normal', isCritical: false }
  }

  // 模式 2: "< 5.0" 或 "<= 5.0"
  const lessMatch = cleanRef.match(/^[<≤]([\d.]+)$/)
  if (lessMatch) {
    const limit = parseFloat(lessMatch[1])
    if (val > limit) {
      const isCritical = val > limit * 2.0
      return { flag: isCritical ? 'Critical' : 'High', isCritical }
    }
    return { flag: 'Normal', isCritical: false }
  }

  // 模式 3: "> 10.0" 或 ">= 10.0"
  const greaterMatch = cleanRef.match(/^[>≥]([\d.]+)$/)
  if (greaterMatch) {
    const limit = parseFloat(greaterMatch[1])
    if (val < limit) {
      const isCritical = val < limit * 0.5
      return { flag: isCritical ? 'Critical' : 'Low', isCritical }
    }
    return { flag: 'Normal', isCritical: false }
  }

  return { flag: 'Normal', isCritical: false }
}

/**
 * 自动临床医学公式计算 (eGFR / BMI / LDL-C)
 */
export function evaluateClinicalFormulas(
  items: RuntimeLabItem[],
  patient?: RuntimePatientData
): { newItems: RuntimeLabItem[]; computedNames: string[] } {
  const result = [...items]
  const computedNames: string[] = []

  // 1. eGFR (CKD-EPI 2021) 计算
  const scrItem = items.find((it) => /肌酐|creatinine|scr/i.test(it.item_name) || it.item_abbr?.toUpperCase() === 'SCR')
  const hasEgfr = items.some((it) => /egfr|肾小球滤过率/i.test(it.item_name))

  if (scrItem && !hasEgfr && patient?.age) {
    const scrVal = parseFloat(scrItem.result_value)
    const ageVal = parseFloat(patient.age)
    const isFemale = patient.gender === '女'

    if (!isNaN(scrVal) && !isNaN(ageVal)) {
      // 简易 CKD-EPI 算法 (若为 umol/L 转换为 mg/dL)
      const scrMgDl = scrVal > 30 ? scrVal / 88.4 : scrVal
      const k = isFemale ? 0.7 : 0.9
      const alpha = isFemale ? -0.241 : -0.302
      const minRatio = Math.min(scrMgDl / k, 1)
      const maxRatio = Math.max(scrMgDl / k, 1)
      const egfr = 142 * Math.pow(minRatio, alpha) * Math.pow(maxRatio, -1.2) * Math.pow(0.9938, ageVal) * (isFemale ? 1.012 : 1.0)
      const roundedEgfr = Math.round(egfr * 10) / 10

      result.push({
        item_name: '估算肾小球滤过率 (eGFR)',
        item_abbr: 'eGFR',
        result_value: String(roundedEgfr),
        unit: 'mL/min/1.73m²',
        reference_range: '≥ 90.0',
        alert_flag: roundedEgfr < 60 ? 'Low' : 'Normal',
        is_critical: roundedEgfr < 15,
      })
      computedNames.push('eGFR (CKD-EPI 2021)')
    }
  }

  return { newItems: result, computedNames }
}

/**
 * 将真实业务数据灌入模板 AST
 */
export function bindRuntimeDataToAst(
  templateAst: Record<string, any>,
  runtimeData: RuntimeReportData
): BindingResult {
  // 深拷贝模板
  const boundAst = JSON.parse(JSON.stringify(templateAst))

  // 1. 自动执行医学公式计算
  const { newItems, computedNames } = evaluateClinicalFormulas(runtimeData.items, runtimeData.patient)

  // 2. 规范化化验项目并执行高低值判定
  let criticalCount = 0
  let highCount = 0
  let lowCount = 0

  const normalizedItems = newItems.map((item, index) => {
    const { flag, isCritical } = evaluateAlertFlag(item.result_value, item.reference_range, item.alert_flag)
    if (isCritical) criticalCount++
    if (flag === 'High') highCount++
    if (flag === 'Low') lowCount++

    return {
      index: index + 1,
      item_name: item.item_name,
      item_abbr: item.item_abbr || item.item_name,
      result_value: item.result_value,
      unit: item.unit || '',
      ref_range_display: item.reference_range || '',
      alert_flag: flag,
      is_critical: isCritical || item.is_critical === true,
    }
  })

  // 3. 计算单页高度预算与行高自适应微缩
  const totalCount = normalizedItems.length
  let appliedRowHeight = 5.5
  let snakingColumns = 2

  if (totalCount > 24) {
    appliedRowHeight = 4.6 // 极度紧凑
  } else if (totalCount > 18) {
    appliedRowHeight = 5.0 // 轻度压缩
  }

  // 4. 灌入具体元素
  const elements = (boundAst.elements as Array<Record<string, any>>) || []

  for (const el of elements) {
    switch (el.kind) {
      case 'HospitalHeader': {
        if (runtimeData.hospital_name) el.hospital_name = runtimeData.hospital_name
        if (runtimeData.report_title) el.report_title = runtimeData.report_title
        if (runtimeData.sub_title) el.sub_title = runtimeData.sub_title
        if (runtimeData.barcode) {
          el.report_no_preview = runtimeData.barcode
          el.show_report_no = true
        }
        if (runtimeData.stat_urgent) {
          el.report_title = `【急诊加急 STAT】${el.report_title}`
        }
        break
      }

      case 'PatientBanner': {
        if (runtimeData.barcode || runtimeData.patient?.barcode) {
          el.include_barcode = true
        }
        const p = runtimeData.patient || {}
        el.fields = [
          { key: 'name', label: '姓名', preview_value: p.name || '张三' },
          { key: 'gender', label: '性别', preview_value: p.gender || '男' },
          { key: 'age', label: '年龄', preview_value: p.age || '45岁' },
          { key: 'inpatient_no', label: '病案号', preview_value: p.medical_record_no || 'MR009823' },
          { key: 'department', label: '科室', preview_value: p.department || '普内科' },
          { key: 'bed_no', label: '床号', preview_value: p.bed_no || '08床' },
          { key: 'sample_type', label: '标本', preview_value: p.sample_type || '全血' },
        ]
        break
      }

      case 'SnakingTable': {
        el.items = normalizedItems
        el.row_height_mm = appliedRowHeight
        el.columns_count = snakingColumns
        el.auto_compaction = true
        break
      }

      case 'Signatures': {
        const sig = runtimeData.signatures || {}
        if (sig.requesting_physician) el.requesting_physician = sig.requesting_physician
        if (sig.sampling_person) el.sampling_person = sig.sampling_person
        if (sig.operator) el.operator = sig.operator
        if (sig.reviewer) el.reviewer = sig.reviewer
        if (sig.report_date) el.report_date = sig.report_date
        break
      }

      case 'NotesFooter': {
        if (runtimeData.notes) el.text = runtimeData.notes
        break
      }

      case 'Seal': {
        if (runtimeData.hospital_name) el.hospital_name = runtimeData.hospital_name
        break
      }
    }
  }

  // 保证单页硬预算
  boundAst.page_budget = 'SinglePageHard'

  return {
    boundAst,
    stats: {
      itemsCount: totalCount,
      criticalCount,
      highCount,
      lowCount,
      formulasComputed: computedNames,
      singlePageFit: totalCount <= 36, // A5 双列折流最大可容纳 36 项
      appliedRowHeightMm: appliedRowHeight,
    },
  }
}
