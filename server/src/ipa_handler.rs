use std::path::Path;
use tokio::fs::{self};
use tokio::io::{AsyncWriteExt, AsyncReadExt};
use reqwest;
use std::time::Duration;
use crate::apple_auth::{Store, AccountStore, AuthInfo};
use crate::signature::SignatureClient;
use serde_json::Value;

const CHUNK_SIZE: usize = 5 * 1024 * 1024;
const MAX_RETRIES: usize = 5;
const RETRY_DELAY: u64 = 3000;

#[derive(Debug, Clone)]
pub struct DownloadProgress {
    pub phase: String,
    pub message: String,
    pub progress: Option<f64>,
    pub file_size: Option<u64>,
    pub downloaded: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct DownloadResult {
    pub ok: bool,
    pub file: Option<String>,
    pub metadata: Option<DownloadMetadata>,
    pub error: Option<String>,
    pub needs_reauth: bool,
    pub needs_purchase: bool,
}

#[derive(Debug, Clone)]
pub struct DownloadParams<'a, S: AppleAuthService> {
    pub store: &'a S,
    pub email: &'a str,
    pub appid: &'a str,
    pub app_ver_id: Option<&'a str>,
    pub download_path: &'a str,
    pub auto_purchase: bool,
    pub token: Option<&'a str>,
}

impl<'a, S: AppleAuthService> DownloadParams<'a, S> {
    pub fn on_progress(&self, progress: DownloadProgress) {
        // 默认实现，什么都不做
        let _ = progress;
    }
}

#[derive(Debug, Clone)]
pub struct DownloadMetadata {
    pub bundle_display_name: String,
    pub bundle_short_version_string: String,
    pub bundle_id: String,
    pub artwork_url: String,
    pub artist_name: String,
}

fn get_value_from_map<'a>(map: &'a std::collections::HashMap<String, Value>, key: &str) -> Option<&'a Value> {
    map.get(key)
}

fn is_session_error(result: &std::collections::HashMap<String, Value>) -> bool {
    let error_msg = get_value_from_map(result, "failureType")
        .or(get_value_from_map(result, "customerMessage"))
        .or(get_value_from_map(result, "message"))
        .and_then(|v: &Value| v.as_str())
        .unwrap_or("")
        .to_lowercase();

    let session_error_patterns = [
        "session expired",
        "session invalid", 
        "invalid session",
        "unauthorized",
        "authentication failed",
        "token expired",
        "invalid token",
        "not authenticated",
    ];

    session_error_patterns.iter().any(|pattern| error_msg.contains(pattern))
}

pub fn get_license_error_message(result: &std::collections::HashMap<String, Value>) -> String {
    let customer_message = get_value_from_map(result, "customerMessage")
        .and_then(|v: &Value| v.as_str())
        .unwrap_or("");
    
    let failure_type = get_value_from_map(result, "failureType")
        .and_then(|v: &Value| v.as_str())
        .unwrap_or("");

    let error_msg = format!("{} {}", customer_message, failure_type).to_lowercase();

    let license_error_map = [
        ("license not found", "您尚未购买此应用，正在尝试免费获取..."),
        ("not found", "未找到此应用，请检查 App ID 是否正确"),
        ("not purchased", "您尚未购买此应用"),
        ("未购买", "您尚未购买此应用"),
        ("未找到", "未找到此应用"),
        ("unauthorized", "无权下载此应用"),
        ("invalid request", "无效的请求"),
        ("item not found", "未找到此应用"),
        ("store front mismatch", "账号区域与应用不匹配"),
        ("store front error", "账号区域错误，请切换账号区域"),
    ];

    for (key, message) in &license_error_map {
        if error_msg.contains(key) {
            return message.to_string();
        }
    }

    if !customer_message.is_ascii() {
        return customer_message.to_string();
    }

    customer_message.to_string()
}

