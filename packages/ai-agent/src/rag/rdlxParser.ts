/**
 * 葡萄城 (GrapeCity ActiveReports) RDLX 报表模板解析与迁移引擎
 *
 * 专门解析医疗旧系统（如 POCT、LIS、HIS、DMS）广泛使用的 ActiveReports .rdlx XML 模板，
 * 提取页面尺寸、页边距、dataset1（化验列表）与 dataset2（患者元数据与签名链），
 * 并自动映射为现代 MedPrint 声明式物理约束 AST。
 */

import type { DocumentFingerprint } from './fingerprinter.js'

export interface ParsedRdlxTemplate {
  reportTitle: string
  paper: {
    width_mm: number
    height_mm: number
    orientation: 'Portrait' | 'Landscape'
  }
  margins: {
    top_mm: number
    right_mm: number
    bottom_mm: number
    left_mm: number
  }
  patientFields: Array<{ key: string; label: string; fieldExpr: string }>
  tableColumns: Array<{ header: string; fieldName: string }>
  signatures: {
    requester?: string
    operator?: string
    reviewer?: string
  }
  instrumentName?: string
  dataset1Fields: string[]
  dataset2Fields: string[]
  rawXml: string
}

function parseLengthToMm(valStr: string, defaultValMm: number): number {
  if (!valStr) return defaultValMm
  const s = valStr.trim().toLowerCase()
  if (s.endsWith('cm')) {
    const num = parseFloat(s.replace('cm', ''))
    return isNaN(num) ? defaultValMm : Math.round(num * 10 * 10) / 10
  }
  if (s.endsWith('mm')) {
    const num = parseFloat(s.replace('mm', ''))
    return isNaN(num) ? defaultValMm : num
  }
  if (s.endsWith('in')) {
    const num = parseFloat(s.replace('in', ''))
    return isNaN(num) ? defaultValMm : Math.round(num * 25.4 * 10) / 10
  }
  if (s.endsWith('pt')) {
    const num = parseFloat(s.replace('pt', ''))
    return isNaN(num) ? defaultValMm : Math.round((num * 25.4 / 72.0) * 10) / 10
  }
  const num = parseFloat(s)
  return isNaN(num) ? defaultValMm : num
}

export function isRdlxXml(text: string): boolean {
  return text.includes('<Report') && (
    text.includes('schemas.microsoft.com/sqlserver/reporting') ||
    text.includes('ActiveReports') ||
    text.includes('<ReportItems>') ||
    text.includes('dataset1') ||
    text.includes('dataset2')
  )
}

