// MedPrint Chrome / Edge Extension Background Service Worker
// 桥接网页与底层 Rust medprint-agent 的 Native Messaging 管道

const HOST_NAME = 'com.medprint.agent'

let port: chrome.runtime.Port | null = null

function getOrCreateNativePort(): chrome.runtime.Port {
  if (!port) {
    port = chrome.runtime.connectNative(HOST_NAME)
    port.onMessage.addListener((msg) => {
      console.log('[MedPrint Extension] Received from Agent:', msg)
      // 向前端活跃标签页广播真实的硬件打印机事件 (如 JOB_COMPLETED, PAPER_OUT)
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'PRINTER_EVENT', payload: msg })
        }
      })
    })

    port.onDisconnect.addListener(() => {
      console.warn('[MedPrint Extension] Native host disconnected')
      port = null
    })
  }
  return port
}

// 监听来自医院 HIS/LIS 网页的消息
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'SILENT_PRINT') {
    try {
      const nativePort = getOrCreateNativePort()
      nativePort.postMessage({
        action: 'print',
        template_id: request.templateId,
        pdf_bytes_base64: request.pdfBase64,
      })
      sendResponse({ status: 'sent_to_agent' })
    } catch (err: any) {
      sendResponse({ status: 'error', error: err.message })
    }
  }
  return true
})

// 点击扩展图标打开设计器
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'http://localhost:19800' })
})