async fn download_chunk(
    url: &str,
    start: u64,
    end: u64,
    output: &Path,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = reqwest::Client::new();
    
    for attempt in 0..MAX_RETRIES {
        let response = client
            .get(url)
            .header("Range", format!("bytes={}-{}", start, end))
            .send()
            .await?;

        if !response.status().is_success() {
            if attempt < MAX_RETRIES - 1 {
                tokio::time::sleep(Duration::from_millis(RETRY_DELAY * (attempt as u64 + 1))).await;
                continue;
            }
            return Err(format!("无法获取区块: {}", response.status()).into());
        }

        let mut file = fs::OpenOptions::new()
            .write(true)
            .create(true)
            .append(true)
            .open(output)
            .await?;

        let bytes = response.bytes().await?;
        file.write_all(&bytes).await?;

        return Ok(());
    }

    Err("下载重试次数耗尽".into())
}

async fn clear_cache(cache_dir: &Path) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if let Ok(mut entries) = fs::read_dir(cache_dir).await {
        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_file() {
                fs::remove_file(entry.path()).await?;
            }
        }
    }
    Ok(())
}

fn get_artwork_from_map(metadata: &serde_json::Map<String, Value>) -> String {
    let url_60 = metadata.get("artworkUrl60").and_then(|v| v.as_str());
    let url_512 = metadata.get("artworkUrl512").and_then(|v| v.as_str());
    let url_100 = metadata.get("artworkUrl100").and_then(|v| v.as_str());
    url_60.or(url_512).or(url_100).unwrap_or("").to_string()
}

fn get_state(app: &std::collections::HashMap<String, Value>) -> Option<&Value> {
    app.get("_state")
}

fn get_song_list(app: &std::collections::HashMap<String, Value>) -> Option<&Value> {
    app.get("songList")
}

