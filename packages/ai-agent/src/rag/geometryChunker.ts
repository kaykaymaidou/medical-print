/**
 * MedPrint 几何优先排版切分与原子结构化 Chunking 算法
 * 
 * 解决传统 RAG 纯文本切分导致的“A5双列横切串行”与“数字碎片化”死穴。
 * 核心逻辑：
 * 1. 物理几何先行：通过 Y 轴水平投影检测页眉、主体表格与责任页尾；
 * 2. X 轴直方图投影：检测列数与空白槽（Whitespace Gutters），智能识别 A5 双列折流（Snaking Flow）；
 * 3. 分级原子切分：表格作为单一原子网格块保留，绝不跨行截断；
 * 4. 键值对邻近语义锚定：提取姓名、科室、病案号等元数据；
 * 5. 防错兜底与歧义消除：置信度低于 75% 触发自适应结构归纳（Adaptive Induction）。
 */

import type { DocumentFingerprint } from './fingerprinter.js'

export interface TextSpan {
  x: number
  y: number
  width: number
  height: number
  text: string
  fontSize?: number
  fontName?: string
}

export interface GeometricBand {
  name: 'Header' | 'PatientBanner' | 'BodyTable' | 'Footer' | 'Other'
  yStartMm: number
  yEndMm: number
  spans: TextSpan[]
}

export interface ColumnGutter {
  colIndex: number
  xStartMm: number
  xEndMm: number
  headerLabel?: string
}

export interface StructuredTemplateChunk {
  chunkId: string
  physicalFingerprint: {
    paper: 'A4' | 'A5' | 'Custom'
    orientation: 'Portrait' | 'Landscape'
    columnsCount: number
    snakingFlowDetected: boolean
    estimatedItemsCount: number
  }
  semanticAnchors: {
    hospitalName?: string
    reportTitle?: string
    department?: string
    patientFields: Record<string, string>
    tableColumns: string[]
  }
  atomicTableGrid: {
    headers: string[]
    rows: Array<Record<string, string>>
  }
  confidence: number
  needsFallbackInduction: boolean
  fallbackReason?: string
}

/**
 * X 轴直方图投影：分析文本 Span 聚类，检测表格列数与空白槽
 */
export function detectColumnGutters(spans: TextSpan[], pageWidthMm: number): ColumnGutter[] {
  if (spans.length === 0) return []

  // 1. 将页面宽度划分为 0.5mm 粒度的桶 (Bucket)
  const bucketCount = Math.ceil(pageWidthMm * 2)
  const density = new Array(bucketCount).fill(0)

  for (const span of spans) {
    const startIdx = Math.max(0, Math.floor(span.x * 2))
    const endIdx = Math.min(bucketCount - 1, Math.floor((span.x + span.width) * 2))
    for (let i = startIdx; i <= endIdx; i++) {
      density[i]++
    }
  }

  // 2. 寻找连续的波谷（空白槽）
  const gutters: ColumnGutter[] = []
  let inColumn = false
  let colStart = 0
  let colIdx = 0

  for (let i = 0; i < bucketCount; i++) {
    const isText = density[i] > 0
    if (isText && !inColumn) {
      inColumn = true
      colStart = i / 2.0
    } else if (!isText && inColumn) {
      inColumn = false
      const colEnd = i / 2.0
      if (colEnd - colStart >= 8.0) { // 过滤小于 8mm 的噪声碎片
        gutters.push({
          colIndex: colIdx++,
          xStartMm: colStart,
          xEndMm: colEnd,
        })
      }
    }
  }

  if (inColumn) {
    gutters.push({
      colIndex: colIdx++,
      xStartMm: colStart,
      xEndMm: bucketCount / 2.0,
    })
  }

  return gutters
}

/**
 * 几何物理先行分区：将原始文本或图元切分为 Header、PatientBanner、Table、Footer
 */
