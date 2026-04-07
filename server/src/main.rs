use actix_files as fs;
use actix_multipart::Multipart;
use actix_web::{
    body::{EitherBody, MessageBody},
    cookie::{time::Duration as CookieDuration, Cookie, SameSite},
    dev::{ServiceRequest, ServiceResponse},
    error::{ErrorInternalServerError, ErrorNotFound, ErrorUnauthorized},
    http::header::{ContentDisposition, DispositionParam, DispositionType},
    middleware::{from_fn, Next},
    web, App, Error, FromRequest, HttpRequest, HttpResponse, HttpServer, Responder,
};
use base64::Engine as _;
use bytes::Bytes;
use chrono::{Duration, Utc};
use futures_util::{
    future::{ready, Ready},
    stream, StreamExt, TryStreamExt,
};
use ipa_webtool_services::DownloadRecord;
use ipa_webtool_services::{
    canonical_ipa_filename, download_ipa_with_account, generate_plist, get_license_error_message,
    inspect_ipa_path, AccountStore, AdminUser, BatchItem, Database, DownloadManager,
    DownloadParams, InstallQuery, IpaInspection, JobEndEvent, JobEvent, JobLogEvent,
    JobProgressEvent, JobProgressPayload, JobState, JobStore, NewSubscription,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tokio::io::AsyncWriteExt;
use tokio::sync::RwLock;
use uuid::Uuid;

const ADMIN_SESSION_COOKIE: &str = "ipa_admin_session";
const SESSION_TTL_DAYS: i64 = 30;
const PENDING_MFA_TTL_MINUTES: i64 = 10;

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
#[allow(non_snake_case)]
struct PurchaseStatusQuery {
    token: String,
    appid: String,
    appVerId: Option<String>,
}

#[derive(Deserialize)]
#[allow(non_snake_case)]
struct ClaimRequest {
    token: String,
    appid: String,
    appVerId: Option<String>,
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
#[allow(non_snake_case)]
struct StartDownloadDirectRequest {
    token: String,
    appid: String,
    appVerId: Option<String>,
    appName: Option<String>,
    bundleId: Option<String>,
    appVersion: Option<String>,
    artworkUrl: Option<String>,
    artistName: Option<String>,
    #[serde(default)]
    autoPurchase: bool,
}

#[derive(Deserialize)]
struct AppMetaQuery {
    appid: String,
    region: Option<String>,
}

#[derive(Deserialize)]
#[allow(non_snake_case)]
struct JobIdQuery {
    jobId: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppleLoginRequest {
    email: String,
    password: String,
    mfa: Option<String>,
    save_credentials: Option<bool>,
}

#[derive(Deserialize)]
struct AdminLoginRequest {
    username: String,
    password: String,
}

#[derive(Deserialize)]
struct ChangePasswordRequest {
    current_password: String,
    new_password: String,
    new_username: Option<String>,
}

#[derive(Serialize, Clone)]
struct AuthUserPayload {
    username: String,
    is_default: bool,
}

impl From<&AdminUser> for AuthUserPayload {
    fn from(user: &AdminUser) -> Self {
        Self {
            username: user.username.clone(),
            is_default: user.is_default,
        }
    }
}

#[derive(Debug, Clone)]
struct AuthenticatedAdmin {
    username: String,
    is_default: bool,
    #[allow(dead_code)]
    session_token: String,
}

#[derive(Deserialize, Default)]
#[allow(non_snake_case)]
struct ManifestQuery {
    url: Option<String>,
    bundle_id: Option<String>,
    bundle_version: Option<String>,
    title: Option<String>,
    jobId: Option<String>,
}

// 应用状态
struct AppState {
    db: Arc<Mutex<Database>>,
    download_manager: Arc<DownloadManager>,
    job_store: JobStore,
    downloads_dir: PathBuf,
}

#[derive(Debug, Clone)]
struct DownloadArtifact {
    id: String,
    path: PathBuf,
    file_name: String,
    file_size: u64,
    modified_at: Option<chrono::DateTime<Utc>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadRecordView {
    id: Option<i64>,
    job_id: Option<String>,
    app_name: String,
    app_id: String,
    bundle_id: Option<String>,
    version: Option<String>,
    account_email: String,
    account_region: Option<String>,
    download_date: Option<String>,
    status: String,
    file_size: Option<i64>,
    file_path: Option<String>,
    download_url: Option<String>,
    install_url: Option<String>,
    artwork_url: Option<String>,
    artist_name: Option<String>,
    progress: Option<i64>,
    error: Option<String>,
    package_kind: String,
    ota_installable: bool,
    install_method: String,
    created_at: Option<String>,
    file_exists: bool,
    inspection: Option<IpaInspection>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct IpaArtifactView {
    id: String,
    file_name: String,
    file_size: u64,
    file_path: String,
    modified_at: Option<String>,
    app_name: String,
    app_id: String,
    bundle_id: Option<String>,
    version: Option<String>,
    account_email: Option<String>,
    account_region: Option<String>,
    artwork_url: Option<String>,
    artist_name: Option<String>,
    record_id: Option<i64>,
    download_url: String,
    install_url: Option<String>,
    package_kind: String,
    ota_installable: bool,
    install_method: String,
    inspection: Option<IpaInspection>,
}

#[derive(Clone)]
struct PendingMfaSession {
    account_store: AccountStore,
    password_hash: String,
    created_at: chrono::DateTime<Utc>,
}

// 模拟的账号存储（生产环境应该使用数据库）
lazy_static::lazy_static! {
    static ref ACCOUNTS: RwLock<HashMap<String, AccountStore>> = RwLock::new(HashMap::new());
    // MFA 第一轮失败后暂存 AccountStore（保留 GUID），等待用户提交验证码后复用
    static ref PENDING_MFA: RwLock<HashMap<String, PendingMfaSession>> = RwLock::new(HashMap::new());
}

fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hex::encode(hasher.finalize())
}

fn normalize_mfa_code(mfa: Option<&str>) -> Option<String> {
    mfa.map(|code| code.trim().replace(' ', ""))
        .filter(|code| !code.is_empty())
}

fn normalize_region_code(region: &str) -> Option<String> {
    let normalized = region.trim().to_uppercase();
    if normalized.len() >= 2 && normalized.len() <= 3 {
        Some(normalized)
    } else {
        None
    }
}

fn resolved_account_region(result: &HashMap<String, Value>, fallback: Option<String>) -> String {
    result
        .get("region")
        .and_then(|value| value.as_str())
        .and_then(normalize_region_code)
        .or_else(|| fallback.and_then(|value| normalize_region_code(&value)))
        .unwrap_or_else(|| "US".to_string())
}

fn is_pending_mfa_expired(created_at: chrono::DateTime<Utc>) -> bool {
    Utc::now().signed_duration_since(created_at) > Duration::minutes(PENDING_MFA_TTL_MINUTES)
}

async fn save_pending_mfa(email: &str, password: &str, account_store: AccountStore) {
    let mut pending = PENDING_MFA.write().await;
    pending.insert(
        email.to_string(),
        PendingMfaSession {
            account_store,
            password_hash: hash_password(password),
            created_at: Utc::now(),
        },
    );
}

async fn clear_pending_mfa(email: &str) {
    let mut pending = PENDING_MFA.write().await;
    pending.remove(email);
}

async fn take_pending_mfa(email: &str, password: &str) -> Result<AccountStore, String> {
    let pending_session = {
        let mut pending = PENDING_MFA.write().await;
        pending.remove(email)
    };

    let pending_session = pending_session.ok_or_else(|| {
        "验证码会话不存在或已丢失，请重新输入账号密码并再次登录以获取新的验证码".to_string()
    })?;

    if is_pending_mfa_expired(pending_session.created_at) {
        return Err(format!(
            "验证码会话已超过 {} 分钟，请重新登录以获取新的验证码",
            PENDING_MFA_TTL_MINUTES
        ));
    }

    if pending_session.password_hash != hash_password(password) {
        return Err("登录密码已变更，请重新输入账号密码并再次登录以重新发起验证".to_string());
    }

    Ok(pending_session.account_store)
}

fn apple_auth_failure_details(
    result: &serde_json::Map<String, Value>,
    has_mfa: bool,
) -> (String, String, bool) {
    let failure_type = result
        .get("failureType")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    let customer_message = result
        .get("customerMessage")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    let normalized_message = customer_message.to_lowercase();
    let bad_login_without_mfa = !has_mfa
        && failure_type.is_empty()
        && matches!(
            customer_message.as_str(),
            "MZFinance.BadLogin.Configurator_message" | "MZFinance.BadLogin.Configurator.message"
        );

    let explicit_mfa_message = normalized_message.contains("verification code")
        || normalized_message.contains("two-factor")
        || normalized_message.contains("two step")
        || normalized_message.contains("two-step")
        || normalized_message.contains("2fa")
        || normalized_message.contains("mfa");

    let explicit_mfa_failure = failure_type.contains("verificationCode")
        || failure_type.contains("authCode")
        || failure_type == "-22938"
        || failure_type == "-20101";

    let needs_mfa = bad_login_without_mfa || explicit_mfa_message || explicit_mfa_failure;

    let user_facing_msg = if bad_login_without_mfa {
        "此账号需要二次验证，请在验证码输入框输入 6 位验证码后再次点击登录".to_string()
    } else if explicit_mfa_message || explicit_mfa_failure {
        if has_mfa {
            "验证码无效、已过期，或当前验证会话已失效，请检查后重试".to_string()
        } else {
            customer_message.clone()
        }
    } else {
        match customer_message.as_str() {
            "MZFinance.BadLogin.Configurator_message"
            | "MZFinance.BadLogin.Configurator.message" => {
                "账号或密码错误，请检查后重试".to_string()
            }
            m if m.starts_with("MZFinance.BadLogin") => "账号或密码错误，请检查后重试".to_string(),
            m if m.contains("account.locked") || m.contains("account disabled") => {
                "账号已被锁定或停用".to_string()
            }
            m if m.contains("rate.limit") || m.contains("too many") => {
                "登录尝试过于频繁，请稍后再试".to_string()
            }
            _ if !customer_message.is_empty() => customer_message.clone(),
            _ if !failure_type.is_empty() => failure_type.clone(),
            _ => "登录失败，Apple 未返回具体错误信息".to_string(),
        }
    };

    (failure_type, user_facing_msg, needs_mfa)
}

fn session_expires_at() -> String {
    (Utc::now() + Duration::days(SESSION_TTL_DAYS))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string()
}

fn build_session_cookie(token: &str) -> Cookie<'static> {
    Cookie::build(ADMIN_SESSION_COOKIE, token.to_string())
        .path("/")
        .http_only(true)
        .same_site(SameSite::Lax)
        .max_age(CookieDuration::days(SESSION_TTL_DAYS))
        .finish()
}

fn clear_session_cookie() -> Cookie<'static> {
    let mut cookie = Cookie::build(ADMIN_SESSION_COOKIE, "")
        .path("/")
        .http_only(true)
        .same_site(SameSite::Lax)
        .finish();
    cookie.make_removal();
    cookie
}

fn unauthorized_response() -> HttpResponse {
    HttpResponse::Unauthorized().json(ApiResponse::<String>::error(
        "未登录或登录已过期".to_string(),
    ))
}

fn resolve_admin_session(app_state: &AppState, token: &str) -> Result<AuthenticatedAdmin, String> {
    log::debug!("[auth:resolve] token={}..", &token[..8.min(token.len())]);

    let db = app_state.db.lock().map_err(|e| {
        log::error!("[auth:resolve] db lock failed: {:?}", e);
        "认证服务暂时不可用".to_string()
    })?;

    let session = db
        .get_session(token)
        .map_err(|e| {
            log::error!("[auth:resolve] get_session failed: {}", e);
            format!("查询登录态失败: {}", e)
        })?
        .ok_or_else(|| {
            log::debug!(
                "[auth:resolve] no valid session for token={}..",
                &token[..8.min(token.len())]
            );
            "未登录或登录已过期".to_string()
        })?;

    let user = db
        .get_admin_user(&session.username)
        .map_err(|e| {
            log::error!(
                "[auth:resolve] get_admin_user failed for {}: {}",
                session.username,
                e
            );
            format!("查询管理员失败: {}", e)
        })?
        .ok_or_else(|| {
            let _ = db.delete_session(token);
            log::warn!(
                "[auth:resolve] admin user not found: {}, session deleted",
                session.username
            );
            "管理员账号不存在".to_string()
        })?;

    log::debug!("[auth:resolve] ok user={}", user.username);

    Ok(AuthenticatedAdmin {
        username: user.username,
        is_default: user.is_default,
        session_token: session.token,
    })
}

impl FromRequest for AuthenticatedAdmin {
    type Error = Error;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _: &mut actix_web::dev::Payload) -> Self::Future {
        let app_state = match req.app_data::<web::Data<AppState>>() {
            Some(data) => data.clone(),
            None => return ready(Err(ErrorUnauthorized("认证服务未初始化"))),
        };

        let session_cookie = match req.cookie(ADMIN_SESSION_COOKIE) {
            Some(cookie) => cookie,
            None => return ready(Err(ErrorUnauthorized("未登录或登录已过期"))),
        };

        ready(
            resolve_admin_session(app_state.get_ref(), session_cookie.value())
                .map_err(ErrorUnauthorized),
        )
    }
}

async fn require_auth<B>(
    req: ServiceRequest,
    next: Next<B>,
) -> Result<ServiceResponse<EitherBody<B>>, Error>
where
    B: MessageBody + 'static,
{
    let app_state = match req.app_data::<web::Data<AppState>>() {
        Some(data) => data.clone(),
        None => {
            return Ok(req
                .into_response(unauthorized_response())
                .map_into_right_body())
        }
    };

    let Some(session_cookie) = req.cookie(ADMIN_SESSION_COOKIE) else {
        return Ok(req
            .into_response(unauthorized_response())
            .map_into_right_body());
    };

    if let Err(error_message) = resolve_admin_session(app_state.get_ref(), session_cookie.value()) {
        log::warn!("[auth:middleware] session rejected: {}", error_message);
        return Ok(req
            .into_response(
                HttpResponse::Unauthorized().json(ApiResponse::<String>::error(error_message)),
            )
            .map_into_right_body());
    }

    Ok(next.call(req).await?.map_into_left_body())
}

// 健康检查
async fn health() -> impl Responder {
    HttpResponse::Ok().json(ApiResponse::<String>::success("OK".to_string()))
}

// 查询版本
async fn get_versions(query: web::Query<VersionQuery>) -> impl Responder {
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
            // Handle both {data: [...]} and direct [...] formats
            if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
                Some(data.clone())
            } else if json.is_array() {
                Some(json.as_array().cloned().unwrap_or_default())
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
            v.get("bundle_version")
                .and_then(|bv| bv.as_str())
                .map(|s| !s.is_empty())
                .unwrap_or(false)
                && v.get("external_identifier")
                    .and_then(|ei| ei.as_i64())
                    .map(|id| id > 0)
                    .unwrap_or(false)
        })
        .collect();

    HttpResponse::Ok().json(ApiResponse::success(formatted_versions))
}

