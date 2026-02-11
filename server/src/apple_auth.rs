use reqwest::{header, Client};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthInfo {
    pub ds_person_id: Option<String>,
    pub password_token: Option<String>,
    pub display_name: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Store {
    pub client: Client,
    pub guid: String,
}

impl Store {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap();

        // 生成 GUID（使用 MAC 地址或随机 UUID）
        let guid = Self::generate_guid();

        Store { client, guid }
    }

    fn generate_guid() -> String {
        // 简单的 GUID 生成
        uuid::Uuid::new_v4()
            .to_string()
            .to_uppercase()
            .replace("-", "")
    }

    pub fn get_headers() -> header::HeaderMap {
        let mut headers = header::HeaderMap::new();
        headers.insert(
            "User-Agent",
            "Configurator/2.15 (Macintosh; OS X 11.0.0; 16G29) AppleWebKit/2603.3.8"
                .parse()
                .unwrap(),
        );
        headers.insert(
            "Content-Type",
            "application/x-www-form-urlencoded".parse().unwrap(),
        );
        headers
    }

    pub async fn authenticate(
        &self,
        email: &str,
        password: &str,
        mfa: Option<&str>,
    ) -> Result<HashMap<String, Value>, Box<dyn std::error::Error + Send + Sync>> {
        let url = format!(
            "https://auth.itunes.apple.com/auth/v1/native/fast?guid={}",
            self.guid
        );

        let mut auth_data = HashMap::new();
        auth_data.insert("appleId", Value::String(email.to_string()));
        auth_data.insert(
            "attempt",
            Value::Number(serde_json::Number::from(if mfa.is_some() { 2 } else { 4 })),
        );
        auth_data.insert("createSession", Value::String("true".to_string()));
        auth_data.insert("guid", Value::String(self.guid.clone()));
        auth_data.insert(
            "password",
            Value::String(format!("{}{}", password, mfa.unwrap_or(""))),
        );
        auth_data.insert("rmp", Value::Number(serde_json::Number::from(0)));
        auth_data.insert("why", Value::String("signIn".to_string()));

        // 将数据转换为 plist 格式（这里简化处理）
        let response = self
            .client
            .post(&url)
            .headers(Self::get_headers())
            .form(&auth_data)
            .send()
            .await?;

        let result: HashMap<String, Value> = response.json().await?;

        let mut final_result = result.clone();
        if result.contains_key("failureType") {
            final_result.insert("_state".to_string(), Value::String("failure".to_string()));
        } else {
            final_result.insert("_state".to_string(), Value::String("success".to_string()));
        }

        Ok(final_result)
    }

    pub async fn ensure_license(
        &self,
        app_identifier: &str,
        app_ver_id: Option<&str>,
        auth_info: &AuthInfo,
    ) -> Result<HashMap<String, Value>, Box<dyn std::error::Error + Send + Sync>> {
        let url = format!(
            "https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/buyProduct?guid={}",
            self.guid
        );

        let mut purchase_data = HashMap::new();
        purchase_data.insert("guid", Value::String(self.guid.clone()));
        purchase_data.insert("salableAdamId", Value::String(app_identifier.to_string()));
        if let Some(ver_id) = app_ver_id {
            purchase_data.insert("externalVersionId", Value::String(ver_id.to_string()));
            purchase_data.insert("appExtVrsId", Value::String(ver_id.to_string()));
        }
        purchase_data.insert("pricingParameters", Value::String("STDQ".to_string()));

        let mut headers = Self::get_headers();
        if let Some(ds_id) = &auth_info.ds_person_id {
            headers.insert("X-Dsid", ds_id.parse().unwrap());
            headers.insert("iCloud-DSID", ds_id.parse().unwrap());
        }
        if let Some(token) = &auth_info.password_token {
            headers.insert("X-Token", token.parse().unwrap());
        }

        let response = self
            .client
            .post(&url)
            .headers(headers)
            .form(&purchase_data)
            .send()
            .await?;

        let mut result: HashMap<String, Value> = response.json().await?;
        result.insert("_state".to_string(), Value::String("success".to_string()));
        Ok(result)
    }

    pub async fn download_product(
        &self,
        app_identifier: &str,
        app_ver_id: Option<&str>,
        auth_info: &AuthInfo,
    ) -> Result<HashMap<String, Value>, Box<dyn std::error::Error + Send + Sync>> {
        let url = format!(
            "https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/volumeStoreDownloadProduct?guid={}",
            self.guid
        );

        let mut download_data = HashMap::new();
        download_data.insert("creditDisplay", Value::String("".to_string()));
        download_data.insert("guid", Value::String(self.guid.clone()));
        download_data.insert("salableAdamId", Value::String(app_identifier.to_string()));
        if let Some(ver_id) = app_ver_id {
            download_data.insert("externalVersionId", Value::String(ver_id.to_string()));
        }

        let mut headers = Self::get_headers();
        if let Some(ds_id) = &auth_info.ds_person_id {
            headers.insert("X-Dsid", ds_id.parse().unwrap());
            headers.insert("iCloud-DSID", ds_id.parse().unwrap());
        }
        if let Some(token) = &auth_info.password_token {
            headers.insert("X-Token", token.parse().unwrap());
        }

        let response = self
            .client
            .post(&url)
            .headers(headers)
            .form(&download_data)
            .send()
            .await?;

        let mut result: HashMap<String, Value> = response.json().await?;
        result.insert("_state".to_string(), Value::String("success".to_string()));
        Ok(result)
    }
}

impl Default for Store {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone)]
pub struct AccountStore {
    pub store: Store,
    pub account_email: String,
    pub auth_info: Option<AuthInfo>,
}

impl AccountStore {
    pub fn new(email: &str) -> Self {
        AccountStore {
            store: Store::new(),
            account_email: email.to_string(),
            auth_info: None,
        }
    }

    pub async fn authenticate(
        &mut self,
        password: &str,
        mfa: Option<&str>,
    ) -> Result<HashMap<String, Value>, Box<dyn std::error::Error + Send + Sync>> {
        let result = self
            .store
            .authenticate(&self.account_email, password, mfa)
            .await?;

        // 提取认证信息
        if result.get("_state").and_then(|v| v.as_str()) == Some("success") {
            let auth_info = AuthInfo {
                ds_person_id: result
                    .get("dsPersonId")
                    .and_then(|v| v.as_str())
                    .map(String::from),
                password_token: result
                    .get("passwordToken")
                    .and_then(|v| v.as_str())
                    .map(String::from),
                display_name: result
                    .get("displayName")
                    .and_then(|v| v.as_str())
                    .map(String::from),
                email: Some(self.account_email.clone()),
            };
            self.auth_info = Some(auth_info);
        }

        Ok(result)
    }

    pub async fn download_product(
        &self,
        app_identifier: &str,
        app_ver_id: Option<&str>,
    ) -> Result<HashMap<String, Value>, Box<dyn std::error::Error + Send + Sync>> {
        let auth_info = self.auth_info.as_ref().ok_or("Not authenticated")?;
        self.store
            .download_product(app_identifier, app_ver_id, auth_info)
            .await
    }

    pub async fn ensure_license(
        &self,
        app_identifier: &str,
        app_ver_id: Option<&str>,
    ) -> Result<HashMap<String, Value>, Box<dyn std::error::Error + Send + Sync>> {
        let auth_info = self.auth_info.as_ref().ok_or("Not authenticated")?;
        self.store
            .ensure_license(app_identifier, app_ver_id, auth_info)
            .await
    }
}
