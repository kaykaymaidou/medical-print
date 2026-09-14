//! 医院内网离线本地文件与档案存储引擎 (Hospital Intranet Local Storage)
//!
//! 适配内网脱机环境，纯 Rust 零外部 C 库依赖。
//! 将模板与打印审计记录安全持久化至本地磁盘与 JSON 档案库。

use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

pub struct LocalArchiveStore {
    base_dir: PathBuf,
}

impl LocalArchiveStore {
    pub fn new<P: AsRef<Path>>(base_dir: P) -> Self {
        let store = Self {
            base_dir: base_dir.as_ref().to_path_buf(),
        };
        let _ = fs::create_dir_all(store.templates_dir());
        let _ = fs::create_dir_all(store.logs_dir());
        store
    }

    fn templates_dir(&self) -> PathBuf {
        self.base_dir.join("templates")
    }

    fn logs_dir(&self) -> PathBuf {
        self.base_dir.join("logs")
    }

    /// 保存或更新报告单模板
    #[allow(dead_code)]
    pub fn save_template(&self, id: &str, template_json: &serde_json::Value) -> io::Result<PathBuf> {
        let file_path = self.templates_dir().join(format!("{}.medprint.json", id));
        let mut file = File::create(&file_path)?;
        let content = serde_json::to_string_pretty(template_json)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        file.write_all(content.as_bytes())?;
        log::info!("Template saved to local archive: {:?}", file_path);
        Ok(file_path)
    }

    /// 列出本地全部已保存的医疗模板
    pub fn list_templates(&self) -> Vec<serde_json::Value> {
        let mut list = Vec::new();
        if let Ok(entries) = fs::read_dir(self.templates_dir()) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("json") {
                    if let Ok(mut file) = File::open(&path) {
                        let mut content = String::new();
                        if file.read_to_string(&mut content).is_ok() {
                            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                                list.push(val);
                            }
                        }
                    }
                }
            }
        }
        list
    }

    /// 获取单个模板详情
    pub fn get_template(&self, id: &str) -> Option<serde_json::Value> {
        let file_path = self.templates_dir().join(format!("{}.medprint.json", id));
        if file_path.exists() {
            if let Ok(mut file) = File::open(&file_path) {
                let mut content = String::new();
                if file.read_to_string(&mut content).is_ok() {
                    return serde_json::from_str::<serde_json::Value>(&content).ok();
                }
            }
        }
        None
    }

    /// 导出本地模板全量备份包 (离线迁移/U盘备份)
    pub fn export_bundle(&self) -> String {
        let templates = self.list_templates();
        serde_json::json!({
            "version": "1.0",
            "exported_at": chrono::Utc::now().to_rfc3339(),
            "count": templates.len(),
            "templates": templates
        }).to_string()
    }

    /// 删除指定 ID 的本地模板
    pub fn delete_template(&self, id: &str) -> io::Result<bool> {
        let file_path = self.templates_dir().join(format!("{}.medprint.json", id));
        if file_path.exists() {
            fs::remove_file(file_path)?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// 导入全量离线归档备份包或单个模板
    pub fn import_bundle(&self, bundle_json: &serde_json::Value) -> io::Result<usize> {
        let mut count = 0;
        if let Some(templates) = bundle_json.get("templates").and_then(|v| v.as_array()) {
            for tpl in templates {
                if let Some(id) = tpl.get("id").and_then(|v| v.as_str()) {
                    let _ = self.save_template(id, tpl);
                    count += 1;
                }
            }
        } else if let Some(id) = bundle_json.get("id").and_then(|v| v.as_str()) {
            let _ = self.save_template(id, bundle_json);
            count += 1;
        }
        Ok(count)
    }
}
