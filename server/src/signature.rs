use std::fs::{File, OpenOptions};
use std::io::{Read, Write};
use plist::Value;
use zip::ZipArchive;
use serde::{Deserialize, Serialize};
use base64::Engine;
use plist;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureMetadata {
    pub bundle_display_name: Option<String>,
    pub bundle_short_version_string: Option<String>,
    pub bundle_id: Option<String>,
    pub artwork_url: Option<String>,
    pub artist_name: Option<String>,
    pub apple_id: Option<String>,
    pub user_name: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Sinf {
    pub id: i32,
    pub sinf: String,
}

#[derive(Debug, Clone)]
pub struct SignatureClient {
    archive: Vec<u8>,
    filename: String,
    metadata: SignatureMetadata,
    signature: Option<Sinf>,
    email: String,
}

impl SignatureClient {
    pub fn new(song_list_0: &serde_json::Value, email: &str) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let metadata = SignatureMetadata {
            bundle_display_name: song_list_0["metadata"]["bundleDisplayName"].as_str().map(|s| s.to_string()),
            bundle_short_version_string: song_list_0["metadata"]["bundleShortVersionString"].as_str().map(|s| s.to_string()),
            bundle_id: song_list_0["metadata"]["bundleId"].as_str().map(|s| s.to_string()),
            artwork_url: {
                let url_60 = song_list_0["metadata"]["artworkUrl60"].as_str();
                let url_512 = song_list_0["metadata"]["artworkUrl512"].as_str();
                let url_100 = song_list_0["metadata"]["artworkUrl100"].as_str();
                url_60.or(url_512).or(url_100).map(|s| s.to_string())
            },
            artist_name: song_list_0["metadata"]["artistName"].as_str().map(|s| s.to_string()),
            apple_id: Some(email.to_string()),
            user_name: Some(email.to_string()),
        };

        let signature = song_list_0["sinfs"]
            .as_array()
            .and_then(|sinfs| sinfs.iter().find(|s| s["id"].as_i64() == Some(0)))
            .map(|s| Sinf {
                id: 0,
                sinf: s["sinf"].as_str().unwrap_or("").to_string(),
            });

        if signature.is_none() {
            return Err("Invalid signature".into());
        }

        Ok(SignatureClient {
            archive: Vec::new(),
            filename: String::new(),
            metadata,
            signature,
            email: email.to_string(),
        })
    }

    pub fn load_file(&mut self, path: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut file = File::open(path)?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)?;
        self.archive = buffer;
        self.filename = path.to_string();
        Ok(())
    }

    pub fn append_metadata(&mut self) -> &mut Self {
        let mut dict = plist::Dictionary::new();
        if let Some(name) = &self.metadata.bundle_display_name {
            dict.insert("bundleDisplayName".to_string(), plist::Value::String(name.clone()));
        }
        if let Some(version) = &self.metadata.bundle_short_version_string {
            dict.insert("bundleShortVersionString".to_string(), plist::Value::String(version.clone()));
        }
        if let Some(bundle_id) = &self.metadata.bundle_id {
            dict.insert("bundleId".to_string(), plist::Value::String(bundle_id.clone()));
        }
        if let Some(artwork_url) = &self.metadata.artwork_url {
            dict.insert("artworkUrl".to_string(), plist::Value::String(artwork_url.clone()));
        }
        if let Some(artist_name) = &self.metadata.artist_name {
            dict.insert("artistName".to_string(), plist::Value::String(artist_name.clone()));
        }
        dict.insert("apple-id".to_string(), plist::Value::String(self.email.clone()));
        dict.insert("userName".to_string(), plist::Value::String(self.email.clone()));

        let metadata_plist = plist::Value::Dictionary(dict);
        let mut buf = Vec::new();
        let options = plist::XmlWriteOptions::default();
        plist::to_writer_xml_with_options(&mut buf, &metadata_plist, &options).map_err(|e| format!("Failed to serialize plist: {}", e)).unwrap();
        let metadata_content = String::from_utf8(buf).map_err(|e| format!("Invalid UTF-8: {}", e)).unwrap();
        
        let mut archive = zip::ZipWriter::new(std::io::Cursor::new(&mut self.archive));
        let options: zip::write::FileOptions<'_, ()> = zip::write::FileOptions::default();
        archive.start_file("iTunesMetadata.plist", options).unwrap();
        archive.write_all(metadata_content.as_bytes()).unwrap();
        let _ = archive.finish();
        
        self.archive.flush().unwrap();
        self
    }

    pub fn append_signature(&mut self) -> Result<&mut Self, Box<dyn std::error::Error + Send + Sync>> {
        let signature = match &self.signature {
            Some(s) => s,
            None => return Err("Invalid signature".into()),
        };

        let reader = std::io::Cursor::new(self.archive.clone());
        let mut zip = ZipArchive::new(reader)?;

        let app_bundle_name = {
            let mut name = None;
            for i in 0..zip.len() {
                let zip_name = zip.by_index(i)?.name().to_string();
                if zip_name.starts_with("Payload/") && zip_name.ends_with(".app/") {
                    name = Some(zip_name
                        .strip_prefix("Payload/")
                        .and_then(|s| s.strip_suffix('/'))
                        .unwrap_or(&zip_name)
                        .to_string());
                    break;
                }
            }
            name.ok_or("Could not find app bundle")?
        };

        let manifest_path = format!("{}/SC_Info/Manifest.plist", app_bundle_name);
        let manifest_content = {
            let mut manifest_file = zip.by_name(&manifest_path)?;
            let mut content = String::new();
            manifest_file.read_to_string(&mut content)?;
            content
        };

        let manifest: Value = plist::from_reader_xml(manifest_content.as_bytes()).unwrap_or_else(|_| Value::Dictionary(Default::default()));
        if manifest == Value::Dictionary(Default::default()) {
            return Err("Invalid manifest format".into());
        }
        
        let sinf_path = if let Value::Dictionary(dict) = &manifest {
            dict.get("SinfPaths")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .and_then(|v| v.as_string())
                .map(|s| s.to_string())
        } else {
            None
        }.ok_or("Invalid signature: no SinfPaths found")?;

        let signature_target_path = format!("Payload/{}.app/{}", app_bundle_name, sinf_path);
        let sinf_bytes = base64::engine::general_purpose::STANDARD.decode(&signature.sinf)?;

        let mut new_archive = zip::ZipWriter::new(std::io::Cursor::new(&mut self.archive));
        
        for i in 0..zip.len() {
            let mut file = zip.by_index(i)?;
            if file.name() == signature_target_path {
                continue;
            }
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)?;
            let options: zip::write::FileOptions<'_, ()> = zip::write::FileOptions::default();
            new_archive.start_file(file.name(), options)?;
            new_archive.write_all(&buffer)?;
        }

        let options: zip::write::FileOptions<'_, ()> = zip::write::FileOptions::default();
        new_archive.start_file(&signature_target_path, options)?;
        new_archive.write_all(&sinf_bytes)?;
        let _ = new_archive.finish();
        
        self.archive.flush().unwrap();
        Ok(self)
    }

    pub fn write(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut file = OpenOptions::new()
            .write(true)
            .truncate(true)
            .open(&self.filename)?;
        
        file.write_all(&self.archive)?;
        Ok(())
    }
}

pub fn read_zip(path: &str) -> Result<ZipArchive<std::fs::File>, Box<dyn std::error::Error + Send + Sync>> {
    let file = File::open(path)?;
    let zip = ZipArchive::new(file)?;
    Ok(zip)
}