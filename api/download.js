/**
 * EdgeOne Pages / ESA Pages Serverless 函数
 * 完全无状态的下载 API
 * 只返回直链，不处理下载
 */

import { AccountStore } from '../server/services/apple-auth.js';

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

    // GET /api/download-url - 获取下载直链
    if (path === '/api/download-url' && req.method === 'GET') {
      const { appid, appVerId, region, cookieUser, cookies } = Object.fromEntries(url.searchParams);

      if (!appid || !region || !cookieUser || !cookies) {
        return res.json({ ok: false, error: '缺少必要参数' });
      }

      try {
        const store = new AccountStore(region);
        // 恢复会话
        store._cookieUser = cookieUser;
        store._cookies = cookies;

        // 获取下载信息
        const meta = await store.downloadProduct(appid, appVerId, cookieUser);

        if (meta._state !== 'success') {
          return res.json({
            ok: false,
            error: meta.customerMessage || '下载信息获取失败'
          });
        }

        const s0 = meta?.songList?.[0];
        const downloadUrl = s0?.URL;
        const fileName = `${s0.metadata.bundleDisplayName}_${s0.metadata.bundleShortVersionString}.ipa`;

        return res.json({
          ok: true,
          data: {
            url: downloadUrl,
            fileName: fileName,
            size: s0.metadata.size,
            bundleId: s0.metadata.bundleIdentifier,
            version: s0.metadata.bundleShortVersionString
          }
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