export function parseRdlxXml(xml: string): ParsedRdlxTemplate {
  // 1. 提取纸张尺寸与页边距
  const widthMatch = xml.match(/<PageWidth>([^<]+)<\/PageWidth>/i)
  const heightMatch = xml.match(/<PageHeight>([^<]+)<\/PageHeight>/i)
  const topMarginMatch = xml.match(/<TopMargin>([^<]+)<\/TopMargin>/i)
  const bottomMarginMatch = xml.match(/<BottomMargin>([^<]+)<\/BottomMargin>/i)
  const leftMarginMatch = xml.match(/<LeftMargin>([^<]+)<\/LeftMargin>/i)
  const rightMarginMatch = xml.match(/<RightMargin>([^<]+)<\/RightMargin>/i)
  const orientMatch = xml.match(/<Name>PaperOrientation<\/Name>\s*<Value>([^<]+)<\/Value>/i)

  const width_mm = parseLengthToMm(widthMatch ? widthMatch[1] : '', 210)
  const height_mm = parseLengthToMm(heightMatch ? heightMatch[1] : '', 148)
  const top_mm = parseLengthToMm(topMarginMatch ? topMarginMatch[1] : '', 5)
  const bottom_mm = parseLengthToMm(bottomMarginMatch ? bottomMarginMatch[1] : '', 5)
  const left_mm = parseLengthToMm(leftMarginMatch ? leftMarginMatch[1] : '', 5)
  const right_mm = parseLengthToMm(rightMarginMatch ? rightMarginMatch[1] : '', 5)

  const orientation = (orientMatch && orientMatch[1].toLowerCase() === 'portrait') || height_mm > width_mm
    ? 'Portrait'
    : 'Landscape'

  // 2. 提取报表标题 (从 ReportParameters 或特定大字号 Textbox)
  let reportTitle = '临床检验报告单'
  const paramTitleMatch = xml.match(/<ReportParameter Name="标题">[\s\S]*?<Prompt>([^<]+)<\/Prompt>/i)
  if (paramTitleMatch && !paramTitleMatch[1].includes('参数') && paramTitleMatch[1].trim().length > 2) {
    reportTitle = paramTitleMatch[1].trim()
  } else {
    // 寻找字号 >= 14pt 的居中标题 Textbox
    const bigTitleMatch =
      xml.match(/<FontSize>(?:1[4-9]|[2-9][0-9])pt<\/FontSize>[\s\S]*?<Value>([^<]+)<\/Value>/i) ||
      xml.match(/<Value>([^<]+)<\/Value>[\s\S]*?<FontSize>(?:1[4-9]|[2-9][0-9])pt<\/FontSize>/i)

    if (bigTitleMatch && !bigTitleMatch[1].startsWith('=')) {
      reportTitle = bigTitleMatch[1].trim()
    } else if (xml.includes('A5') && xml.includes('纵向')) {
      reportTitle = '临床化验单 (A5纵向单列)'
    } else if (xml.includes('血栓') || xml.includes('TEG')) {
      reportTitle = '血栓弹力图 (TEG) 检验报告单'
    } else if (xml.includes('超声') || xml.includes('PACS')) {
      reportTitle = '彩色多普勒超声检查报告单'
    }
  }

  // 3. 提取检测仪器
  let instrumentName: string | undefined
  const instMatch = xml.match(/<Value>检测仪器:?<\/Value>[\s\S]*?<Textbox[^>]*>[\s\S]*?<Value>([^<]+)<\/Value>/i)
  if (instMatch && !instMatch[1].startsWith('=')) {
    instrumentName = instMatch[1].trim()
  }

  // 4. 提取 DataSets 字段定义 (dataset1 与 dataset2)
  const dataset1Fields: string[] = []
  const dataset2Fields: string[] = []

  const ds1Match = xml.match(/<DataSet Name="dataset1">([\s\S]*?)<\/DataSet>/i)
  if (ds1Match) {
    const fieldMatches = ds1Match[1].matchAll(/<Field Name="([^"]+)">/gi)
    for (const m of fieldMatches) dataset1Fields.push(m[1])
  }

  const ds2Match = xml.match(/<DataSet Name="dataset2">([\s\S]*?)<\/DataSet>/i)
  if (ds2Match) {
    const fieldMatches = ds2Match[1].matchAll(/<Field Name="([^"]+)">/gi)
    for (const m of fieldMatches) dataset2Fields.push(m[1])
  }

  // 5. 提取患者信息字段映射 (从 PageHeader Textbox 中提取)
  const patientFields: ParsedRdlxTemplate['patientFields'] = []
  const knownPatientLabels: Array<{ label: string; key: string }> = [
    { label: '姓名', key: 'name' },
    { label: '性别', key: 'gender' },
    { label: '年龄', key: 'age' },
    { label: '床号', key: 'bed_no' },
    { label: '病历号', key: 'inpatient_no' },
    { label: '住院号', key: 'inpatient_no' },
    { label: '病区', key: 'ward' },
    { label: '送检科室', key: 'department' },
    { label: '科室', key: 'department' },
    { label: '样本号', key: 'barcode' },
    { label: '样本类型', key: 'sample_type' },
    { label: '诊断', key: 'diagnosis' },
    { label: '送检者', key: 'requester' },
  ]

  for (const kp of knownPatientLabels) {
    if (xml.includes(`>${kp.label}:<`) || xml.includes(`>${kp.label}：<`) || xml.includes(`Fields!${kp.label}.Value`)) {
      if (!patientFields.some(p => p.key === kp.key)) {
        patientFields.push({
          key: kp.key,
          label: kp.label,
          fieldExpr: `=Fields!${kp.label}.Value`,
        })
      }
    }
  }

  // 6. 提取表格列头 (从 Table1 Header 中提取)
  const tableColumns: Array<{ header: string; fieldName: string }> = []
  const tableHeaderMatch = xml.match(/<Table Name="Table1">[\s\S]*?<Header>([\s\S]*?)<\/Header>/i)
  if (tableHeaderMatch) {
    const colHeaderMatches = tableHeaderMatch[1].matchAll(/<Textbox[^>]*>[\s\S]*?<Value>([^<]+)<\/Value>/gi)
    for (const ch of colHeaderMatches) {
      const headerText = ch[1].trim()
      if (!headerText.startsWith('=')) {
        tableColumns.push({
          header: headerText,
          fieldName: headerText,
        })
      }
    }
  }

  // 7. 提取签字人员
  const signatures: ParsedRdlxTemplate['signatures'] = {
    requester: xml.includes('送检者') ? '送检医师' : undefined,
    operator: xml.includes('检验者') ? '检验技师' : undefined,
    reviewer: xml.includes('审核者') ? '主管技师' : undefined,
  }

  return {
    reportTitle,
    paper: {
      width_mm,
      height_mm,
      orientation,
    },
    margins: {
      top_mm,
      right_mm,
      bottom_mm,
      left_mm,
    },
    patientFields,
    tableColumns,
    signatures,
    instrumentName,
    dataset1Fields,
    dataset2Fields,
    rawXml: xml,
  }
}

