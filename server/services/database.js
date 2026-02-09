import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory name since we're using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'ipa-webtool.json');

// Create data directory if it doesn't exist (synchronous)
const dataDir = path.join(__dirname, '..', 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
  console.log('📁 创建数据目录:', dataDir);
}

// 尝试使用Better-SQLite3，如果失败则回退到JSON文件存储
let db = null;
let useSqlite = true;

try {
  // 尝试动态导入better-sqlite3
  const Database = (await import('better-sqlite3')).default;
  const sqliteDbPath = dbPath.replace('.json', '.db');
  console.log('🗄️  初始化 SQLite 数据库:', sqliteDbPath);
  const sqliteDb = new Database(sqliteDbPath);
  
  // 设置 WAL 模式以提高并发性能
  sqliteDb.exec('PRAGMA journal_mode = WAL;');
  sqliteDb.exec('PRAGMA foreign_keys = ON;');

  // 创建accounts表
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      region TEXT DEFAULT 'US',
      guid TEXT,
      cookie_user TEXT,
      cookies TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 检查并添加region字段（用于升级旧数据库）
  try {
    const columns = sqliteDb.prepare("PRAGMA table_info(accounts)").all();
    const hasRegion = columns.some(col => col.name === 'region');
    if (!hasRegion) {
      sqliteDb.exec('ALTER TABLE accounts ADD COLUMN region TEXT DEFAULT \"US\"');
      console.log('Added region column to accounts table');
    }
  } catch (error) {
    console.log('Note: Could not add region column (may already exist):', error.message);
  }

  // 创建credentials表
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_encrypted TEXT NOT NULL,
      key_id TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建encryption_keys表
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS encryption_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_id TEXT UNIQUE NOT NULL,
      key_value TEXT NOT NULL,
      is_current BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_rotation INTEGER NOT NULL,
      next_rotation INTEGER NOT NULL
    )
  `);

  // 验证 encryption_keys 表结构
  try {
    const keyTableInfo = sqliteDb.prepare("PRAGMA table_info(encryption_keys)").all();
    console.log('📋 encryption_keys 表结构:', keyTableInfo.map(col => ({ name: col.name, type: col.type, notnull: col.notnull })));
    
    // 检查是否有必需的列
    const requiredColumns = ['key_id', 'key_value', 'is_current', 'last_rotation', 'next_rotation'];
    const existingColumns = keyTableInfo.map(col => col.name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.error('❌ encryption_keys 表缺少必需的列:', missingColumns);
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }
  } catch (error) {
    console.error('❌ 验证表结构失败:', error);
  }

  // 创建download_records表
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS download_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_name TEXT NOT NULL,
      app_id TEXT NOT NULL,
      bundle_id TEXT,
      version TEXT,
      account_email TEXT NOT NULL,
      account_region TEXT,
      download_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'completed',
      file_size INTEGER,
      install_url TEXT,
      artwork_url TEXT,
      artist_name TEXT,
      progress INTEGER DEFAULT 0,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 检查并添加progress和error字段（用于升级旧数据库）
  try {
    const columns = sqliteDb.prepare("PRAGMA table_info(download_records)").all();
    const hasProgress = columns.some(col => col.name === 'progress');
    const hasError = columns.some(col => col.name === 'error');
    
    if (!hasProgress) {
      sqliteDb.exec('ALTER TABLE download_records ADD COLUMN progress INTEGER DEFAULT 0');
      console.log('Added progress column to download_records table');
    }
    if (!hasError) {
      sqliteDb.exec('ALTER TABLE download_records ADD COLUMN error TEXT');
      console.log('Added error column to download_records table');
    }
  } catch (error) {
    console.log('Note: Could not add progress/error columns (may already exist):', error.message);
  }

  db = sqliteDb;
  console.log('Better-SQLite3 database initialized successfully');
} catch (error) {
  console.warn('Failed to initialize Better-SQLite3 database, falling back to JSON file storage:', error.message);
  useSqlite = false;
  
  // 初始化JSON数据文件
  try {
    await fs.access(dbPath);
  } catch {
    await fs.writeFile(dbPath, JSON.stringify({ accounts: [], credentials: [], encryption_keys: [] }));
  }
}

// 定义数据库操作函数
const database = {
  // 获取所有账号
  async getAllAccounts() {
    if (useSqlite && db) {
      return db.prepare('SELECT * FROM accounts').all();
    } else {
      const data = await fs.readFile(dbPath, 'utf8');
      const jsonData = JSON.parse(data);
      return jsonData.accounts || [];
    }
  },

  // 根据token获取账号
  async getAccountByToken(token) {
    if (useSqlite && db) {
      return db.prepare('SELECT * FROM accounts WHERE token = ?').get(token);
    } else {
      const data = await fs.readFile(dbPath, 'utf8');
      const jsonData = JSON.parse(data);
      return (jsonData.accounts || []).find(acc => acc.token === token);
    }
  },

  // 保存账号
  async saveAccount(token, email, region, guid, cookieUser, cookies) {
    if (useSqlite && db) {
      const stmt = db.prepare(
        `INSERT OR REPLACE INTO accounts 
        (token, email, region, guid, cookie_user, cookies) 
        VALUES (?, ?, ?, ?, ?, ?)`
      );
      stmt.run(
        token,
        email,
        region || 'US',
        guid,
        JSON.stringify(cookieUser),
        JSON.stringify(cookies)
      );
    } else {
      const data = await fs.readFile(dbPath, 'utf8');
      const jsonData = JSON.parse(data);
      
      const existingIndex = (jsonData.accounts || []).findIndex(acc => acc.token === token);
      const account = {
        token,
        email,
        region: region || 'US',
        guid,
        cookie_user: JSON.stringify(cookieUser),
        cookies: JSON.stringify(cookies)
      };
      
      if (existingIndex !== -1) {
        jsonData.accounts[existingIndex] = account;
      } else {
        if (!jsonData.accounts) {
          jsonData.accounts = [];
        }
        jsonData.accounts.push(account);
      }
      
      await fs.writeFile(dbPath, JSON.stringify(jsonData, null, 2));
    }
  },

  // 删除账号
  async deleteAccount(token) {
    if (useSqlite && db) {
      const stmt = db.prepare('DELETE FROM accounts WHERE token = ?');
      stmt.run(token);
    } else {
      const data = await fs.readFile(dbPath, 'utf8');
      const jsonData = JSON.parse(data);
      
      jsonData.accounts = (jsonData.accounts || []).filter(acc => acc.token !== token);
      
      await fs.writeFile(dbPath, JSON.stringify(jsonData, null, 2));
    }
  },

  // 保存凭证
  async saveCredentials(email, passwordEncrypted, keyId, iv, authTag) {
    if (useSqlite && db) {
      const stmt = db.prepare(
        `INSERT OR REPLACE INTO credentials 
        (email, password_encrypted, key_id, iv, auth_tag) 
        VALUES (?, ?, ?, ?, ?)`
      );
      stmt.run(
        email,
        passwordEncrypted,
        keyId,
        iv,
        authTag
      );
    } else {
      const data = await fs.readFile(dbPath, 'utf8');
      const jsonData = JSON.parse(data);
      
      const existingIndex = (jsonData.credentials || []).findIndex(cred => cred.email === email);
      const credential = {
        email,
        password_encrypted: passwordEncrypted,
        key_id: keyId,
        iv,
        auth_tag: authTag
      };
      
      if (existingIndex !== -1) {
        jsonData.credentials[existingIndex] = credential;
      } else {
        if (!jsonData.credentials) {
          jsonData.credentials = [];
        }
        jsonData.credentials.push(credential);
      }
      
      await fs.writeFile(dbPath, JSON.stringify(jsonData, null, 2));
    }
  },

  // 删除凭证
  async deleteCredentials(email) {
    if (useSqlite && db) {
      const stmt = db.prepare('DELETE FROM credentials WHERE email = ?');
      stmt.run(email);
    } else {
      const data = await fs.readFile(dbPath, 'utf8');
      const jsonData = JSON.parse(data);
      
      jsonData.credentials = (jsonData.credentials || []).filter(cred => cred.email !== email);
      
      await fs.writeFile(dbPath, JSON.stringify(jsonData, null, 2));
    }
  },

  // 获取所有凭证
  async getAllCredentials() {
    if (useSqlite && db) {
      return db.prepare('SELECT * FROM credentials').all();
    } else {
      const data = await fs.readFile(dbPath, 'utf8');
      const jsonData = JSON.parse(data);
      return jsonData.credentials || [];
    }
  },

  // 获取单个凭证
  async getCredentials(email) {
    if (useSqlite && db) {
      const result = db.prepare('SELECT * FROM credentials WHERE email = ?').get(email);
      return result;
    } else {
      const data = await fs.readFile(dbPath, 'utf8');
      const jsonData = JSON.parse(data);
      return (jsonData.credentials || []).find(cred => cred.email === email);
    }
  },

  // 保存加密密钥
  async saveEncryptionKey(keyId, keyValue, isCurrent, lastRotation, nextRotation) {
    console.log('📝 保存加密密钥:', { keyId, isCurrent, lastRotation, nextRotation });
    
    if (useSqlite && db) {
      // 验证所有必需参数
      if (!keyId || keyValue === null || keyValue === undefined) {
        throw new Error('Missing required parameters for saveEncryptionKey');
      }
      
      // 先将所有密钥标记为非当前
      if (isCurrent) {
        db.exec('UPDATE encryption_keys SET is_current = FALSE WHERE is_current = TRUE');
      }
      
      try {
        const stmt = db.prepare(
          `INSERT OR REPLACE INTO encryption_keys 
          (key_id, key_value, is_current, last_rotation, next_rotation) 
          VALUES (?, ?, ?, ?, ?)`
        );
        stmt.run(
          keyId,
          keyValue,
          isCurrent ? 1 : 0,
          lastRotation,
          nextRotation
        );
        console.log('✅ 加密密钥保存成功');
      } catch (error) {
        console.error('❌ 保存加密密钥失败:', error);
        throw error;
      }
    } else {
      const data = await fs.readFile(dbPath, 'utf8');
      const jsonData = JSON.parse(data);
      
      if (!jsonData.encryption_keys) {
        jsonData.encryption_keys = [];
      }
      
      const existingIndex = jsonData.encryption_keys.findIndex(k => k.key_id === keyId);
      const key = {
        key_id: keyId,
        key_value: keyValue,
        is_current: isCurrent,
        last_rotation: lastRotation,
        next_rotation: nextRotation
      };
      
      if (existingIndex !== -1) {
        jsonData.encryption_keys[existingIndex] = key;
      } else {
        jsonData.encryption_keys.push(key);
      }
      
      await fs.writeFile(dbPath, JSON.stringify(jsonData, null, 2));
    }
  },

  // 获取当前加密密钥
  async getCurrentEncryptionKey() {
    if (useSqlite && db) {
      return db.prepare('SELECT * FROM encryption_keys WHERE is_current = TRUE').get();
    } else {
      const data = await fs.readFile(dbPath, 'utf8');
      const jsonData = JSON.parse(data);
      return (jsonData.encryption_keys || []).find(k => k.is_current);
    }
  },

  // ========== 下载记录相关操作 ==========

  // 添加下载记录
  async addDownloadRecord(record) {
    if (useSqlite && db) {
      const stmt = db.prepare(`
        INSERT INTO download_records 
        (app_name, app_id, bundle_id, version, account_email, account_region, status, file_size, install_url, artwork_url, artist_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        record.app_name,
        record.app_id,
        record.bundle_id || '',
        record.version || '',
        record.account_email,
        record.account_region || 'US',
        record.status || 'completed',
        record.file_size || 0,
        record.install_url || '',
        record.artwork_url || '',
        record.artist_name || ''
      );
      return { id: result.lastInsertRowid, ...record };
    } else {
      const data = await fs.readFile(dbPath, 'utf8');
      const jsonData = JSON.parse(data);
      
      if (!jsonData.download_records) {
        jsonData.download_records = [];
      }
      
      const newRecord = {
        id: Date.now(),
        ...record,
        download_date: new Date().toISOString()
      };
      
      jsonData.download_records.unshift(newRecord);
      await fs.writeFile(dbPath, JSON.stringify(jsonData, null, 2));
      return newRecord;
    }
  },

  // 获取所有下载记录
  async getAllDownloadRecords() {
    if (useSqlite && db) {
      return db.prepare('SELECT * FROM download_records ORDER BY download_date DESC').all();
    } else {
      const data = await fs.readFile(dbPath, 'utf8');
      const jsonData = JSON.parse(data);
      return (jsonData.download_records || []).sort((a, b) => 
        new Date(b.download_date) - new Date(a.download_date)
      );
    }
  },

  // 删除下载记录
  async deleteDownloadRecord(id) {
    if (useSqlite && db) {
      db.prepare('DELETE FROM download_records WHERE id = ?').run(id);
    } else {
      const data = await fs.readFile(dbPath, 'utf8');
      const jsonData = JSON.parse(data);
      jsonData.download_records = (jsonData.download_records || []).filter(r => r.id !== id);
      await fs.writeFile(dbPath, JSON.stringify(jsonData, null, 2));
    }
  },

  // 更新下载记录
  async updateDownloadRecord(id, updates) {
    if (useSqlite && db) {
      const fields = [];
      const values = [];

      for (const [key, value] of Object.entries(updates)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }

      if (fields.length > 0) {
        values.push(id);
        db.prepare(`UPDATE download_records SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }
    } else {
      const data = await fs.readFile(dbPath, 'utf8');
      const jsonData = JSON.parse(data);

      const index = (jsonData.download_records || []).findIndex(r => r.id === id);
      if (index >= 0) {
        jsonData.download_records[index] = { ...jsonData.download_records[index], ...updates };
        await fs.writeFile(dbPath, JSON.stringify(jsonData, null, 2));
      }
    }
  },

  // 清空所有下载记录
  async clearAllDownloadRecords() {
    if (useSqlite && db) {
      db.prepare('DELETE FROM download_records').run();
    } else {
      const data = await fs.readFile(dbPath, 'utf8');
      const jsonData = JSON.parse(data);
      jsonData.download_records = [];
      await fs.writeFile(dbPath, JSON.stringify(jsonData, null, 2));
    }
  },

  // 获取所有加密密钥
  async getAllEncryptionKeys() {
    if (useSqlite && db) {
      return db.prepare('SELECT * FROM encryption_keys ORDER BY created_at DESC').all();
    } else {
      const data = await fs.readFile(dbPath, 'utf8');
      const jsonData = JSON.parse(data);
      return jsonData.encryption_keys || [];
    }
  },

  // 获取当前加密密钥
  async getCurrentEncryptionKey() {
    if (useSqlite && db) {
      return db.prepare('SELECT * FROM encryption_keys WHERE is_current = 1').get();
    } else {
      const data = await fs.readFile(dbPath, 'utf8');
      const jsonData = JSON.parse(data);
      return (jsonData.encryption_keys || []).find(k => k.is_current === true);
    }
  },

  // 保存加密密钥
  async saveEncryptionKey(keyData) {
    if (useSqlite && db) {
      // 如果有新的当前密钥，将旧的设置为非当前
      if (keyData.is_current) {
        db.prepare('UPDATE encryption_keys SET is_current = 0').run();
      }
      
      db.prepare(`
        INSERT INTO encryption_keys (key_id, key_value, is_current, last_rotation, next_rotation)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        keyData.key_id,
        keyData.key_value,
        keyData.is_current ? 1 : 0,
        keyData.last_rotation,
        keyData.next_rotation
      );
    } else {
      const data = await fs.readFile(dbPath, 'utf8');
      const jsonData = JSON.parse(data);
      
      if (!jsonData.encryption_keys) {
        jsonData.encryption_keys = [];
      }
      
      // 如果有新的当前密钥，将旧的设置为非当前
      if (keyData.is_current) {
        jsonData.encryption_keys.forEach(k => k.is_current = false);
      }
      
      jsonData.encryption_keys.push(keyData);
      await fs.writeFile(dbPath, JSON.stringify(jsonData, null, 2));
    }
  }
};

export default database;