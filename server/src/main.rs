use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use ipa_webtool_services::{Database, AccountStore};
use std::collections::HashMap;
use reqwest::Client;
use tokio::sync::RwLock;
use serde_json::Value;

#[derive(Serialize)]
struct ApiResponse<T> {
    ok: bool,
    data: Option<T>,
    error: Option<String>,
}

impl<T> ApiResponse<T> {
    fn success(data: T) -> Self {
        Self {
            ok: true,
            data: Some(data),
            error: None,
        }
    }

    fn error(error: String) -> Self {
        Self {
            ok: false,
            data: None,
            error: Some(error),
        }
    }
}

#[derive(Deserialize)]
struct VersionQuery {
    appid: String,
    region: Option<String>,
}

#[derive(Deserialize)]
#[allow(non_snake_case)]
#[allow(dead_code)]
struct DownloadUrlQuery {
    token: String,
    appid: String,
    appVerId: Option<String>,
    #[serde(default)]
    autoPurchase: bool,
}

#[derive(Deserialize)]
#[allow(dead_code)]
#[allow(non_snake_case)]
struct DownloadRequest {
    token: String,
    url: String,
    appid: Option<String>,
    appVerId: Option<String>,
    downloadPath: Option<String>,
    #[serde(default)]
    autoPurchase: bool,
}

#[derive(Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
    mfa: Option<String>,
}

// 应用状态
#[allow(dead_code)]
struct AppState {
    db: Mutex<Database>,
    accounts: RwLock<HashMap<String, AccountStore>>, // token -> AccountStore
}

// 模拟的账号存储（生产环境应该使用数据库）
lazy_static::lazy_static! {
    static ref ACCOUNTS: RwLock<HashMap<String, AccountStore>> = RwLock::new(HashMap::new());
}

// 健康检查
async fn health() -> impl Responder {
    HttpResponse::Ok().json(ApiResponse::<String>::success("OK".to_string()))
}

// 查询版本
async fn get_versions(
    query: web::Query<VersionQuery>,
) -> impl Responder {
    let appid = &query.appid;
    let region = query.region.as_deref().unwrap_or("US");
    
    let client = Client::new();
    
    // 尝试第一个 API
    let url1 = format!(
        "https://api.timbrd.com/apple/app-version/index.php?id={}&country={}",
        appid, region
    );
    
    let response1 = client.get(&url1).send().await;
    let versions = if let Ok(resp) = response1 {
        if let Ok(json) = resp.json::<serde_json::Value>().await {
            if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
                Some(data.clone())
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };
    
    let final_versions = if let Some(vers) = versions {
        vers
    } else {
        // 尝试第二个 API
        let url2 = format!(
            "https://apis.bilin.eu.org/history/{}?country={}",
            appid, region
        );
        
        let response2 = client.get(&url2).send().await;
        if let Ok(resp) = response2 {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
                    data.clone()
                } else {
                    vec![]
                }
            } else {
                vec![]
            }
        } else {
            vec![]
        }
    };
    
    let formatted_versions: Vec<serde_json::Value> = final_versions
        .iter()
        .map(|item| {
            serde_json::json!({
                "bundle_version": item.get("bundle_version")
                    .or(item.get("version"))
                    .and_then(|v| v.as_str())
                    .unwrap_or(""),
                "external_identifier": item.get("external_identifier")
                    .or(item.get("id"))
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0),
                "size": item.get("size")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0),
                "created_at": item.get("created_at")
                    .or(item.get("date"))
                    .and_then(|v| v.as_str())
                    .unwrap_or(""),
            })
        })
        .filter(|v| {
            v.get("bundle_version").and_then(|bv| bv.as_str()).map(|s| !s.is_empty()).unwrap_or(false)
                && v.get("external_identifier").and_then(|ei| ei.as_i64()).map(|id| id > 0).unwrap_or(false)
        })
        .collect();

    HttpResponse::Ok().json(ApiResponse::success(formatted_versions))
}

