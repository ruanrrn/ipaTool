use anyhow::Result;
use serde::Deserialize;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub database_path: PathBuf,
    pub data_dir: PathBuf,
    pub temp_dir: PathBuf,
    pub max_file_size: usize,
    pub max_concurrent_downloads: usize,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let port = std::env::var("PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(8080);

        let data_dir = std::env::var("DATA_DIR")
            .ok()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("./data"));

        let database_path = data_dir.join("ipa-webtool.db");
        let temp_dir = std::env::temp_dir().join("ipa-uploads");

        let max_file_size = std::env::var("MAX_FILE_SIZE")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(2 * 1024 * 1024 * 1024); // 2GB

        let max_concurrent_downloads = std::env::var("MAX_CONCURRENT_DOWNLOADS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(10);

        Ok(Config {
            port,
            database_path,
            data_dir,
            temp_dir,
            max_file_size,
            max_concurrent_downloads,
        })
    }
}
