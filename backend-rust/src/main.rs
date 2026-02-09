use anyhow::Result;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};
use tracing::{info, Level};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

mod api;
mod config;
mod crypto;
mod db;
mod error;
mod models;
mod services;

use api::{download, login, versions};
use config::Config;
use crypto::KeyManager;
use db::Database;

#[tokio::main]
async fn main() -> Result<()> {
    // 初始化日志
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(EnvFilter::builder().default_level(Level::INFO).from_env_lossy())
        .init();

    // 加载配置
    let config = Config::from_env()?;
    info!("配置加载成功");

    // 初始化数据库
    let db = Database::new(&config.database_path).await?;
    info!("数据库初始化成功");

    // 初始化密钥管理器
    let key_manager = KeyManager::new(db.clone()).await?;
    info!("密钥管理器初始化成功");

    // 构建应用状态
    let app_state = models::AppState {
        db: db.clone(),
        key_manager: key_manager.clone(),
        config: config.clone(),
    };

    // 构建 CORS 层
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // 构建路由
    let app = Router::new()
        // 健康检查
        .route("/health", get(health_check))
        .route("/api/health", get(health_check))
        // API 路由
        .route("/api/login", post(login::login))
        .route("/api/login/verify", post(login::verify_code))
        .route("/api/login/status", get(login::status))
        .route("/api/logout", post(login::logout))
        .route("/api/accounts", get(login::list_accounts))
        .route("/api/accounts/:token", get(login::get_account))
        .route("/api/accounts/:token", delete(login::delete_account))
        .route("/api/versions", get(versions::get_versions))
        .route("/api/download-url", get(download::get_download_url))
        .route("/api/download", post(download::download_ipa))
        .route("/api/download/:job_id", get(download::get_job_status))
        .route("/api/download/:job_id/cancel", post(download::cancel_job))
        .route("/api/downloads", get(download::list_downloads))
        .with_state(app_state)
        .layer(cors);

    // 启动服务器
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    let listener = TcpListener::bind(addr).await?;

    info!("🚀 服务器启动成功");
    info!("📋 地址: http://localhost:{}", config.port);
    info!("🔐 加密: 已启用 (密钥 ID: {})", key_manager.get_current_key_id().await);

    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> impl IntoResponse {
    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
        .body(serde_json::json!({
            "status": "OK",
            "timestamp": chrono::Utc::now().to_rfc3339()
        })
        .to_string())
        .unwrap()
}
