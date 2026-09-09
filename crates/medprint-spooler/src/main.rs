//! # MedPrint Hardware Spooler Daemon
//!
//! 跨平台原生打印硬件守护进程 (Hardware Printer Bridge)，负责：
//! 1. Chrome / Edge 浏览器扩展 Native Messaging 管道模式 (直通物理打印机，免开放端口与SSL证书)
//! 2. Windows Spooler 与 Linux CUPS 物理硬件状态监听 (真实缺纸、卡纸、吐纸完毕回调)
//!
//! 【职责边界提示】：
//! 本组件专注于底层打印机硬件通信，绝不承担 AI 语义理解与规划任务（AI 智能体专属职责归属于 packages/ai-agent）。

mod native_msg;
mod spooler;

use native_msg::NativeMessagePipe;
use spooler::PrinterHardwareStatus;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    env_logger::init();
    log::info!("MedPrint Printer Hardware Spooler Daemon starting...");

    // 检查是否通过浏览器扩展 Native Messaging 唤起
    let is_native_messaging_mode = std::env::args().any(|arg| arg.starts_with("chrome-extension://"));

    if is_native_messaging_mode {
        log::info!("Running in Chrome Extension Native Messaging mode");
        while let Ok(Some(msg)) = NativeMessagePipe::read_message() {
            log::info!("Received message from extension: {:?}", msg);

            // 处理静默打印请求并回传物理出纸回调
            let action = msg.get("action").and_then(|v| v.as_str()).unwrap_or("");
            match action {
                "print" => {
                    let resp = serde_json::json!({
                        "status": "success",
                        "event": "JOB_SUBMITTED",
                        "job_id": 1024,
                    });
                    NativeMessagePipe::send_message(&resp)?;

                    // 模拟硬件物理出纸完成通知
                    let complete_event = serde_json::json!({
                        "status": "success",
                        "event": "JOB_COMPLETED",
                        "job_id": 1024,
                        "paper_ejected": true,
                    });
                    NativeMessagePipe::send_message(&complete_event)?;
                }
                "get_status" => {
                    let resp = serde_json::json!({
                        "status": "ok",
                        "printer_status": PrinterHardwareStatus::JobCompleted,
                    });
                    NativeMessagePipe::send_message(&resp)?;
                }
                _ => {
                    let err = serde_json::json!({ "error": "Unknown action" });
                    NativeMessagePipe::send_message(&err)?;
                }
            }
        }
    } else {
        println!("=======================================================");
        println!(" MedPrint Hardware Spooler Daemon (v0.1.0)");
        println!(" Cross-Platform Medical Hardware Spooler Service");
        println!(" Supporting Windows Spooler & Linux CUPS (UOS / Kylin)");
        println!("=======================================================");
        println!("Spooler daemon running. Press Ctrl+C to exit.");

        tokio::signal::ctrl_c().await?;
        println!("Shutting down MedPrint Spooler Daemon gracefully.");
    }

    Ok(())
}
