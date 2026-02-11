use std::collections::HashMap;
use std::sync::Mutex;
use rand::Rng;
use std::time::{SystemTime, UNIX_EPOCH};

const KEY_ROTATION_INTERVAL_MS: i64 = 30 * 24 * 60 * 60 * 1000;

pub struct KeyManager {
    current_key: Mutex<Option<String>>,
    current_key_id: Mutex<Option<String>>,
    last_rotation: Mutex<Option<i64>>,
    next_rotation: Mutex<Option<i64>>,
    previous_keys: Mutex<HashMap<String, String>>,
}

impl KeyManager {
    pub fn new() -> Self {
        Self {
            current_key: Mutex::new(None),
            current_key_id: Mutex::new(None),
            last_rotation: Mutex::new(None),
            next_rotation: Mutex::new(None),
            previous_keys: Mutex::new(HashMap::new()),
        }
    }

    pub fn init(&self) -> Result<(), Box<dyn std::error::Error>> {
        Ok(())
    }

    fn generate_new_key(&self) -> String {
        let key: [u8; 32] = rand::thread_rng().gen();
        hex::encode(key)
    }

    fn generate_key_id(&self) -> String {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;
        format!("key-{:x}-{}", timestamp, hex::encode(rand::thread_rng().gen::<[u8; 4]>()))
    }

    pub fn needs_rotation(&self) -> bool {
        let next_rotation = self.next_rotation.lock().unwrap();
        match *next_rotation {
            Some(ts) => SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis() as i64 > ts)
                .unwrap_or(false),
            None => true,
        }
    }

    pub fn rotate_key(&self) -> Result<KeyInfo, Box<dyn std::error::Error>> {
        let mut previous_keys = self.previous_keys.lock().unwrap();
        let mut current_key_id = self.current_key_id.lock().unwrap();

        if let Some(old_key_id) = &*current_key_id {
            let mut current_key = self.current_key.lock().unwrap();
            if let Some(old_key) = current_key.take() {
                previous_keys.insert(old_key_id.clone(), old_key);
            }
        }

        let new_key = self.generate_new_key();
        let new_key_id = self.generate_key_id();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_millis() as i64;
        let next = now + KEY_ROTATION_INTERVAL_MS;

        {
            let mut current_key = self.current_key.lock().unwrap();
            *current_key = Some(new_key.clone());
        }
        
        *current_key_id = Some(new_key_id.clone());

        {
            let mut last_rotation = self.last_rotation.lock().unwrap();
            *last_rotation = Some(now);
        }

        {
            let mut next_rotation = self.next_rotation.lock().unwrap();
            *next_rotation = Some(next);
        }

        Ok(KeyInfo {
            key_id: new_key_id,
            key: new_key,
            last_rotation: now,
            next_rotation: next,
        })
    }

    pub fn get_current_key(&self) -> Result<String, Box<dyn std::error::Error>> {
        let current_key = self.current_key.lock().unwrap();
        match &*current_key {
            Some(key) => Ok(key.clone()),
            None => Err("Encryption key not initialized".into()),
        }
    }

    pub fn get_current_key_id(&self) -> Result<String, Box<dyn std::error::Error>> {
        let current_key_id = self.current_key_id.lock().unwrap();
        match &*current_key_id {
            Some(key_id) => Ok(key_id.clone()),
            None => Err("Encryption key ID not initialized".into()),
        }
    }

    pub fn get_key_info(&self) -> KeyInfo {
        let current_key_id = self.current_key_id.lock().unwrap().clone();
        let current_key = self.current_key.lock().unwrap().clone();
        let last_rotation = *self.last_rotation.lock().unwrap();
        let next_rotation = *self.next_rotation.lock().unwrap();

        KeyInfo {
            key_id: current_key_id.unwrap_or_default(),
            key: current_key.unwrap_or_default(),
            last_rotation: last_rotation.unwrap_or(0),
            next_rotation: next_rotation.unwrap_or(0),
        }
    }

    pub fn manual_rotate(&self) -> Result<KeyInfo, Box<dyn std::error::Error>> {
        self.rotate_key()
    }
}

#[derive(Debug, Clone)]
pub struct KeyInfo {
    pub key_id: String,
    pub key: String,
    pub last_rotation: i64,
    pub next_rotation: i64,
}

impl Default for KeyManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_generation() {
        let manager = KeyManager::new();
        let key = manager.generate_new_key();
        assert_eq!(key.len(), 64);
    }

    #[test]
    fn test_key_id_generation() {
        let manager = KeyManager::new();
        let key_id = manager.generate_key_id();
        assert!(key_id.starts_with("key-"));
    }
}