fn build_base_url(req: &HttpRequest) -> String {
    if let Ok(public_base_url) = std::env::var("IPA_TOOL_PUBLIC_BASE_URL") {
        let trimmed = public_base_url.trim().trim_end_matches('/');
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    let info = req.connection_info();
    format!("{}://{}", info.scheme(), info.host())
}

fn resolve_project_root() -> PathBuf {
    if let Ok(root) = std::env::var("IPA_TOOL_ROOT") {
        return PathBuf::from(root);
    }

    let mut candidates = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.clone());
        if let Some(parent) = cwd.parent() {
            candidates.push(parent.to_path_buf());
            if let Some(grand_parent) = parent.parent() {
                candidates.push(grand_parent.to_path_buf());
            }
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            candidates.push(parent.to_path_buf());
            if let Some(grand_parent) = parent.parent() {
                candidates.push(grand_parent.to_path_buf());
                if let Some(great_grand_parent) = grand_parent.parent() {
                    candidates.push(great_grand_parent.to_path_buf());
                }
            }
        }
    }

    for candidate in candidates {
        if candidate.join("server/Cargo.toml").exists() && candidate.join("src").exists() {
            return candidate;
        }
        if candidate.file_name().and_then(|name| name.to_str()) == Some("server")
            && candidate.join("Cargo.toml").exists()
        {
            if let Some(parent) = candidate.parent() {
                return parent.to_path_buf();
            }
        }
    }

    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn artifact_id_from_path(path: &Path, downloads_dir: &Path) -> Option<String> {
    let relative = path.strip_prefix(downloads_dir).ok()?;
    Some(
        base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(relative.to_string_lossy().as_bytes()),
    )
}

fn resolve_artifact_path(downloads_dir: &Path, artifact_id: &str) -> Option<PathBuf> {
    let canonical_root = downloads_dir.canonicalize().ok()?;

    let try_relative = |relative: &str| -> Option<PathBuf> {
        let candidate = downloads_dir.join(relative);
        let canonical = candidate.canonicalize().ok()?;
        if canonical.starts_with(&canonical_root) {
            Some(canonical)
        } else {
            None
        }
    };

    if let Ok(decoded) = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(artifact_id) {
        if let Ok(relative) = String::from_utf8(decoded) {
            if let Some(path) = try_relative(&relative) {
                return Some(path);
            }
        }
    }

    // 兼容历史 artifact id：旧实现把 `/` 和 `\\` 都替换成 `__`，
    // 当文件名本身包含 `__` 时不可逆，因此这里通过重扫文件系统按旧规则比对，
    // 而不是继续使用 `replace("__", "/")` 这种有歧义的反解方式。
    scan_download_artifacts(downloads_dir)
        .into_iter()
        .find(|artifact| {
            artifact
                .path
                .strip_prefix(downloads_dir)
                .ok()
                .map(|relative| relative.to_string_lossy().replace(['\\', '/'], "__"))
                .as_deref()
                == Some(artifact_id)
        })
        .map(|artifact| artifact.path)
}

fn build_record_download_url(req: &HttpRequest, record_id: i64) -> String {
    format!(
        "{}/api/public/download-records/{}/file",
        build_base_url(req),
        record_id
    )
}

fn inspection_blocks_install(inspection: &IpaInspection) -> bool {
    !inspection.direct_install_ok
}

#[derive(Debug, Clone)]
struct DeliveryDecision {
    package_kind: String,
    ota_installable: bool,
    install_method: String,
}

fn derive_delivery_decision(
    inspection: Option<&IpaInspection>,
    file_exists: bool,
) -> DeliveryDecision {
    match inspection {
        Some(inspection)
            if inspection.direct_install_ok && inspection.has_embedded_mobileprovision =>
        {
            // Developer-signed / sideloaded IPA with provisioning profile
            DeliveryDecision {
                package_kind: "ota_sideloadable".to_string(),
                ota_installable: true,
                install_method: "ota".to_string(),
            }
        }
        Some(inspection) if inspection.direct_install_ok && inspection.has_sc_info_manifest => {
            // App Store IPA with all declared sinfs properly injected.
            // FairPlay encrypted binaries are expected and handled by iOS at runtime.
            // This matches ipatool.js and ApplePackage (Asspp) behavior.
            DeliveryDecision {
                package_kind: "appstore_sinf_package".to_string(),
                ota_installable: true,
                install_method: "ota".to_string(),
            }
        }
        Some(inspection)
            if inspection.has_sc_info_manifest && !inspection.missing_sinf_paths.is_empty() =>
        {
            // App Store IPA but sinf injection incomplete — cannot install
            DeliveryDecision {
                package_kind: "appstore_incomplete_sinf".to_string(),
                ota_installable: false,
                install_method: if file_exists {
                    "download_only"
                } else {
                    "manual_review"
                }
                .to_string(),
            }
        }
        Some(inspection) if !inspection.encrypted_binaries.is_empty() => {
            // Encrypted binaries with no sinfs and no provisioning profile
            DeliveryDecision {
                package_kind: "fairplay_encrypted".to_string(),
                ota_installable: false,
                install_method: if file_exists {
                    "download_only"
                } else {
                    "manual_review"
                }
                .to_string(),
            }
        }
        Some(_) => DeliveryDecision {
            package_kind: "broken_or_unknown".to_string(),
            ota_installable: false,
            install_method: if file_exists {
                "download_only"
            } else {
                "manual_review"
            }
            .to_string(),
        },
        None => DeliveryDecision {
            package_kind: if file_exists {
                "unknown".to_string()
            } else {
                "missing_file".to_string()
            },
            ota_installable: false,
            install_method: if file_exists { "manual_review" } else { "none" }.to_string(),
        },
    }
}

fn persisted_inspection(record: &DownloadRecord) -> Option<IpaInspection> {
    record
        .inspection_json
        .as_ref()
        .and_then(|raw| serde_json::from_str::<IpaInspection>(raw).ok())
}

fn inspection_for_record(record: &DownloadRecord) -> Option<IpaInspection> {
    // 优先读 DB 持久化结果，避免每次请求都重新 inspect ZIP
    if let Some(cached) = persisted_inspection(record) {
        return Some(cached);
    }
    // DB 没有，才做文件 inspect（用于 backfill）
    record
        .file_path
        .as_ref()
        .map(PathBuf::from)
        .filter(|path| path.exists())
        .as_deref()
        .and_then(inspect_existing_ipa)
}

fn sync_record_delivery(
    db: &Database,
    record: &DownloadRecord,
    inspection: Option<&IpaInspection>,
    file_exists: bool,
) {
    let Some(record_id) = record.id else {
        return;
    };

    let decision = derive_delivery_decision(inspection, file_exists);
    let inspection_json = inspection.and_then(|value| serde_json::to_string(value).ok());

    let stored_matches = record.package_kind.as_deref() == Some(decision.package_kind.as_str())
        && record.ota_installable == Some(decision.ota_installable)
        && record.install_method.as_deref() == Some(decision.install_method.as_str())
        && match (&record.inspection_json, &inspection_json) {
            (Some(left), Some(right)) => left == right,
            (None, None) => true,
            _ => false,
        };

    if !stored_matches {
        let _ = db.update_download_record_delivery(
            record_id,
            Some(decision.package_kind.as_str()),
            Some(decision.ota_installable),
            Some(decision.install_method.as_str()),
            inspection_json.as_deref(),
        );
    }
}

fn extract_record_id_from_download_url(download_url: &str) -> Option<i64> {
    let marker = "/api/public/download-records/";
    let rest = download_url.split(marker).nth(1)?;
    let record_id = rest.split('/').next()?;
    record_id.parse().ok()
}

fn build_record_install_url(
    req: &HttpRequest,
    record: &DownloadRecord,
    record_id: i64,
) -> Option<String> {
    let inspection = inspection_for_record(record);
    let file_exists = record
        .file_path
        .as_ref()
        .map(PathBuf::from)
        .map(|path| path.exists())
        .unwrap_or(false);
    let decision = derive_delivery_decision(inspection.as_ref(), file_exists);
    if !decision.ota_installable {
        return None;
    }

    let download_url = build_record_download_url(req, record_id);
    let bundle_id = record.bundle_id.clone()?;
    let bundle_version = record.version.clone().filter(|value| !value.is_empty())?;
    let title = if record.app_name.is_empty() {
        record
            .file_path
            .as_ref()?
            .rsplit('/')
            .next()?
            .trim_end_matches(".ipa")
            .to_string()
    } else {
        record.app_name.clone()
    };

    // 仿 OpenList：对外暴露 /i/{token}.plist，但额外带上 bundle_version 以保留真实版本信息。
    let name_full = format!("{}@{}", title, bundle_id);
    let link_encode = urlencoding::encode(&download_url);
    let name_encode = urlencoding::encode(&name_full);
    let version_encode = urlencoding::encode(&bundle_version);
    let raw = format!("{}/{}/{}", link_encode, name_encode, version_encode);
    let token = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(raw.as_bytes());

    let manifest_url = format!("{}/i/{}.plist", build_base_url(req), token);

    Some(format!(
        "itms-services://?action=download-manifest&url={}",
        urlencoding::encode(&manifest_url)
    ))
}

fn scan_download_artifacts(downloads_dir: &Path) -> Vec<DownloadArtifact> {
    fn visit(dir: &Path, root: &Path, artifacts: &mut Vec<DownloadArtifact>) {
        let entries = match std::fs::read_dir(dir) {
            Ok(entries) => entries,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                visit(&path, root, artifacts);
                continue;
            }

            if path.extension().and_then(|ext| ext.to_str()) != Some("ipa") {
                continue;
            }

            let meta = match entry.metadata() {
                Ok(meta) => meta,
                Err(_) => continue,
            };
            let id = match artifact_id_from_path(&path, root) {
                Some(id) => id,
                None => continue,
            };
            let modified_at = meta.modified().ok().map(chrono::DateTime::<Utc>::from);
            let file_name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("download.ipa")
                .to_string();

            artifacts.push(DownloadArtifact {
                id,
                path,
                file_name,
                file_size: meta.len(),
                modified_at,
            });
        }
    }

    let mut artifacts = Vec::new();
    if downloads_dir.exists() {
        visit(downloads_dir, downloads_dir, &mut artifacts);
        artifacts.sort_by(|left, right| right.modified_at.cmp(&left.modified_at));
    }
    artifacts
}

fn inspect_existing_ipa(path: &Path) -> Option<IpaInspection> {
    match inspect_ipa_path(path) {
        Ok(inspection) => Some(inspection),
        Err(error) => {
            log::warn!("failed to inspect ipa {}: {}", path.display(), error);
            None
        }
    }
}

fn normalize_download_record_artifact_paths(db: &Database, downloads_dir: &Path) {
    let records = db.get_all_download_records().unwrap_or_default();
    let canonical_root = match downloads_dir.canonicalize() {
        Ok(path) => path,
        Err(_) => return,
    };

    for mut record in records {
        let Some(record_id) = record.id else {
            continue;
        };
        let Some(bundle_id) = record
            .bundle_id
            .clone()
            .filter(|value| !value.trim().is_empty())
        else {
            continue;
        };
        let Some(version) = record
            .version
            .clone()
            .filter(|value| !value.trim().is_empty())
        else {
            continue;
        };
        let Some(file_path) = record.file_path.clone() else {
            continue;
        };

        let current_path = PathBuf::from(&file_path);
        if !current_path.exists() {
            continue;
        }
        let Ok(canonical_current) = current_path.canonicalize() else {
            continue;
        };
        if !canonical_current.starts_with(&canonical_root) {
            continue;
        }

        let current_name = canonical_current
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_string();
        let expected_name = canonical_ipa_filename(&record.app_name, &version, Some(&bundle_id));

        if current_name == expected_name {
            continue;
        }

        let Some(parent_dir) = canonical_current.parent() else {
            continue;
        };
        let target_path = parent_dir.join(&expected_name);
        let final_path = if target_path.exists() {
            target_path
        } else {
            if let Err(error) = std::fs::rename(&canonical_current, &target_path) {
                log::warn!(
                    "failed to rename legacy ipa artifact {} -> {}: {}",
                    canonical_current.display(),
                    target_path.display(),
                    error
                );
                continue;
            }
            target_path
        };

        record.file_path = Some(final_path.to_string_lossy().to_string());
        if let Some(size) = std::fs::metadata(&final_path)
            .ok()
            .map(|meta| meta.len() as i64)
        {
            record.file_size = Some(size);
        }
        let _ = db.update_download_record(record_id, &record);
    }
}

fn sync_download_records_from_filesystem(db: &Database, downloads_dir: &Path) {
    let existing_records = db.get_all_download_records().unwrap_or_default();
    let mut known_paths: HashMap<String, DownloadRecord> = HashMap::new();
    for record in existing_records {
        if let Some(path) = record.file_path.clone() {
            known_paths.insert(path, record);
        }
    }

    for artifact in scan_download_artifacts(downloads_dir) {
        let absolute_path = artifact.path.to_string_lossy().to_string();
        if known_paths.contains_key(&absolute_path) {
            continue;
        }

        let app_name = artifact.file_name.trim_end_matches(".ipa").to_string();
        let inferred = DownloadRecord {
            id: None,
            job_id: None,
            app_name,
            app_id: "unknown".to_string(),
            bundle_id: None,
            version: None,
            account_email: "未知账号".to_string(),
            account_region: None,
            download_date: artifact.modified_at.map(|dt| dt.to_rfc3339()),
            status: "completed".to_string(),
            file_size: Some(artifact.file_size as i64),
            file_path: Some(absolute_path),
            install_url: None,
            artwork_url: None,
            artist_name: None,
            progress: Some(100),
            error: None,
            package_kind: None,
            ota_installable: None,
            install_method: None,
            inspection_json: None,
            created_at: None,
        };
        let _ = db.add_download_record(&inferred);
    }
}

fn build_job_manifest_url(req: &HttpRequest, job_id: &str) -> String {
    format!(
        "{}/api/public/manifest?jobId={}",
        build_base_url(req),
        urlencoding::encode(job_id)
    )
}

fn build_job_install_url(req: &HttpRequest, job_id: &str) -> String {
    let manifest_url = build_job_manifest_url(req, job_id);
    format!(
        "itms-services://?action=download-manifest&url={}",
        urlencoding::encode(&manifest_url)
    )
}

fn encode_sse<T: Serialize>(event_name: &str, payload: &T) -> Result<Bytes, Error> {
    let payload = serde_json::to_string(payload).map_err(ErrorInternalServerError)?;
    Ok(Bytes::from(format!(
        "event: {}\ndata: {}\n\n",
        event_name, payload
    )))
}

