use crate::error::AppResult;
use crate::models::{DownloadJob, DownloadUrlResponse};
use axum::{
    extract::{Path, State},
    response::Json,
};
use serde_json::json;
use std::collections::HashMap;
use tokio::sync::Mutex;
use uuid::Uuid;

lazy_static::lazy_static! {
    static ref DOWNLOAD_JOBS: Mutex<HashMap<String, DownloadJob>> = Mutex::new(HashMap::new());
}

pub async fn get_download_url(
    State(state): State<crate::models::AppState>,
    axum::extract::Query(params): axum::extract::Query<HashMap<String, String>>,
) -> AppResult<Json<DownloadUrlResponse>> {
    let token = params.get("token").ok_or_else(|| {
        crate::error::AppError::BadRequest("缺少 token".to_string())
    })?;
    
    let appid = params.get("appid").ok_or_else(|| {
        crate::error::AppError::BadRequest("缺少 appid".to_string())
    })?;

    // 验证账号
    let _account = state.db.get_account(token).await?
        .ok_or_else(|| crate::error::AppError::Auth("无效的 token".to_string()))?;

    // TODO: 实现 Apple Store 下载逻辑
    // 这里需要调用 Apple Store API 获取下载链接
    
    Ok(Json(DownloadUrlResponse {
        ok: true,
        url: Some("https://example.com/download.ipa".to_string()),
        error: None,
        needs_purchase: Some(false),
    }))
}

pub async fn download_ipa(
    State(state): State<crate::models::AppState>,
    axum::extract::Query(params): axum::extract::Query<HashMap<String, String>>,
) -> AppResult<Json<serde_json::Value>> {
    let token = params.get("token").ok_or_else(|| {
        crate::error::AppError::BadRequest("缺少 token".to_string())
    })?;
    
    let url = params.get("url").ok_or_else(|| {
        crate::error::AppError::BadRequest("缺少 url".to_string())
    })?;

    // 验证账号
    let _account = state.db.get_account(token).await?
        .ok_or_else(|| crate::error::AppError::Auth("无效的 token".to_string()))?;

    let job_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let job = DownloadJob {
        job_id: job_id.clone(),
        status: "pending".to_string(),
        progress: 0.0,
        file_path: None,
        file_name: None,
        error: None,
        logs: vec!["开始下载任务".to_string()],
        install_url: None,
        created_at: now.clone(),
        updated_at: now,
    };

    // 保存到数据库
    state.db.save_download_job(&job).await?;
    
    // 保存到内存
    let mut jobs = DOWNLOAD_JOBS.lock().await;
    jobs.insert(job_id.clone(), job);

    // TODO: 启动异步下载任务
    // tokio::spawn(async move {
    //     start_download(job_id, url.to_string()).await;
    // });

    Ok(Json(json!({
        "ok": true,
        "jobId": job_id
    })))
}

pub async fn get_job_status(
    State(state): State<crate::models::AppState>,
    Path(job_id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let job = state.db.get_download_job(&job_id).await?
        .ok_or_else(|| crate::error::AppError::NotFound("任务不存在".to_string()))?;

    Ok(Json(json!({
        "ok": true,
        "data": job
    })))
}

pub async fn cancel_job(
    State(state): State<crate::models::AppState>,
    Path(job_id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let mut job = state.db.get_download_job(&job_id).await?
        .ok_or_else(|| crate::error::AppError::NotFound("任务不存在".to_string()))?;

    job.status = "cancelled".to_string();
    job.updated_at = chrono::Utc::now().to_rfc3339();

    state.db.save_download_job(&job).await?;

    let mut jobs = DOWNLOAD_JOBS.lock().await;
    jobs.insert(job_id.clone(), job);

    Ok(Json(json!({
        "ok": true,
        "message": "任务已取消"
    })))
}

pub async fn list_downloads(
    State(state): State<crate::models::AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let jobs = state.db.list_download_jobs().await?;

    Ok(Json(json!({
        "ok": true,
        "data": jobs
    })))
}
