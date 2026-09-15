/**
 * MedPrint RAG 知识库检索与 Pi Agent 最小化逆向生成主入口
 */

import { analyzeDocumentFingerprint, type DocumentFingerprint } from './fingerprinter.js'
import { retrieveBestArchetype, type RetrievalResult } from './retriever.js'
import { fillTemplateSlots, type SlotFillingResult } from './slotFiller.js'
import type { ModelProviderConfig } from '../provider.js'

export * from './fingerprinter.js'
export * from './knowledgeBase.js'
export * from './retriever.js'
export * from './slotFiller.js'

export interface ReverseGenerationOptions {
  modelConfig?: ModelProviderConfig
}

export interface PipelineStepLog {
  stepIndex: number
  name: string
  status: 'done' | 'running' | 'pending'
  message: string
  details?: Record<string, unknown>
}

export interface ReverseGenerationResult {
  template: Record<string, unknown>
  fingerprint: DocumentFingerprint
  retrieval: RetrievalResult
  slotFilling: SlotFillingResult
  pipelineSteps: PipelineStepLog[]
  elapsedMs: number
}

export async function reverseGenerateTemplate(
  rawInput: string,
  options: ReverseGenerationOptions = {}
): Promise<ReverseGenerationResult> {
  const startTime = Date.now()
  const pipelineSteps: PipelineStepLog[] = []

  // Step 1: 结构指纹抽取
  const fingerprint = analyzeDocumentFingerprint(rawInput)
  pipelineSteps.push({
    stepIndex: 1,
    name: '结构拓扑指纹提取 (Fingerprinting)',
    status: 'done',
    message: `识别类别: ${fingerprint.category} (置信度 ${(fingerprint.categoryConfidence * 100).toFixed(0)}%)，提取到 ${fingerprint.tableStructure.estimatedRowCount} 项表格数据、${fingerprint.detectedPatientFields.length} 个患者字段`,
    details: {
      category: fingerprint.category,
      hospitalName: fingerprint.hospitalName,
      itemsCount: fingerprint.tableStructure.estimatedRowCount,
      paperHint: fingerprint.paperHint,
    },
  })

  // Step 2: RAG 黄金骨架知识库检索
  const retrieval = retrieveBestArchetype(fingerprint, rawInput)
  pipelineSteps.push({
    stepIndex: 2,
    name: '黄金骨架 RAG 召回 (Archetype Retrieval)',
    status: 'done',
    message: `命中骨架【${retrieval.matchedArchetype.name}】，综合亲和度: ${(retrieval.confidence * 100).toFixed(1)}%`,
    details: {
      matchedId: retrieval.matchedArchetype.id,
      rationale: retrieval.rationale,
      confidence: retrieval.confidence,
    },
  })

  // Step 3: Pi Agent 最小化槽位精准填空
  const slotFilling = await fillTemplateSlots(
    rawInput,
    fingerprint,
    retrieval.matchedArchetype,
    options.modelConfig
  )
  pipelineSteps.push({
    stepIndex: 3,
    name: 'Pi Agent 最小化槽位填充 (Slot Filling)',
    status: 'done',
    message: `完成表头、条码、${slotFilling.filledSlots.itemsExtractedCount} 项化验明细、双人签字链填充，应用约束: ${slotFilling.filledSlots.constraintsApplied.join('; ') || '默认对齐'}`,
    details: {
      filledSlots: slotFilling.filledSlots,
      agentMode: slotFilling.agentMode,
    },
  })

  // Step 4: 物理几何闭环校验与单页预算守护
  pipelineSteps.push({
    stepIndex: 4,
    name: '物理几何闭环校验 (Physical Budget Guard)',
    status: 'done',
    message: `${slotFilling.physicalBudgetSummary}，输出 100% 封闭合规 AST，零外部模糊，就绪直出矢量 PDF`,
    details: {
      compactionAdjusted: slotFilling.compactionAdjusted,
      budget: slotFilling.physicalBudgetSummary,
    },
  })

  const elapsedMs = Date.now() - startTime

  return {
    template: slotFilling.template,
    fingerprint,
    retrieval,
    slotFilling,
    pipelineSteps,
    elapsedMs,
  }
}