fn encode_job_event(event: JobEvent) -> Result<Bytes, Error> {
    match event {
        JobEvent::Progress(payload) => encode_sse("progress", &payload),
        JobEvent::Log(payload) => encode_sse("log", &payload),
        JobEvent::End(payload) => encode_sse("end", &payload),
    }
}

fn snapshot_progress_event(snapshot: &JobState) -> JobProgressEvent {
    JobProgressEvent {
        status: Some(snapshot.status.clone()),
        progress: Some(JobProgressPayload {
            stage: snapshot.stage.clone(),
            percent: snapshot.progress,
            downloaded: None,
            total: None,
            message: None,
        }),
        error: snapshot.error.clone(),
    }
}

async fn start_download_direct(body: web::Bytes, data: web::Data<AppState>) -> impl Responder {
    let req: StartDownloadDirectRequest = match serde_json::from_slice(&body) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[start-download-direct] JSON parse error: {}", e);
            eprintln!(
                "[start-download-direct] raw body: {}",
                String::from_utf8_lossy(&body)
            );
            return HttpResponse::BadRequest()
                .json(ApiResponse::<String>::error(format!("请求解析失败: {}", e)));
        }
    };
    let accounts = ACCOUNTS.read().await;
    eprintln!(
        "[start-download-direct] token={}… appid={} appVerId={:?} autoPurchase={} active_accounts={}",
        req.token.chars().take(8).collect::<String>(),
        req.appid,
        req.appVerId,
        req.autoPurchase,
        accounts.len()
    );
    let account_store = match accounts.get(&req.token) {
        Some(account) => account.clone(),
        None => {
            eprintln!(
                "[start-download-direct] token miss: {}…",
                req.token.chars().take(8).collect::<String>()
            );
            return HttpResponse::Unauthorized()
                .json(ApiResponse::<String>::error("无效的 token".to_string()));
        }
    };
    drop(accounts);

    if !req.autoPurchase {
        match account_store
            .download_product(&req.appid, req.appVerId.as_deref())
            .await
        {
            Ok(result) => {
                let state = result
                    .get("_state")
                    .and_then(|value| value.as_str())
                    .unwrap_or("failure");

                if state != "success" {
                    let error_message = result
                        .get("customerMessage")
                        .or(result.get("failureType"))
                        .or(result.get("message"))
                        .and_then(|value| value.as_str())
                        .unwrap_or("下载失败")
                        .to_string();

                    let is_license_error = error_message.to_lowercase().contains("license")
                        || error_message.to_lowercase().contains("not found")
                        || error_message.contains("未购买")
                        || error_message.contains("未找到");

                    if is_license_error {
                        return HttpResponse::BadRequest().json(serde_json::json!({
                            "ok": false,
                            "needsPurchase": true,
                            "error": get_license_error_message(&result),
                        }));
                    }

                    return HttpResponse::BadRequest()
                        .json(ApiResponse::<String>::error(error_message));
                }
            }
            Err(error) => {
                return HttpResponse::InternalServerError().json(ApiResponse::<String>::error(
                    format!("创建任务失败: {}", error),
                ))
            }
        }
    }

    let job_id = Uuid::new_v4().to_string();
    eprintln!("[start-download-direct] job created: {}", job_id);
    let job = data.job_store.create_job(job_id.clone()).await;
    job.append_log(format!("[job] 已创建任务 {}", job_id)).await;

    let appid = req.appid.clone();
    let app_ver_id = req.appVerId.clone();
    let app_name_hint = req.appName.clone().filter(|value| !value.is_empty());
    let bundle_id_hint = req.bundleId.clone().filter(|value| !value.is_empty());
    let app_version_hint = req.appVersion.clone().filter(|value| !value.is_empty());
    let artwork_url_hint = req.artworkUrl.clone().filter(|value| !value.is_empty());
    let artist_name_hint = req.artistName.clone().filter(|value| !value.is_empty());
    let auto_purchase = req.autoPurchase;
    let account_email = account_store.account_email.clone();
    let account_region = data
        .db
        .lock()
        .ok()
        .and_then(|db| db.get_account_by_token(&req.token).ok().flatten())
        .map(|account| account.region)
        .filter(|value| !value.is_empty());
    let job_for_task = job.clone();
    let job_id_for_task = job_id.clone();
    let db = data.db.clone();
    let downloads_dir = data.downloads_dir.clone();

    tokio::spawn(async move {
        let job_dir = downloads_dir.join("jobs").join(&job_id_for_task);
        if let Err(error) = tokio::fs::create_dir_all(&job_dir).await {
            let message = format!("创建任务目录失败: {}", error);
            job_for_task
                .append_log(format!("[error] {}", message))
                .await;
            job_for_task.mark_failed(message).await;
            return;
        }

        job_for_task.set_running().await;
        job_for_task
            .append_log("[job] 开始下载任务".to_string())
            .await;

        let progress_job = job_for_task.clone();
        let progress_callback =
            std::sync::Arc::new(move |progress: ipa_webtool_services::DownloadProgress| {
                let progress_job = progress_job.clone();
                tokio::spawn(async move {
                    progress_job.append_log(progress.message.clone()).await;
                    progress_job.update_from_progress(&progress).await;
                });
            });

        let download_path = job_dir.to_string_lossy().to_string();
        let params = DownloadParams {
            store: &account_store,
            email: &account_email,
            appid: &appid,
            app_ver_id: app_ver_id.as_deref(),
            download_path: &download_path,
            auto_purchase,
            token: None,
            progress_callback: Some(progress_callback),
        };

        match download_ipa_with_account(params).await {
            Ok(result) if result.ok => {
                if let Some(file_path) = result.file {
                    job_for_task
                        .append_log(format!("[ready] 文件已就绪：{}", file_path))
                        .await;
                    job_for_task
                        .mark_ready(file_path.clone(), result.metadata.clone(), None)
                        .await;

                    let file_meta = std::fs::metadata(&file_path).ok();
                    let file_name = Path::new(&file_path)
                        .file_stem()
                        .and_then(|name| name.to_str())
                        .unwrap_or(&appid)
                        .to_string();
                    let inspection = inspect_existing_ipa(Path::new(&file_path));
                    let decision = derive_delivery_decision(inspection.as_ref(), true);
                    let inspection_json = inspection
                        .as_ref()
                        .and_then(|value| serde_json::to_string(value).ok());
                    let meta = result.metadata.clone();
                    let record = DownloadRecord {
                        id: None,
                        job_id: Some(job_id_for_task.clone()),
                        app_name: meta
                            .as_ref()
                            .map(|item| item.bundle_display_name.clone())
                            .filter(|value| !value.is_empty())
                            .or_else(|| app_name_hint.clone())
                            .unwrap_or(file_name),
                        app_id: appid.clone(),
                        bundle_id: meta
                            .as_ref()
                            .map(|item| item.bundle_id.clone())
                            .filter(|value| !value.is_empty())
                            .or_else(|| bundle_id_hint.clone()),
                        version: meta
                            .as_ref()
                            .map(|item| item.bundle_short_version_string.clone())
                            .filter(|value| !value.is_empty())
                            .or_else(|| app_version_hint.clone())
                            .or_else(|| app_ver_id.clone()),
                        account_email: account_email.clone(),
                        account_region: account_region.clone(),
                        download_date: Some(Utc::now().to_rfc3339()),
                        status: "completed".to_string(),
                        file_size: file_meta.map(|info| info.len() as i64),
                        file_path: Some(file_path.clone()),
                        install_url: None,
                        artwork_url: meta
                            .as_ref()
                            .map(|item| item.artwork_url.clone())
                            .filter(|value| !value.is_empty())
                            .or_else(|| artwork_url_hint.clone()),
                        artist_name: meta
                            .as_ref()
                            .map(|item| item.artist_name.clone())
                            .filter(|value| !value.is_empty())
                            .or_else(|| artist_name_hint.clone()),
                        progress: Some(100),
                        error: None,
                        package_kind: Some(decision.package_kind),
                        ota_installable: Some(decision.ota_installable),
                        install_method: Some(decision.install_method),
                        inspection_json,
                        created_at: None,
                    };
                    if let Err(e) = db.lock().unwrap().add_download_record(&record) {
                        eprintln!("[record] Failed to save download record: {}", e);
                    }
                } else {
                    let message = "下载完成，但未找到产物文件".to_string();
                    job_for_task
                        .append_log(format!("[error] {}", message))
                        .await;
                    job_for_task.mark_failed(message).await;
                }
            }
            Ok(result) => {
                let message = result.error.unwrap_or_else(|| "下载失败".to_string());
                job_for_task
                    .append_log(format!("[error] {}", message))
                    .await;
                job_for_task.mark_failed(message).await;
            }
            Err(error) => {
                let message = error.to_string();
                job_for_task
                    .append_log(format!("[error] {}", message))
                    .await;
                job_for_task.mark_failed(message).await;
            }
        }
    });

    HttpResponse::Ok().json(serde_json::json!({
        "ok": true,
        "jobId": job_id,
    }))
}

async fn progress_sse(
    query: web::Query<JobIdQuery>,
    data: web::Data<AppState>,
) -> Result<HttpResponse, Error> {
    let job = data
        .job_store
        .get(&query.jobId)
        .await
        .ok_or_else(|| ErrorNotFound("任务不存在"))?;

    let snapshot = job.snapshot().await;
    let mut initial_events: Vec<Result<Bytes, Error>> = Vec::new();

    for line in &snapshot.logs {
        initial_events.push(encode_sse("log", &JobLogEvent { line: line.clone() }));
    }

    initial_events.push(encode_sse("progress", &snapshot_progress_event(&snapshot)));

    if snapshot.status == "ready" || snapshot.status == "failed" {
        initial_events.push(encode_sse(
            "end",
            &JobEndEvent {
                status: snapshot.status.clone(),
                error: snapshot.error.clone(),
            },
        ));

        return Ok(HttpResponse::Ok()
            .insert_header(("Content-Type", "text/event-stream"))
            .insert_header(("Cache-Control", "no-cache"))
            .insert_header(("X-Accel-Buffering", "no"))
            .streaming(stream::iter(initial_events)));
    }

    let receiver = job.subscribe();
    let live_stream = stream::unfold(receiver, |mut receiver| async move {
        loop {
            match receiver.recv().await {
                Ok(event) => return Some((encode_job_event(event), receiver)),
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                Err(tokio::sync::broadcast::error::RecvError::Closed) => return None,
            }
        }
    });

    Ok(HttpResponse::Ok()
        .insert_header(("Content-Type", "text/event-stream"))
        .insert_header(("Cache-Control", "no-cache"))
        .insert_header(("X-Accel-Buffering", "no"))
        .streaming(stream::iter(initial_events).chain(live_stream)))
}

async fn download_file(
    query: web::Query<JobIdQuery>,
    data: web::Data<AppState>,
) -> Result<fs::NamedFile, Error> {
    let file_path = if let Some(job) = data.job_store.get(&query.jobId).await {
        let snapshot = job.snapshot().await;
        if snapshot.status != "ready" {
            return Err(ErrorNotFound("任务尚未就绪"));
        }
        snapshot
            .file_path
            .clone()
            .ok_or_else(|| ErrorNotFound("下载文件不存在"))?
    } else {
        let record = data
            .db
            .lock()
            .unwrap()
            .get_download_record_by_job_id(&query.jobId)
            .map_err(ErrorInternalServerError)?
            .ok_or_else(|| ErrorNotFound("任务不存在"))?;
        record
            .file_path
            .clone()
            .ok_or_else(|| ErrorNotFound("下载文件不存在"))?
    };

    let path = PathBuf::from(&file_path);
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("download.ipa")
        .to_string();

    let file = fs::NamedFile::open_async(path)
        .await
        .map_err(ErrorNotFound)?
        .set_content_disposition(ContentDisposition {
            disposition: DispositionType::Attachment,
            parameters: vec![DispositionParam::Filename(file_name)],
        });

    Ok(file)
}

async fn get_job_info(
    req: HttpRequest,
    query: web::Query<JobIdQuery>,
    data: web::Data<AppState>,
) -> impl Responder {
    let job = match data.job_store.get(&query.jobId).await {
        Some(job) => job,
        None => {
            let persisted_record = match data
                .db
                .lock()
                .unwrap()
                .get_download_record_by_job_id(&query.jobId)
            {
                Ok(Some(record)) => record,
                Ok(None) => {
                    return HttpResponse::NotFound()
                        .json(ApiResponse::<String>::error("任务不存在".to_string()))
                }
                Err(error) => {
                    return HttpResponse::InternalServerError().json(ApiResponse::<String>::error(
                        format!("读取任务记录失败：{error}"),
                    ))
                }
            };

            let file_exists = persisted_record
                .file_path
                .as_ref()
                .map(|path| PathBuf::from(path).exists())
                .unwrap_or(false);
            let inspection = inspection_for_record(&persisted_record);
            sync_record_delivery(
                &data.db.lock().unwrap(),
                &persisted_record,
                inspection.as_ref(),
                file_exists,
            );
            let decision = derive_delivery_decision(inspection.as_ref(), file_exists);
            let file_size = persisted_record
                .file_path
                .as_ref()
                .and_then(|path| std::fs::metadata(path).ok())
                .map(|meta| meta.len());
            let install_url = if decision.ota_installable {
                persisted_record.id.and_then(|record_id| {
                    build_record_install_url(&req, &persisted_record, record_id)
                })
            } else {
                None
            };
            let download_url = persisted_record.id.and_then(|record_id| {
                if file_exists {
                    Some(build_record_download_url(&req, record_id))
                } else {
                    None
                }
            });

            return HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
                "jobId": query.jobId.clone(),
                "status": if file_exists { "ready" } else { "failed" },
                "stage": if file_exists { "done" } else { "missing-file" },
                "progress": if file_exists { 100 } else { persisted_record.progress.unwrap_or(0) },
                "downloadUrl": download_url,
                "installUrl": install_url,
                "packageKind": decision.package_kind,
                "otaInstallable": decision.ota_installable,
                "installMethod": decision.install_method,
                "inspection": inspection,
                "error": if file_exists { serde_json::Value::Null } else { serde_json::Value::String("任务记录存在，但安装包文件已丢失".to_string()) },
                "metadata": serde_json::Value::Null,
                "filePath": persisted_record.file_path,
                "fileSize": file_size,
            })));
        }
    };

    let snapshot = job.snapshot().await;

    let persisted_record = if snapshot.status == "ready" {
        data.db
            .lock()
            .unwrap()
            .get_download_record_by_job_id(&query.jobId)
            .ok()
            .flatten()
    } else {
        None
    };

    let snapshot_inspection = snapshot
        .file_path
        .as_ref()
        .map(PathBuf::from)
        .filter(|path| path.exists())
        .as_deref()
        .and_then(inspect_existing_ipa);
    let snapshot_file_exists = snapshot
        .file_path
        .as_ref()
        .map(PathBuf::from)
        .map(|path| path.exists())
        .unwrap_or(false);
    let persisted_record_inspection = persisted_record.as_ref().and_then(inspection_for_record);
    if let Some(record) = persisted_record.as_ref() {
        if snapshot.status == "ready" {
            if let Ok(db) = data.db.lock() {
                sync_record_delivery(
                    &db,
                    record,
                    persisted_record_inspection.as_ref(),
                    snapshot_file_exists,
                );
            }
        }
    }
    let snapshot_decision = if persisted_record.is_some() {
        derive_delivery_decision(persisted_record_inspection.as_ref(), snapshot_file_exists)
    } else {
        derive_delivery_decision(snapshot_inspection.as_ref(), snapshot_file_exists)
    };
    let install_url = if snapshot.status == "ready" {
        if !snapshot_decision.ota_installable {
            None
        } else if let Some(record) = persisted_record.as_ref() {
            record
                .id
                .and_then(|record_id| build_record_install_url(&req, record, record_id))
        } else if snapshot.file_path.is_some() {
            Some(build_job_install_url(&req, &query.jobId))
        } else {
            None
        }
    } else {
        snapshot.install_url.clone()
    };
    let download_url = if snapshot.status == "ready" {
        if let Some(record) = persisted_record.as_ref() {
            if let Some(record_id) = record.id {
                Some(build_record_download_url(&req, record_id))
            } else {
                Some(format!(
                    "{}/api/public/download-file?jobId={}",
                    build_base_url(&req),
                    urlencoding::encode(&query.jobId)
                ))
            }
        } else {
            Some(format!(
                "{}/api/public/download-file?jobId={}",
                build_base_url(&req),
                urlencoding::encode(&query.jobId)
            ))
        }
    } else {
        None
    };
    let file_size = snapshot
        .file_path
        .as_ref()
        .and_then(|path| std::fs::metadata(path).ok())
        .map(|meta| meta.len());

    HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
        "jobId": snapshot.job_id,
        "status": snapshot.status,
        "stage": snapshot.stage,
        "progress": snapshot.progress,
        "downloadUrl": download_url,
        "installUrl": install_url,
        "packageKind": snapshot_decision.package_kind,
        "otaInstallable": snapshot_decision.ota_installable,
        "installMethod": snapshot_decision.install_method,
        "inspection": if persisted_record.is_some() { persisted_record_inspection } else { snapshot_inspection },
        "error": snapshot.error,
        "metadata": snapshot.metadata,
        "filePath": snapshot.file_path,
        "fileSize": file_size,
    })))
}

