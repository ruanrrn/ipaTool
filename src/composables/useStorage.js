/**
 * IndexedDB 存储管理器
 * 用于在浏览器本地存储账户信息
 */

import { openDB } from 'idb';

const DB_NAME = 'ipa-webtool-db';
const DB_VERSION = 1;
const STORE_ACCOUNTS = 'accounts';
const STORE_PASSWORDS = 'passwords';

class StorageManager {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 创建账户存储
        if (!db.objectStoreNames.contains(STORE_ACCOUNTS)) {
          const accountStore = db.createObjectStore(STORE_ACCOUNTS, {
            keyPath: 'email'
          });
          accountStore.createIndex('email', 'email', { unique: true });
          accountStore.createIndex('region', 'region');
        }

        // 创建密码存储（单独存储，更安全）
        if (!db.objectStoreNames.contains(STORE_PASSWORDS)) {
          const passwordStore = db.createObjectStore(STORE_PASSWORDS, {
            keyPath: 'email'
          });
          passwordStore.createIndex('email', 'email', { unique: true });
        }
      }
    });

    return this.db;
  }

  // ========== 账户管理 ==========

  async getAllAccounts() {
    await this.init();
    return await this.db.getAll(STORE_ACCOUNTS);
  }

  async getAccount(email) {
    await this.init();
    return await this.db.get(STORE_ACCOUNTS, email);
  }

  async saveAccount(account) {
    await this.init();
    await this.db.put(STORE_ACCOUNTS, {
      ...account,
      updatedAt: Date.now()
    });
  }

  async deleteAccount(email) {
    await this.init();
    await this.db.delete(STORE_ACCOUNTS, email);
    await this.db.delete(STORE_PASSWORDS, email);
  }

  async updateAccount(email, updates) {
    await this.init();
    const account = await this.getAccount(email);
    if (account) {
      await this.saveAccount({ ...account, ...updates });
    }
  }

  // ========== 密码管理 ==========

  async savePassword(email, password) {
    await this.init();
    await this.db.put(STORE_PASSWORDS, {
      email,
      password,
      updatedAt: Date.now()
    });
  }

  async getPassword(email) {
    await this.init();
    const record = await this.db.get(STORE_PASSWORDS, email);
    return record ? record.password : null;
  }

  // ========== 批量操作 ==========

  async clearAll() {
    await this.init();
    await this.db.clear(STORE_ACCOUNTS);
    await this.db.clear(STORE_PASSWORDS);
  }

  async exportData() {
    await this.init();
    const accounts = await this.getAllAccounts();
    return {
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      accounts: accounts.map(acc => ({
        email: acc.email,
        region: acc.region,
        createdAt: acc.createdAt
      }))
    };
  }
}

// 创建单例实例
export const storage = new StorageManager();
