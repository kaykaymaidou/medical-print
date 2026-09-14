//! # MedPrint Server
//!
//! 单一二进制独立微服务 (Single All-in-One Binary):
//! 彻底解决“既要部署前端 npm 页面，又要部署 Windows 本地服务”的双重地狱痛点。
//! 双击即可运行，同时提供 Web 界面、REST API、离线本地模板存储与高精矢量 PDF 编译服务。

mod storage;

use medprint_core::pdf::{MedicalReportCompiler, VectorPdfDoc};
use medprint_core::units::PhysicalSize;
use storage::LocalArchiveStore;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

struct HttpRequest {
    method: String,
    path: String,
    #[allow(dead_code)]
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

async fn read_http_request<T: AsyncReadExt + Unpin>(
    socket: &mut T,
) -> Result<HttpRequest, Box<dyn std::error::Error + Send + Sync>> {
    let mut header_bytes = Vec::new();
    let mut buf = [0u8; 2048];
    let mut header_end = None;

    while header_end.is_none() {
        let n = socket.read(&mut buf).await?;
        if n == 0 {
            return Err("Connection closed by peer".into());
        }
        header_bytes.extend_from_slice(&buf[..n]);

        if let Some(pos) = header_bytes.windows(4).position(|w| w == b"\r\n\r\n") {
            header_end = Some(pos);
            break;
        }
        if header_bytes.len() > 65536 {
            return Err("Headers exceed 64KB limit".into());
        }
    }

    let end_pos = header_end.unwrap();
    let header_str = String::from_utf8_lossy(&header_bytes[..end_pos]).to_string();
    let initial_body = header_bytes[end_pos + 4..].to_vec();

    let mut lines = header_str.lines();
    let req_line = lines.next().unwrap_or("");
    let mut parts = req_line.split_whitespace();
    let method = parts.next().unwrap_or("GET").to_uppercase();
    let path = parts.next().unwrap_or("/").to_string();

    let mut headers = Vec::new();
    let mut content_length = 0usize;

    for line in lines {
        if let Some((k, v)) = line.split_once(':') {
            let key = k.trim().to_lowercase();
            let val = v.trim().to_string();
            if key == "content-length" {
                content_length = val.parse().unwrap_or(0);
            }
            headers.push((key, val));
        }
    }

    let mut body = initial_body;
    while body.len() < content_length {
        let n = socket.read(&mut buf).await?;
        if n == 0 {
            break;
        }
        body.extend_from_slice(&buf[..n]);
    }

    Ok(HttpRequest {
        method,
        path,
        headers,
        body,
    })
}

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
            let req = match read_http_request(&mut socket).await {
                Ok(r) => r,
                Err(_) => return,
            };

            let path = req.path.split('?').next().unwrap_or(&req.path).to_string();

            // 1. CORS Preflight
            if req.method == "OPTIONS" {
                let resp = "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, DELETE, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, Authorization, Accept\r\nAccess-Control-Max-Age: 86400\r\nContent-Length: 0\r\n\r\n";
                let _ = socket.write_all(resp.as_bytes()).await;
                return;
            }

            // 2. REST API: 健康检查
            if req.method == "GET" && path == "/api/v1/health" {
                let body = r#"{"status":"UP","service":"medprint-server","version":"0.1.0","arch":"x86_64"}"#;
                let resp = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = socket.write_all(resp.as_bytes()).await;
                return;
            }