pub async fn download_ipa_with_account<S: AppleAuthService>(
    params: DownloadParams<'_, S>,
) -> Result<DownloadResult, Box<dyn std::error::Error + Send + Sync>> {
    params.on_progress(DownloadProgress {
        phase: "auth".to_string(),
        message: "[auth] 查询下载信息".to_string(),
        progress: None,
        file_size: None,
        downloaded: None,
    });

    let auth_info = AuthInfo {
        ds_person_id: None,
        password_token: None,
        display_name: None,
        email: Some(params.email.to_string()),
    };
    
    let mut app = params.store.download_product(params.appid, params.app_ver_id, &auth_info).await?;

    let state = get_state(&app);
    if state != Some(&Value::String("success".to_string())) 
        && is_session_error(&app) 
    {
        params.on_progress(DownloadProgress {
            phase: "session".to_string(),
            message: "[session] 检测到会话失效，尝试刷新...".to_string(),
            progress: None,
            file_size: None,
            downloaded: None,
        });

        return Ok(DownloadResult {
            ok: false,
            file: None,
            metadata: None,
            error: Some("会话已失效，请重新登录".to_string()),
            needs_reauth: true,
            needs_purchase: false,
        });
    }

    let error_msg = get_value_from_map(&app, "failureType")
        .or(get_value_from_map(&app, "customerMessage"))
        .or(get_value_from_map(&app, "message"))
        .and_then(|v: &Value| v.as_str())
        .unwrap_or("")
        .to_lowercase();

    let is_license_error = error_msg.contains("license") 
        || error_msg.contains("not found") 
        || error_msg.contains("未购买")
        || error_msg.contains("未授权");

    let current_state = get_state(&app);
    if current_state != Some(&Value::String("success".to_string())) && is_license_error {
        if params.auto_purchase {
            params.on_progress(DownloadProgress {
                phase: "auth".to_string(),
                message: "[purchase] 正在购买应用...".to_string(),
                progress: None,
                file_size: None,
                downloaded: None,
            });

            let license_result = params.store.ensure_license(params.appid, params.app_ver_id, &auth_info).await?;
            
            if get_state(&license_result) != Some(&Value::String("success".to_string())) {
                let error_msg = get_license_error_message(&license_result);
                return Ok(DownloadResult {
                    ok: false,
                    file: None,
                    metadata: None,
                    error: Some(error_msg),
                    needs_reauth: false,
                    needs_purchase: true,
                });
            }

            params.on_progress(DownloadProgress {
                phase: "auth".to_string(),
                message: "[purchase] 购买成功，重新查询下载信息".to_string(),
                progress: None,
                file_size: None,
                downloaded: None,
            });

            app = params.store.download_product(params.appid, params.app_ver_id, &auth_info).await?;

            if get_state(&app) != Some(&Value::String("success".to_string())) {
                let error_msg = get_license_error_message(&app);
                return Ok(DownloadResult {
                    ok: false,
                    file: None,
                    metadata: None,
                    error: Some(error_msg),
                    needs_reauth: false,
                    needs_purchase: true,
                });
            }
        } else {
            let error_msg = get_license_error_message(&app);
            return Ok(DownloadResult {
                ok: false,
                file: None,
                metadata: None,
                error: Some(error_msg),
                needs_reauth: false,
                needs_purchase: true,
            });
        }
    }

    if get_state(&app) != Some(&Value::String("success".to_string())) {
        let error_msg = get_value_from_map(&app, "customerMessage")
            .and_then(|v: &Value| v.as_str())
            .unwrap_or("下载失败")
            .to_string();
        
        return Ok(DownloadResult {
            ok: false,
            file: None,
            metadata: None,
            error: Some(error_msg),
            needs_reauth: false,
            needs_purchase: false,
        });
    }

    let song_list_value = get_song_list(&app)
        .and_then(|v| v.as_array())
        .and_then(|v| v.first())
        .ok_or("Invalid song list")?;

    let song_list = song_list_value.as_object()
        .ok_or("Invalid song list format")?;

    let file_url = song_list.get("URL")
        .and_then(|v| v.as_str())
        .ok_or("Invalid file URL")?;

    let metadata = song_list.get("metadata")
        .and_then(|v| v.as_object())
        .ok_or("Invalid metadata")?;

    let download_dir = Path::new(params.download_path);
    fs::create_dir_all(download_dir).await?;

    let bundle_display_name = metadata.get("bundleDisplayName")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown");

    let bundle_short_version = metadata.get("bundleShortVersionString")
        .and_then(|v| v.as_str())
        .unwrap_or("1.0");

    let output_file_path = download_dir.join(format!("{}_{}.ipa", bundle_display_name, bundle_short_version));
    let cache_dir = download_dir.join("cache");
    fs::create_dir_all(&cache_dir).await?;
    clear_cache(&cache_dir).await?;

    let response = reqwest::Client::new()
        .get(file_url)
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(format!("无法获取文件: {}", response.status()).into());
    }

    let file_size = response.content_length()
        .unwrap_or(0);
    let num_chunks = (file_size as f64 / CHUNK_SIZE as f64).ceil() as usize;

    params.on_progress(DownloadProgress {
        phase: "download-start".to_string(),
        message: format!("[download] 开始：{:.2}MB，分块={}", file_size as f64 / 1024.0 / 1024.0, num_chunks),
        progress: Some(0.0),
        file_size: Some(file_size),
        downloaded: Some(0),
    });

    let mut downloaded: u64 = 0;
    let mut progress = vec![0u64; num_chunks];

    for i in 0..num_chunks {
        let start = (i * CHUNK_SIZE) as u64;
        let end = std::cmp::min(start + CHUNK_SIZE as u64 - 1, file_size - 1);
        let temp_output = cache_dir.join(format!("part{}", i));
        let url = file_url.to_string();

        download_chunk(&url, start, end, &temp_output).await?;

        progress[i] = std::cmp::min(CHUNK_SIZE as u64, file_size - (i * CHUNK_SIZE) as u64);
        downloaded = progress.iter().sum();
        
        let percent = ((downloaded as f64 / file_size as f64) * 100.0).min(100.0) as u32;

        params.on_progress(DownloadProgress {
            phase: "download-progress".to_string(),
            message: format!(
                "[download] 进度 {:.2}MB / {:.2}MB",
                downloaded as f64 / 1024.0 / 1024.0,
                file_size as f64 / 1024.0 / 1024.0
            ),
            progress: Some(percent as f64),
            file_size: Some(file_size),
            downloaded: Some(downloaded),
        });
    }

    params.on_progress(DownloadProgress {
        phase: "merge".to_string(),
        message: "[merge] 合并分块...".to_string(),
        progress: None,
        file_size: None,
        downloaded: None,
    });

    let mut final_file = fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(&output_file_path)
        .await?;

    for i in 0..num_chunks {
        let temp_output = cache_dir.join(format!("part{}", i));
        let mut temp_file = fs::File::open(&temp_output).await?;
        let mut buffer = Vec::new();
        temp_file.read_to_end(&mut buffer).await?;
        final_file.write_all(&buffer).await?;
        fs::remove_file(&temp_output).await?;
    }

    params.on_progress(DownloadProgress {
        phase: "sign".to_string(),
        message: "[sign] 写入签名...".to_string(),
        progress: None,
        file_size: None,
        downloaded: None,
    });

    let mut sig_client = SignatureClient::new(song_list_value, params.email)?;
    sig_client.load_file(&output_file_path.to_string_lossy())?;
    sig_client.append_metadata();
    sig_client.append_signature()?;
    sig_client.write()?;

    fs::remove_dir_all(&cache_dir).await?;

    let metadata_info = DownloadMetadata {
        bundle_display_name: bundle_display_name.to_string(),
        bundle_short_version_string: bundle_short_version.to_string(),
        bundle_id: metadata.get("bundleId")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        artwork_url: get_artwork_from_map(metadata),
        artist_name: metadata.get("artistName")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
    };

    params.on_progress(DownloadProgress {
        phase: "done".to_string(),
        message: format!("[done] 产物：{}", output_file_path.to_string_lossy()),
        progress: Some(100.0),
        file_size: Some(file_size),
        downloaded: Some(downloaded),
    });

    Ok(DownloadResult {
        ok: true,
        file: Some(output_file_path.to_string_lossy().into_owned()),
        metadata: Some(metadata_info),
        error: None,
        needs_reauth: false,
        needs_purchase: false,
    })
}