// 获取下载链接
async fn get_download_url(query: web::Query<DownloadUrlQuery>) -> impl Responder {
    let accounts = ACCOUNTS.read().await;
    eprintln!(
        "[download-url] token={}… appid={} appVerId={:?} active_accounts={}",
        query.token.chars().take(8).collect::<String>(),
        query.appid,
        query.appVerId,
        accounts.len()
    );
    let account_store = accounts.get(&query.token);

    if account_store.is_none() {
        eprintln!(
            "[download-url] token miss: {}…",
            query.token.chars().take(8).collect::<String>()
        );
        return HttpResponse::Unauthorized()
            .json(ApiResponse::<String>::error("无效的 token".to_string()));
    }

    let account_store = account_store.unwrap();

    // 调用 download_product
    match account_store
        .download_product(&query.appid, query.appVerId.as_deref())
        .await
    {
        Ok(result) => {
            let state = result
                .get("_state")
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
                                "fileName": canonical_ipa_filename(
                                    metadata.and_then(|m| m.get("bundleDisplayName")).and_then(|v| v.as_str()).unwrap_or("app"),
                                    metadata.and_then(|m| m.get("bundleShortVersionString")).and_then(|v| v.as_str()).unwrap_or("1.0.0"),
                                    metadata.and_then(|m| m.get("bundleId")).and_then(|v| v.as_str())
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

                let error_msg = result
                    .get("customerMessage")
                    .or(result.get("failureType"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("无法获取下载链接");

                HttpResponse::BadRequest().json(ApiResponse::<String>::error(error_msg.to_string()))
            } else {
                // 检查是否需要购买
                let error_msg = result
                    .get("customerMessage")
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
                    HttpResponse::BadRequest()
                        .json(ApiResponse::<String>::error(error_msg.to_string()))
                }
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!(
            "获取下载链接失败: {}",
            e
        ))),
    }
}

async fn claim_app(req: web::Json<ClaimRequest>) -> impl Responder {
    let accounts = ACCOUNTS.read().await;
    let account_store = match accounts.get(&req.token) {
        Some(account) => account,
        None => {
            return HttpResponse::Unauthorized()
                .json(ApiResponse::<String>::error("无效的 token".to_string()))
        }
    };

    match account_store
        .ensure_license(&req.appid, req.appVerId.as_deref())
        .await
    {
        Ok(result) => {
            let state = result
                .get("_state")
                .and_then(|v| v.as_str())
                .unwrap_or("failure");

            if state != "success" {
                let error_msg = get_license_error_message(&result);
                return HttpResponse::BadRequest().json(ApiResponse::<String>::error(error_msg));
            }

            let verify_delays_ms = [0_u64, 1200, 2500, 4000];
            let mut last_verify_error = String::new();

            for (attempt, delay_ms) in verify_delays_ms.iter().enumerate() {
                if *delay_ms > 0 {
                    tokio::time::sleep(std::time::Duration::from_millis(*delay_ms)).await;
                }

                match account_store
                    .download_product(&req.appid, req.appVerId.as_deref())
                    .await
                {
                    Ok(verify_result) => {
                        let verify_state = verify_result
                            .get("_state")
                            .and_then(|v| v.as_str())
                            .unwrap_or("failure");

                        if verify_state == "success" {
                            return HttpResponse::Ok().json(ApiResponse::success(
                                serde_json::json!({
                                    "claimed": true,
                                    "verified": true,
                                    "verifyAttempts": attempt + 1,
                                }),
                            ));
                        }

                        let verify_error = verify_result
                            .get("customerMessage")
                            .or(verify_result.get("failureType"))
                            .or(verify_result.get("message"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .trim()
                            .to_string();

                        let retryable = {
                            let lowered = verify_error.to_lowercase();
                            lowered.contains("license not found")
                                || lowered.contains("not purchased")
                                || lowered.contains("not found")
                                || verify_error.contains("未购买")
                                || verify_error.contains("未领取")
                                || verify_error.contains("未找到")
                        };

                        last_verify_error = verify_error;
                        if !retryable {
                            break;
                        }
                    }
                    Err(e) => {
                        return HttpResponse::InternalServerError().json(
                            ApiResponse::<String>::error(format!("领取后校验失败: {}", e)),
                        );
                    }
                }
            }

            let error_msg = if last_verify_error.is_empty() {
                "Apple 尚未确认领取成功，请稍后刷新或重试".to_string()
            } else {
                format!("Apple 正在同步领取状态，请稍后重试：{}", last_verify_error)
            };

            HttpResponse::BadRequest().json(ApiResponse::<String>::error(error_msg))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<String>::error(format!("领取失败: {}", e))),
    }
}

async fn get_purchase_status(query: web::Query<PurchaseStatusQuery>) -> impl Responder {
    let accounts = ACCOUNTS.read().await;
    let account_store = match accounts.get(&query.token) {
        Some(account) => account,
        None => {
            return HttpResponse::Unauthorized()
                .json(ApiResponse::<String>::error("无效的 token".to_string()))
        }
    };

    match account_store
        .download_product(&query.appid, query.appVerId.as_deref())
        .await
    {
        Ok(result) => {
            let state = result
                .get("_state")
                .and_then(|v| v.as_str())
                .unwrap_or("failure");

            if state == "success" {
                return HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
                    "purchased": true,
                    "needsPurchase": false,
                    "status": "owned",
                    "error": null,
                })));
            }

            let error_msg = result
                .get("customerMessage")
                .or(result.get("failureType"))
                .or(result.get("message"))
                .and_then(|v| v.as_str())
                .unwrap_or("下载失败")
                .to_string();

            let lowered = error_msg.to_lowercase();
            let is_license_error = lowered.contains("license")
                || lowered.contains("not found")
                || lowered.contains("not purchased")
                || lowered.contains("not owned")
                || error_msg.contains("未购买")
                || error_msg.contains("未领取")
                || error_msg.contains("未找到");

            HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
                "purchased": false,
                "needsPurchase": is_license_error,
                "status": if is_license_error { "not_owned" } else { "unknown" },
                "error": error_msg,
            })))
        }
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!(
            "查询购买状态失败: {}",
            e
        ))),
    }
}

// 下载 IPA
async fn download_ipa(
    req: web::Json<DownloadRequest>,
    data: web::Data<AppState>,
) -> impl Responder {
    // 验证 token
    let accounts = ACCOUNTS.read().await;
    let _account_store = accounts.get(&req.token);

    if _account_store.is_none() {
        return HttpResponse::Unauthorized()
            .json(ApiResponse::<String>::error("无效的 token".to_string()));
    }

    drop(accounts);

    // 创建下载目录
    let download_dir = data.downloads_dir.clone();
    if tokio::fs::create_dir_all(&download_dir).await.is_err() {
        return HttpResponse::InternalServerError()
            .json(ApiResponse::<String>::error("创建下载目录失败".to_string()));
    }

    // 获取下载 URL
    let url = &req.url;

    // 解析 URL 获取文件名
    let filename = url.split("/").last().unwrap_or("app.ipa");
    let filepath = download_dir.join(filename).to_string_lossy().to_string();

    // 开始下载
    match download_file_with_progress(url, &filepath).await {
        Ok(metadata) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "file": filepath,
            "metadata": metadata
        }))),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<String>::error(format!("下载失败: {}", e))),
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

fn sanitize_upload_filename(name: &str) -> String {
    let base = name
        .rsplit('/')
        .next()
        .unwrap_or(name)
        .rsplit('\\')
        .next()
        .unwrap_or(name);

    let cleaned: String = base
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '_'
            }
        })
        .collect();

    if cleaned.is_empty() {
        "upload.ipa".to_string()
    } else {
        cleaned
    }
}

// 上传 IPA（手动上传到服务器）
async fn upload_ipa(mut payload: Multipart, data: web::Data<AppState>) -> impl Responder {
    const MAX_UPLOAD_BYTES: u64 = 2 * 1024 * 1024 * 1024;

    let job_id = Uuid::new_v4().to_string();
    let uploads_dir = data.downloads_dir.join("uploads");
    if let Err(e) = tokio::fs::create_dir_all(&uploads_dir).await {
        return HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!(
            "创建上传目录失败: {}",
            e
        )));
    }

    let mut saved_file_name: Option<String> = None;
    let mut saved_file_path: Option<PathBuf> = None;
    let mut saved_file_size: u64 = 0;

    while let Ok(Some(mut field)) = payload.try_next().await {
        let filename = field
            .content_disposition()
            .get_filename()
            .map(sanitize_upload_filename)
            .unwrap_or_else(|| "upload.ipa".to_string());

        if !filename.to_lowercase().ends_with(".ipa") {
            return HttpResponse::BadRequest().json(ApiResponse::<String>::error(
                "只能上传 .ipa 文件".to_string(),
            ));
        }

        // Only accept the first file field
        if saved_file_path.is_some() {
            continue;
        }

        let target_path = uploads_dir.join(format!("{}-{}", job_id, filename));
        let mut f = match tokio::fs::File::create(&target_path).await {
            Ok(file) => file,
            Err(e) => {
                return HttpResponse::InternalServerError().json(ApiResponse::<String>::error(
                    format!("创建上传文件失败: {}", e),
                ));
            }
        };

        while let Ok(Some(chunk)) = field.try_next().await {
            saved_file_size = saved_file_size.saturating_add(chunk.len() as u64);
            if saved_file_size > MAX_UPLOAD_BYTES {
                let _ = tokio::fs::remove_file(&target_path).await;
                return HttpResponse::BadRequest().json(ApiResponse::<String>::error(
                    "上传文件不能超过 2GB".to_string(),
                ));
            }
            if let Err(e) = f.write_all(&chunk).await {
                let _ = tokio::fs::remove_file(&target_path).await;
                return HttpResponse::InternalServerError().json(ApiResponse::<String>::error(
                    format!("写入上传文件失败: {}", e),
                ));
            }
        }

        saved_file_name = Some(filename);
        saved_file_path = Some(target_path);
    }

    let Some(file_path) = saved_file_path else {
        return HttpResponse::BadRequest()
            .json(ApiResponse::<String>::error("未找到上传文件".to_string()));
    };

    let file_name = saved_file_name.unwrap_or_else(|| "upload.ipa".to_string());
    let absolute_path = file_path.to_string_lossy().to_string();

    if let Ok(db) = data.db.lock() {
        let inspection = inspect_existing_ipa(Path::new(&absolute_path));
        let decision = derive_delivery_decision(inspection.as_ref(), true);
        let inspection_json = inspection
            .as_ref()
            .and_then(|value| serde_json::to_string(value).ok());
        let record = DownloadRecord {
            id: None,
            job_id: Some(job_id.clone()),
            app_name: file_name.trim_end_matches(".ipa").to_string(),
            app_id: "uploaded".to_string(),
            bundle_id: None,
            version: None,
            account_email: "手动上传".to_string(),
            account_region: None,
            download_date: Some(Utc::now().to_rfc3339()),
            status: "completed".to_string(),
            file_size: Some(saved_file_size as i64),
            file_path: Some(absolute_path.clone()),
            install_url: None,
            artwork_url: None,
            artist_name: None,
            progress: Some(100),
            error: None,
            package_kind: Some(decision.package_kind),
            ota_installable: Some(decision.ota_installable),
            install_method: Some(decision.install_method),
            inspection_json,
            created_at: None,
        };
        let _ = db.add_download_record(&record);
    }

    HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
        "jobId": job_id,
        "fileName": file_name,
        "fileSize": saved_file_size,
        "filePath": absolute_path,
        "installUrl": null,
    })))
}

