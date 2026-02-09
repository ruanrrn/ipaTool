use crate::error::AppResult;
use crate::models::{StatusResponse, VerifyCodeRequest, LoginRequest, LoginResponse};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use serde_json::json;
use uuid::Uuid;

pub async fn login(
    State(state): State<crate::models::AppState>,
    Json(req): Json<LoginRequest>,
) -> AppResult<Json<LoginResponse>> {
    // TODO: 实现 Apple 认证逻辑
    // 这里需要调用 Apple 认证服务
    
    let token = Uuid::new_v4().to_string();
    
    Ok(Json(LoginResponse {
        ok: true,
        token: Some(token),
        error: None,
        needs_code: Some(false),
    }))
}

pub async fn verify_code(
    State(state): State<crate::models::AppState>,
    Json(req): Json<VerifyCodeRequest>,
) -> AppResult<Json<LoginResponse>> {
    // TODO: 实现验证码验证逻辑
    
    Ok(Json(LoginResponse {
        ok: true,
        token: Some(req.token),
        error: None,
        needs_code: Some(false),
    }))
}

pub async fn status(
    State(state): State<crate::models::AppState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<StatusResponse>> {
    let token = params.get("token").ok_or_else(|| {
        crate::error::AppError::BadRequest("缺少 token".to_string())
    })?;

    let account = state.db.get_account(token).await?;

    Ok(Json(StatusResponse {
        ok: true,
        authenticated: Some(account.is_some()),
        email: account.map(|a| a.email),
        region: account.map(|a| a.region),
    }))
}

pub async fn logout(
    State(state): State<crate::models::AppState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<serde_json::Value>> {
    let token = params.get("token").ok_or_else(|| {
        crate::error::AppError::BadRequest("缺少 token".to_string())
    })?;

    state.db.delete_account(token).await?;

    Ok(Json(json!({ "ok": true })))
}

pub async fn list_accounts(
    State(state): State<crate::models::AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let accounts = state.db.list_accounts().await?;
    
    Ok(Json(json!({
        "ok": true,
        "data": accounts
    })))
}

pub async fn get_account(
    State(state): State<crate::models::AppState>,
    Path(token): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let account = state.db.get_account(&token).await?
        .ok_or_else(|| crate::error::AppError::NotFound("账号不存在".to_string()))?;
    
    Ok(Json(json!({
        "ok": true,
        "data": account
    })))
}

pub async fn delete_account(
    State(state): State<crate::models::AppState>,
    Path(token): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    state.db.delete_account(&token).await?;
    
    Ok(Json(json!({ "ok": true })))
}