            // 3. REST API: 纯矢量 PDF 实时编译 (POST 接收当前模板 AST)
            if req.method == "POST" && (path == "/api/v1/render/compile_pdf" || path == "/api/v1/render/pdf") {
                match serde_json::from_slice::<serde_json::Value>(&req.body) {
                    Ok(template_json) => {
                        match MedicalReportCompiler::compile_from_json(&template_json) {
                            Ok(pdf_doc) => {
                                let pdf_bytes = pdf_doc.compile_to_bytes();
                                let resp = format!(
                                    "HTTP/1.1 200 OK\r\nContent-Type: application/pdf\r\nContent-Disposition: attachment; filename=\"report.pdf\"\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n",
                                    pdf_bytes.len()
                                );
                                let _ = socket.write_all(resp.as_bytes()).await;
                                let _ = socket.write_all(&pdf_bytes).await;
                                return;
                            }
                            Err(err) => {
                                let err_json = format!(r#"{{"error":"PDF compilation failed: {}"}}"#, err);
                                let resp = format!(
                                    "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                                    err_json.len(),
                                    err_json
                                );
                                let _ = socket.write_all(resp.as_bytes()).await;
                                return;
                            }
                        }
                    }
                    Err(err) => {
                        let err_json = format!(r#"{{"error":"Invalid JSON AST: {}"}}"#, err);
                        let resp = format!(
                            "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                            err_json.len(),
                            err_json
                        );
                        let _ = socket.write_all(resp.as_bytes()).await;
                        return;
                    }
                }
            }

            // 4. REST API: 纯矢量 PDF 测试样张 (GET)
            if req.method == "GET" && path == "/api/v1/render/pdf" {
                let mut pdf = VectorPdfDoc::new(PhysicalSize::a5_landscape());
                pdf.draw_rect(10.0, 10.0, 190.0, 128.0, true, false);
                pdf.draw_line(10.0, 25.0, 200.0, 25.0, 1.0);
                pdf.draw_text(15.0, 15.0, "MEDPRINT CLINICAL TEST REPORT", 12.0, "F2");
                pdf.draw_barcode_code128(140.0, 15.0, 45.0, 8.0, "MZ20260908001");
                let pdf_bytes = pdf.compile_to_bytes();

                let resp = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/pdf\r\nContent-Disposition: inline; filename=\"sample.pdf\"\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n",
                    pdf_bytes.len()
                );
                let _ = socket.write_all(resp.as_bytes()).await;
                let _ = socket.write_all(&pdf_bytes).await;
                return;
            }

            // 5. REST API: 离线模板列出或单个获取 (GET)
            if req.method == "GET" && path == "/api/v1/storage/templates" {
                let templates = store.list_templates();
                let body = serde_json::to_string(&templates).unwrap_or_else(|_| "[]".to_string());
                let resp = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = socket.write_all(resp.as_bytes()).await;
                return;
            }

            if req.method == "GET" && path.starts_with("/api/v1/storage/templates/") {
                let id = path.trim_start_matches("/api/v1/storage/templates/");
                if let Some(tpl) = store.get_template(id) {
                    let body = serde_json::to_string(&tpl).unwrap_or_else(|_| "{}".to_string());
                    let resp = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                        body.len(),
                        body
                    );
                    let _ = socket.write_all(resp.as_bytes()).await;
                    return;
                } else {
                    let resp_body = r#"{"error":"Template not found"}"#;
                    let resp = format!(
                        "HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                        resp_body.len(),
                        resp_body
                    );
                    let _ = socket.write_all(resp.as_bytes()).await;
                    return;
                }
            }

