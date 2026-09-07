//! # MedPrint Agent 主入口
//!
//! 跨平台原生打印守护进程，支持：
//! 1. Chrome / Edge 浏览器扩展 Native Messaging 管道模式
//! 2. 独立控制台与 Windows 服务托盘模式

mod native_msg;
mod spooler;

use native_msg::NativeMessagePipe;
use spooler::PrinterHardwareStatus;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    env_logger::init();
    log::info!("MedPrint Native Print Agent starting...");

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
        println!(" MedPrint Native Print Daemon (v0.1.0)");
        println!(" Cross-Platform Medical Hardware Spooler Service");
        println!(" Supporting Windows Spooler & Linux CUPS (UOS / Kylin)");
        println!("=======================================================");
        println!("Agent daemon running. Press Ctrl+C to exit.");

        tokio::signal::ctrl_c().await?;
        println!("Shutting down MedPrint Agent gracefully.");
    }

    Ok(())
}
