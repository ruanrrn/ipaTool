import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AccountStore } from '../services/apple-auth.js';
import { keyManager } from '../services/key-manager.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import db from '../services/database.js';

const router = express.Router();

// 存储账号信息（内存缓存）
const accounts = new Map(); // token -> { email, region, store }

const ALGORITHM = 'aes-256-gcm';

// 根据邮箱域名自动检测区域
function detectRegionFromEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  
  // 中国区邮箱域名
  if (domain.endsWith('.cn') || 
      ['qq.com', '163.com', '126.com', 'sina.com', 'sohu.com', 'aliyun.com', 'foxmail.com'].includes(domain)) {
    return 'CN';
  }
  
  // 日本区邮箱域名
  if (domain.endsWith('.jp') || 
      ['gmail.com', 'yahoo.co.jp', 'icloud.com'].some(d => domain.includes(d))) {
    // 需要进一步判断，暂时返回US
    return 'US';
  }
  
  // 默认美国区
  return 'US';
}

// 根据Apple ID响应获取区域信息
function detectRegionFromResponse(user) {
  // 检查响应中的区域信息
  if (user.countryCode) {
    return user.countryCode.toUpperCase();
  }
  
  // 检查storefront信息
  if (user.storeFrontId) {
    // 143441 = US, 143465 = CN, etc.
    const storefrontMap = {
      '143441': 'US',
      '143465': 'CN',
      '143462': 'JP',
      '143444': 'GB',
      '143443': 'DE',
      '143448': 'FR'
    };
    return storefrontMap[String(user.storeFrontId)] || 'US';
  }
  
  return null;
}

