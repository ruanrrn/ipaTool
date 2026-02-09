import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 密钥轮换周期（毫秒）- 默认30天
const KEY_ROTATION_INTERVAL = 30 * 24 * 60 * 60 * 1000; // 30天

class KeyManager {
  constructor() {
    this.currentKey = null;
    this.currentKeyId = null;
    this.lastRotation = null;
    this.nextRotation = null;
    this.previousKeys = new Map(); // 存储旧密钥用于解密历史数据
  }

  /**
   * 初始化密钥管理器
   * - 尝试从数据库加载现有密钥
   * - 如果没有找到，生成初始密钥
   */
  async init() {
    try {
      // 尝试从数据库加载现有密钥
      const currentKeyRecord = await db.getCurrentEncryptionKey();
      
      if (currentKeyRecord) {
        this.currentKey = currentKeyRecord.key_value;
        this.currentKeyId = currentKeyRecord.key_id;
        this.lastRotation = currentKeyRecord.last_rotation;
        this.nextRotation = currentKeyRecord.next_rotation;
        
        // 加载所有以前的密钥
        const allKeys = await db.getAllEncryptionKeys();
        allKeys.forEach(keyRecord => {
          if (!keyRecord.is_current) {
            this.previousKeys.set(keyRecord.key_id, keyRecord.key_value);
          }
        });
        
        console.log(`✅ 已加载加密密钥 (ID: ${this.currentKeyId})`);
        console.log(`📅 上次轮换: ${new Date(this.lastRotation).toLocaleString()}`);
        console.log(`⏰ 下次轮换: ${new Date(this.nextRotation).toLocaleString()}`);
      } else {
        // 生成初始密钥
        console.log('🔐 未找到现有密钥，正在生成初始密钥...');
        await this.rotateKey();
      }
    } catch (error) {
      console.error('❌ 密钥管理器初始化失败:', error.message);
      
      // 如果是数据库约束错误，尝试重置数据库
      if (error.code === 'SQLITE_CONSTRAINT_NOTNULL' || error.code === 'SQLITE_CONSTRAINT') {
        console.log('🔄 检测到数据库损坏，尝试重置...');
        try {
          await db.resetEncryptionKeys();
          console.log('✅ 数据库已重置，重新生成密钥...');
          await this.rotateKey();
        } catch (resetError) {
          console.error('❌ 数据库重置失败:', resetError);
          throw resetError;
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * 检查是否需要轮换密钥
   */
  needsRotation() {
    if (!this.nextRotation) return true;
    return Date.now() >= this.nextRotation;
  }

  /**
   * 生成新密钥
   */
  generateNewKey() {
    return crypto.randomBytes(32).toString('hex'); // 256位密钥
  }

  /**
   * 生成密钥ID
   */
  generateKeyId() {
    return `key-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * 执行密钥轮换
   * - 将当前密钥移动到历史密钥集合
   * - 生成新密钥
   * - 保存到数据库
   */
  async rotateKey() {
    console.log('🔄 开始密钥轮换流程...');
    
    // 将当前密钥移动到历史密钥集合
    if (this.currentKey) {
      this.previousKeys.set(this.currentKeyId, this.currentKey);
      console.log(`📦 已将旧密钥移至历史记录: ${this.currentKeyId}`);
    }

    // 生成新密钥
    this.currentKey = this.generateNewKey();
    this.currentKeyId = this.generateKeyId();
    this.lastRotation = Date.now();
    this.nextRotation = this.lastRotation + KEY_ROTATION_INTERVAL;

    console.log(`🔑 生成新密钥:`, {
      keyId: this.currentKeyId,
      keyLength: this.currentKey.length,
      lastRotation: this.lastRotation,
      nextRotation: this.nextRotation
    });

    // 保存到数据库
    try {
      await db.saveEncryptionKey(
        this.currentKeyId,
        this.currentKey,
        true, // 标记为当前密钥
        this.lastRotation,
        this.nextRotation
      );
    } catch (error) {
      console.error('❌ 密钥保存失败，回滚密钥状态:', error);
      this.currentKey = null;
      this.currentKeyId = null;
      throw error;
    }

    console.log(`🔐 首次运行，正在生成加密密钥...`);
    console.log(`✅ 新密钥已生成 (ID: ${this.currentKeyId})`);
    console.log(`⏰ 下次轮换时间: ${new Date(this.nextRotation).toLocaleString()}`);

    return {
      keyId: this.currentKeyId,
      key: this.currentKey,
      lastRotation: this.lastRotation,
      nextRotation: this.nextRotation
    };
  }

  /**
   * 生成密钥ID
   */
  generateKeyId() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `key-${timestamp}-${random}`;
  }


  /**
   * 获取当前密钥
   */
  getCurrentKey() {
    if (!this.currentKey) {
      throw new Error('Encryption key not initialized');
    }
    return this.currentKey;
  }

  /**
   * 获取当前密钥ID
   */
  getCurrentKeyId() {
    if (!this.currentKeyId) {
      throw new Error('Encryption key ID not initialized');
    }
    return this.currentKeyId;
  }

  /**
   * 获取所有可用密钥（当前+历史）
   */
  getAllKeys() {
    const allKeys = new Map(this.previousKeys);
    if (this.currentKey) {
      allKeys.set(this.currentKeyId, this.currentKey);
    }
    return allKeys;
  }

  /**
   * 获取密钥信息（用于日志）
   */
  getKeyInfo() {
    return {
      currentKeyId: this.currentKeyId,
      lastRotation: this.lastRotation ? new Date(this.lastRotation).toISOString() : null,
      nextRotation: this.nextRotation ? new Date(this.nextRotation).toISOString() : null,
      previousKeysCount: this.previousKeys.size
    };
  }

  /**
   * 手动触发密钥轮换（用于管理接口）
   */
  async manualRotate() {
    console.log('🔄 手动触发密钥轮换...');
    await this.rotateKey();
    return this.getKeyInfo();
  }
}

// 创建全局实例
export const keyManager = new KeyManager();

// 初始化密钥管理器
keyManager.init().catch(err => {
  console.error('Failed to initialize key manager:', err);
});