fn format_itunes_app(app: &serde_json::Value) -> serde_json::Value {
    serde_json::json!({
        "trackId": app.get("trackId")
            .and_then(|v| v.as_i64())
            .map(|v| v.to_string())
            .or_else(|| app.get("trackId").and_then(|v| v.as_str()).map(|v| v.to_string()))
            .unwrap_or_default(),
        "trackName": app.get("trackName").and_then(|v| v.as_str()).unwrap_or(""),
        "bundleId": app.get("bundleId").and_then(|v| v.as_str()).unwrap_or(""),
        "artistName": app.get("artistName").and_then(|v| v.as_str()).unwrap_or(""),
        "artworkUrl60": app.get("artworkUrl60").and_then(|v| v.as_str()).unwrap_or(""),
        "artworkUrl100": app.get("artworkUrl100").and_then(|v| v.as_str()).unwrap_or(""),
        "version": app.get("version").and_then(|v| v.as_str()).unwrap_or(""),
        "averageUserRating": app.get("averageUserRating").and_then(|v| v.as_f64()).unwrap_or(0.0),
        "price": app.get("price").and_then(|v| v.as_f64()).unwrap_or(0.0),
        "formattedPrice": app.get("formattedPrice").and_then(|v| v.as_str()).unwrap_or(""),
        "fileSizeBytes": app.get("fileSizeBytes")
            .and_then(|v| v.as_str())
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(0),
        "genres": app.get("genres").and_then(|v| v.as_array()).cloned().unwrap_or(vec![]),
    })
}

async fn app_meta(query: web::Query<AppMetaQuery>) -> impl Responder {
    use reqwest::Client;

    let region = query.region.as_deref().unwrap_or("US");
    let url = format!(
        "https://itunes.apple.com/lookup?id={}&country={}",
        urlencoding::encode(&query.appid),
        region
    );

    match Client::new().get(&url).send().await {
        Ok(response) => {
            if !response.status().is_success() {
                return HttpResponse::InternalServerError().json(ApiResponse::<String>::error(
                    "lookup API 返回错误".to_string(),
                ));
            }

            match response.json::<serde_json::Value>().await {
                Ok(json) => {
                    if let Some(app) = json
                        .get("results")
                        .and_then(|v| v.as_array())
                        .and_then(|arr| arr.first())
                    {
                        HttpResponse::Ok().json(ApiResponse::success(format_itunes_app(app)))
                    } else {
                        HttpResponse::NotFound()
                            .json(ApiResponse::<String>::error("未找到应用元数据".to_string()))
                    }
                }
                Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<String>::error(
                    format!("解析应用元数据失败: {}", e),
                )),
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!(
            "获取应用元数据失败: {}",
            e
        ))),
    }
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
        return HttpResponse::BadRequest().json(ApiResponse::<String>::error(
            "搜索关键词不能为空".to_string(),
        ));
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
                                    let formatted_apps: Vec<serde_json::Value> =
                                        apps.iter().map(format_itunes_app).collect();

                                    return HttpResponse::Ok()
                                        .json(ApiResponse::success(formatted_apps));
                                }
                            }
                        }

                        // 没有找到结果
                        HttpResponse::Ok().json(ApiResponse::<Vec<Value>>::success(vec![]))
                    }
                    Err(e) => {
                        log::error!("解析搜索结果失败: {}", e);
                        HttpResponse::InternalServerError()
                            .json(ApiResponse::<String>::error("解析搜索结果失败".to_string()))
                    }
                }
            } else {
                log::error!("搜索 API 返回错误: {}", response.status());
                HttpResponse::InternalServerError().json(ApiResponse::<String>::error(
                    "搜索 API 返回错误".to_string(),
                ))
            }
        }
        Err(e) => {
            log::error!("搜索请求失败: {}", e);
            HttpResponse::InternalServerError()
                .json(ApiResponse::<String>::error(format!("搜索请求失败: {}", e)))
        }
    }
}

// 登录
async fn apple_login(
    req: web::Json<AppleLoginRequest>,
    data: web::Data<AppState>,
) -> impl Responder {
    let mfa_code = normalize_mfa_code(req.mfa.as_deref());
    let has_mfa = mfa_code.is_some();
    log::info!(
        "Apple login attempt: email={}, has_mfa={}, mfa_len={}",
        req.email,
        has_mfa,
        mfa_code.as_ref().map(|s| s.len()).unwrap_or(0)
    );

    // 如果有 MFA code，优先复用第一轮暂存的 AccountStore（保留 GUID）
    // 否则创建新的
    let mut account_store = if has_mfa {
        match take_pending_mfa(&req.email, &req.password).await {
            Ok(store) => {
                log::info!("Reusing pending MFA session for {}", req.email);
                store
            }
            Err(message) => {
                log::warn!(
                    "Pending MFA session unavailable for {}: {}",
                    req.email,
                    message
                );
                return HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
                    "status": "need_restart",
                    "message": message,
                })));
            }
        }
    } else {
        AccountStore::new(&req.email)
    };

    match account_store
        .authenticate(&req.password, mfa_code.as_deref())
        .await
    {
        Ok(result) => {
            let state = result
                .get("_state")
                .and_then(|v| v.as_str())
                .unwrap_or("failure");

            log::info!(
                "Apple auth result: state={}, keys={:?}",
                state,
                result.keys().take(10).collect::<Vec<_>>()
            );

            if state == "success" {
                // 清理可能残留的 pending MFA 条目
                clear_pending_mfa(&req.email).await;

                // 生成 token
                let token = uuid::Uuid::new_v4().to_string();
                let dsid = result
                    .get("dsPersonId")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let mut region_for_response = resolved_account_region(&result, None);

                // 存储账号到内存
                let mut accounts = ACCOUNTS.write().await;
                accounts.insert(token.clone(), account_store);

                // 持久化账号到 DB
                if let Ok(db) = data.db.lock() {
                    let existing_region = db
                        .get_latest_account_region_by_email(&req.email)
                        .ok()
                        .flatten();
                    let region = resolved_account_region(&result, existing_region);
                    region_for_response = region.clone();
                    let db_account = ipa_webtool_services::Account {
                        id: None,
                        token: token.clone(),
                        email: req.email.clone(),
                        region,
                        guid: None,
                        cookie_user: None,
                        cookies: None,
                        created_at: None,
                        updated_at: None,
                    };
                    let _ = db.save_account(&db_account);

                    // 可选：加密保存凭证
                    if req.save_credentials.unwrap_or(false) {
                        if let Ok(enc_key) =
                            ipa_webtool_services::crypto::ensure_encryption_key(&db)
                        {
                            if let Ok((ct, iv, tag)) =
                                ipa_webtool_services::crypto::encrypt(&req.password, &enc_key)
                            {
                                let key_id = db
                                    .get_current_encryption_key()
                                    .ok()
                                    .flatten()
                                    .map(|k| k.key_id)
                                    .unwrap_or_default();
                                let creds = ipa_webtool_services::Credentials {
                                    id: None,
                                    email: req.email.clone(),
                                    password_encrypted: ct,
                                    key_id,
                                    iv,
                                    auth_tag: tag,
                                    created_at: None,
                                    updated_at: None,
                                };
                                let _ = db.save_credentials(&creds);
                            }
                        }
                    }
                }

                log::info!("Apple login success: email={}, dsid={}", req.email, dsid);

                HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
                    "token": token,
                    "email": req.email,
                    "dsid": dsid,
                    "region": region_for_response,
                    "displayName": result.get("displayName"),
                })))
            } else {
                let result_obj: serde_json::Map<String, Value> =
                    result.clone().into_iter().collect();
                let (failure_type, user_facing_msg, needs_mfa) =
                    apple_auth_failure_details(&result_obj, has_mfa);
                let customer_message = result_obj
                    .get("customerMessage")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                log::warn!(
                    "Apple auth failure: failureType='{}', customerMessage='{}', needs_mfa={}, has_mfa={}",
                    failure_type, customer_message, needs_mfa, has_mfa
                );

                if needs_mfa && !has_mfa {
                    // 第一轮：暂存 AccountStore 保留 GUID，等用户提交验证码
                    save_pending_mfa(&req.email, &req.password, account_store).await;

                    log::info!("Saved pending MFA session for {}", req.email);

                    return HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
                        "status": "need_mfa",
                        "message": user_facing_msg,
                    })));
                }

                // MFA code provided but still got MFA-related error — code may be wrong/expired
                if needs_mfa && has_mfa {
                    // Re-save AccountStore for retry
                    save_pending_mfa(&req.email, &req.password, account_store).await;

                    log::warn!("MFA code rejected for {}", req.email);

                    return HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
                        "status": "mfa_failed",
                        "message": user_facing_msg,
                    })));
                }

                // Non-MFA auth failure: do not blindly keep a pending MFA session.
                // Preserve pending state only for explicit MFA branches above, otherwise
                // wrong-password / locked-account flows can poison the next login attempt.
                clear_pending_mfa(&req.email).await;

                log::error!("Apple auth failed for {}: {}", req.email, user_facing_msg);
                HttpResponse::Ok().json(ApiResponse::<String>::error(user_facing_msg.to_string()))
            }
        }
        Err(e) => {
            let err_msg = e.to_string();
            log::error!("Apple auth exception for {}: {}", req.email, err_msg);

            // 如果是 JSON 解析错误，说明 Apple 返回了非 JSON 响应
            if err_msg.contains("error decoding response body")
                || err_msg.contains("expected value")
            {
                HttpResponse::Ok().json(ApiResponse::<String>::error(
                    "登录请求被 Apple 拒绝，请检查网络、账号密码，或者尝试使用应用专用密码登录"
                        .to_string(),
                ))
            } else if err_msg.contains("timed out") || err_msg.contains("deadline") {
                HttpResponse::Ok().json(ApiResponse::<String>::error(
                    "连接 Apple 超时，请检查网络环境".to_string(),
                ))
            } else {
                HttpResponse::Ok().json(ApiResponse::<String>::error(format!(
                    "登录失败: {}",
                    err_msg
                )))
            }
        }
    }
}

// 获取已登录的 Apple 账号列表
async fn get_account_list(data: web::Data<AppState>) -> impl Responder {
    let accounts = ACCOUNTS.read().await;
    let mut list: Vec<serde_json::Value> = Vec::new();

    let (saved_credential_emails, account_regions): (
        std::collections::HashSet<String>,
        HashMap<String, String>,
    ) = if let Ok(db) = data.db.lock() {
        let saved_credential_emails = match db.get_all_credentials() {
            Ok(creds) => creds.into_iter().map(|c| c.email).collect(),
            Err(_) => std::collections::HashSet::new(),
        };
        let account_regions = match db.get_all_accounts() {
            Ok(rows) => rows
                .into_iter()
                .map(|account| (account.token, account.region))
                .collect(),
            Err(_) => HashMap::new(),
        };
        (saved_credential_emails, account_regions)
    } else {
        (std::collections::HashSet::new(), HashMap::new())
    };

    for (token, store) in accounts.iter() {
        let dsid = store
            .auth_info
            .as_ref()
            .and_then(|ai| ai.ds_person_id.clone())
            .unwrap_or_default();
        let email = store
            .auth_info
            .as_ref()
            .and_then(|ai| ai.email.clone())
            .unwrap_or_else(|| store.account_email.clone());
        let display_name = store
            .auth_info
            .as_ref()
            .and_then(|ai| ai.display_name.clone());
        let has_saved_credentials = saved_credential_emails.contains(&email);
        let region = account_regions
            .get(token)
            .cloned()
            .filter(|value| !value.is_empty())
            .or_else(|| store.auth_info.as_ref().and_then(|ai| ai.region.clone()))
            .unwrap_or_else(|| "US".to_string());

        list.push(serde_json::json!({
            "token": token,
            "email": email,
            "dsid": dsid,
            "region": region,
            "displayName": display_name,
            "hasSavedCredentials": has_saved_credentials,
        }));
    }

    // 这里只返回当前内存中仍然有效的登录会话。
    // DB 中残留但尚未恢复到 ACCOUNTS 的记录不应伪装成“已登录账号”，
    // 否则前端会拿着陈旧 token 去做下载/刷新，得到“无效的 token”。
    HttpResponse::Ok().json(ApiResponse::success(list))
}

// 删除 Apple 账号
async fn delete_account(token: web::Path<String>, data: web::Data<AppState>) -> impl Responder {
    let token = token.into_inner();

    // 从内存删除
    let mut accounts = ACCOUNTS.write().await;
    let removed_account = accounts.remove(&token);
    let email = removed_account.as_ref().map(|a| a.account_email.clone());

    // 从 DB 删除
    if let Ok(db) = data.db.lock() {
        let _ = db.delete_account(&token);
        // 同时删除该 email 的凭证
        if let Some(email) = email {
            let _ = db.delete_credentials(&email);
        }
    }

    if removed_account.is_some() {
        HttpResponse::Ok().json(ApiResponse::success("已删除"))
    } else {
        HttpResponse::Ok().json(ApiResponse::success("已删除（仅数据库记录）"))
    }
}

// 获取已保存的凭证邮箱列表（不返回密码）
async fn get_credentials_list(data: web::Data<AppState>) -> impl Responder {
    let db = match data.db.lock() {
        Ok(db) => db,
        Err(_) => {
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<String>::error("数据库不可用".to_string()))
        }
    };

    match db.get_all_credentials() {
        Ok(creds) => {
            let emails: Vec<serde_json::Value> = creds
                .iter()
                .map(|c| serde_json::json!({ "email": c.email }))
                .collect();
            HttpResponse::Ok().json(ApiResponse::success(emails))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<String>::error(format!("获取凭证失败: {}", e))),
    }
}

