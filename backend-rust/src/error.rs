use axum::{
    http::StatusCode,
    response::{IntoResponse, Json, Response},
};
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("数据库错误: {0}")]
    Database(#[from] sqlx::Error),

    #[error("加密错误: {0}")]
    Crypto(String),

    #[error("认证失败: {0}")]
    Auth(String),

    #[error("下载错误: {0}")]
    Download(String),

    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),

    #[error("HTTP 错误: {0}")]
    Http(String),

    #[error("序列化错误: {0}")]
    Json(#[from] serde_json::Error),

    #[error("未找到: {0}")]
    NotFound(String),

    #[error("无效请求: {0}")]
    BadRequest(String),

    #[error("内部错误: {0}")]
    Internal(String),
}

#[derive(Serialize)]
struct ErrorResponse {
    ok: bool,
    error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    needs_purchase: Option<bool>,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_msg, needs_purchase) = match &self {
            AppError::Database(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("数据库错误: {}", e), None),
            AppError::Crypto(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("加密错误: {}", e), None),
            AppError::Auth(e) => (StatusCode::UNAUTHORIZED, e.clone(), None),
            AppError::Download(e) => {
                if e.contains("未购买") || e.contains("license") {
                    (StatusCode::BAD_REQUEST, e.clone(), Some(true))
                } else {
                    (StatusCode::BAD_REQUEST, e.clone(), None)
                }
            }
            AppError::NotFound(e) => (StatusCode::NOT_FOUND, e.clone(), None),
            AppError::BadRequest(e) => (StatusCode::BAD_REQUEST, e.clone(), None),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, "内部服务器错误".to_string(), None),
        };

        let body = Json(ErrorResponse {
            ok: false,
            error: error_msg,
            needs_purchase,
        });

        (status, body).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;
