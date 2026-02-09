// IPA 处理服务
// 处理 IPA 文件的下载、签名和打包

use anyhow::Result;
use reqwest::Client;
use tokio::fs::File;
use tokio::io::{AsyncWriteExt, BufWriter};
use tokio_util::io::StreamReader;

const CHUNK_SIZE: usize = 5 * 1024 * 1024; // 5MB
const MAX_RETRIES: u32 = 5;
const RETRY_DELAY: u64 = 3000; // 3秒

pub struct IpaHandler {
    client: Client,
}

impl IpaHandler {
    pub fn new() -> Self {
        IpaHandler {
            client: Client::new(),
        }
    }

    pub async fn download_ipa(&self, url: &str, output_path: &str) -> Result<f64> {
        let response = self.client.get(url).send().await?;

        let total_size = response.content_length().unwrap_or(0);
        let mut downloaded = 0u64;

        let file = File::create(output_path).await?;
        let mut writer = BufWriter::new(file);

        let mut stream = response.bytes_stream();
        use futures_util::StreamExt;

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result?;
            writer.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;

            if total_size > 0 {
                let progress = (downloaded as f64 / total_size as f64) * 100.0;
                return Ok(progress);
            }
        }

        writer.flush().await?;
        Ok(100.0)
    }

    pub async fn download_with_resume(
        &self,
        url: &str,
        output_path: &str,
        start: u64,
        end: Option<u64>,
    ) -> Result<()> {
        let range = if let Some(end) = end {
            format!("bytes={}-{}", start, end)
        } else {
            format!("bytes={}-", start)
        };

        let response = self
            .client
            .get(url)
            .header("Range", range)
            .send()
            .await?;

        let mut file = if start == 0 {
            File::create(output_path).await?
        } else {
            OpenOptions::new().append(true).open(output_path).await?
        };

        let mut stream = response.bytes_stream();
        use futures_util::StreamExt;

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result?;
            file.write_all(&chunk).await?;
        }

        Ok(())
    }
}

use tokio::fs::OpenOptions;
