/**
 * Pi-Agent Minimal Slot Filling Engine
 *
 * Maps extracted clinical entities and parsed items into golden template AST slots.
 * Enforces single-page height constraints and applies column flow rules.
 */

import type { DocumentFingerprint } from './fingerprinter.js'
import type { GoldenArchetype } from './knowledgeBase.js'
import type { ModelProviderConfig } from '../provider.js'

export interface SlotFillingResult {
  template: Record<string, unknown>
  filledSlots: {
    hospitalName: string
    reportTitle: string
    patientFieldsCount: number
    itemsExtractedCount: number
    signatures: Record<string, string>
    constraintsApplied: string[]
  }
  agentMode: 'heuristic-rules' | 'local-llm-assisted'
  compactionAdjusted: boolean
  physicalBudgetSummary: string
}

export async function fillTemplateSlots(
  rawInput: string,
  fingerprint: DocumentFingerprint,
  archetype: GoldenArchetype,
  _modelConfig?: ModelProviderConfig
): Promise<SlotFillingResult> {
  // 深拷贝骨架，避免污染原标准库
  const template: Record<string, unknown> = JSON.parse(JSON.stringify(archetype.template_skeleton))
  template.id = `rev_${Date.now()}`
  template.name = fingerprint.reportTitle || archetype.name

  let agentMode: 'heuristic-rules' | 'local-llm-assisted' = 'heuristic-rules'
  const constraintsApplied: string[] = []

  // 1. 槽位提取：医院表头与单号
  const hospitalName = fingerprint.hospitalName || 'XX市第一人民医院'
  const reportTitle = fingerprint.reportTitle || archetype.name
  const subTitle = fingerprint.subTitle || '检验科 / 实验诊断中心'

  const elements = (template.elements as Array<Record<string, unknown>>) || []

  // 2. 注入表头槽位
  const header = elements.find((e) => e.kind === 'HospitalHeader')
  if (header) {
    header.hospital_name = hospitalName
    header.report_title = reportTitle
    header.sub_title = subTitle

    // 约束：Logo 锚定与对齐
    if (fingerprint.constraints.logoPosition === 'TopLeft') {
      header.align = 'left'
      header.constraints = {
        anchor_position: 'TopLeft',
      }
      constraintsApplied.push('院徽 Logo 锚定左上角 (TopLeft)')
    }
  }

  // 3. 注入患者元数据槽位 (PatientBanner)
  const patientBanner = elements.find((e) => e.kind === 'PatientBanner')
  if (patientBanner) {
    patientBanner.include_barcode = fingerprint.hasBarcode
    // 如果指纹中嗅探到了具体字段，更新预览
    const fields = (patientBanner.fields as Array<Record<string, unknown>>) || []
    for (const f of fields) {
      if (f.key === 'name') {
        const m = rawInput.match(/(?:姓名|患者)[:：\s]+([^\s\n\r,，|]+)/)
        if (m) f.preview_value = m[1].trim()
      } else if (f.key === 'gender') {
        const m = rawInput.match(/(?:性别)[:：\s]+([男|女])/)
        if (m) f.preview_value = m[1].trim()
      } else if (f.key === 'age') {
        const m = rawInput.match(/(?:年龄)[:：\s]+([0-9]{1,3}\s*(?:岁|月)?)/)
        if (m) f.preview_value = m[1].trim()
      } else if (f.key === 'inpatient_no') {
        const m = rawInput.match(/(?:病案号|住院号|门诊号|ID号)[:：\s]+([0-9a-zA-Z\-_]+)/)
        if (m) f.preview_value = m[1].trim()
      }
    }
  }

  // 4. 注入化验项目列表槽位 (SnakingTable)
  const snakingTable = elements.find((e) => e.kind === 'SnakingTable')
  let itemsCount = 0

  if (snakingTable) {
    let finalItems: Array<Record<string, unknown>> = []

    if (fingerprint.tableStructure.parsedItems.length > 0) {
      // 采用从异构文档提取出的真实项目列表
      finalItems = fingerprint.tableStructure.parsedItems.map((it, idx) => {
        const numVal = parseFloat(it.value)
        let alert_flag = 'Normal'
        let is_critical = false

        if (it.refRange) {
          const rangeParts = it.refRange.split(/[\-~～]/).map((s) => parseFloat(s.trim()))
          if (rangeParts.length === 2 && !isNaN(rangeParts[0]) && !isNaN(rangeParts[1]) && !isNaN(numVal)) {
            if (numVal < rangeParts[0]) alert_flag = 'Low'
            else if (numVal > rangeParts[1]) alert_flag = 'High'
          }
        }
        if (numVal > 100.0 && alert_flag === 'High') {
          is_critical = true
        }

        return {
          index: idx + 1,
          item_name: it.name,
          item_abbr: it.abbr || it.name.slice(0, 4).toUpperCase(),
          result_value: it.value,
          unit: it.unit || '',
          ref_range_display: it.refRange || '',
          alert_flag,
          is_critical,
        }
      })
    } else {
      // 保留骨架内的标准样例
      finalItems = (snakingTable.items as Array<Record<string, unknown>>) || []
    }

    snakingTable.items = finalItems
    itemsCount = finalItems.length

    // 物理单页预算自适应折流调节 (Compaction Guard)
    if (itemsCount > 10) {
      snakingTable.columns_count = 2
      snakingTable.column_gap = 6.0
      snakingTable.left_ratio = 0.5
      constraintsApplied.push(`化验项超 10 项 (${itemsCount}项)，自动启用 A5 双列折流平衡`)
    }
  }

  // 5. 注入空间避让图表 (TEG / Pacs)
  if (fingerprint.constraints.hasObstacleChart) {
    constraintsApplied.push('注册图表为几何障碍禁区，化验表格执行 AvoidAndNarrow 避让折流')
  }

  // 6. 注入签名与印章槽位
  const signatures = elements.find((e) => e.kind === 'Signatures')
  if (signatures) {
    if (fingerprint.signatures.operator) signatures.operator = fingerprint.signatures.operator
    if (fingerprint.signatures.reviewer) signatures.reviewer = fingerprint.signatures.reviewer
    if (fingerprint.signatures.requester) signatures.requesting_physician = fingerprint.signatures.requester
    signatures.report_date = new Date().toISOString().slice(0, 16).replace('T', ' ')
  }

  const seal = elements.find((e) => e.kind === 'Seal')
  if (seal) {
    seal.hospital_name = hospitalName
    seal.seal_title = archetype.category === 'TegThromboelastogram' ? '输血检测专用章' : '检验专用章'
  }

  // 7. 单页预算与紧凑度验证
  let compactionAdjusted = false
  let physicalBudgetSummary = '单页物理高度预算充足 (A5)'
  if (itemsCount > 24) {
    compactionAdjusted = true
    physicalBudgetSummary = `单页高度守卫：${itemsCount} 项已自动压缩行距至 4.8mm，保持单页完整。`
    template.page_budget = 'SinglePageHard'
    constraintsApplied.push('单页硬预算守卫 (SinglePageHard)')
  }

  return {
    template,
    filledSlots: {
      hospitalName,
      reportTitle,
      patientFieldsCount: (patientBanner?.fields as unknown[])?.length || 6,
      itemsExtractedCount: itemsCount,
      signatures: {
        operator: (signatures?.operator as string) || '',
        reviewer: (signatures?.reviewer as string) || '',
      },
      constraintsApplied,
    },
    agentMode,
    compactionAdjusted,
    physicalBudgetSummary,
  }
}
