/**
 * 医疗模板 RAG 智能检索器 (Template Retriever)
 *
 * 结合结构拓扑指纹与临床语义特征，在黄金标准模板库中快速检索最匹配的合规骨架。
 */

import type { DocumentFingerprint } from './fingerprinter.js'
import { GOLDEN_ARCHETYPES, type GoldenArchetype } from './knowledgeBase.js'

export interface RetrievalResult {
  matchedArchetype: GoldenArchetype
  confidence: number
  scoreDetails: {
    categoryMatchScore: number
    keywordScore: number
    tableStructureScore: number
    fieldOverlapScore: number
  }
  rationale: string
  alternativeMatches: Array<{ id: string; name: string; score: number }>
}

export function retrieveBestArchetype(
  fingerprint: DocumentFingerprint,
  rawQuery?: string
): RetrievalResult {
  const queryText = (rawQuery || `${fingerprint.reportTitle} ${fingerprint.hospitalName} ${fingerprint.category}`).toLowerCase()

  const scoredList = GOLDEN_ARCHETYPES.map((archetype) => {
    // 1. 类别硬匹配 (权重 0.45)
    let categoryScore = 0.2
    if (archetype.category === fingerprint.category) {
      categoryScore = 1.0
    } else if (
      (archetype.category === 'LisBloodRoutine' && fingerprint.category === 'LisBiochemistry') ||
      (archetype.category === 'LisBiochemistry' && fingerprint.category === 'LisBloodRoutine')
    ) {
      categoryScore = 0.75 // 检验类同族
    }

    // 2. 关键词与语义亲和度 (权重 0.25)
    const matchedKeywords = archetype.keywords.filter((kw) => queryText.includes(kw.toLowerCase()))
    const keywordScore = Math.min(1.0, (matchedKeywords.length / Math.max(1, archetype.keywords.length)) * 2.0)

    // 3. 表格结构与纸张匹配度 (权重 0.20)
    let tableStructureScore = 0.5
    if (fingerprint.tableStructure.estimatedRowCount > 12 && archetype.id.includes('snaking')) {
      // 多项目优先匹配双列折流
      tableStructureScore = 1.0
    } else if (fingerprint.constraints.hasObstacleChart && archetype.id.includes('teg')) {
      tableStructureScore = 1.0
    } else if (fingerprint.category === 'PacsImaging' && archetype.id.includes('pacs')) {
      tableStructureScore = 1.0
    }

    // 4. 患者字段重叠度 (权重 0.10)
    const fieldOverlapScore = fingerprint.detectedPatientFields.length > 0 ? 0.9 : 0.6

    // 综合加权得分
    const totalScore =
      categoryScore * 0.45 +
      keywordScore * 0.25 +
      tableStructureScore * 0.20 +
      fieldOverlapScore * 0.10

    return {
      archetype,
      totalScore,
      details: {
        categoryMatchScore: categoryScore,
        keywordScore,
        tableStructureScore,
        fieldOverlapScore,
      },
    }
  })

  // 按得分降序排序
  scoredList.sort((a, b) => b.totalScore - a.totalScore)

  const best = scoredList[0]
  const alternatives = scoredList.slice(1).map((s) => ({
    id: s.archetype.id,
    name: s.archetype.name,
    score: Math.round(s.totalScore * 100) / 100,
  }))

  const rationale = `匹配至【${best.archetype.name}】（置信度: ${(best.totalScore * 100).toFixed(1)}%）。原因：检测到${fingerprint.category}特征，表格约${fingerprint.tableStructure.estimatedRowCount}项，符合${best.archetype.paper_size.width_mm}×${best.archetype.paper_size.height_mm}mm标准规范。`

  return {
    matchedArchetype: best.archetype,
    confidence: Math.round(best.totalScore * 100) / 100,
    scoreDetails: best.details,
    rationale,
    alternativeMatches: alternatives,
  }
}