            // 6. REST API: 离线模板保存或更新 (POST)
            if req.method == "POST" && path == "/api/v1/storage/templates" {
                if let Ok(template_json) = serde_json::from_slice::<serde_json::Value>(&req.body) {
                    let id = template_json
                        .get("id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("tpl_unnamed");
                    match store.save_template(id, &template_json) {
                        Ok(_) => {
                            let resp_body = format!(r#"{{"status":"saved","id":"{}"}}"#, id);
                            let resp = format!(
                                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                                resp_body.len(),
                                resp_body
                            );
                            let _ = socket.write_all(resp.as_bytes()).await;
                            return;
                        }
                        Err(e) => {
                            let resp_body = format!(r#"{{"error":"Failed to save: {}"}}"#, e);
                            let resp = format!(
                                "HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                                resp_body.len(),
                                resp_body
                            );
                            let _ = socket.write_all(resp.as_bytes()).await;
                            return;
                        }
                    }
                }
            }

            // 7. REST API: 离线模板删除 (DELETE)
            if req.method == "DELETE" && path.starts_with("/api/v1/storage/templates/") {
                let id = path.trim_start_matches("/api/v1/storage/templates/");
                match store.delete_template(id) {
                    Ok(deleted) => {
                        let resp_body = format!(r#"{{"status":"deleted","id":"{}","found":{}}}"#, id, deleted);
                        let resp = format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                            resp_body.len(),
                            resp_body
                        );
                        let _ = socket.write_all(resp.as_bytes()).await;
                        return;
                    }
                    Err(e) => {
                        let resp_body = format!(r#"{{"error":"Failed to delete: {}"}}"#, e);
                        let resp = format!(
                            "HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                            resp_body.len(),
                            resp_body
                        );
                        let _ = socket.write_all(resp.as_bytes()).await;
                        return;
                    }
                }
            }

            // 8. REST API: 离线归档备份包导出 (GET)
            if req.method == "GET" && path == "/api/v1/storage/export" {
                let bundle = store.export_bundle();
                let resp = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Disposition: attachment; filename=\"medprint_archive.json\"\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                    bundle.len(),
                    bundle
                );
                let _ = socket.write_all(resp.as_bytes()).await;
                return;
            }

            // 9. REST API: 离线归档备份包导入 (POST)
            if req.method == "POST" && path == "/api/v1/storage/import" {
                if let Ok(bundle_json) = serde_json::from_slice::<serde_json::Value>(&req.body) {
                    match store.import_bundle(&bundle_json) {
                        Ok(count) => {
                            let resp_body = format!(r#"{{"status":"imported","count":{}}}"#, count);
                            let resp = format!(
                                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                                resp_body.len(),
                                resp_body
                            );
                            let _ = socket.write_all(resp.as_bytes()).await;
                            return;
                        }
                        Err(e) => {
                            let resp_body = format!(r#"{{"error":"Failed to import: {}"}}"#, e);
                            let resp = format!(
                                "HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                                resp_body.len(),
                                resp_body
                            );
                            let _ = socket.write_all(resp.as_bytes()).await;
                            return;
                        }
                    }
                }
            }

            // 10. 静态 Web Studio 资源分发 (支持直接脱机加载 Vue 3 Web Studio)
            let clean_path = if path == "/" || path.is_empty() {
                "/index.html"
            } else {
                &path
            };

            let candidate_dirs = [
                "packages/designer/dist",
                "./dist",
                "./web",
                "../packages/designer/dist",
            ];

            let mut file_content: Option<(Vec<u8>, &'static str)> = None;
            for dir in candidate_dirs {
                let candidate_path = format!("{}{}", dir, clean_path);
                if let Ok(bytes) = std::fs::read(&candidate_path) {
                    let mime = mime_type(clean_path);
                    file_content = Some((bytes, mime));
                    break;
                }
            }

            // SPA Fallback: 如果是前端单页路由请求，自动回退到 index.html
            if file_content.is_none() && !clean_path.starts_with("/api/") {
                for dir in candidate_dirs {
                    let index_path = format!("{}/index.html", dir);
                    if let Ok(bytes) = std::fs::read(&index_path) {
                        file_content = Some((bytes, "text/html; charset=utf-8"));
                        break;
                    }
                }
            }

            if let Some((bytes, mime)) = file_content {
                let header = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n",
                    mime,
                    bytes.len()
                );
                let _ = socket.write_all(header.as_bytes()).await;
                let _ = socket.write_all(&bytes).await;
            } else {
                // 降级返回内置 Web 服务状态页
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
        <div class="endpoint">POST /api/v1/render/compile_pdf - 传入 ReportTemplate AST，编译返回纯矢量高精 PDF</div>
        <div class="endpoint">GET /api/v1/storage/templates - 医院内网本地模板档案库</div>
        <div class="endpoint">POST /api/v1/storage/templates - 保存或更新报告单模板</div>
        <div class="endpoint">GET /api/v1/storage/export - 导出全量离线归档备份包 (.json)</div>
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
        });
    }
}

fn mime_type(path: &str) -> &'static str {
    if path.ends_with(".html") {
        "text/html; charset=utf-8"
    } else if path.ends_with(".js") {
        "application/javascript; charset=utf-8"
    } else if path.ends_with(".css") {
        "text/css; charset=utf-8"
    } else if path.ends_with(".svg") {
        "image/svg+xml"
    } else if path.ends_with(".png") {
        "image/png"
    } else if path.ends_with(".jpg") || path.ends_with(".jpeg") {
        "image/jpeg"
    } else if path.ends_with(".wasm") {
        "application/wasm"
    } else if path.ends_with(".json") {
        "application/json; charset=utf-8"
    } else {
        "application/octet-stream"
    }
}