// 解密函数
function decrypt(encryptedData) {
  const key = Buffer.from(keyManager.getCurrentKey(), 'hex'); // 将十六进制字符串转换为Buffer
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(encryptedData.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(encryptedData.auth_tag, 'hex')); // 注意字段名已更正
  let decrypted = decipher.update(encryptedData.password_encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// 保存账号到数据库
async function saveAccountToDatabase(token, email, region, store) {
  try {
    // 序列化 cookieJar - 使用 toJSON 方法
    const cookies = store.cookieJar.toJSON ?
      store.cookieJar.toJSON() :
      await store.cookieJar.serialize();
    
    await db.saveAccount(
      token,
      email,
      region || 'US', // 默认为US区域
      store._guid,
      store._cookieUser,
      cookies
    );
  } catch (error) {
    console.error('Failed to save account to database:', error);
    throw error;
  }
}

// 从数据库删除账号
async function removeAccountFromDatabase(token) {
  try {
    await db.deleteAccount(token);
  } catch (error) {
    console.error('Failed to remove account from database:', error);
    throw error;
  }
}

// 保存加密凭证到数据库
async function saveCredentialsToDatabase(email, password) {
  try {
    const key = Buffer.from(keyManager.getCurrentKey(), 'hex'); // 将十六进制字符串转换为Buffer
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    await db.saveCredentials(
      email,
      encrypted,
      keyManager.getCurrentKeyId(),
      iv.toString('hex'),
      authTag.toString('hex')
    );
  } catch (error) {
    console.error('Failed to save credentials to database:', error);
    throw error;
  }
}

// 从数据库删除凭证
async function removeCredentialFromDatabase(email) {
  try {
    await db.deleteCredentials(email);
  } catch (error) {
    console.error('Failed to remove credential from database:', error);
    throw error;
  }
}

// 从数据库加载账号
async function loadAccountsFromDatabase() {
  try {
    const rows = await db.getAllAccounts();
    
    for (const row of rows) {
      const store = new AccountStore();
      store._guid = row.guid;
      store._cookieUser = typeof row.cookie_user === 'string' 
        ? JSON.parse(row.cookie_user) 
        : row.cookie_user;
      
      // 反序列化 cookieJar - 使用 syncLoadCookies 或 deserialize 方法
      try {
        const cookies = typeof row.cookies === 'string' 
          ? JSON.parse(row.cookies) 
          : row.cookies;
        if (typeof store.cookieJar.syncLoadCookies === 'function') {
          store.cookieJar.syncLoadCookies(cookies);
        } else if (typeof store.cookieJar.deserialize === 'function') {
          await store.cookieJar.deserialize(cookies);
        }
      } catch (err) {
        console.warn(`Failed to load cookies for ${row.email}:`, err.message);
        // 继续加载，只是cookies可能失效
      }
      
      accounts.set(row.token, {
        email: row.email,
        region: row.region,
        store
      });
    }
    
    console.log(`Loaded ${accounts.size} accounts from database`);
  } catch (error) {
    console.error('Failed to load accounts from database:', error);
  }
}

// 登录
router.post('/login', async (req, res) => {
  const { email, password, code, saveCredentials = false } = req.body || {};
  
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: '缺少邮箱或密码' });
  }

  try {
    const store = new AccountStore();
    const user = await store.authenticate(email, password, code);
    
    if (user._state !== 'success') {
      return res.status(401).json({ 
        ok: false, 
        error: user.customerMessage || '登录失败' 
      });
    }

    store._cookieUser = user;
    const token = uuidv4();
    
    // 自动检测区域
    let detectedRegion = detectRegionFromResponse(user);
    if (!detectedRegion) {
      detectedRegion = detectRegionFromEmail(email);
    }
    
    console.log(`[Login] Account ${email} detected region: ${detectedRegion}`);
    
    accounts.set(token, { email, region: detectedRegion, store });
    
    // 保存到数据库
    await saveAccountToDatabase(token, email, detectedRegion, store);
    
    // 如果需要保存凭证
    if (saveCredentials) {
      await saveCredentialsToDatabase(email, password);
    }
    
    return res.json({ 
      ok: true, 
      token, 
      email, 
      region: detectedRegion,
      dsid: user.dsPersonId 
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// 获取所有已登录账号列表
router.get('/accounts', async (req, res) => {
  const accountsList = [];
  for (const [token, data] of accounts.entries()) {
    accountsList.push({
      token,
      email: data.email,
      region: data.region || 'US',
      dsid: data.store._cookieUser?.dsPersonId
    });
  }
  return res.json({ ok: true, data: accountsList });
});

// 删除账号
router.delete('/accounts/:token', async (req, res) => {
  const { token } = req.params;
  if (accounts.has(token)) {
    const account = accounts.get(token);
    const email = account.email;
    
    accounts.delete(token);
    await removeAccountFromDatabase(token);
    
    // 同时删除保存的凭证
    try {
      await removeCredentialFromDatabase(email);
    } catch (error) {
      console.error('Failed to remove credentials:', error);
    }
    
    return res.json({ ok: true });
  }
  
  return res.status(404).json({ ok: false, error: 'Account not found' });
});

// 初始化：从数据库加载账号
loadAccountsFromDatabase();

// 自动登录 - 使用存储的凭证
router.post('/auto-login', async (req, res) => {
  const { email } = req.body || {};
  
  if (!email) {
    return res.status(400).json({ ok: false, error: '缺少邮箱' });
  }

  try {
    // 从数据库获取加密的凭证
    const credential = await db.getCredentialsByEmail(email);
    
    if (!credential) {
      return res.status(404).json({ ok: false, error: '未找到保存的凭证，请重新登录' });
    }
    
    // 解密密码
    const password = decrypt(credential);
    
    // 尝试登录
    const store = new AccountStore();
    const user = await store.authenticate(email, password);
    
    if (user._state !== 'success') {
      return res.status(401).json({ 
        ok: false, 
        error: user.customerMessage || '自动登录失败，可能需要重新验证' 
      });
    }

    store._cookieUser = user;
    const token = uuidv4();
    accounts.set(token, { email, region: 'US', store });
    
    // 更新数据库中的账号信息
    await saveAccountToDatabase(token, email, 'US', store);
    
    return res.json({ 
      ok: true, 
      token, 
      email, 
      dsid: user.dsPersonId 
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// 检查是否有保存的凭证
router.get('/has-credentials/:email', async (req, res) => {
  const { email } = req.params;
  
  try {
    const credential = await db.getCredentialsByEmail(email);
    return res.json({ ok: true, hasCredentials: !!credential });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export { router as loginRouter, accounts };