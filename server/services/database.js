/**
 * 纯内存数据库服务 - 适配 ESA Pages / Serverless 环境
 * 不依赖 SQLite3，所有数据存储在内存中
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 内存存储
let memoryStore = {
  accounts: [],
  credentials: [],
  encryption_keys: []
};

// 尝试从本地文件加载数据（仅开发环境）
const dataPath = path.join(__dirname, '..', 'data', 'ipa-webtool.json');

async function loadFromFile() {
  try {
    const data = await fs.readFile(dataPath, 'utf-8');
    memoryStore = JSON.parse(data);
    console.log('✅ Data loaded from file');
  } catch (error) {
    console.log('📝 No existing data file, starting with empty store');
    memoryStore = {
      accounts: [],
      credentials: [],
      encryption_keys: []
    };
  }
}

// 初始化时加载数据
await loadFromFile();

// 定期保存到文件（仅开发环境）
if (process.env.NODE_ENV !== 'production') {
  setInterval(async () => {
    try {
      await fs.mkdir(path.dirname(dataPath), { recursive: true });
      await fs.writeFile(dataPath, JSON.stringify(memoryStore, null, 2));
    } catch (error) {
      // 忽略保存错误
    }
  }, 30000);
}

const database = {
  // ========== 账户相关 ==========
  
  async getAccountByToken(token) {
    return memoryStore.accounts.find(acc => acc.token === token);
  },
  
  async getAccountByEmail(email) {
    return memoryStore.accounts.find(acc => acc.email === email);
  },
  
  async createAccount(accountData) {
    const newAccount = {
      id: Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...accountData
    };
    memoryStore.accounts.push(newAccount);
    return newAccount;
  },
  
  async updateAccount(token, updates) {
    const index = memoryStore.accounts.findIndex(acc => acc.token === token);
    if (index === -1) return null;
    
    memoryStore.accounts[index] = {
      ...memoryStore.accounts[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    return memoryStore.accounts[index];
  },
  
  async deleteAccount(token) {
    const index = memoryStore.accounts.findIndex(acc => acc.token === token);
    if (index === -1) return false;
    
    memoryStore.accounts.splice(index, 1);
    return true;
  },
  
  async getAllAccounts() {
    return memoryStore.accounts;
  },
  
  // ========== 凭证相关 ==========
  
  async getCredentialsByEmail(email) {
    return memoryStore.credentials.find(cred => cred.email === email);
  },
  
  async createCredentials(credData) {
    const newCred = {
      id: Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...credData
    };
    memoryStore.credentials.push(newCred);
    return newCred;
  },
  
  async updateCredentials(email, updates) {
    const index = memoryStore.credentials.findIndex(cred => cred.email === email);
    if (index === -1) return null;
    
    memoryStore.credentials[index] = {
      ...memoryStore.credentials[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    return memoryStore.credentials[index];
  },
  
  async deleteCredentials(email) {
    const index = memoryStore.credentials.findIndex(cred => cred.email === email);
    if (index === -1) return false;
    
    memoryStore.credentials.splice(index, 1);
    return true;
  },
  
  // ========== 加密密钥相关 ==========
  
  async getCurrentKey() {
    return memoryStore.encryption_keys.find(key => key.is_current);
  },
  
  async getKeyByKeyId(keyId) {
    return memoryStore.encryption_keys.find(key => key.key_id === keyId);
  },
  
  async createKey(keyData) {
    const newKey = {
      id: Date.now(),
      created_at: new Date().toISOString(),
      ...keyData
    };
    memoryStore.encryption_keys.push(newKey);
    return newKey;
  },
  
  async updateKey(keyId, updates) {
    const index = memoryStore.encryption_keys.findIndex(key => key.key_id === keyId);
    if (index === -1) return null;
    
    memoryStore.encryption_keys[index] = {
      ...memoryStore.encryption_keys[index],
      ...updates
    };
    return memoryStore.encryption_keys[index];
  },
  
  async setCurrentKey(keyId) {
    // 取消所有当前密钥
    memoryStore.encryption_keys.forEach(key => {
      key.is_current = false;
    });
    
    // 设置新的当前密钥
    const key = await this.getKeyByKeyId(keyId);
    if (key) {
      key.is_current = true;
      return key;
    }
    return null;
  },
  
  // ========== 工具函数 ==========
  
  async clearAll() {
    memoryStore = {
      accounts: [],
      credentials: [],
      encryption_keys: []
    };
  },
  
  // 导出数据（用于备份）
  async exportData() {
    return JSON.stringify(memoryStore, null, 2);
  },
  
  // 导入数据（用于恢复）
  async importData(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      memoryStore = data;
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }
};

export default database;
