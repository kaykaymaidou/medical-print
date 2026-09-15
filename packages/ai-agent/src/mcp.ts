#!/usr/bin/env node
/**
 * MedPrint Model Context Protocol (MCP) Server
 * Standard JSON-RPC 2.0 stdio server connecting MedPrint tools to AI Agent platforms:
 * Claude Desktop, Cursor, Antigravity, DeepSeek Harness, Open WebUI, and local hospital LLMs (Ollama / vLLM).
 */

import * as readline from 'node:readline'
import { MEDPRINT_TOOLS, MedPrintToolExecutor } from './tools.js'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: any
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

function sendResponse(response: JsonRpcResponse): void {
  const json = JSON.stringify(response)
  process.stdout.write(json + '\n')
}

export function startMcpServer(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  })

  rl.on('line', async (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return

    let request: JsonRpcRequest
    try {
      request = JSON.parse(trimmed)
    } catch (e: any) {
      sendResponse({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: `Parse error: ${e.message}`,
        },
      })
      return
    }

    // Ignore notifications without id
    if (request.id === undefined || request.id === null) {
      return
    }

    try {
      switch (request.method) {
        case 'initialize': {
          sendResponse({
            jsonrpc: '2.0',
            id: request.id,
            result: {
              protocolVersion: '2024-11-05',
              serverInfo: {
                name: 'medprint-mcp',
                version: '0.1.0',
              },
              capabilities: {
                tools: {},
              },
            },
          })
          break
        }

        case 'tools/list': {
          const mcpTools = MEDPRINT_TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.parameters,
          }))
          sendResponse({
            jsonrpc: '2.0',
            id: request.id,
            result: {
              tools: mcpTools,
            },
          })
          break
        }

        case 'tools/call': {
          const { name, arguments: args } = request.params || {}
          if (!name) {
            sendResponse({
              jsonrpc: '2.0',
              id: request.id,
              error: {
                code: -32602,
                message: 'Missing tool name in tools/call request',
              },
            })
            return
          }

          const toolResult = await MedPrintToolExecutor.executeTool(name, args || {})
          sendResponse({
            jsonrpc: '2.0',
            id: request.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2),
                },
              ],
            },
          })
          break
        }

        default: {
          sendResponse({
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: `Method not found: ${request.method}`,
            },
          })
        }
      }
    } catch (err: any) {
      sendResponse({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32000,
          message: `Tool execution error: ${err.message}`,
        },
      })
    }
  })

  // Handle process exit
  process.on('SIGINT', () => process.exit(0))
  process.on('SIGTERM', () => process.exit(0))
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('mcp.js')) {
  startMcpServer()
}