#[async_trait::async_trait]
pub trait AppleAuthService {
    async fn download_product(
        &self,
        app_identifier: &str,
        app_ver_id: Option<&str>,
        auth_info: &AuthInfo,
    ) -> Result<std::collections::HashMap<String, Value>, Box<dyn std::error::Error + Send + Sync>>;
    
    async fn ensure_license(
        &self,
        app_identifier: &str,
        app_ver_id: Option<&str>,
        auth_info: &AuthInfo,
    ) -> Result<std::collections::HashMap<String, Value>, Box<dyn std::error::Error + Send + Sync>>;
}

#[async_trait::async_trait]
impl AppleAuthService for Store {
    async fn download_product(
        &self,
        app_identifier: &str,
        app_ver_id: Option<&str>,
        auth_info: &AuthInfo,
    ) -> Result<std::collections::HashMap<String, Value>, Box<dyn std::error::Error + Send + Sync>> {
        Store::download_product(self, app_identifier, app_ver_id, auth_info).await
    }

    async fn ensure_license(
        &self,
        app_identifier: &str,
        app_ver_id: Option<&str>,
        auth_info: &AuthInfo,
    ) -> Result<std::collections::HashMap<String, Value>, Box<dyn std::error::Error + Send + Sync>> {
        Store::ensure_license(self, app_identifier, app_ver_id, auth_info).await
    }
}

#[async_trait::async_trait]
impl AppleAuthService for AccountStore {
    async fn download_product(
        &self,
        app_identifier: &str,
        app_ver_id: Option<&str>,
        _auth_info: &AuthInfo,
    ) -> Result<std::collections::HashMap<String, Value>, Box<dyn std::error::Error + Send + Sync>> {
        AccountStore::download_product(self, app_identifier, app_ver_id).await
    }

    async fn ensure_license(
        &self,
        app_identifier: &str,
        app_ver_id: Option<&str>,
        _auth_info: &AuthInfo,
    ) -> Result<std::collections::HashMap<String, Value>, Box<dyn std::error::Error + Send + Sync>> {
        AccountStore::ensure_license(self, app_identifier, app_ver_id).await
    }
}