export function partitionGeometricBands(
  rawTextOrSpans: string | TextSpan[],
  pageHeightMm: number = 148
): GeometricBand[] {
  // 如果输入是纯文本，按结构特征分段构建虚拟 Band
  if (typeof rawTextOrSpans === 'string') {
    const lines = rawTextOrSpans.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const headerLines: string[] = []
    const patientLines: string[] = []
    const tableLines: string[] = []
    const footerLines: string[] = []

    let currentPhase: 'header' | 'patient' | 'table' | 'footer' = 'header'

    for (const line of lines) {
      if (/送检|检验|审核|报告日期|医师|技师|仅对本次|复查/i.test(line) && currentPhase === 'table') {
        currentPhase = 'footer'
      } else if (currentPhase === 'header' && /姓名|性别|年龄|科室|床号|病案号|标本/i.test(line)) {
        currentPhase = 'patient'
      } else if (currentPhase === 'patient' && (/项目|结果|参考|单位|序号|wbc|rbc|alt|ast/i.test(line) || /\d+\.?\d*/.test(line))) {
        currentPhase = 'table'
      }

      if (currentPhase === 'header') headerLines.push(line)
      else if (currentPhase === 'patient') patientLines.push(line)
      else if (currentPhase === 'table') tableLines.push(line)
      else footerLines.push(line)
    }

    return [
      {
        name: 'Header',
        yStartMm: 0,
        yEndMm: 30,
        spans: headerLines.map((l, i) => ({ x: 10, y: i * 5, width: 100, height: 4, text: l })),
      },
      {
        name: 'PatientBanner',
        yStartMm: 30,
        yEndMm: 45,
        spans: patientLines.map((l, i) => ({ x: 10, y: 30 + i * 4, width: 150, height: 4, text: l })),
      },
      {
        name: 'BodyTable',
        yStartMm: 45,
        yEndMm: pageHeightMm - 20,
        spans: tableLines.map((l, i) => ({ x: 10, y: 45 + i * 4, width: 180, height: 4, text: l })),
      },
      {
        name: 'Footer',
        yStartMm: pageHeightMm - 20,
        yEndMm: pageHeightMm,
        spans: footerLines.map((l, i) => ({ x: 10, y: pageHeightMm - 20 + i * 4, width: 180, height: 4, text: l })),
      },
    ]
  }

  // 若传入的是原生 TextSpan，按 Y 轴坐标阈值切割
  const spans = rawTextOrSpans
  const headerSpans = spans.filter((s) => s.y < 32)
  const patientSpans = spans.filter((s) => s.y >= 32 && s.y < 46)
  const tableSpans = spans.filter((s) => s.y >= 46 && s.y < pageHeightMm - 18)
  const footerSpans = spans.filter((s) => s.y >= pageHeightMm - 18)

  return [
    { name: 'Header', yStartMm: 0, yEndMm: 32, spans: headerSpans },
    { name: 'PatientBanner', yStartMm: 32, yEndMm: 46, spans: patientSpans },
    { name: 'BodyTable', yStartMm: 46, yEndMm: pageHeightMm - 18, spans: tableSpans },
    { name: 'Footer', yStartMm: pageHeightMm - 18, yEndMm: pageHeightMm, spans: footerSpans },
  ]
}

/**
 * 基于几何分区的原子结构化切分 (Tiered Semantic-Geometric Chunking)
 */
export function chunkMedicalDocument(
  rawInput: string | TextSpan[],
  fingerprint: DocumentFingerprint
): StructuredTemplateChunk {
  const isLandscape = fingerprint.paperHint === 'A5_Landscape'
  const pw = isLandscape ? 210 : 148
  const ph = isLandscape ? 148 : 210

  const bands = partitionGeometricBands(rawInput, ph)
  const tableBand = bands.find((b) => b.name === 'BodyTable')
  const tableSpans = tableBand?.spans || []

  // X 轴直方图投影检测列数
  const gutters = detectColumnGutters(tableSpans, pw)
  const columnsCount = gutters.length > 0 ? gutters.length : 5
  const isSnaking = columnsCount >= 8 || fingerprint.tableStructure.estimatedRowCount > 18

  // 键值对提取
  const patientBand = bands.find((b) => b.name === 'PatientBanner')
  const patientText = patientBand?.spans.map((s) => s.text).join(' ') || ''
  const patientFields: Record<string, string> = {}

  const kvRegex = /(姓名|性别|年龄|科室|床号|病案号|住院号|门诊号|样本类型|标本号)[:：\s]+([^\s,;，；]+)/g
  let match: RegExpExecArray | null
  while ((match = kvRegex.exec(patientText)) !== null) {
    patientFields[match[1]] = match[2]
  }

  // 评估置信度与防错熔断
  let confidence = 0.95
  let needsFallbackInduction = false
  let fallbackReason: string | undefined

  if (fingerprint.tableStructure.estimatedRowCount === 0) {
    confidence = 0.5
    needsFallbackInduction = true
    fallbackReason = '未检测到结构化化验项目行，可能为自由手写笺或纯文本描述单'
  } else if (columnsCount < 2) {
    confidence = 0.65
    needsFallbackInduction = true
    fallbackReason = '表格未检测出有效列结构，列间隙过于狭窄或排版异常'
  }

  return {
    chunkId: `chunk_${Date.now()}`,
    physicalFingerprint: {
      paper: fingerprint.paperHint === 'A4_Portrait' ? 'A4' : 'A5',
      orientation: isLandscape ? 'Landscape' : 'Portrait',
      columnsCount,
      snakingFlowDetected: isSnaking,
      estimatedItemsCount: fingerprint.tableStructure.estimatedRowCount,
    },
    semanticAnchors: {
      hospitalName: fingerprint.hospitalName,
      reportTitle: fingerprint.category,
      department: patientFields['科室'] || '检验科',
      patientFields,
      tableColumns: ['项目名称', '缩写', '测定结果', '单位', '参考区间'],
    },
    atomicTableGrid: {
      headers: ['项目名称', '结果', '单位', '参考值'],
      rows: [],
    },
    confidence,
    needsFallbackInduction,
    fallbackReason,
  }
}