// 自动登录所有保存的凭证
async fn auto_login_all(data: web::Data<AppState>) -> impl Responder {
    let (credentials, enc_key) = {
        let db = match data.db.lock() {
            Ok(db) => db,
            Err(_) => {
                return HttpResponse::InternalServerError()
                    .json(ApiResponse::<String>::error("数据库不可用".to_string()))
            }
        };

        let credentials = match db.get_all_credentials() {
            Ok(c) => c,
            Err(e) => {
                return HttpResponse::InternalServerError()
                    .json(ApiResponse::<String>::error(format!("获取凭证失败: {}", e)))
            }
        };

        let enc_key = match ipa_webtool_services::crypto::ensure_encryption_key(&db) {
            Ok(k) => k,
            Err(e) => {
                return HttpResponse::InternalServerError().json(ApiResponse::<String>::error(
                    format!("加密密钥初始化失败: {}", e),
                ))
            }
        };

        (credentials, enc_key)
    };

    let mut success = Vec::new();
    let mut need_code = Vec::new();
    let mut failed = Vec::new();

    let accounts = ACCOUNTS.read().await;
    // 收集已登录的邮箱列表
    let logged_in_emails: std::collections::HashSet<String> =
        accounts.values().map(|a| a.account_email.clone()).collect();
    drop(accounts);

    for cred in &credentials {
        // 解密密码
        let db2 = match data.db.lock() {
            Ok(d) => d,
            Err(_) => continue,
        };
        let password = match ipa_webtool_services::crypto::decrypt(
            &cred.password_encrypted,
            &cred.iv,
            &cred.auth_tag,
            &enc_key,
        ) {
            Ok(p) => p,
            Err(_) => {
                failed.push(serde_json::json!({ "email": cred.email, "error": "解密失败" }));
                continue;
            }
        };
        drop(db2);

        // 检查是否已登录
        if logged_in_emails.contains(&cred.email) {
            success.push(serde_json::json!({
                "email": cred.email,
                "alreadyLoggedIn": true,
            }));
            continue;
        }

        // 尝试登录
        let mut store = AccountStore::new(&cred.email);
        match store.authenticate(&password, None).await {
            Ok(result) => {
                let state = result
                    .get("_state")
                    .and_then(|v| v.as_str())
                    .unwrap_or("failure");
                if state == "success" {
                    let token = uuid::Uuid::new_v4().to_string();
                    let dsid = result
                        .get("dsPersonId")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();

                    let mut accounts = ACCOUNTS.write().await;
                    accounts.insert(token.clone(), store);

                    let mut region_for_response = resolved_account_region(&result, None);

                    // 持久化
                    if let Ok(db) = data.db.lock() {
                        let existing_region = db
                            .get_latest_account_region_by_email(&cred.email)
                            .ok()
                            .flatten();
                        let region = resolved_account_region(&result, existing_region);
                        region_for_response = region.clone();
                        let db_account = ipa_webtool_services::Account {
                            id: None,
                            token: token.clone(),
                            email: cred.email.clone(),
                            region,
                            guid: None,
                            cookie_user: None,
                            cookies: None,
                            created_at: None,
                            updated_at: None,
                        };
                        let _ = db.save_account(&db_account);
                    }

                    success.push(serde_json::json!({
                        "email": cred.email,
                        "token": token,
                        "dsid": dsid,
                        "region": region_for_response,
                        "alreadyLoggedIn": false,
                    }));
                } else {
                    let err_msg = result
                        .get("customerMessage")
                        .or(result.get("failureType"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("登录失败");

                    if err_msg == "MZFinance.BadLogin.Configurator_message"
                        || err_msg.contains("verification code")
                        || err_msg.contains("two-factor")
                        || err_msg.contains("MFA")
                    {
                        need_code.push(serde_json::json!({ "email": cred.email }));
                    } else {
                        failed.push(serde_json::json!({ "email": cred.email, "error": err_msg }));
                    }
                }
            }
            Err(e) => {
                failed.push(serde_json::json!({ "email": cred.email, "error": e.to_string() }));
            }
        }
    }

    HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
        "results": { "success": success, "needCode": need_code, "failed": failed }
    })))
}

// 刷新账号会话（重新认证）
async fn refresh_login(
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>,
) -> impl Responder {
    let token = match req.get("token").and_then(|v| v.as_str()) {
        Some(t) => t.to_string(),
        None => {
            return HttpResponse::BadRequest()
                .json(ApiResponse::<String>::error("缺少 token".to_string()))
        }
    };

    // 查找现有账号
    let accounts = ACCOUNTS.read().await;
    let email = match accounts.get(&token) {
        Some(store) => store.account_email.clone(),
        None => {
            return HttpResponse::NotFound()
                .json(ApiResponse::<String>::error("账号不存在".to_string()))
        }
    };
    drop(accounts);

    let password = {
        let db = match data.db.lock() {
            Ok(db) => db,
            Err(_) => {
                return HttpResponse::InternalServerError()
                    .json(ApiResponse::<String>::error("数据库不可用".to_string()))
            }
        };

        let cred = match db.get_credentials(&email) {
            Ok(Some(c)) => c,
            _ => {
                return HttpResponse::BadRequest().json(ApiResponse::<String>::error(
                    "未找到保存的密码，无法自动刷新。请重新登录。".to_string(),
                ))
            }
        };

        let enc_key = match ipa_webtool_services::crypto::ensure_encryption_key(&db) {
            Ok(k) => k,
            Err(e) => {
                return HttpResponse::InternalServerError()
                    .json(ApiResponse::<String>::error(format!("加密密钥失败: {}", e)))
            }
        };

        match ipa_webtool_services::crypto::decrypt(
            &cred.password_encrypted,
            &cred.iv,
            &cred.auth_tag,
            &enc_key,
        ) {
            Ok(password) => password,
            Err(_) => {
                return HttpResponse::InternalServerError()
                    .json(ApiResponse::<String>::error("解密密码失败".to_string()))
            }
        }
    };

    // 重新认证
    let mut store = AccountStore::new(&email);
    match store.authenticate(&password, None).await {
        Ok(result) => {
            let state = result
                .get("_state")
                .and_then(|v| v.as_str())
                .unwrap_or("failure");
            if state == "success" {
                let mut region_for_response = resolved_account_region(&result, None);

                // 更新内存中的账号
                let mut accounts = ACCOUNTS.write().await;
                accounts.insert(token.clone(), store);

                if let Ok(db) = data.db.lock() {
                    let existing_region =
                        db.get_latest_account_region_by_email(&email).ok().flatten();
                    let region = resolved_account_region(&result, existing_region);
                    region_for_response = region.clone();
                    let _ = db.update_account_region(&token, &region);
                }

                HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
                    "ok": true,
                    "email": email,
                    "region": region_for_response,
                })))
            } else {
                let err_msg = result
                    .get("customerMessage")
                    .or(result.get("failureType"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("刷新失败");
                HttpResponse::BadRequest().json(ApiResponse::<String>::error(err_msg.to_string()))
            }
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<String>::error(format!("刷新失败: {}", e))),
    }
}

async fn admin_login(
    req: web::Json<AdminLoginRequest>,
    data: web::Data<AppState>,
) -> impl Responder {
    let username = req.username.trim();
    let password = req.password.trim();

    log::info!("[auth:login] attempt username={}", username);

    if username.is_empty() || password.is_empty() {
        log::warn!("[auth:login] rejected: empty username or password");
        return HttpResponse::BadRequest().json(ApiResponse::<String>::error(
            "用户名和密码不能为空".to_string(),
        ));
    }

    let db = match data.db.lock() {
        Ok(db) => db,
        Err(_) => {
            log::error!("[auth:login] failed to acquire db lock");
            return HttpResponse::InternalServerError().json(ApiResponse::<String>::error(
                "认证服务暂时不可用".to_string(),
            ));
        }
    };

    let user = match db.get_admin_user(username) {
        Ok(Some(user)) => user,
        Ok(None) => {
            log::warn!("[auth:login] user not found: {}", username);
            return HttpResponse::Unauthorized()
                .json(ApiResponse::<String>::error("用户名或密码错误".to_string()));
        }
        Err(e) => {
            log::error!("[auth:login] db error looking up user {}: {}", username, e);
            return HttpResponse::InternalServerError().json(ApiResponse::<String>::error(
                format!("查询管理员失败: {}", e),
            ));
        }
    };

    if user.password_hash != hash_password(password) {
        log::warn!("[auth:login] wrong password for user: {}", username);
        return HttpResponse::Unauthorized()
            .json(ApiResponse::<String>::error("用户名或密码错误".to_string()));
    }

    let token = Uuid::new_v4().to_string();
    if let Err(e) = db.cleanup_expired_sessions() {
        log::warn!("[auth:login] cleanup expired sessions failed: {}", e);
    }

    if let Err(e) = db.create_session(&token, &user.username, &session_expires_at()) {
        log::error!("[auth:login] create session failed for {}: {}", username, e);
        return HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!(
            "创建登录态失败: {}",
            e
        )));
    }

    log::info!(
        "[auth:login] success user={} is_default={} token={}..",
        user.username,
        user.is_default,
        &token[..8]
    );

    HttpResponse::Ok()
        .cookie(build_session_cookie(&token))
        .json(ApiResponse::success(AuthUserPayload::from(&user)))
}

async fn logout(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
    if let Some(session_cookie) = req.cookie(ADMIN_SESSION_COOKIE) {
        match data.db.lock() {
            Ok(db) => {
                if let Err(e) = db.delete_session(session_cookie.value()) {
                    log::warn!("清理登录态失败: {}", e);
                }
            }
            Err(_) => log::warn!("认证服务暂时不可用，跳过服务端 session 清理"),
        }
    }

    HttpResponse::Ok()
        .cookie(clear_session_cookie())
        .json(ApiResponse::success("已退出登录".to_string()))
}

async fn me(admin: AuthenticatedAdmin) -> impl Responder {
    HttpResponse::Ok().json(ApiResponse::success(AuthUserPayload {
        username: admin.username,
        is_default: admin.is_default,
    }))
}

async fn change_password(
    admin: AuthenticatedAdmin,
    req: web::Json<ChangePasswordRequest>,
    data: web::Data<AppState>,
) -> impl Responder {
    log::info!(
        "[auth:change-pwd] user={} new_username={:?} session={}..",
        admin.username,
        req.new_username,
        &admin.session_token[..8]
    );

    if req.new_password.trim().is_empty() {
        return HttpResponse::BadRequest()
            .json(ApiResponse::<String>::error("新密码不能为空".to_string()));
    }

    if req.current_password == req.new_password {
        return HttpResponse::BadRequest().json(ApiResponse::<String>::error(
            "新密码不能与当前密码相同".to_string(),
        ));
    }

    let db = match data.db.lock() {
        Ok(db) => db,
        Err(_) => {
            log::error!(
                "[auth:change-pwd] db lock failed for user={}",
                admin.username
            );
            return HttpResponse::InternalServerError().json(ApiResponse::<String>::error(
                "认证服务暂时不可用".to_string(),
            ));
        }
    };

    let user = match db.get_admin_user(&admin.username) {
        Ok(Some(user)) => user,
        Ok(None) => {
            log::warn!("[auth:change-pwd] user not found: {}", admin.username);
            return HttpResponse::Unauthorized()
                .json(ApiResponse::<String>::error("管理员账号不存在".to_string()));
        }
        Err(e) => {
            log::error!("[auth:change-pwd] db error for {}: {}", admin.username, e);
            return HttpResponse::InternalServerError().json(ApiResponse::<String>::error(
                format!("查询管理员失败: {}", e),
            ));
        }
    };

    if user.password_hash != hash_password(&req.current_password) {
        log::warn!(
            "[auth:change-pwd] wrong current password for user={}",
            admin.username
        );
        return HttpResponse::BadRequest()
            .json(ApiResponse::<String>::error("当前密码不正确".to_string()));
    }

    // Determine final username before any DB writes
    let new_username = req
        .new_username
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty() && *s != admin.username);

    // Atomic: update password + rename in one transaction
    let final_username = match db.change_password_and_rename(
        &admin.username,
        &hash_password(&req.new_password),
        false,
        new_username,
    ) {
        Ok(name) => {
            log::info!(
                "[auth:change-pwd] success user={} -> {} is_default=false",
                admin.username,
                name
            );
            name
        }
        Err(e) => {
            log::error!(
                "[auth:change-pwd] transaction failed for {}: {}",
                admin.username,
                e
            );
            return HttpResponse::InternalServerError().json(ApiResponse::<String>::error(
                format!("修改密码/用户名失败: {}", e),
            ));
        }
    };

    HttpResponse::Ok().json(ApiResponse::success(AuthUserPayload {
        username: final_username,
        is_default: false,
    }))
}

// 生成 plist 清单文件
async fn get_manifest(
    req: HttpRequest,
    query: web::Query<ManifestQuery>,
    data: web::Data<AppState>,
) -> impl Responder {
    let manifest_result = if let Some(job_id) = &query.jobId {
        let job = match data.job_store.get(job_id).await {
            Some(job) => job,
            None => {
                return HttpResponse::NotFound()
                    .json(ApiResponse::<String>::error("任务不存在".to_string()))
            }
        };
        let snapshot = job.snapshot().await;

        if snapshot.status != "ready" {
            return HttpResponse::BadRequest().json(ApiResponse::<String>::error(
                "任务尚未完成，无法生成 manifest".to_string(),
            ));
        }

        let file_exists = snapshot
            .file_path
            .as_ref()
            .map(PathBuf::from)
            .map(|path| path.exists())
            .unwrap_or(false);
        let inspection = snapshot
            .file_path
            .as_ref()
            .map(PathBuf::from)
            .filter(|path| path.exists())
            .as_deref()
            .and_then(inspect_existing_ipa);
        let decision = derive_delivery_decision(inspection.as_ref(), file_exists);
        if !decision.ota_installable {
            let reason = inspection
                .as_ref()
                .map(|value| value.summary.clone())
                .unwrap_or_else(|| "该 IPA 不支持 OTA 安装".to_string());
            return HttpResponse::Forbidden().json(ApiResponse::<String>::error(format!(
                "已拦截 manifest 生成：{}",
                reason
            )));
        }

        let metadata = match snapshot.metadata {
            Some(metadata) => metadata,
            None => {
                return HttpResponse::InternalServerError()
                    .json(ApiResponse::<String>::error("任务缺少元数据".to_string()))
            }
        };

        let download_url = format!(
            "{}/api/public/download-file?jobId={}",
            build_base_url(&req),
            urlencoding::encode(job_id)
        );

        generate_plist(
            download_url,
            metadata.bundle_id,
            metadata.bundle_short_version_string,
            metadata.bundle_display_name,
        )
    } else {
        let url = match &query.url {
            Some(url) => url.clone(),
            None => {
                return HttpResponse::BadRequest()
                    .json(ApiResponse::<String>::error("url 不能为空".to_string()))
            }
        };
        let bundle_id = match &query.bundle_id {
            Some(bundle_id) => bundle_id.clone(),
            None => {
                return HttpResponse::BadRequest().json(ApiResponse::<String>::error(
                    "bundle_id 不能为空".to_string(),
                ))
            }
        };
        let bundle_version = match &query.bundle_version {
            Some(bundle_version) => bundle_version.clone(),
            None => {
                return HttpResponse::BadRequest().json(ApiResponse::<String>::error(
                    "bundle_version 不能为空".to_string(),
                ))
            }
        };
        let title = match &query.title {
            Some(title) => title.clone(),
            None => {
                return HttpResponse::BadRequest()
                    .json(ApiResponse::<String>::error("title 不能为空".to_string()))
            }
        };

        generate_plist(url, bundle_id, bundle_version, title)
    };

    match manifest_result {
        Ok(plist) => HttpResponse::Ok()
            .content_type("application/xml; charset=utf-8")
            .insert_header(("Cache-Control", "no-store"))
            .body(plist),
        Err(error) => {
            log::error!("Failed to generate plist: {}", error);
            HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!(
                "生成 plist 失败: {}",
                error
            )))
        }
    }
}

