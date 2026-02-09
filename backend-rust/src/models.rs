use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone)]
pub struct AppState {
    pub db: db::Database,
    pub key_manager: crypto::KeyManager,
    pub config: config::Config,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Account {
    pub token: String,
    pub email: String,
    pub region: String,
    pub guid: String,
    #[serde(skip)]
    pub cookie_user: String,
    #[serde(skip)]
    pub cookies: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadJob {
    pub job_id: String,
    pub status: String,
    pub progress: f64,
    pub file_path: Option<String>,
    pub file_name: Option<String>,
    pub error: Option<String>,
    pub logs: Vec<String>,
    pub install_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VersionInfo {
    pub bundle_version: String,
    pub external_identifier: i64,
    pub size: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VersionsResponse {
    pub ok: bool,
    pub total: usize,
    pub data: Vec<VersionInfo>,
    pub region: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadUrlResponse {
    pub ok: bool,
    pub url: Option<String>,
    pub error: Option<String>,
    pub needs_purchase: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    pub region: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VerifyCodeRequest {
    pub token: String,
    pub code: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub ok: bool,
    pub token: Option<String>,
    pub error: Option<String>,
    pub needs_code: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StatusResponse {
    pub ok: bool,
    pub authenticated: Option<bool>,
    pub email: Option<String>,
    pub region: Option<String>,
}
