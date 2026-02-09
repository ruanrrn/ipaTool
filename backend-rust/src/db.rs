use crate::error::{AppError, AppResult};
use crate::models::{Account, DownloadJob};
use chrono::Utc;
use sqlx::{sqlite::SqlitePool, Row};
use std::path::Path;

pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn new(path: &Path) -> Result<Self, sqlx::Error> {
        // 确保数据目录存在
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await.ok();
        }

        let connection_string = format!("sqlite:{}", path.display());
        let pool = SqlitePool::connect(&connection_string).await?;

        let db = Database { pool };
        db.init_schema().await?;
        Ok(db)
    }

    async fn init_schema(&self) -> Result<(), sqlx::Error> {
        // 创建 accounts 表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token TEXT UNIQUE NOT NULL,
                email TEXT NOT NULL,
                region TEXT DEFAULT 'US',
                guid TEXT,
                cookie_user TEXT,
                cookies TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        // 创建 credentials 表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS credentials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_encrypted TEXT NOT NULL,
                key_id TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        // 创建 encryption_keys 表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS encryption_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key_id TEXT UNIQUE NOT NULL,
                key_value TEXT NOT NULL,
                is_current BOOLEAN DEFAULT 0,
                last_rotation INTEGER NOT NULL,
                next_rotation INTEGER NOT NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        // 创建 download_jobs 表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS download_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT UNIQUE NOT NULL,
                status TEXT NOT NULL,
                progress REAL DEFAULT 0,
                file_path TEXT,
                file_name TEXT,
                error TEXT,
                logs TEXT,
                install_url TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    // 账号相关操作
    pub async fn save_account(&self, account: &Account) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO accounts 
            (token, email, region, guid, cookie_user, cookies, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&account.token)
        .bind(&account.email)
        .bind(&account.region)
        .bind(&account.guid)
        .bind(&account.cookie_user)
        .bind(&account.cookies)
        .bind(&account.created_at)
        .bind(&account.updated_at)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_account(&self, token: &str) -> AppResult<Option<Account>> {
        let row = sqlx::query("SELECT * FROM accounts WHERE token = ?")
            .bind(token)
            .fetch_optional(&self.pool)
            .await?;

        match row {
            Some(r) => Ok(Some(Account {
                token: r.try_get("token")?,
                email: r.try_get("email")?,
                region: r.try_get("region")?,
                guid: r.try_get("guid")?,
                cookie_user: r.try_get("cookie_user")?,
                cookies: r.try_get("cookies")?,
                created_at: r.try_get("created_at")?,
                updated_at: r.try_get("updated_at")?,
            })),
            None => Ok(None),
        }
    }

    pub async fn list_accounts(&self) -> AppResult<Vec<Account>> {
        let rows = sqlx::query("SELECT * FROM accounts ORDER BY created_at DESC")
            .fetch_all(&self.pool)
            .await?;

        let accounts = rows
            .iter()
            .map(|r| Account {
                token: r.try_get("token").unwrap_or_default(),
                email: r.try_get("email").unwrap_or_default(),
                region: r.try_get("region").unwrap_or_default(),
                guid: r.try_get("guid").unwrap_or_default(),
                cookie_user: r.try_get("cookie_user").unwrap_or_default(),
                cookies: r.try_get("cookies").unwrap_or_default(),
                created_at: r.try_get("created_at").unwrap_or_default(),
                updated_at: r.try_get("updated_at").unwrap_or_default(),
            })
            .collect();

        Ok(accounts)
    }

    pub async fn delete_account(&self, token: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM accounts WHERE token = ?")
            .bind(token)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // 凭证相关操作
    pub async fn save_credential(&self, email: &str, password_encrypted: &str, key_id: &str) -> AppResult<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO credentials 
            (email, password_encrypted, key_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(email)
        .bind(password_encrypted)
        .bind(key_id)
        .bind(&now)
        .bind(&now)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_credential(&self, email: &str) -> AppResult<Option<(String, String)>> {
        let row = sqlx::query("SELECT password_encrypted, key_id FROM credentials WHERE email = ?")
            .bind(email)
            .fetch_optional(&self.pool)
            .await?;

        match row {
            Some(r) => Ok(Some((
                r.try_get("password_encrypted")?,
                r.try_get("key_id")?,
            ))),
            None => Ok(None),
        }
    }

    // 加密密钥相关操作
    pub async fn get_current_encryption_key(&self) -> AppResult<Option<EncryptionKey>> {
        let row = sqlx::query("SELECT * FROM encryption_keys WHERE is_current = 1 ORDER BY id DESC LIMIT 1")
            .fetch_optional(&self.pool)
            .await?;

        match row {
            Some(r) => Ok(Some(EncryptionKey {
                key_id: r.try_get("key_id")?,
                key_value: r.try_get("key_value")?,
                is_current: r.try_get("is_current")?,
                last_rotation: r.try_get("last_rotation")?,
                next_rotation: r.try_get("next_rotation")?,
            })),
            None => Ok(None),
        }
    }

    pub async fn get_all_encryption_keys(&self) -> AppResult<Vec<EncryptionKey>> {
        let rows = sqlx::query("SELECT * FROM encryption_keys ORDER BY id DESC")
            .fetch_all(&self.pool)
            .await?;

        let keys = rows
            .iter()
            .map(|r| EncryptionKey {
                key_id: r.try_get("key_id").unwrap_or_default(),
                key_value: r.try_get("key_value").unwrap_or_default(),
                is_current: r.try_get("is_current").unwrap_or(false),
                last_rotation: r.try_get("last_rotation").unwrap_or(0),
                next_rotation: r.try_get("next_rotation").unwrap_or(0),
            })
            .collect();

        Ok(keys)
    }

    pub async fn save_encryption_key(
        &self,
        key_id: &str,
        key_value: &str,
        last_rotation: i64,
        next_rotation: i64,
    ) -> AppResult<()> {
        // 将所有旧密钥标记为非当前
        sqlx::query("UPDATE encryption_keys SET is_current = 0")
            .execute(&self.pool)
            .await?;

        // 插入新密钥
        sqlx::query(
            r#"
            INSERT INTO encryption_keys 
            (key_id, key_value, is_current, last_rotation, next_rotation)
            VALUES (?, ?, 1, ?, ?)
            "#,
        )
        .bind(key_id)
        .bind(key_value)
        .bind(last_rotation)
        .bind(next_rotation)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    // 下载任务相关操作
    pub async fn save_download_job(&self, job: &DownloadJob) -> AppResult<()> {
        let logs = serde_json::to_string(&job.logs)?;
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO download_jobs 
            (job_id, status, progress, file_path, file_name, error, logs, install_url, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&job.job_id)
        .bind(&job.status)
        .bind(job.progress)
        .bind(&job.file_path)
        .bind(&job.file_name)
        .bind(&job.error)
        .bind(logs)
        .bind(&job.install_url)
        .bind(&job.created_at)
        .bind(&job.updated_at)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_download_job(&self, job_id: &str) -> AppResult<Option<DownloadJob>> {
        let row = sqlx::query("SELECT * FROM download_jobs WHERE job_id = ?")
            .bind(job_id)
            .fetch_optional(&self.pool)
            .await?;

        match row {
            Some(r) => {
                let logs: Vec<String> = serde_json::from_str(r.try_get::<String, _>("logs").unwrap_or(&"[]".to_string()).as_str()).unwrap_or_default();
                Ok(Some(DownloadJob {
                    job_id: r.try_get("job_id")?,
                    status: r.try_get("status")?,
                    progress: r.try_get("progress")?,
                    file_path: r.try_get("file_path").ok(),
                    file_name: r.try_get("file_name").ok(),
                    error: r.try_get("error").ok(),
                    logs,
                    install_url: r.try_get("install_url").ok(),
                    created_at: r.try_get("created_at")?,
                    updated_at: r.try_get("updated_at")?,
                }))
            }
            None => Ok(None),
        }
    }

    pub async fn list_download_jobs(&self) -> AppResult<Vec<DownloadJob>> {
        let rows = sqlx::query("SELECT * FROM download_jobs ORDER BY created_at DESC")
            .fetch_all(&self.pool)
            .await?;

        let jobs = rows
            .iter()
            .map(|r| {
                let logs: Vec<String> = serde_json::from_str(r.try_get::<String, _>("logs").unwrap_or(&"[]".to_string()).as_str()).unwrap_or_default();
                DownloadJob {
                    job_id: r.try_get("job_id").unwrap_or_default(),
                    status: r.try_get("status").unwrap_or_default(),
                    progress: r.try_get("progress").unwrap_or(0.0),
                    file_path: r.try_get("file_path").ok(),
                    file_name: r.try_get("file_name").ok(),
                    error: r.try_get("error").ok(),
                    logs,
                    install_url: r.try_get("install_url").ok(),
                    created_at: r.try_get("created_at").unwrap_or_default(),
                    updated_at: r.try_get("updated_at").unwrap_or_default(),
                }
            })
            .collect();

        Ok(jobs)
    }
}

#[derive(Debug, Clone)]
pub struct EncryptionKey {
    pub key_id: String,
    pub key_value: String,
    pub is_current: bool,
    pub last_rotation: i64,
    pub next_rotation: i64,
}
