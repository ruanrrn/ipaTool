/**
 * EdgeOne Pages / ESA Pages Serverless 函数
 * 完全无状态的登录 API
 * 不存储任何数据，所有数据由前端存储
 */

import { AccountStore } from '../server/services/apple-auth.js';

function detectRegionFromEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase() || '';

  if (domain.endsWith('.cn') ||
      ['qq.com', '163.com', '126.com', 'sina.com', 'sohu.com', 'aliyun.com', 'foxmail.com'].includes(domain)) {
    return 'CN';
  }

  return 'US';
}

export default async function handler(req, res) {
  // CORS 处理
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    // POST /api/login - 登录（无状态，返回所有必要信息）
    if (path === '/api/login' && req.method === 'POST') {
      const { email, password } = await req.json();

      if (!email || !password) {
        return res.json({ ok: false, error: '请提供邮箱和密码' });
      }

      const region = detectRegionFromEmail(email);
      const store = new AccountStore(region);

      try {
        const result = await store.login(email, password);

        if (!result.ok) {
          return res.json({ ok: false, error: result.error });
        }

        // 返回所有必要信息，前端存储到 IndexedDB
        return res.json({
          ok: true,
          data: {
            email,
            region,
            guid: result.guid,
            cookieUser: result.cookieUser,
            cookies: result.cookies,
          }
        });

      } catch (error) {
        return res.json({ ok: false, error: error.message });
      }
    }

    // POST /api/validate - 验证账户是否有效
    if (path === '/api/validate' && req.method === 'POST') {
      const { email, region, cookieUser, cookies } = await req.json();

      if (!email || !cookieUser || !cookies) {
        return res.json({ ok: false, error: '缺少必要参数' });
      }

      try {
        const store = new AccountStore(region);
        // 恢复会话
        store._cookieUser = cookieUser;
        store._cookies = cookies;

        // 尝试获取账户信息验证
        const account = await store.accountInfo(cookieUser);

        return res.json({
          ok: true,
          valid: !!account,
          data: account
        });

      } catch (error) {
        return res.json({ ok: false, valid: false, error: error.message });
      }
    }

    return res.json({ ok: false, error: 'API not found' }, { status: 404 });

  } catch (error) {
    console.error('API Error:', error);
    return res.json({ ok: false, error: error.message }, { status: 500 });
  }
}