// Plist token 解析端点（仿 OpenList /i/:link_name.plist）
async fn plist_from_token(path: web::Path<String>, data: web::Data<AppState>) -> impl Responder {
    use base64::engine::general_purpose::URL_SAFE_NO_PAD as BASE64;
    use base64::Engine as _;

    let raw = path.into_inner();
    let token = raw.strip_suffix(".plist").unwrap_or(&raw);

    let decoded = match BASE64.decode(token) {
        Ok(bytes) => bytes,
        Err(e) => {
            log::warn!("invalid plist token base64: {}", e);
            return HttpResponse::BadRequest().body("invalid plist token");
        }
    };

    let decoded_str = match String::from_utf8(decoded) {
        Ok(s) => s,
        Err(_) => {
            return HttpResponse::BadRequest().body("invalid plist token encoding");
        }
    };

    let parts: Vec<&str> = decoded_str.splitn(3, '/').collect();
    if parts.len() < 2 {
        return HttpResponse::BadRequest().body("malformed plist token");
    }

    let link_encode = parts[0];
    let name_encode = parts[1];
    let version_encode = parts.get(2).copied();

    let link_str = match urlencoding::decode(link_encode) {
        Ok(v) => v.into_owned(),
        Err(_) => return HttpResponse::BadRequest().body("invalid url in plist token"),
    };

    // Hard block: if this token points to a download record whose IPA is not directly side-loadable,
    // stop before returning a plist. This prevents users from installing and then hitting black-screen crash.
    if let Some(record_id) = extract_record_id_from_download_url(&link_str) {
        let record = data
            .db
            .lock()
            .unwrap()
            .get_download_record(record_id)
            .ok()
            .flatten();

        if let Some(record) = record {
            if let Some(file_path) = record.file_path.clone() {
                let path = PathBuf::from(file_path);
                if path.exists() {
                    if let Some(inspection) = inspect_existing_ipa(&path) {
                        if inspection_blocks_install(&inspection) {
                            let message = format!("已拦截安装：{}", inspection.summary);
                            return HttpResponse::Forbidden()
                                .content_type("text/plain; charset=utf-8")
                                .insert_header(("Cache-Control", "no-store"))
                                .body(message);
                        }
                    }
                }
            }
        }
    }

    let name_full = match urlencoding::decode(name_encode) {
        Ok(v) => v.into_owned(),
        Err(_) => return HttpResponse::BadRequest().body("invalid name in plist token"),
    };

    let mut name = name_full.clone();
    let mut identifier = format!("org.ipatool.{}", name_full);
    if let Some(idx) = name_full.rfind('@') {
        name = name_full[..idx].to_string();
        identifier = name_full[idx + 1..].to_string();
    }

    let bundle_version = match version_encode {
        Some(encoded) => match urlencoding::decode(encoded) {
            Ok(v) => v.into_owned(),
            Err(_) => return HttpResponse::BadRequest().body("invalid version in plist token"),
        },
        None => "1.0".to_string(),
    };

    let plist_result = generate_plist(link_str, identifier, bundle_version, name);

    match plist_result {
        Ok(plist) => HttpResponse::Ok()
            .content_type("application/xml; charset=utf-8")
            .insert_header(("Cache-Control", "no-store"))
            .body(plist),
        Err(err) => {
            log::error!("Failed to generate plist from token: {}", err);
            HttpResponse::InternalServerError().body("failed to generate plist")
        }
    }
}

// OTA 安装端点 - 跳转到 itms-services 触发 iOS 原生安装
async fn install(query: web::Query<InstallQuery>) -> impl Responder {
    log::info!("OTA install request, manifest URL: {}", query.manifest);

    let install_url = format!(
        "itms-services://?action=download-manifest&url={}",
        urlencoding::encode(&query.manifest)
    );

    HttpResponse::Found()
        .insert_header(("Location", install_url))
        .finish()
}

// ============ 批量下载相关端点 ============

#[derive(Deserialize)]
struct BatchDownloadRequest {
    task_name: String,
    items: Vec<BatchItemRequest>,
}

#[derive(Deserialize)]
struct BatchItemRequest {
    app_id: String,
    app_name: Option<String>,
    version: Option<String>,
    account_email: String,
}

// 开始批量下载
async fn start_batch_download(
    req: web::Json<BatchDownloadRequest>,
    data: web::Data<AppState>,
) -> impl Responder {
    if req.task_name.trim().is_empty() {
        return HttpResponse::BadRequest().json(ApiResponse::<String>::error(
            "task_name 不能为空".to_string(),
        ));
    }

    if req.items.is_empty() {
        return HttpResponse::BadRequest()
            .json(ApiResponse::<String>::error("items 不能为空".to_string()));
    }

    // 从全局 ACCOUNTS 中按 email 找到已认证的 AccountStore
    let accounts = ACCOUNTS.read().await;

    let mut batch_items: Vec<BatchItem<AccountStore>> = Vec::with_capacity(req.items.len());

    for item in &req.items {
        let account = accounts
            .values()
            .find(|acc| acc.account_email == item.account_email)
            .cloned();

        let account = match account {
            Some(a) => a,
            None => {
                return HttpResponse::BadRequest().json(ApiResponse::<String>::error(format!(
                    "账号未登录或不存在: {}",
                    item.account_email
                )));
            }
        };

        if account.auth_info.is_none() {
            return HttpResponse::BadRequest().json(ApiResponse::<String>::error(format!(
                "账号尚未完成认证: {}",
                item.account_email
            )));
        }

        batch_items.push(BatchItem {
            store: account,
            app_id: item.app_id.clone(),
            app_name: item.app_name.clone(),
            // 这里的 version 实际是 appVerId（external_identifier），用于 download_product 的 app_ver_id 参数
            version: item.version.clone(),
            account_email: item.account_email.clone(),
        });
    }

    drop(accounts);

    match data
        .download_manager
        .start_batch_download::<AccountStore>(&req.task_name, batch_items)
        .await
    {
        Ok(batch_id) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "batchId": batch_id,
            "taskName": req.task_name,
            "totalCount": req.items.len(),
        }))),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!(
            "创建批量任务失败: {}",
            e
        ))),
    }
}

// 获取所有批量下载任务
async fn get_batch_tasks(data: web::Data<AppState>) -> impl Responder {
    match data.db.lock().unwrap().get_batch_tasks() {
        Ok(tasks) => HttpResponse::Ok().json(ApiResponse::success(tasks)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!(
            "获取批量任务失败: {}",
            e
        ))),
    }
}

// 获取单个批量下载任务详情
async fn get_batch_task(path: web::Path<i64>, data: web::Data<AppState>) -> impl Responder {
    let batch_id = path.into_inner();

    // 获取任务信息
    let task = match data.db.lock().unwrap().get_batch_tasks() {
        Ok(tasks) => tasks.into_iter().find(|t| t.id == Some(batch_id)),
        Err(e) => {
            return HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!(
                "获取批量任务失败: {}",
                e
            )))
        }
    };

    if task.is_none() {
        return HttpResponse::NotFound()
            .json(ApiResponse::<String>::error("批量任务不存在".to_string()));
    }

    let task = task.unwrap();

    // 获取任务项目
    let items = match data.db.lock().unwrap().get_batch_items(batch_id) {
        Ok(items) => items,
        Err(e) => {
            return HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!(
                "获取批量任务项失败: {}",
                e
            )))
        }
    };

    HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
        "task": task,
        "items": items
    })))
}

// 删除批量下载任务
async fn delete_batch_task(path: web::Path<i64>, data: web::Data<AppState>) -> impl Responder {
    let batch_id = path.into_inner();

    match data.db.lock().unwrap().delete_batch_task(batch_id) {
        Ok(_) => HttpResponse::Ok().json(ApiResponse::success("批量任务已删除".to_string())),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!(
            "删除批量任务失败: {}",
            e
        ))),
    }
}

// ============ 下载记录端点 ============

// 获取所有下载记录
async fn get_download_records(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
    {
        let db = data.db.lock().unwrap();
        normalize_download_record_artifact_paths(&db, &data.downloads_dir);
        sync_download_records_from_filesystem(&db, &data.downloads_dir);
    }

    let records = {
        let db = data.db.lock().unwrap();
        match db.get_all_download_records() {
            Ok(r) => r,
            Err(e) => {
                log::error!("[records] failed to get records: {}", e);
                return HttpResponse::InternalServerError()
                    .json(ApiResponse::<String>::error("获取下载记录失败".to_string()));
            }
        }
    };

    // Backfill inspection for records that lack it (outside db lock to avoid deadlock)
    let backfill: Vec<(i64, String)> = records
        .iter()
        .filter(|r| {
            r.inspection_json.is_none()
                && r.file_path
                    .as_ref()
                    .map(|p| PathBuf::from(p).exists())
                    .unwrap_or(false)
        })
        .filter_map(|r| {
            let path = PathBuf::from(r.file_path.as_ref()?);
            let inspection = inspect_existing_ipa(&path)?;
            let json = serde_json::to_string(&inspection).ok()?;
            Some((r.id?, json))
        })
        .collect();

    if !backfill.is_empty() {
        let db = data.db.lock().unwrap();
        for (record_id, json) in backfill {
            let _ = db.update_download_record_delivery(
                record_id,
                None,
                None,
                None,
                Some(json.as_str()),
            );
        }
    }

    let items = records
        .into_iter()
        .map(|record| {
            let inspection = inspection_for_record(&record);
            let file_exists = record
                .file_path
                .as_ref()
                .map(PathBuf::from)
                .map(|path| path.exists())
                .unwrap_or(false);
            let decision = derive_delivery_decision(inspection.as_ref(), file_exists);
            let record_id = record.id;
            let download_url = record_id.map(|id| build_record_download_url(&req, id));
            let install_url = if decision.ota_installable {
                record_id.and_then(|id| build_record_install_url(&req, &record, id))
            } else {
                None
            };

            DownloadRecordView {
                id: record.id,
                job_id: record.job_id,
                app_name: record.app_name,
                app_id: record.app_id,
                bundle_id: record.bundle_id,
                version: record.version,
                account_email: record.account_email,
                account_region: record.account_region,
                download_date: record.download_date,
                status: record.status,
                file_size: record.file_size,
                file_path: record.file_path,
                download_url,
                install_url,
                artwork_url: record.artwork_url,
                artist_name: record.artist_name,
                progress: record.progress,
                error: record.error,
                package_kind: decision.package_kind,
                ota_installable: decision.ota_installable,
                install_method: decision.install_method,
                created_at: record.created_at,
                file_exists,
                inspection,
            }
        })
        .collect::<Vec<_>>();

    HttpResponse::Ok().json(ApiResponse::success(items))
}

async fn download_record_file(
    path: web::Path<i64>,
    data: web::Data<AppState>,
) -> Result<fs::NamedFile, Error> {
    let id = path.into_inner();
    let record = data
        .db
        .lock()
        .unwrap()
        .get_download_record(id)
        .map_err(ErrorInternalServerError)?
        .ok_or_else(|| ErrorNotFound("记录不存在"))?;
    let file_path = record
        .file_path
        .clone()
        .ok_or_else(|| ErrorNotFound("记录未保存文件路径"))?;
    let path = PathBuf::from(&file_path);
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("download.ipa")
        .to_string();

    Ok(fs::NamedFile::open_async(path)
        .await
        .map_err(ErrorNotFound)?
        .set_content_disposition(ContentDisposition {
            disposition: DispositionType::Attachment,
            parameters: vec![DispositionParam::Filename(file_name)],
        }))
}

async fn get_ipa_files(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
    let records = {
        let db = data.db.lock().unwrap();
        normalize_download_record_artifact_paths(&db, &data.downloads_dir);
        sync_download_records_from_filesystem(&db, &data.downloads_dir);
        db.get_all_download_records().unwrap_or_default()
    };

    let mut record_by_path = HashMap::new();
    for record in records {
        if let Some(path) = record.file_path.clone() {
            record_by_path.insert(path, record);
        }
    }

    let artifacts = scan_download_artifacts(&data.downloads_dir);

    let backfill: Vec<(i64, String)> = artifacts
        .iter()
        .filter_map(|artifact| {
            let path_string = artifact.path.to_string_lossy().to_string();
            let record = record_by_path.get(&path_string)?;
            if record.inspection_json.is_some() {
                return None;
            }
            let inspection = inspection_for_record(record)?;
            let json = serde_json::to_string(&inspection).ok()?;
            Some((record.id?, json))
        })
        .collect();

    if !backfill.is_empty() {
        let db = data.db.lock().unwrap();
        for (record_id, json) in backfill {
            let _ = db.update_download_record_delivery(
                record_id,
                None,
                None,
                None,
                Some(json.as_str()),
            );
        }
    }

    let items = artifacts
        .into_iter()
        .map(|artifact| {
            let path_string = artifact.path.to_string_lossy().to_string();
            let record = record_by_path.get(&path_string);
            let fallback_name = artifact.file_name.trim_end_matches(".ipa").to_string();
            let download_url = format!(
                "{}/api/ipa-files/{}/download",
                build_base_url(&req),
                artifact.id
            );
            let inspection = if let Some(record) = record {
                inspection_for_record(record)
            } else {
                inspect_existing_ipa(&artifact.path)
            };
            let decision = derive_delivery_decision(inspection.as_ref(), true);
            let install_url = if decision.ota_installable {
                record.and_then(|record| {
                    let record_id = record.id?;
                    build_record_install_url(&req, record, record_id)
                })
            } else {
                None
            };

            IpaArtifactView {
                id: artifact.id,
                file_name: artifact.file_name,
                file_size: artifact.file_size,
                file_path: path_string,
                modified_at: artifact.modified_at.map(|dt| dt.to_rfc3339()),
                app_name: record
                    .map(|item| item.app_name.clone())
                    .filter(|value| !value.is_empty())
                    .unwrap_or(fallback_name),
                app_id: record
                    .map(|item| item.app_id.clone())
                    .unwrap_or_else(|| "unknown".to_string()),
                bundle_id: record.and_then(|item| item.bundle_id.clone()),
                version: record.and_then(|item| item.version.clone()),
                account_email: record.map(|item| item.account_email.clone()),
                account_region: record.and_then(|item| item.account_region.clone()),
                artwork_url: record.and_then(|item| item.artwork_url.clone()),
                artist_name: record.and_then(|item| item.artist_name.clone()),
                record_id: record.and_then(|item| item.id),
                download_url,
                install_url,
                package_kind: decision.package_kind,
                ota_installable: decision.ota_installable,
                install_method: decision.install_method,
                inspection,
            }
        })
        .collect::<Vec<_>>();

    HttpResponse::Ok().json(ApiResponse::success(items))
}

async fn download_ipa_file(
    path: web::Path<String>,
    data: web::Data<AppState>,
) -> Result<fs::NamedFile, Error> {
    let artifact_id = path.into_inner();
    let file_path = resolve_artifact_path(&data.downloads_dir, &artifact_id)
        .ok_or_else(|| ErrorNotFound("IPA 文件不存在"))?;
    let file_name = file_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("download.ipa")
        .to_string();

    Ok(fs::NamedFile::open_async(file_path)
        .await
        .map_err(ErrorNotFound)?
        .set_content_disposition(ContentDisposition {
            disposition: DispositionType::Attachment,
            parameters: vec![DispositionParam::Filename(file_name)],
        }))
}

