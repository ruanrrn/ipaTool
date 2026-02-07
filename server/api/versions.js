import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// 查询版本
router.get('/versions', async (req, res) => {
  const appid = req.query.appid;
  const region = req.query.region || 'US'; // 默认使用US区域
  
  if (!appid) {
    return res.status(400).json({ ok: false, error: '缺少 appid' });
  }

  try {
    // 尝试第一个API（添加区域参数）
    const url1 = `https://api.timbrd.com/apple/app-version/index.php?id=${encodeURIComponent(appid)}&country=${encodeURIComponent(region)}`;
    let resp = await fetch(url1);
    let json = await resp.json().catch(() => null);
    
    // 如果第一个API失败，尝试第二个API（添加区域参数）
    if (!json || !Array.isArray(json.data)) {
      const url2 = `https://apis.bilin.eu.org/history/${encodeURIComponent(appid)}?country=${encodeURIComponent(region)}`;
      resp = await fetch(url2);
      json = await resp.json().catch(() => null);
    }
    
    if (!json || !Array.isArray(json.data)) {
      return res.status(404).json({ ok: false, error: '未获取到版本数据' });
    }
    
    const list = json.data.map(item => ({
      bundle_version: String(item.bundle_version ?? item.version ?? ''),
      external_identifier: Number(item.external_identifier ?? item.id ?? 0),
      size: Number(item.size ?? 0),
      created_at: String(item.created_at ?? item.date ?? '')
    })).filter(x => x.bundle_version && x.external_identifier);
    
    return res.json({ ok: true, total: list.length, data: list, region });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
