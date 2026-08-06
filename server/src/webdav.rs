//! WebDAV 文件上传。
//!
//! WebDAV 的核心操作就是标准 HTTP：
//!   - PUT   上传/覆盖文件
//!   - MKCOL 创建目录（已存在返回 405，视为成功）
//!
//! 因此不需要引入专门的 WebDAV crate，直接用 reqwest 即可。
//! 下载完成后由 download_manager 调用 `upload_file` 把 IPA 推到远端。

use std::path::Path;
use tokio::fs;
use tokio::io::AsyncReadExt;

/// WebDAV 上传配置（从数据库 WebDAVConfig 映射而来）。
#[derive(Debug, Clone)]
pub struct WebDAVTarget {
    pub url: String,
    pub username: String,
    pub password: String,
    pub remote_path: String,
}

impl WebDAVTarget {
    /// 构建带 Basic Auth 的 reqwest RequestBuilder。
    fn request(&self, method: reqwest::Method, url: &str) -> reqwest::RequestBuilder {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(300))
            .build()
            .expect("reqwest client build failed");
        let mut req = client.request(method, url);
        if !self.username.is_empty() {
            req = req.basic_auth(&self.username, Some(&self.password));
        }
        req
    }

    /// 拼接最终上传 URL：base_url + remote_path + filename
    fn file_url(&self, filename: &str) -> String {
        let base = self.url.trim_end_matches('/');
        let remote = self.remote_path.trim_matches('/');
        if remote.is_empty() {
            format!("{}/{}", base, filename)
        } else {
            format!("{}/{}/{}", base, remote, filename)
        }
    }

    fn dir_url(&self) -> String {
        let base = self.url.trim_end_matches('/');
        let remote = self.remote_path.trim_matches('/');
        if remote.is_empty() {
            base.to_string()
        } else {
            format!("{}/{}", base, remote)
        }
    }
}

/// WebDAV 上传错误。
#[derive(Debug)]
pub struct WebDAVError(pub String);

impl std::fmt::Display for WebDAVError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for WebDAVError {}

/// 测试 WebDAV 连接：对 remote_path 目录发 PROPFIND（深度 0）。
/// 返回 Ok 表示目录可达且凭据有效。
pub async fn test_connection(target: &WebDAVTarget) -> Result<(), WebDAVError> {
    let url = target.dir_url();

    let resp = target
        .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &url)
        .header("Depth", "0")
        .header("Content-Type", "application/xml; charset=utf-8")
        .body(
            r#"<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><displayname/></prop></propfind>"#,
        )
        .send()
        .await
        .map_err(|e| WebDAVError(format!("连接失败: {}", e)))?;

    let status = resp.status().as_u16();
    // 207 Multi-Status = 成功; 200 某些实现也返回
    if status == 207 || status == 200 {
        return Ok(());
    }
    if status == 401 || status == 403 {
        return Err(WebDAVError("认证失败：用户名或密码错误".to_string()));
    }
    if status == 404 {
        return Err(WebDAVError(format!(
            "目录不存在: {}（HTTP 404）",
            target.remote_path
        )));
    }
    let text = resp.text().await.unwrap_or_default();
    Err(WebDAVError(format!(
        "服务器返回异常状态: {} {}",
        status,
        text.chars().take(200).collect::<String>()
    )))
}

/// 上传本地文件到 WebDAV。
/// 自动创建目标目录（MKCOL），然后 PUT 文件。
/// 返回上传后的完整 URL。
pub async fn upload_file(target: &WebDAVTarget, local_path: &Path) -> Result<String, WebDAVError> {
    let filename = local_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| WebDAVError("无法解析文件名".to_string()))?;

    // 1. 确保目标目录存在（MKCOL，已存在不报错）
    let dir_url = target.dir_url();
    if !target.remote_path.trim_matches('/').is_empty() {
        let mkcol = target
            .request(reqwest::Method::from_bytes(b"MKCOL").unwrap(), &dir_url)
            .send()
            .await;
        if let Ok(resp) = mkcol {
            let s = resp.status().as_u16();
            // 201 created, 405 method not allowed (已存在), 301 ok — 都视为目录就绪
            if s != 201 && s != 405 && s != 301 && s != 200 {
                log::warn!(
                    "[webdav] MKCOL {} returned status {}, continuing with PUT",
                    dir_url,
                    s
                );
            }
        }
    }

    // 2. 读取文件内容
    let mut file = fs::File::open(local_path)
        .await
        .map_err(|e| WebDAVError(format!("无法读取本地文件: {}", e)))?;
    let metadata = file
        .metadata()
        .await
        .map_err(|e| WebDAVError(format!("无法获取文件信息: {}", e)))?;
    let file_size = metadata.len();
    let mut buffer = Vec::with_capacity(file_size as usize);
    file.read_to_end(&mut buffer)
        .await
        .map_err(|e| WebDAVError(format!("读取文件内容失败: {}", e)))?;
    drop(file);

    // 3. PUT 上传
    let file_url = target.file_url(filename);
    log::info!(
        "[webdav] uploading {} ({} bytes) -> {}",
        filename,
        file_size,
        file_url
    );

    let resp = target
        .request(reqwest::Method::PUT, &file_url)
        .header("Content-Type", "application/octet-stream")
        .header("Content-Length", file_size)
        .body(buffer)
        .send()
        .await
        .map_err(|e| WebDAVError(format!("上传请求失败: {}", e)))?;

    let status = resp.status().as_u16();
    // 200, 201, 204 = 成功
    if status == 200 || status == 201 || status == 204 {
        log::info!("[webdav] upload complete: {} -> {}", filename, file_url);
        return Ok(file_url);
    }

    if status == 401 || status == 403 {
        return Err(WebDAVError("认证失败：用户名或密码错误".to_string()));
    }
    let body = resp.text().await.unwrap_or_default();
    Err(WebDAVError(format!(
        "上传失败: HTTP {} {}",
        status,
        body.chars().take(300).collect::<String>()
    )))
}

/// 从数据库配置构建 WebDAVTarget。
/// 如果未配置或 url 为空返回 None。
pub fn target_from_config(config: &crate::WebDAVConfig) -> Option<WebDAVTarget> {
    if config.url.trim().is_empty() {
        return None;
    }
    Some(WebDAVTarget {
        url: config.url.clone(),
        username: config.username.clone(),
        password: config.password.clone(),
        remote_path: config.remote_path.clone(),
    })
}