// 获取下载链接
async fn get_download_url(
    query: web::Query<DownloadUrlQuery>,
) -> impl Responder {
    let accounts = ACCOUNTS.read().await;
    let account_store = accounts.get(&query.token);
    
    if account_store.is_none() {
        return HttpResponse::Unauthorized().json(ApiResponse::<String>::error("无效的 token".to_string()));
    }
    
    let account_store = account_store.unwrap();
    
    // 调用 download_product
    match account_store.download_product(&query.appid, query.appVerId.as_deref()).await {
        Ok(result) => {
            let state = result.get("_state")
                .and_then(|v| v.as_str())
                .unwrap_or("failure");
            
            if state == "success" {
                // 提取下载链接
                if let Some(song_list) = result.get("songList").and_then(|sl| sl.as_array()) {
                    if let Some(first_song) = song_list.first() {
                        if let Some(url) = first_song.get("URL").and_then(|u| u.as_str()) {
                            // 提取元数据
                            let metadata = first_song.get("metadata").and_then(|m| m.as_object());
                            
                            return HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
                                "url": url,
                                "fileName": format!("{}_{}.ipa",
                                    metadata.and_then(|m| m.get("bundleDisplayName")).and_then(|v| v.as_str()).unwrap_or("app"),
                                    metadata.and_then(|m| m.get("bundleShortVersionString")).and_then(|v| v.as_str()).unwrap_or("1.0.0")
                                ),
                                "metadata": {
                                    "bundle_display_name": metadata.and_then(|m| m.get("bundleDisplayName")).and_then(|v| v.as_str()).unwrap_or(""),
                                    "bundle_short_version_string": metadata.and_then(|m| m.get("bundleShortVersionString")).and_then(|v| v.as_str()).unwrap_or(""),
                                    "bundle_id": metadata.and_then(|m| m.get("bundleId")).and_then(|v| v.as_str()).unwrap_or(""),
                                    "artwork_url": metadata.and_then(|m| m.get("artworkUrl")).and_then(|v| v.as_str()).unwrap_or(""),
                                    "artist_name": metadata.and_then(|m| m.get("artistName")).and_then(|v| v.as_str()).unwrap_or(""),
                                }
                            })));
                        }
                    }
                }
                
                HttpResponse::BadRequest().json(ApiResponse::<String>::error("无法获取下载链接".to_string()))
            } else {
                // 检查是否需要购买
                let error_msg = result.get("customerMessage")
                    .or(result.get("failureType"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("下载失败");
                
                let is_license_error = error_msg.to_lowercase().contains("license")
                    || error_msg.to_lowercase().contains("not found")
                    || error_msg.contains("未购买");
                
                if is_license_error {
                    HttpResponse::BadRequest().json(serde_json::json!({
                        "ok": false,
                        "needsPurchase": true,
                        "error": error_msg
                    }))
                } else {
                    HttpResponse::BadRequest().json(ApiResponse::<String>::error(error_msg.to_string()))
                }
            }
        }
        Err(e) => {
            HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!("获取下载链接失败: {}", e)))
        }
    }
}

// 下载 IPA
async fn download_ipa(
    req: web::Json<DownloadRequest>,
    data: web::Data<AppState>,
) -> impl Responder {
    
    
    
    // 验证 token
    let accounts = data.accounts.read().await;
    let _account_store = accounts.get(&req.token);
    
    if _account_store.is_none() {
        return HttpResponse::Unauthorized().json(ApiResponse::<String>::error("无效的 token".to_string()));
    }
    
    drop(accounts);
    
    // 创建下载目录
    let download_dir = "../downloads";
    if let Err(_) = tokio::fs::create_dir_all(download_dir).await {
        return HttpResponse::InternalServerError().json(ApiResponse::<String>::error("创建下载目录失败".to_string()));
    }
    
    // 获取下载 URL
    let url = &req.url;
    
    // 解析 URL 获取文件名
    let filename = url.split("/").last().unwrap_or("app.ipa");
    let filepath = format!("{}/{}", download_dir, filename);
    
    // 开始下载
    match download_file_with_progress(url, &filepath).await {
        Ok(metadata) => {
            HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
                "file": filepath,
                "metadata": metadata
            })))
        }
        Err(e) => {
            HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!("下载失败: {}", e)))
        }
    }
}

async fn download_file_with_progress(
    url: &str,
    filepath: &str,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    use reqwest::Client;
    use tokio::fs::File;
    use tokio::io::AsyncWriteExt;
    
    let client = Client::new();
    let response = client.get(url).send().await?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP 错误: {}", response.status()).into());
    }
    
    let total_size = response.content_length().unwrap_or(0);
    let bytes = response.bytes().await?;
    
    let mut file = File::create(filepath).await?;
    file.write_all(&bytes).await?;
    file.flush().await?;
    
    let downloaded = bytes.len() as u64;
    
    if total_size > 0 {
        let progress = (downloaded as f64 / total_size as f64) * 100.0;
        log::info!("下载完成: {:.1}% ({}/{})", progress, downloaded, total_size);
    }
    
    // 返回元数据
    Ok(serde_json::json!({
        "bundle_display_name": "Downloaded App",
        "bundle_short_version_string": "1.0.0",
        "bundle_id": "com.example.app",
        "artwork_url": "",
        "artist_name": "",
        "file_size": downloaded
    }))
}

