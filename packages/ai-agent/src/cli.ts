#!/usr/bin/env node
/**
 * MedPrint CLI (Command Line Interface)
 * Batch operations, RDLX template migration, RAG reverse compilation, and MCP server runner.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { parseRdlxXml, rdlxToFingerprint } from './rag/rdlxParser.js'
import { reverseGenerateTemplate } from './rag/index.js'
import { bindRuntimeDataToAst } from './binding/dataBinder.js'
import { startMcpServer } from './mcp.js'

function printHelp(): void {
  console.log(`
🏥 MedPrint CLI - Next-Gen Medical Report Engine Tools

Usage:
  medprint-cli <command> [options]

Commands:
  rdlx-parse <file.rdlx>        Parse GrapeCity ActiveReports RDLX XML and output MedPrint AST
  reverse <text-or-file>        Reverse-engineer Word/PDF/text report into MedPrint AST via RAG
  bind <tpl.json> <data.json>   Bind runtime patient & lab data into template AST JSON
  render <tpl.json> <data.json> Bind real patient data and compile into 300 DPI vector PDF
  compile <ast.json>            Compile MedPrint AST JSON into pure vector PDF via medprint-server
  mcp                           Start Model Context Protocol (MCP) stdio server
  help                          Display this help message

Options:
  -o, --out <path>              Output file path (JSON or PDF)
  -s, --server <url>            medprint-server URL (default: http://127.0.0.1:19800)

Examples:
  medprint-cli rdlx-parse ./template.rdlx -o ./template.ast.json
  medprint-cli reverse ./report_ocr.txt -o ./output.json
  medprint-cli render ./template.ast.json ./patient_data.json -o ./report.pdf
  medprint-cli compile ./template.ast.json -o ./report.pdf
  medprint-cli mcp
`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes('-h') || args.includes('--help') || args[0] === 'help') {
    printHelp()
    process.exit(0)
  }

  const command = args[0]

  switch (command) {
    case 'mcp': {
      startMcpServer()
      break
    }

    case 'rdlx-parse': {
      const filePath = args[1]
      if (!filePath) {
        console.error('❌ Error: Missing <file.rdlx> argument.')
        process.exit(1)
      }
      const fullPath = path.resolve(process.cwd(), filePath)
      if (!fs.existsSync(fullPath)) {
        console.error(`❌ Error: File not found: ${fullPath}`)
        process.exit(1)
      }

      const xml = fs.readFileSync(fullPath, 'utf-8')
      const rdlx = parseRdlxXml(xml)
      const res = await reverseGenerateTemplate(xml)

      const outIndex = args.findIndex((a) => a === '-o' || a === '--out')
      const outPath = outIndex !== -1 && args[outIndex + 1] ? path.resolve(process.cwd(), args[outIndex + 1]) : null

      if (outPath) {
        fs.writeFileSync(outPath, JSON.stringify(res.template, null, 2), 'utf-8')
        console.log(`✅ Converted RDLX [${path.basename(fullPath)}] -> [${outPath}] in ${res.elapsedMs}ms`)
        console.log(`   Items extracted: ${rdlx.dataset1Fields.length}, Patient fields: ${rdlx.patientFields.length}`)
      } else {
        console.log(JSON.stringify(res.template, null, 2))
      }
      break
    }

    case 'reverse': {
      const input = args[1]
      if (!input) {
        console.error('❌ Error: Missing <text-or-file> argument.')
        process.exit(1)
      }

      let content = input
      const fullPath = path.resolve(process.cwd(), input)
      if (fs.existsSync(fullPath)) {
        content = fs.readFileSync(fullPath, 'utf-8')
      }

      const res = await reverseGenerateTemplate(content)
      const outIndex = args.findIndex((a) => a === '-o' || a === '--out')
      const outPath = outIndex !== -1 && args[outIndex + 1] ? path.resolve(process.cwd(), args[outIndex + 1]) : null

      if (outPath) {
        fs.writeFileSync(outPath, JSON.stringify(res.template, null, 2), 'utf-8')
        console.log(`✅ Reverse generated AST via RAG in ${res.elapsedMs}ms -> [${outPath}]`)
        console.log(`   Matched archetype: ${res.retrieval.matchedArchetype.name} (${(res.retrieval.confidence * 100).toFixed(1)}%)`)
      } else {
        console.log(JSON.stringify(res.template, null, 2))
      }
      break
    }

    case 'bind': {
      const tplPath = args[1]
      const dataPath = args[2]
      if (!tplPath || !dataPath) {
        console.error('❌ Error: Usage: medprint-cli bind <template.ast.json> <data.json> [-o <out.ast.json>]')
        process.exit(1)
      }
      const fullTpl = path.resolve(process.cwd(), tplPath)
      const fullData = path.resolve(process.cwd(), dataPath)
      if (!fs.existsSync(fullTpl)) {
        console.error(`❌ Template file not found: ${fullTpl}`)
        process.exit(1)
      }
      if (!fs.existsSync(fullData)) {
        console.error(`❌ Data file not found: ${fullData}`)
        process.exit(1)
      }
      const tplAst = JSON.parse(fs.readFileSync(fullTpl, 'utf-8'))
      const runtimeData = JSON.parse(fs.readFileSync(fullData, 'utf-8'))
      const { boundAst, stats } = bindRuntimeDataToAst(tplAst, runtimeData)

      const outIndex = args.findIndex((a) => a === '-o' || a === '--out')
      const outPath = outIndex !== -1 && args[outIndex + 1] ? path.resolve(process.cwd(), args[outIndex + 1]) : null

      if (outPath) {
        fs.writeFileSync(outPath, JSON.stringify(boundAst, null, 2), 'utf-8')
        console.log(`✅ Data bound to AST successfully -> [${outPath}]`)
        console.log(`   Items: ${stats.itemsCount}, High: ${stats.highCount}, Low: ${stats.lowCount}, Critical: ${stats.criticalCount}`)
      } else {
        console.log(JSON.stringify(boundAst, null, 2))
      }
      break
    }

    case 'render': {
      const tplPath = args[1]
      const dataPath = args[2]
      if (!tplPath || !dataPath) {
        console.error('❌ Error: Usage: medprint-cli render <template.ast.json> <data.json> [-o <out.pdf>] [-s <serverUrl>]')
        process.exit(1)
      }
      const fullTpl = path.resolve(process.cwd(), tplPath)
      const fullData = path.resolve(process.cwd(), dataPath)
      if (!fs.existsSync(fullTpl)) {
        console.error(`❌ Template file not found: ${fullTpl}`)
        process.exit(1)
      }
      if (!fs.existsSync(fullData)) {
        console.error(`❌ Data file not found: ${fullData}`)
        process.exit(1)
      }
      const tplAst = JSON.parse(fs.readFileSync(fullTpl, 'utf-8'))
      const runtimeData = JSON.parse(fs.readFileSync(fullData, 'utf-8'))
      const { boundAst, stats } = bindRuntimeDataToAst(tplAst, runtimeData)

      const serverIndex = args.findIndex((a) => a === '-s' || a === '--server')
      const serverUrl = serverIndex !== -1 && args[serverIndex + 1] ? args[serverIndex + 1] : 'http://127.0.0.1:19800'

      const outIndex = args.findIndex((a) => a === '-o' || a === '--out')
      const outPath = outIndex !== -1 && args[outIndex + 1]
        ? path.resolve(process.cwd(), args[outIndex + 1])
        : fullTpl.replace(/\.json$/i, '') + '_rendered.pdf'

      console.log(`📡 Injected ${stats.itemsCount} real lab items (Critical: ${stats.criticalCount}, High: ${stats.highCount}, Low: ${stats.lowCount})...`)
      console.log(`📡 Sending to compiler server: ${serverUrl}/api/v1/render/compile_pdf ...`)

      try {
        const resp = await fetch(`${serverUrl}/api/v1/render/compile_pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(boundAst),
        })
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${await resp.text()}`)
        }
        const pdfBuf = await resp.arrayBuffer()
        fs.writeFileSync(outPath, Buffer.from(pdfBuf))
        console.log(`✅ Pure Vector PDF compiled with real patient data (${pdfBuf.byteLength} bytes) -> [${outPath}]`)
      } catch (err: any) {
        console.error(`❌ Render failed: ${err.message}`)
        console.error('   Hint: Make sure medprint-server is running (`cargo run -p medprint-server`).')
        process.exit(1)
      }
      break
    }

    case 'compile': {
      const jsonPath = args[1]
      if (!jsonPath) {
        console.error('❌ Error: Missing <ast.json> argument.')
        process.exit(1)
      }
      const fullJsonPath = path.resolve(process.cwd(), jsonPath)
      if (!fs.existsSync(fullJsonPath)) {
        console.error(`❌ Error: AST JSON file not found: ${fullJsonPath}`)
        process.exit(1)
      }

      const serverIndex = args.findIndex((a) => a === '-s' || a === '--server')
      const serverUrl = serverIndex !== -1 && args[serverIndex + 1] ? args[serverIndex + 1] : 'http://127.0.0.1:19800'

      const outIndex = args.findIndex((a) => a === '-o' || a === '--out')
      const outPath = outIndex !== -1 && args[outIndex + 1]
        ? path.resolve(process.cwd(), args[outIndex + 1])
        : fullJsonPath.replace(/\.json$/i, '') + '.pdf'

      const rawAst = fs.readFileSync(fullJsonPath, 'utf-8')
      const ast = JSON.parse(rawAst)

      console.log(`📡 Sending AST to compiler server: ${serverUrl}/api/v1/render/compile_pdf ...`)
      try {
        const resp = await fetch(`${serverUrl}/api/v1/render/compile_pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ast),
        })
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${await resp.text()}`)
        }
        const pdfBuf = await resp.arrayBuffer()
        fs.writeFileSync(outPath, Buffer.from(pdfBuf))
        console.log(`✅ Pure Vector PDF compiled successfully (${pdfBuf.byteLength} bytes) -> [${outPath}]`)
      } catch (err: any) {
        console.error(`❌ Failed to compile PDF: ${err.message}`)
        console.error('   Hint: Make sure medprint-server is running (`cargo run -p medprint-server`).')
        process.exit(1)
      }
      break
    }

    default: {
      console.error(`❌ Unknown command: ${command}`)
      printHelp()
      process.exit(1)
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
