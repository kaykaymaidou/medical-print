//! # MedPrint Server
//!
//! 单一二进制独立微服务 (Single All-in-One Binary):
//! 彻底解决“既要部署前端 npm 页面，又要部署 Windows 本地服务”的双重地狱痛点。
//! 双击即可运行，同时提供 Web 界面、REST API、离线本地模板存储与批量 PDF 打印服务。

mod storage;

use medprint_core::pdf::VectorPdfDoc;
use medprint_core::units::PhysicalSize;
use storage::LocalArchiveStore;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    env_logger::init();
    let port = 19800;
    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).await?;

    let store = Arc::new(LocalArchiveStore::new("data"));

    println!("===============================================================");
    println!(" 🏥 MedPrint All-in-One Standalone Microservice");
    println!(" Single Binary Solution for Medical Report Designer & Printing");
    println!(" Local Offline Archive Directory: ./data/templates/");
    println!(" Listening on: http://localhost:{}", port);
    println!(" Web Studio & API: http://127.0.0.1:{}", port);
    println!("===============================================================");

    let server = Arc::new(listener);

    loop {
        let (mut socket, _peer_addr) = server.accept().await?;
        let store = Arc::clone(&store);

        tokio::spawn(async move {
            let mut buffer = [0u8; 8192];
            match socket.read(&mut buffer).await {
                Ok(0) => return,
                Ok(n) => {
                    let req_str = String::from_utf8_lossy(&buffer[..n]);
                    let first_line = req_str.lines().next().unwrap_or("");
                    let mut parts = first_line.split_whitespace();
                    let _method = parts.next().unwrap_or("");
                    let path = parts.next().unwrap_or("");

                    if path.starts_with("/api/v1/health") {
                        let body = r#"{"status":"UP","service":"medprint-server","version":"0.1.0"}"#;
                        let resp = format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                            body.len(),
                            body
                        );
                        let _ = socket.write_all(resp.as_bytes()).await;
                    } else if path.starts_with("/api/v1/storage/templates") {
                        // 列出内网离线存储的全部模板
                        let templates = store.list_templates();
                        let body = serde_json::to_string(&templates).unwrap_or_else(|_| "[]".to_string());
                        let resp = format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                            body.len(),
                            body
                        );
                        let _ = socket.write_all(resp.as_bytes()).await;
                    } else if path.starts_with("/api/v1/storage/export") {
                        // 导出离线备份归档包
                        let bundle = store.export_bundle();
                        let resp = format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Disposition: attachment; filename=\"medprint_archive.json\"\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                            bundle.len(),
                            bundle
                        );
                        let _ = socket.write_all(resp.as_bytes()).await;
                    } else if path.starts_with("/api/v1/render/pdf") {
                        // 导出高精矢量 PDF
                        let mut pdf = VectorPdfDoc::new(PhysicalSize::a5_landscape());
                        pdf.draw_rect(10.0, 10.0, 190.0, 128.0, true, false);
                        pdf.draw_line(10.0, 25.0, 200.0, 25.0, 1.0);
                        let pdf_bytes = pdf.compile_to_bytes();

                        let header = format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: application/pdf\r\nContent-Disposition: inline; filename=\"report.pdf\"\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n",
                            pdf_bytes.len()
                        );
                        let _ = socket.write_all(header.as_bytes()).await;
                        let _ = socket.write_all(&pdf_bytes).await;
                    } else {
                        // 根路径：返回内置 Web 设计器引导页
                        let html = r#"<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>MedPrint Medical Studio</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; background: #f8fafc; color: #1e293b; }
        .card { background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 800px; margin: 0 auto; }
        h1 { color: #0284c7; margin-top: 0; }
        .badge { background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 9999px; font-weight: 600; font-size: 14px; }
        .endpoint { background: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace; margin: 8px 0; }
        .btn { display: inline-block; background: #0284c7; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500; margin-top: 16px; }
    </style>
</head>
<body>
    <div class="card">
        <h1>🏥 MedPrint Medical Studio <span class="badge">v0.1.0 Ready</span></h1>
        <p>面向医疗健康领域的下一代跨平台打印报告单设计器与高性能引擎已成功启动。</p>
        <h3>内置服务端点与离线存储 (Endpoints & Offline Storage)</h3>
        <div class="endpoint">GET /api/v1/health - 健康检查</div>
        <div class="endpoint">GET /api/v1/storage/templates - 医院内网本地模板档案库</div>
        <div class="endpoint">GET /api/v1/storage/export - 导出全量离线归档备份包 (.json)</div>
        <div class="endpoint">GET /api/v1/render/pdf - 300/600 DPI 纯矢量 A5 横向化验单 PDF 直出</div>
        <a class="btn" href="/api/v1/render/pdf" target="_blank">预览矢量 PDF 测试样张</a>
    </div>
</body>
</html>"#;
                        let resp = format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\r\n{}",
                            html.as_bytes().len(),
                            html
                        );
                        let _ = socket.write_all(resp.as_bytes()).await;
                    }
                }
                Err(e) => {
                    log::error!("Socket read error: {}", e);
                }
            }
        });
    }
}