// 搜索应用
async fn search_app(
    query: web::Query<std::collections::HashMap<String, String>>,
) -> impl Responder {
    use reqwest::Client;
    
    let term = match query.get("term") {
        Some(t) => t.as_str(),
        None => "",
    };
    let region = match query.get("region") {
        Some(r) => r.as_str(),
        None => "US",
    };
    let media = match query.get("media") {
        Some(m) => m.as_str(),
        None => "software",
    };
    let limit = match query.get("limit") {
        Some(l) => l.as_str(),
        None => "25",
    };
    
    if term.is_empty() {
        return HttpResponse::BadRequest().json(ApiResponse::<String>::error("搜索关键词不能为空".to_string()));
    }
    
    // 调用 Apple Search API
    let url = format!(
        "https://itunes.apple.com/search?term={}&country={}&media={}&limit={}",
        urlencoding::encode(term),
        region,
        media,
        limit
    );
    
    let client = Client::new();
    match client.get(&url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(json) => {
                        if let Some(results) = json.get("resultCount").and_then(|v| v.as_u64()) {
                            if results > 0 {
                                if let Some(apps) = json.get("results").and_then(|v| v.as_array()) {
                                    // 转换为我们的格式
                                    let formatted_apps: Vec<serde_json::Value> = apps
                                        .iter()
                                        .map(|app| {
                                            serde_json::json!({
                                                "trackId": app.get("trackId").and_then(|v| v.as_str()).unwrap_or(""),
                                                "trackName": app.get("trackName").and_then(|v| v.as_str()).unwrap_or(""),
                                                "bundleId": app.get("bundleId").and_then(|v| v.as_str()).unwrap_or(""),
                                                "artistName": app.get("artistName").and_then(|v| v.as_str()).unwrap_or(""),
                                                "artworkUrl100": app.get("artworkUrl100").and_then(|v| v.as_str()).unwrap_or(""),
                                                "version": app.get("version").and_then(|v| v.as_str()).unwrap_or(""),
                                                "averageUserRating": app.get("averageUserRating").and_then(|v| v.as_f64()).unwrap_or(0.0),
                                                "price": app.get("price").and_then(|v| v.as_f64()).unwrap_or(0.0),
                                                "genres": app.get("genres").and_then(|v| v.as_array()).cloned().unwrap_or(vec![]),
                                            })
                                        })
                                        .collect();
                                    
                                    return HttpResponse::Ok().json(ApiResponse::success(formatted_apps));
                                }
                            }
                        }
                        
                        // 没有找到结果
                        HttpResponse::Ok().json(ApiResponse::<Vec<Value>>::success(vec![]))
                    }
                    Err(e) => {
                        log::error!("解析搜索结果失败: {}", e);
                        HttpResponse::InternalServerError().json(ApiResponse::<String>::error("解析搜索结果失败".to_string()))
                    }
                }
            } else {
                log::error!("搜索 API 返回错误: {}", response.status());
                HttpResponse::InternalServerError().json(ApiResponse::<String>::error("搜索 API 返回错误".to_string()))
            }
        }
        Err(e) => {
            log::error!("搜索请求失败: {}", e);
            HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!("搜索请求失败: {}", e)))
        }
    }
}

// 登录
async fn login(
    req: web::Json<LoginRequest>,
) -> impl Responder {
    let mut account_store = AccountStore::new(&req.email);
    
    match account_store.authenticate(&req.password, req.mfa.as_deref()).await {
        Ok(result) => {
            let state = result.get("_state")
                .and_then(|v| v.as_str())
                .unwrap_or("failure");
            
            if state == "success" {
                // 生成 token
                let token = uuid::Uuid::new_v4().to_string();
                
                // 存储账号信息
                let mut accounts = ACCOUNTS.write().await;
                accounts.insert(token.clone(), account_store);
                
                // 返回成功响应
                HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
                    "token": token,
                    "email": req.email,
                    "displayName": result.get("displayName"),
                })))
            } else {
                // 返回失败响应
                let error_msg = result.get("customerMessage")
                    .or(result.get("failureType"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("登录失败");
                
                HttpResponse::BadRequest().json(ApiResponse::<String>::error(error_msg.to_string()))
            }
        }
        Err(e) => {
            HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!("登录失败: {}", e)))
        }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();

    // 初始化数据库
    let db_path = "../data/ipa-webtool.db";
    log::info!("Initializing database at: {}", db_path);
    let db = Database::new(db_path).unwrap_or_else(|e| {
        log::error!("Failed to initialize database: {}", e);
        panic!("Database initialization failed: {}", e);
    });

    let app_state = web::Data::new(AppState {
        db: Mutex::new(db),
        accounts: RwLock::new(HashMap::new()),
    });

    let bind_address = "0.0.0.0:8080";
    log::info!("Starting server at {}", bind_address);

    HttpServer::new(move || {
        App::new()
            .app_data(web::JsonConfig::default().limit(4096))
            .app_data(app_state.clone())
            .route("/health", web::get().to(health))
            .route("/login", web::post().to(login))
            .route("/versions", web::get().to(get_versions))
            .route("/download-url", web::get().to(get_download_url))
            .route("/download", web::post().to(download_ipa))
            .route("/search", web::get().to(search_app))
    })
    .bind(bind_address)?
    .run()
    .await
}