/** 将 GrapeCity RDLX 模板转换为 MedPrint 统一结构指纹 */
export function rdlxToFingerprint(rdlx: ParsedRdlxTemplate): DocumentFingerprint {
  const isThrombus = rdlx.rawXml.includes('血栓') || rdlx.rawXml.includes('TEG') || rdlx.reportTitle.includes('血栓')
  const isPacs = rdlx.rawXml.includes('超声') || rdlx.rawXml.includes('PACS') || rdlx.reportTitle.includes('超声')

  const category = isThrombus
    ? 'TegThromboelastogram'
    : (isPacs ? 'PacsImaging' : 'LisBloodRoutine')

  const sampleItems = rdlx.dataset1Fields.map((f, idx) => ({
    name: f,
    value: idx === 0 ? '6.52' : (idx === 1 ? '4.85' : '152.0'),
    unit: 'U/L',
    refRange: '10.0 - 50.0',
  }))

  return {
    category,
    categoryConfidence: 0.98,
    hospitalName: 'XX市第一人民医院 (ActiveReports RDLX 迁移)',
    reportTitle: rdlx.reportTitle,
    subTitle: rdlx.instrumentName ? `检测设备: ${rdlx.instrumentName}` : '检验医学科',
    paperHint: rdlx.paper.orientation === 'Landscape' ? 'A5_Landscape' : 'A4_Portrait',
    detectedPatientFields: rdlx.patientFields.map(p => p.key),
    hasBarcode: rdlx.rawXml.includes('样本号') || rdlx.rawXml.includes('条码'),
    hasSeal: true,
    signatures: {
      requester: rdlx.signatures.requester || '送检医师',
      operator: rdlx.signatures.operator || '王检验师',
      reviewer: rdlx.signatures.reviewer || '陈主管技师',
    },
    tableStructure: {
      estimatedRowCount: Math.max(rdlx.dataset1Fields.length, 12),
      estimatedColumnCount: rdlx.paper.width_mm > 180 ? 2 : 1,
      parsedItems: sampleItems,
    },
    constraints: {
      logoPosition: 'TopLeft',
      hasObstacleChart: isThrombus,
      obstacleType: isThrombus ? 'TegCurve' : undefined,
      pageBudget: 'SinglePageHard',
    },
  }
}