async fn delete_ipa_file(path: web::Path<String>, data: web::Data<AppState>) -> impl Responder {
    let artifact_id = path.into_inner();
    let file_path = match resolve_artifact_path(&data.downloads_dir, &artifact_id) {
        Some(path) => path,
        None => {
            return HttpResponse::NotFound()
                .json(ApiResponse::<String>::error("IPA 文件不存在".to_string()))
        }
    };

    if let Err(error) = tokio::fs::remove_file(&file_path).await {
        return HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!(
            "删除文件失败: {}",
            error
        )));
    }

    let file_path_string = file_path.to_string_lossy().to_string();
    let _ = data
        .db
        .lock()
        .unwrap()
        .delete_download_record_by_file_path(&file_path_string);

    HttpResponse::Ok().json(ApiResponse::success("IPA 已删除".to_string()))
}

// 删除下载记录
async fn delete_download_record(path: web::Path<i64>, data: web::Data<AppState>) -> impl Responder {
    let id = path.into_inner();

    match data.db.lock().unwrap().delete_download_record(id) {
        Ok(_) => HttpResponse::Ok().json(ApiResponse::success("记录已删除".to_string())),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<String>::error(format!("删除记录失败: {}", e))),
    }
}

async fn clear_download_records(data: web::Data<AppState>) -> impl Responder {
    match data.db.lock().unwrap().clear_all_download_records() {
        Ok(_) => HttpResponse::Ok().json(ApiResponse::success("记录已清空".to_string())),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<String>::error(format!("清空记录失败: {}", e))),
    }
}

async fn cleanup_download_record_file(
    path: web::Path<i64>,
    data: web::Data<AppState>,
) -> impl Responder {
    let id = path.into_inner();

    let record = match data.db.lock().unwrap().get_download_record(id) {
        Ok(Some(record)) => record,
        Ok(None) => {
            return HttpResponse::NotFound()
                .json(ApiResponse::<String>::error("记录不存在".to_string()))
        }
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<String>::error(format!("查询记录失败: {}", e)))
        }
    };

    let file_path = match record.file_path.clone() {
        Some(path) if !path.is_empty() => path,
        _ => {
            return HttpResponse::BadRequest().json(ApiResponse::<String>::error(
                "记录未保存文件路径".to_string(),
            ))
        }
    };

    let path_buf = PathBuf::from(&file_path);
    let mut freed_bytes = 0u64;
    let mut file_deleted = false;

    if let Ok(meta) = tokio::fs::metadata(&path_buf).await {
        freed_bytes = meta.len();
        if let Err(e) = tokio::fs::remove_file(&path_buf).await {
            return HttpResponse::InternalServerError().json(ApiResponse::<String>::error(
                format!("删除安装包失败: {}", e),
            ));
        }
        file_deleted = true;
    }

    if let Some(parent) = path_buf.parent() {
        let is_jobs_child = parent
            .strip_prefix(data.downloads_dir.join("jobs"))
            .ok()
            .is_some();
        if is_jobs_child {
            let mut empty = true;
            if let Ok(mut entries) = tokio::fs::read_dir(parent).await {
                if entries.next_entry().await.ok().flatten().is_some() {
                    empty = false;
                }
            }
            if empty {
                let _ = tokio::fs::remove_dir(parent).await;
            }
        }
    }

    if let Err(e) = data.db.lock().unwrap().delete_download_record(id) {
        return HttpResponse::InternalServerError()
            .json(ApiResponse::<String>::error(format!("删除记录失败: {}", e)));
    }

    HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
        "recordId": id,
        "fileDeleted": file_deleted,
        "freed_bytes": freed_bytes,
        "freed_mb": ((freed_bytes as f64) / 1024.0 / 1024.0 * 10.0).round() / 10.0,
        "filePath": file_path,
    })))
}

// 清理服务器上的下载文件
async fn cleanup_downloads(data: web::Data<AppState>) -> impl Responder {
    let jobs_dir = data.downloads_dir.join("jobs");
    let mut cleaned = 0i64;
    let mut freed_bytes = 0u64;

    if let Ok(mut entries) = tokio::fs::read_dir(&jobs_dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if path.is_dir() {
                if let Ok(mut dir_entries) = tokio::fs::read_dir(&path).await {
                    while let Ok(Some(f)) = dir_entries.next_entry().await {
                        if f.path().extension().map(|e| e == "ipa").unwrap_or(false) {
                            if let Ok(meta) = f.metadata().await {
                                freed_bytes += meta.len();
                            }
                        }
                    }
                }
                if let Err(e) = tokio::fs::remove_dir_all(&path).await {
                    eprintln!("[cleanup] Failed to remove {:?}: {}", path, e);
                } else {
                    cleaned += 1;
                }
            }
        }
    }

    HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
        "cleaned": cleaned,
        "freed_bytes": freed_bytes,
        "freed_mb": (freed_bytes as f64 / 1024.0 / 1024.0).round(),
    })))
}

// ============ 订阅相关端点 ============

#[derive(Deserialize)]
struct SubscriptionRequest {
    app_id: String,
    app_name: String,
    bundle_id: Option<String>,
    account_email: String,
    account_region: Option<String>,
    artwork_url: Option<String>,
    artist_name: Option<String>,
}

// 获取所有订阅
async fn get_subscriptions(data: web::Data<AppState>) -> impl Responder {
    match data.db.lock().unwrap().get_all_subscriptions() {
        Ok(subs) => HttpResponse::Ok().json(ApiResponse::success(subs)),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<String>::error(format!("获取订阅失败: {}", e))),
    }
}

// 添加订阅
async fn add_subscription(
    req: web::Json<SubscriptionRequest>,
    data: web::Data<AppState>,
) -> impl Responder {
    let subscription = NewSubscription {
        app_id: &req.app_id,
        app_name: &req.app_name,
        bundle_id: req.bundle_id.as_deref(),
        account_email: &req.account_email,
        account_region: req.account_region.as_deref(),
        artwork_url: req.artwork_url.as_deref(),
        artist_name: req.artist_name.as_deref(),
    };

    match data.db.lock().unwrap().add_subscription(&subscription) {
        Ok(_) => HttpResponse::Ok().json(ApiResponse::success("订阅已添加".to_string())),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<String>::error(format!("添加订阅失败: {}", e))),
    }
}

// 移除订阅
async fn remove_subscription(
    query: web::Query<SubscriptionRequest>,
    data: web::Data<AppState>,
) -> impl Responder {
    match data
        .db
        .lock()
        .unwrap()
        .remove_subscription(&query.app_id, &query.account_email)
    {
        Ok(_) => HttpResponse::Ok().json(ApiResponse::success("订阅已移除".to_string())),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<String>::error(format!("移除订阅失败: {}", e))),
    }
}

#[derive(Serialize, Deserialize, Clone)]
struct ArchiveApp {
    id: String,
    name: String,
    icon_url: Option<String>,
    bundle_id: Option<String>,
    versions: Vec<ArchiveVersion>,
    delisted: bool,
    added_at: String,
    added_by: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct ArchiveVersion {
    version_id: String,
    version: String,
}

#[derive(Deserialize)]
#[allow(non_snake_case)]
struct AddArchiveRequest {
    app_id: String,
    app_name: String,
    icon_url: Option<String>,
    bundle_id: Option<String>,
    versions: Vec<ArchiveVersion>,
}

fn resolve_archive_dir() -> PathBuf {
    resolve_project_root().join("data").join("archive")
}

async fn get_archive_apps() -> impl Responder {
    let archive_dir = resolve_archive_dir();
    let mut apps: Vec<ArchiveApp> = Vec::new();

    if let Ok(entries) = std::fs::read_dir(archive_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
                continue;
            }
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Ok(app) = serde_json::from_str::<ArchiveApp>(&content) {
                    apps.push(app);
                }
            }
        }
    }

    apps.sort_by(|a, b| b.added_at.cmp(&a.added_at));
    HttpResponse::Ok().json(ApiResponse::success(apps))
}

async fn add_archive_app(body: web::Json<AddArchiveRequest>) -> impl Responder {
    let archive_dir = resolve_archive_dir();
    if let Err(error) = std::fs::create_dir_all(&archive_dir) {
        return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(format!(
            "创建收藏目录失败: {}",
            error
        )));
    }

    let app = ArchiveApp {
        id: body.app_id.clone(),
        name: body.app_name.clone(),
        icon_url: body.icon_url.clone(),
        bundle_id: body.bundle_id.clone(),
        versions: body.versions.clone(),
        delisted: false,
        added_at: Utc::now().to_rfc3339(),
        added_by: "user".to_string(),
    };

    let file_path = archive_dir.join(format!("{}.json", app.id));
    match serde_json::to_string_pretty(&app) {
        Ok(json) => match std::fs::write(&file_path, json) {
            Ok(_) => HttpResponse::Ok().json(ApiResponse::success(app)),
            Err(error) => HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::error(format!("保存收藏失败: {}", error))),
        },
        Err(error) => HttpResponse::InternalServerError().json(ApiResponse::<()>::error(format!(
            "序列化收藏失败: {}",
            error
        ))),
    }
}

async fn remove_archive_app(path: web::Path<String>) -> impl Responder {
    let id = path.into_inner();
    let file_path = resolve_archive_dir().join(format!("{}.json", id));

    if file_path.exists() {
        if let Err(error) = std::fs::remove_file(&file_path) {
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::error(format!("取消收藏失败: {}", error)));
        }
    }

    HttpResponse::Ok().json(ApiResponse::success(true))
}

async fn get_delisted_apps() -> impl Responder {
    let client = Client::new();
    let url = "https://raw.githubusercontent.com/ruanrrn/ipa-archive/main/delisted.json";

    match client.get(url).send().await {
        Ok(resp) => match resp.json::<Value>().await {
            Ok(data) => HttpResponse::Ok().json(ApiResponse::success(data)),
            Err(_) => {
                HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({ "apps": [] })))
            }
        },
        Err(_) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({ "apps": [] }))),
    }
}

// 检查更新
async fn check_updates(data: web::Data<AppState>) -> impl Responder {
    match data.download_manager.check_app_updates().await {
        Ok(updates) => {
            let count: usize = updates.len();
            HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
                "updates": updates,
                "count": count
            })))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<String>::error(format!("检查更新失败: {}", e))),
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();

    // 初始化数据库
    let project_root = resolve_project_root();
    let data_dir = project_root.join("data");
    let downloads_dir = project_root.join("downloads");
    let db_path = data_dir.join("ipa-webtool.db");
    log::info!("Initializing database at: {}", db_path.display());
    std::fs::create_dir_all(&data_dir).ok();
    std::fs::create_dir_all(&downloads_dir).ok();
    let db = Database::new(db_path.to_string_lossy().as_ref()).unwrap_or_else(|e| {
        log::error!("Failed to initialize database: {}", e);
        panic!("Database initialization failed: {}", e);
    });

    // 将数据库包装在 Arc<Mutex<Database>> 中
    let db_arc = Arc::new(Mutex::new(db));

    // 初始化下载管理器
    let download_manager = Arc::new(DownloadManager::new(
        Arc::clone(&db_arc),
        downloads_dir.clone(),
    ));

    let app_state = web::Data::new(AppState {
        db: db_arc,
        download_manager: download_manager.clone(),
        job_store: JobStore::new(),
        downloads_dir,
    });

    let bind_address = "0.0.0.0:8080";
    log::info!("Starting server at {}", bind_address);

    HttpServer::new(move || {
        App::new()
            .app_data(web::JsonConfig::default().limit(4096))
            .app_data(app_state.clone())
            .route("/i/{token}.plist", web::get().to(plist_from_token))
            .service(
                web::scope("/api")
                    // 公开路由：管理员认证
                    .service(
                        web::scope("/auth")
                            .route("/login", web::post().to(admin_login))
                            .route("/logout", web::post().to(logout))
                            .route("/me", web::get().to(me))
                            .route("/change-password", web::post().to(change_password)),
                    )
                    // 公开 OTA / 下载路由（iOS 安装器不会携带后台登录 cookie）
                    .service(
                        web::scope("/public")
                            .route("/download-file", web::get().to(download_file))
                            .route("/manifest", web::get().to(get_manifest))
                            .route("/install", web::get().to(install))
                            .route("/download-records/{id}/file", web::get().to(download_record_file))
                            .route("/download-records/{id}/file", web::delete().to(cleanup_download_record_file))
                            .route("/ipa-files/{id}/download", web::get().to(download_ipa_file)),
                    )
                    // 公开归档数据（不依赖管理员登录）
                    .route("/archive/delisted", web::get().to(get_delisted_apps))
                    // 需要管理员认证的路由
                    .service(
                        web::scope("")
                            .wrap(from_fn(require_auth))
                            .route("/health", web::get().to(health))
                            .route("/login", web::post().to(apple_login))
                            .route("/accounts", web::get().to(get_account_list))
                            .route("/accounts/{token}", web::delete().to(delete_account))
                            .route("/credentials", web::get().to(get_credentials_list))
                            .route("/auto-login", web::post().to(auto_login_all))
                            .route("/login/refresh", web::post().to(refresh_login))
                            .route("/versions", web::get().to(get_versions))
                            .route("/download-url", web::get().to(get_download_url))
                            .route("/purchase-status", web::get().to(get_purchase_status))
                            .route("/claim", web::post().to(claim_app))
                            .route("/start-download-direct", web::post().to(start_download_direct))
                            .route("/progress-sse", web::get().to(progress_sse))
                            .route("/job-info", web::get().to(get_job_info))
                            .route("/download", web::post().to(download_ipa))
                            .route("/upload-ipa", web::post().to(upload_ipa))
                            .route("/search", web::get().to(search_app))
                            .route("/app-meta", web::get().to(app_meta))
                            .route("/batch-download", web::post().to(start_batch_download))
                            .route("/batch-tasks", web::get().to(get_batch_tasks))
                            .route("/batch-tasks/{id}", web::get().to(get_batch_task))
                            .route("/batch-tasks/{id}", web::delete().to(delete_batch_task))
                            .route("/download-records", web::get().to(get_download_records))
                            .route("/download-records", web::delete().to(clear_download_records))
                            .route("/download-records/{id}", web::delete().to(delete_download_record))
                            .route("/ipa-files", web::get().to(get_ipa_files))
                            .route("/ipa-files/{id}", web::delete().to(delete_ipa_file))
                            .route("/cleanup-downloads", web::post().to(cleanup_downloads))
                            .route("/subscriptions", web::get().to(get_subscriptions))
                            .route("/subscriptions", web::post().to(add_subscription))
                            .route("/subscriptions", web::delete().to(remove_subscription))
                            .route("/check-updates", web::get().to(check_updates))
                            .route("/archive", web::get().to(get_archive_apps))
                            .route("/archive", web::post().to(add_archive_app))
                            .route("/archive/{id}", web::delete().to(remove_archive_app)),
                    ),
            )
            // 托管前端静态文件
            .service(fs::Files::new("/", "./dist").index_file("index.html"))
    })
    .bind(bind_address)?
    .run()
    .await
}
