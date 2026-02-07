import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory name since we're using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'ipa-webtool.json');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '..', 'data');
if (!existsSync(dataDir)) {
  await fs.mkdir(dataDir, { recursive: true });
}

// 尝试使用Better-SQLite3，如果失败则回退到JSON文件存储
let db = null;
let useSqlite = true;

try {
  // 尝试动态导入better-sqlite3
  const Database = (await import('better-sqlite3')).default;
  const sqliteDb = new Database(dbPath.replace('.json', '.db'));
  
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

  // 保存加密密钥
  async saveEncryptionKey(keyId, keyValue, isCurrent, lastRotation, nextRotation) {
    if (useSqlite && db) {
      // 先将所有密钥标记为非当前
      if (isCurrent) {
        db.exec('UPDATE encryption_keys SET is_current = FALSE WHERE is_current = TRUE');
      }
      
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
      
      return (jsonData.encryption_keys || []).find(k => k.is_current === true);
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
  }
};

export default database;