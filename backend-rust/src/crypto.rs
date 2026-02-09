use anyhow::Result;
use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use rand::Rng;

const KEY_ROTATION_INTERVAL: i64 = 30 * 24 * 60 * 60 * 1000; // 30天

pub struct KeyManager {
    db: crate::db::Database,
}

impl KeyManager {
    pub async fn new(db: crate::db::Database) -> Result<Self> {
        let manager = KeyManager { db };
        
        // 检查是否需要初始化密钥
        let current_key = manager.db.get_current_encryption_key().await?;
        if current_key.is_none() {
            manager.rotate_key().await?;
        }
        
        Ok(manager)
    }

    pub async fn get_current_key_id(&self) -> String {
        self.db
            .get_current_encryption_key()
            .await
            .ok()
            .flatten()
            .map(|k| k.key_id)
            .unwrap_or_default()
    }

    pub async fn encrypt(&self, plaintext: &str) -> Result<String> {
        let key_record = self
            .db
            .get_current_encryption_key()
            .await?
            .ok_or_else(|| anyhow::anyhow!("未找到加密密钥"))?;

        let key_bytes = hex::decode(&key_record.key_value)?;
        let key = Aes256Gcm::new_from_slice(&key_bytes)?;

        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let ciphertext = key
            .encrypt(&nonce, plaintext.as_bytes())
            .map_err(|e| anyhow::anyhow!("加密失败: {}", e))?;

        let mut result = nonce.to_vec();
        result.extend_from_slice(&ciphertext);

        Ok(base64::encode(&result))
    }

    pub async fn decrypt(&self, data: &str) -> Result<String> {
        // 尝试使用当前密钥解密
        if let Ok(plaintext) = self.decrypt_with_current_key(data).await {
            return Ok(plaintext);
        }

        // 尝试使用历史密钥解密
        let all_keys = self.db.get_all_encryption_keys().await?;
        for key_record in all_keys {
            if let Ok(plaintext) = self.decrypt_with_key(data, &key_record.key_value).await {
                return Ok(plaintext);
            }
        }

        Err(anyhow::anyhow!("解密失败"))
    }

    async fn decrypt_with_current_key(&self, data: &str) -> Result<String> {
        let key_record = self
            .db
            .get_current_encryption_key()
            .await?
            .ok_or_else(|| anyhow::anyhow!("未找到加密密钥"))?;
        self.decrypt_with_key(data, &key_record.key_value).await
    }

    async fn decrypt_with_key(&self, data: &str, key_hex: &str) -> Result<String> {
        let key_bytes = hex::decode(key_hex)?;
        let key = Aes256Gcm::new_from_slice(&key_bytes)?;

        let decoded = base64::decode(data)?;
        if decoded.len() < 12 {
            return Err(anyhow::anyhow!("无效的加密数据"));
        }

        let (nonce_bytes, ciphertext) = decoded.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        let plaintext = key
            .decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("解密失败: {}", e))?;

        String::from_utf8(plaintext).map_err(|e| anyhow::anyhow!("无效的 UTF-8: {}", e))
    }

    async fn rotate_key(&self) -> Result<()> {
        let key_id = self.generate_key_id();
        let key_value = self.generate_new_key();
        let now = chrono::Utc::now().timestamp_millis();
        let next_rotation = now + KEY_ROTATION_INTERVAL;

        self.db
            .save_encryption_key(&key_id, &key_value, now, next_rotation)
            .await?;

        Ok(())
    }

    fn generate_new_key(&self) -> String {
        let key = Aes256Gcm::generate_key(&mut OsRng);
        hex::encode(key.as_slice())
    }

    fn generate_key_id(&self) -> String {
        let mut rng = rand::thread_rng();
        let random: u64 = rng.gen();
        format!("key-{}-{:x}", chrono::Utc::now().timestamp_millis(), random)
    }
}
