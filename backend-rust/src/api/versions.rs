use crate::error::AppResult;
use crate::models::{VersionsResponse, VersionInfo};
use axum::{
    extract::State,
    response::Json,
};
use reqwest::Client;
use serde_json::Value;

pub async fn get_versions(
    State(state): State<crate::models::AppState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<VersionsResponse>> {
    let appid = params.get("appid").ok_or_else(|| {
        crate::error::AppError::BadRequest("缺少 appid".to_string())
    })?;
    
    let region = params.get("region").unwrap_or(&"US".to_string()).clone();

    let client = Client::new();
    
    // 尝试第一个 API
    let url1 = format!(
        "https://api.timbrd.com/apple/app-version/index.php?id={}&country={}",
        appid, region
    );
    
    let json = match try_fetch_api(&client, &url1).await {
        Some(data) => data,
        None => {
            // 尝试第二个 API
            let url2 = format!(
                "https://apis.bilin.eu.org/history/{}?country={}",
                appid, region
            );
            try_fetch_api(&client, &url2).await
                .ok_or_else(|| crate::error::AppError::NotFound("未获取到版本数据".to_string()))?
        }
    };

    let data = json.get("data")
        .and_then(|d| d.as_array())
        .ok_or_else(|| crate::error::AppError::NotFound("无效的响应数据".to_string()))?;

    let versions: Vec<VersionInfo> = data
        .iter()
        .filter_map(|item| {
            Some(VersionInfo {
                bundle_version: item.get("bundle_version")
                    .or(item.get("version"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                external_identifier: item.get("external_identifier")
                    .or(item.get("id"))
                    .and_then(|i| i.as_i64())
                    .unwrap_or(0),
                size: item.get("size")
                    .and_then(|s| s.as_i64())
                    .unwrap_or(0),
                created_at: item.get("created_at")
                    .or(item.get("date"))
                    .and_then(|d| d.as_str())
                    .unwrap_or("")
                    .to_string(),
            })
        })
        .filter(|v| !v.bundle_version.is_empty() && v.external_identifier > 0)
        .collect();

    Ok(Json(VersionsResponse {
        ok: true,
        total: versions.len(),
        data: versions,
        region,
    }))
}

async fn try_fetch_api(client: &Client, url: &str) -> Option<Value> {
    match client.get(url).send().await {
        Ok(resp) => {
            if let Ok(json) = resp.json::<Value>().await {
                if json.get("data").and_then(|d| d.as_array()).is_some() {
                    return Some(json);
                }
            }
            None
        }
        Err(_) => None,
    }
}
