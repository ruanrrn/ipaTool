/**
 * EdgeOne Pages / ESA Pages Serverless 函数
 * 完全无状态的版本搜索 API
 */

import { AccountStore } from '../server/services/apple-auth.js';

export default async function handler(req, res) {
  // CORS 处理
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    // GET /api/search - 搜索应用
    if (path === '/api/search' && req.method === 'GET') {
      const { term, region, cookieUser, cookies, limit = 50 } = Object.fromEntries(url.searchParams);

      if (!term || !region || !cookieUser || !cookies) {
        return res.json({ ok: false, error: '缺少必要参数' });
      }

      try {
        const store = new AccountStore(region);
        // 恢复会话
        store._cookieUser = cookieUser;
        store._cookies = cookies;

        // 搜索应用
        const results = await store.search(term, parseInt(limit));

        return res.json({
          ok: true,
          data: results
        });

      } catch (error) {
        return res.json({ ok: false, error: error.message });
      }
    }

    // GET /api/app/:appid - 获取应用详情
    if (path.startsWith('/api/app/') && req.method === 'GET') {
      const appid = path.split('/').pop();
      const { region, cookieUser, cookies } = Object.fromEntries(url.searchParams);

      if (!appid || !region || !cookieUser || !cookies) {
        return res.json({ ok: false, error: '缺少必要参数' });
      }

      try {
        const store = new AccountStore(region);
        // 恢复会话
        store._cookieUser = cookieUser;
        store._cookies = cookies;

        // 获取应用详情
        const app = await store.lookup(appid);

        return res.json({
          ok: true,
          data: app
        });

      } catch (error) {
        return res.json({ ok: false, error: error.message });
      }
    }

    return res.json({ ok: false, error: 'API not found' }, { status: 404 });

  } catch (error) {
    console.error('API Error:', error);
    return res.json({ ok: false, error: error.message }, { status: 500 });
  }
}
