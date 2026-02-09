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

/**
 * 检测错误是否由会话失效导致
 * @param {Object} result - API 返回结果
 * @returns {boolean} 是否为会话失效错误
 */
function isSessionError(result) {
  const errorMsg = String(
    result?.failureType || 
    result?.customerMessage || 
    result?.message || 
    ''
  ).toLowerCase();
  
  const sessionErrorPatterns = [
    'session expired',
    'session invalid',
    'invalid session',
    'unauthorized',
    'authentication failed',
    'token expired',
    'invalid token',
    'not authenticated',
    '登录失效',
    '会话过期',
    '未授权',
    '认证失败'
  ];
  
  return sessionErrorPatterns.some(pattern => errorMsg.includes(pattern));
}

/**
 * 将 Apple API 错误消息转换为用户友好的中文提示
 * @param {Object} user - Apple 认证返回的用户对象
 * @returns {string} 用户友好的错误消息
 */
function getFriendlyErrorMessage(user) {
  const customerMessage = user.customerMessage || '';
  const failureType = user.failureType || '';
  
  // 常见错误类型映射
  const errorMap = {
    // 密码相关错误
    'Invalid password': '密码错误，请检查后重试',
    'Incorrect password': '密码不正确，请重新输入',
    'Authentication failed': '认证失败，请检查邮箱和密码',
    
    // 验证码相关错误
    'Invalid code': '验证码错误，请重新输入',
    'Incorrect code': '验证码不正确',
    'Code expired': '验证码已过期，请重新获取',
    'Invalid verification code': '验证码无效',
    
    // 账号状态错误
    'Account disabled': '该账号已被禁用，请联系 Apple 支持',
    'Account locked': '账号已被锁定，请重置密码或联系 Apple 支持',
    'Account not found': '账号不存在，请检查邮箱地址',
    'This Apple ID has been disabled': '此 Apple ID 已被禁用',
    'Your Apple ID has been locked': '您的 Apple ID 已被锁定',
    
    // 二步验证相关
    'Two-step verification required': '需要二步验证，请输入验证码',
    'Two-factor authentication required': '需要双重认证，请在您的设备上确认',
    'Verification code required': '需要输入验证码',
    'Security code required': '需要输入安全码',
    
    // 会话相关
    'Session expired': '会话已过期，请重新登录',
    'Invalid session': '会话无效',
    'Session invalid': '会话已失效',
    
    // 网络相关
    'Network error': '网络连接失败，请检查网络设置',
    'Connection timeout': '连接超时，请稍后重试',
    'Service unavailable': 'Apple 服务暂时不可用，请稍后重试',
    
    // 频率限制
    'Too many attempts': '尝试次数过多，请稍后再试',
    'Rate limit exceeded': '请求过于频繁，请稍后再试',
    'Too many codes sent': '验证码发送次数过多，请稍后再试',
    
    // 设备信任
    'Device not trusted': '此设备不受信任，请在其他设备上登录以信任此设备',
    'New device detected': '检测到新设备，需要额外验证',
    
    // 服务器错误
    'Internal server error': 'Apple 服务器错误，请稍后重试',
    'Server error': '服务器错误，请稍后重试',
  };
  
  // 检查 failureType
  if (failureType) {
    const failureKey = failureType.toLowerCase();
    for (const [key, message] of Object.entries(errorMap)) {
      if (key.toLowerCase().includes(failureKey) || failureKey.includes(key.toLowerCase())) {
        return message;
      }
    }
  }
  
  // 检查 customerMessage
  if (customerMessage) {
    const msgLower = customerMessage.toLowerCase();
    for (const [key, message] of Object.entries(errorMap)) {
      if (msgLower.includes(key.toLowerCase())) {
        return message;
      }
    }
    
    // 如果包含中文，直接返回
    if (/[\u4e00-\u9fa5]/.test(customerMessage)) {
      return customerMessage;
    }
  }
  
  // 默认错误消息
  const defaultErrors = {
    'failure': '登录失败，请检查您的账号信息',
    'success': '登录成功',
  };
  
  return defaultErrors[user._state] || '登录失败，请稍后重试';
}

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
  // 检查响应中的区域信息 - Apple 可能返回多个字段
  if (user.countryCode) {
    return user.countryCode.toUpperCase();
  }
  
  if (user.country) {
    return user.country.toUpperCase();
  }
  
  // 检查 storeFront 信息
  if (user.storeFront) {
    // storeFront 可能是字符串格式的区域代码
    if (typeof user.storeFront === 'string' && user.storeFront.length <= 2) {
      return user.storeFront.toUpperCase();
    }
  }
  
  // 检查 storeFrontId
  if (user.storeFrontId) {
    // Apple StoreFront ID 映射
    const storefrontMap = {
      '143441': 'US',  // United States
      '143465': 'CN',  // China
      '143462': 'JP',  // Japan
      '143444': 'GB',  // United Kingdom
      '143443': 'DE',  // Germany
      '143448': 'FR',  // France
      '143445': 'IT',  // Italy
      '143447': 'ES',  // Spain
      '143446': 'CA',  // Canada
      '143461': 'AU',  // Australia
      '143463': 'KR',  // South Korea
      '143458': 'HK',  // Hong Kong
      '143459': 'SG',  // Singapore
      '143460': 'TW',  // Taiwan
      '143464': 'IN',  // India
      '143467': 'BR',  // Brazil
      '143468': 'MX',  // Mexico
      '143469': 'RU',  // Russia
      '143470': 'TR',  // Turkey
      '143471': 'SA',  // Saudi Arabia
      '143472': 'ZA',  // South Africa
      '143473': 'TH',  // Thailand
      '143474': 'MY',  // Malaysia
      '143475': 'ID',  // Indonesia
      '143476': 'PH',  // Philippines
      '143477': 'VN',  // Vietnam
      '143478': 'AE',  // United Arab Emirates
      '143479': 'AR',  // Argentina
      '143480': 'CO',  // Colombia
      '143481': 'CL',  // Chile
      '143482': 'PE',  // Peru
      '143483': 'NZ',  // New Zealand
      '143484': 'SE',  // Sweden
      '143485': 'NO',  // Norway
      '143486': 'DK',  // Denmark
      '143487': 'FI',  // Finland
      '143488': 'IE',  // Ireland
      '143489': 'AT',  // Austria
      '143490': 'BE',  // Belgium
      '143491': 'NL',  // Netherlands
      '143492': 'LU',  // Luxembourg
      '143493': 'CH',  // Switzerland
      '143494': 'PT',  // Portugal
      '143495': 'GR',  // Greece
      '143496': 'IS',  // Iceland
      '143497': 'CZ',  // Czech Republic
      '143498': 'PL',  // Poland
      '143499': 'HU',  // Hungary
      '143500': 'RO',  // Romania
      '143501': 'BG',  // Bulgaria
      '143502': 'HR',  // Croatia
      '143503': 'SK',  // Slovakia
      '143504': 'SI',  // Slovenia
      '143505': 'LT',  // Lithuania
      '143506': 'LV',  // Latvia
      '143507': 'EE',  // Estonia
      '143508': 'MT',  // Malta
      '143509': 'CY',  // Cyprus
      '143510': 'IL',  // Israel
      '143511': 'ZA',  // South Africa
      '143512': 'NG',  // Nigeria
      '143513': 'EG',  // Egypt
      '143514': 'KE',  // Kenya
      '143515': 'GH',  // Ghana
      '143516': 'TN',  // Tunisia
      '143517': 'MA',  // Morocco
      '143518': 'UA',  // Ukraine
      '143519': 'BY',  // Belarus
      '143520': 'KZ',  // Kazakhstan
      '143521': 'UZ',  // Uzbekistan
      '143522': 'AZ',  // Azerbaijan
      '143523': 'GE',  // Georgia
      '143524': 'AM',  // Armenia
      '143525': 'KG',  // Kyrgyzstan
      '143526': 'TJ',  // Tajikistan
      '143527': 'TM',  // Turkmenistan
      '143528': 'MN',  // Mongolia
      '143529': 'LK',  // Sri Lanka
      '143530': 'BD',  // Bangladesh
      '143531': 'NP',  // Nepal
      '143532': 'PK',  // Pakistan
      '143533': 'AF',  // Afghanistan
      '143534': 'IQ',  // Iraq
      '143535': 'SY',  // Syria
      '143536': 'JO',  // Jordan
      '143537': 'LB',  // Lebanon
      '143538': 'KW',  // Kuwait
      '143539': 'QA',  // Qatar
      '143540': 'BH',  // Bahrain
      '143541': 'OM',  // Oman
      '143542': 'YE',  // Yemen
      '143543': 'DZ',  // Algeria
      '143544': 'LY',  // Libya
      '143545': 'SD',  // Sudan
      '143546': 'ET',  // Ethiopia
      '143547': 'TZ',  // Tanzania
      '143548': 'UG',  // Uganda
      '143549': 'ZW',  // Zimbabwe
      '143550': 'ZM',  // Zambia
      '143551': 'MW',  // Malawi
      '143552': 'MO',  // Mozambique
      '143553': 'AO',  // Angola
      '143554': 'BW',  // Botswana
      '143555': 'NA',  // Namibia
      '143556': 'SZ',  // Swaziland
      '143557': 'LS',  // Lesotho
      '143558': 'MG',  // Madagascar
      '143559': 'MU',  // Mauritius
      '143560': 'SC',  // Seychelles
      '143561': 'CV',  // Cape Verde
      '143562': 'GW',  // Guinea-Bissau
      '143563': 'ST'   // Sao Tome and Principe
    };
    return storefrontMap[String(user.storeFrontId)] || 'US';
  }
  
  // 检查 dsPersonId 中的区域信息（有时包含在 ID 中）
  if (user.dsPersonId) {
    // dsPersonId 格式可能是 "123456789-cn" 或类似
    const match = String(user.dsPersonId).match(/-(\w{2})$/);
    if (match) {
      return match[1].toUpperCase();
    }
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

/**
 * 刷新账号会话（使用保存的凭证自动重新登录）
 * @param {string} token - 账号 token
 * @returns {Promise<Object>} 刷新结果
 */
async function refreshAccountSession(token) {
  const acc = accounts.get(token);
  if (!acc) {
    return { success: false, error: '账号不存在' };
  }
  
  try {
    // 尝试从数据库获取保存的凭证
    const credential = await db.getCredentials(acc.email);
    if (!credential) {
      return { success: false, error: '未找到保存的登录凭证，请重新登录' };
    }
    
    // 解密密码
    const password = decrypt(credential);
    
    // 创建新的 store 实例并重新认证
    const newStore = new AccountStore();
    const user = await newStore.authenticate(acc.email, password);
    
    if (user._state !== 'success') {
      const friendlyError = getFriendlyErrorMessage(user);
      return { success: false, error: friendlyError };
    }
    
    // 更新内存中的账号信息
    newStore._cookieUser = user;
    accounts.set(token, {
      email: acc.email,
      region: acc.region,
      store: newStore
    });
    
    // 更新数据库中的账号信息
    await saveAccountToDatabase(token, acc.email, acc.region, newStore);
    
    console.log(`Account ${acc.email} session refreshed successfully`);
    return { success: true, message: '账号会话已刷新', store: newStore };
    
  } catch (error) {
    console.error('Failed to refresh account session:', error);
    return { success: false, error: '刷新账号失败：' + error.message };
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

// 获取账号列表
router.get('/list', (req, res) => {
  const accountList = [];
  for (const [token, acc] of accounts) {
    accountList.push({
      token,
      email: acc.email,
      region: acc.region
    });
  }
  res.json({ ok: true, accounts: accountList });
});

// 刷新账号会话
router.post('/login/refresh', async (req, res) => {
  const { token } = req.body || {};
  
  if (!token) {
    return res.status(400).json({ ok: false, error: '缺少 token' });
  }
  
  const result = await refreshAccountSession(token);
  
  if (result.success) {
    return res.json({ ok: true, message: result.message });
  } else {
    return res.status(400).json({ ok: false, error: result.error });
  }
});

// 登录
router.post('/login', async (req, res) => {
  const { email, password, code, saveCredentials = false } = req.body || {};
  
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: '请输入邮箱和密码' });
  }

  try {
    const store = new AccountStore();
    const user = await store.authenticate(email, password, code);
    
    if (user._state !== 'success') {
      // 优化错误消息
      const friendlyError = getFriendlyErrorMessage(user);
      return res.status(401).json({ 
        ok: false, 
        error: friendlyError,
        originalError: user.customerMessage || user.failureType || 'UNKNOWN_ERROR'
      });
    }

    store._cookieUser = user;
    const token = uuidv4();
    
    // 自动检测区域
    let detectedRegion = detectRegionFromResponse(user);
    if (!detectedRegion) {
      detectedRegion = detectRegionFromEmail(email);
      console.log(`[Login] Account ${email} - Region detected from email: ${detectedRegion}`);
    } else {
      console.log(`[Login] Account ${email} - Region detected from Apple response: ${detectedRegion}`);
    }
    
    // 调试：记录响应中的关键字段
    console.log(`[Login] Response fields:`, {
      hasCountryCode: !!user.countryCode,
      hasCountry: !!user.country,
      hasStoreFront: !!user.storeFront,
      storeFrontId: user.storeFrontId,
      dsPersonId: user.dsPersonId
    });
    
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

// 获取所有保存的凭证（仅邮箱列表）
router.get('/credentials', async (req, res) => {
  try {
    const credentials = await db.getAllCredentials();
    // 只返回邮箱列表，不返回密码
    const emailList = credentials.map(cred => ({
      email: cred.email,
      created_at: cred.created_at
    }));
    return res.json({ ok: true, data: emailList });
  } catch (error) {
    console.error('Failed to get credentials:', error);
    return res.status(500).json({ ok: false, error: 'Failed to get credentials' });
  }
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
      // 优化错误消息
      const friendlyError = getFriendlyErrorMessage(user);
      return res.status(401).json({ 
        ok: false, 
        error: friendlyError,
        originalError: user.customerMessage || user.failureType || 'UNKNOWN_ERROR'
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