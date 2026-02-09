import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { accounts } from './login.js';
import { downipaWithAccount } from '../services/ipa-handler.js';
import database from '../services/database.js';

const router = express.Router();

// 配置文件上传
const upload = multer({
  dest: path.join(os.tmpdir(), 'ipa-uploads'),
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB
  }
});

// 存储下载任务
const jobs = new Map(); // jobId -> { status, progress, filePath, fileName, error, logs, installUrl }

/**
 * 获取友好的 license 错误消息
 */
function getLicenseErrorMessage(result) {
  const customerMessage = result.customerMessage || '';
  const failureType = result.failureType || '';
  
  const licenseErrorMap = {
    'license not found': '您尚未购买此应用',
    'License not found': '您尚未购买此应用',
    'not found': '未找到此应用，请检查 App ID 是否正确',
    'not purchased': '您尚未购买此应用',
    '未购买': '您尚未购买此应用',
    '未找到': '未找到此应用',
    'unauthorized': '无权下载此应用',
    'Unauthorized': '无权下载此应用',
    'store front mismatch': '账号区域与应用不匹配',
    'store front error': '账号区域错误，请切换账号区域',
  };
  
  const errorMsg = String(failureType || customerMessage || '').toLowerCase();
  
  for (const [key, message] of Object.entries(licenseErrorMap)) {
    if (errorMsg.includes(key.toLowerCase())) {
      return message;
    }
  }
  
  if (/[\u4e00-\u9fa5]/.test(customerMessage)) {
    return customerMessage;
  }
  
  return customerMessage || '无法下载此应用，可能需要先购买';
}

// 获取直链
router.get('/download-url', async (req, res) => {
  const { token, appid, appVerId, autoPurchase } = req.query || {};
  
  if (!token || !appid) {
    return res.status(400).json({ ok: false, error: '缺少 token 或 appid' });
  }
  
  const acc = accounts.get(token);
  if (!acc) {
    return res.status(401).json({ ok: false, error: '无效 token' });
  }
  
  try {
    let meta = await acc.store.downloadProduct(appid, appVerId, acc.store._cookieUser);
    
    // 检查是否需要购买 - 更全面的错误检测
    const errorMsg = String(meta?.failureType || meta?.customerMessage || meta?.message || '').toLowerCase();
    const isLicenseError = /license|not found|未购买|未找到|未授权/i.test(errorMsg);
    
    if (meta._state !== 'success' && isLicenseError) {
      if (autoPurchase === 'true') {
        // 自动购买
        const licenseResult = await acc.store.ensureLicense(appid, appVerId, acc.store._cookieUser);
        if (licenseResult._state !== 'success') {
          const errorMsg = getLicenseErrorMessage(licenseResult);
          return res.status(400).json({ 
            ok: false, 
            needsPurchase: true,
            error: errorMsg 
          });
        }
        // 重新尝试下载
        meta = await acc.store.downloadProduct(appid, appVerId, acc.store._cookieUser);
        
        // 再次检查结果
        if (meta._state !== 'success') {
          const errorMsg = getLicenseErrorMessage(meta);
          return res.status(400).json({ 
            ok: false, 
            needsPurchase: true,
            error: errorMsg 
          });
        }
      } else {
        const errorMsg = getLicenseErrorMessage(meta);
        return res.status(400).json({ 
          ok: false, 
          needsPurchase: true,
          error: errorMsg 
        });
      }
    }
    
    if (meta._state !== 'success') {
      return res.status(400).json({ 
        ok: false, 
        error: meta.customerMessage || '下载信息获取失败' 
      });
    }
    
    const s0 = meta?.songList?.[0];
    const url = s0?.URL;
    // 使用与带进度模式相同的命名逻辑
    const name = `${s0.metadata.bundleDisplayName}_${s0.metadata.bundleShortVersionString}.ipa`;
    
    return res.json({ ok: true, url, fileName: name });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// 创建带进度的下载任务
router.post('/start-download-direct', async (req, res) => {
  const { token, appid, appVerId, autoPurchase } = req.body || {};
  
  if (!token || !appid) {
    return res.status(400).json({ ok: false, error: '缺少 token 或 appid' });
  }
  
  const acc = accounts.get(token);
  if (!acc) {
    return res.status(401).json({ ok: false, error: '无效 token' });
  }

  const jobId = uuidv4();
  const tmpDir = path.join(os.tmpdir(), 'ipa-webtool');
  await fs.promises.mkdir(tmpDir, { recursive: true });

  jobs.set(jobId, {
    status: 'queued',
    progress: { percent: 0 },
    filePath: null,
    fileName: null,
    error: null,
    logs: [],
    installUrl: null,
    appid: appid,
    appVerId: appVerId,
    accountEmail: acc.email,
    accountRegion: acc.region || 'US',
    downloadDate: new Date().toISOString()
  });

  res.json({ ok: true, jobId });

  // 立即创建下载记录到数据库
  let dbRecordId = null;
  try {
    const record = await database.addDownloadRecord({
      app_name: 'Downloading...',
      app_id: appid,
      bundle_id: '',
      version: '',
      account_email: acc.email,
      account_region: acc.region || 'US',
      status: 'downloading',
      file_size: 0,
      install_url: '',
      artwork_url: '',
      artist_name: ''
    });
    dbRecordId = record.id;
    jobs.set(jobId, { ...jobs.get(jobId), dbRecordId });
  } catch (dbError) {
    console.error('Failed to create download record:', dbError);
  }

  // 异步处理下载任务
  (async () => {
    const job = jobs.get(jobId);
    if (!job) return;

    job.status = 'running';

    const onProgress = (stage, payload) => {
      const p = job.progress || {};
      p.stage = stage;
      Object.assign(p, payload || {});
      job.progress = p;

      if (payload?.message) {
        const line = `[${new Date().toISOString()}] ${payload.message}`;
        job.logs.push(line);
      }

      // 实时更新数据库中的进度
      if (job.dbRecordId && payload?.percent !== undefined) {
        database.updateDownloadRecord(job.dbRecordId, {
          progress: payload.percent,
          status: stage === 'done' ? 'completed' : 'downloading'
        }).catch(err => console.error('Failed to update progress:', err));
      }
    };
    
    try {
      const result = await downipaWithAccount({ 
        store: acc.store, 
        email: acc.email, 
        appid, 
        appVerId, 
        path: tmpDir, 
        onProgress,
        autoPurchase: true,  // 自动尝试购买应用
        token: token  // 传递 token 用于会话刷新
      });
      
      if (!result?.ok) {
        job.status = 'failed';
        job.error = result?.error || '下载失败';

        // 更新数据库记录为失败状态
        if (job.dbRecordId) {
          database.updateDownloadRecord(job.dbRecordId, {
            status: 'failed',
            error: result?.error || '下载失败'
          }).catch(err => console.error('Failed to update failed status:', err));
        }

        return;
      }
      
      job.status = 'ready';
      job.filePath = result.file;
      job.fileName = path.basename(result.file);
      
      // 生成安装URL (itms-services协议)
      const manifestUrl = `http://${req.headers.host || 'localhost:8080'}/api/install-manifest?jobId=${jobId}`;
      job.installUrl = `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;
      
      job.logs.push(`[${new Date().toISOString()}] [ready] 文件已准备：${job.fileName}`);
      job.logs.push(`[${new Date().toISOString()}] [install] 安装链接已生成，点击即可安装`);

      // 更新数据库中的下载记录
      try {
        const stats = await fs.promises.stat(result.file);
        const updateData = {
          app_name: result.metadata?.bundleDisplayName || 'Unknown',
          bundle_id: result.metadata?.bundleId || '',
          version: result.metadata?.bundleShortVersionString || '',
          status: 'completed',
          file_size: stats.size,
          install_url: job.installUrl,
          artwork_url: result.metadata?.artworkUrl || '',
          artist_name: result.metadata?.artistName || '',
          progress: 100
        };

        if (job.dbRecordId) {
          await database.updateDownloadRecord(job.dbRecordId, updateData);
          job.logs.push(`[${new Date().toISOString()}] [record] 下载记录已更新`);
        } else {
          // 如果没有创建记录，现在创建
          const record = await database.addDownloadRecord({
            ...updateData,
            app_id: appid,
            account_email: acc.email,
            account_region: acc.region || 'US'
          });
          job.logs.push(`[${new Date().toISOString()}] [record] 下载记录已创建`);
        }
      } catch (dbError) {
        console.error('Failed to update download record:', dbError);
        job.logs.push(`[${new Date().toISOString()}] [warning] 更新下载记录失败`);
      }
    } catch (e) {
      job.status = 'failed';
      job.error = e.message;
      job.logs.push(`[${new Date().toISOString()}] [error] ${e.message}`);

      // 更新数据库记录为失败状态
      if (job.dbRecordId) {
        database.updateDownloadRecord(job.dbRecordId, {
          status: 'failed',
          error: e.message
        }).catch(err => console.error('Failed to update failed status:', err));
      }
    }
  })();
});

// SSE 进度推送
router.get('/progress-sse', (req, res) => {
  const { jobId } = req.query || {};
  const job = jobs.get(jobId);
  
  if (!job) {
    return res.status(404).end('no job');
  }

  res.writeHead(200, { 
    'Content-Type': 'text/event-stream', 
    'Cache-Control': 'no-cache', 
    'Connection': 'keep-alive' 
  });
  
  let lastLogIndex = 0;
  
  const timer = setInterval(() => {
    const j = jobs.get(jobId);
    
    // 进度快照
    res.write(`event: progress\n`);
    res.write(`data: ${JSON.stringify({ 
      status: j?.status, 
      progress: j?.progress, 
      fileName: j?.fileName, 
      error: j?.error 
    })}\n\n`);
    
    // 增量日志
    if (Array.isArray(j?.logs) && j.logs.length > lastLogIndex) {
      for (let i = lastLogIndex; i < j.logs.length; i++) {
        res.write(`event: log\n`);
        res.write(`data: ${JSON.stringify({ line: j.logs[i] })}\n\n`);
      }
      lastLogIndex = j.logs.length;
    }
    
    // 结束
    if (!j || j.status === 'failed' || j.status === 'ready') {
      res.write(`event: end\n`);
      res.write(`data: ${JSON.stringify({ status: j?.status || 'unknown' })}\n\n`);
      clearInterval(timer);
    }
  }, 500);
  
  req.on('close', () => clearInterval(timer));
});

// 下载签名后的文件
router.get('/download-file', (req, res) => {
  const { jobId } = req.query || {};
  const job = jobs.get(jobId);
  
  if (!job) {
    return res.status(404).send('job not found');
  }
  
  if (job.status !== 'ready' || !job.filePath) {
    return res.status(400).send('not ready');
  }
  
  res.setHeader('Content-Type', 'application/octet-stream');
  const name = job.fileName || path.basename(job.filePath);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  
  const s = fs.createReadStream(job.filePath);
  s.pipe(res);
  
  s.on('close', async () => {
    try { 
      await fs.promises.unlink(job.filePath); 
    } catch {}
    jobs.delete(jobId);
  });
  
  s.on('error', async (e) => {
    res.destroy(e);
    try { 
      await fs.promises.unlink(job.filePath);
    } catch {}
    jobs.delete(jobId);
  });
});

// 生成安装清单 (用于 itms-services 安装)
router.get('/install-manifest', async (req, res) => {
  const { jobId } = req.query || {};
  const job = jobs.get(jobId);
  
  if (!job || !job.filePath) {
    return res.status(404).json({ error: '任务不存在或文件未准备好' });
  }
  
  // 检查文件是否存在
  try {
    await fs.promises.access(job.filePath);
  } catch (e) {
    return res.status(404).json({ error: '文件不存在' });
  }
  
  // 生成下载URL
  const fileUrl = `http://${req.headers.host || 'localhost:8080'}/api/download-file?jobId=${jobId}`;
  
  // 生成manifest.plist
  const manifest = {
    items: [
      {
        assets: [
          {
            kind: 'software-package',
            url: fileUrl
          }
        ],
        metadata: {
          'bundle-identifier': 'com.example.app',
          'bundle-version': '1.0.0',
          title: job.fileName || 'Application'
        }
      }
    ]
  };
  
  res.setHeader('Content-Type', 'application/x-plist');
  res.setHeader('Content-Disposition', 'attachment; filename="manifest.plist"');
  res.send('<?xml version="1.0" encoding="UTF-8"?>\n' + 
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
    '<plist version="1.0">\n' +
    '<dict>\n' +
    '  <key>items</key>\n' +
    '  <array>\n' +
    '    <dict>\n' +
    '      <key>assets</key>\n' +
    '      <array>\n' +
    '        <dict>\n' +
    '          <key>kind</key>\n' +
    '          <string>software-package</string>\n' +
    '          <key>url</key>\n' +
    `          <string>${fileUrl}</string>\n` +
    '        </dict>\n' +
    '      </array>\n' +
    '      <key>metadata</key>\n' +
    '      <dict>\n' +
    '        <key>bundle-identifier</key>\n' +
    '        <string>com.example.app</string>\n' +
    '        <key>bundle-version</key>\n' +
    '        <string>1.0.0</string>\n' +
    '        <key>title</key>\n' +
    `        <string>${job.fileName || 'Application'}</string>\n` +
    '      </dict>\n' +
    '    </dict>\n' +
    '  </array>\n' +
    '</dict>\n' +
    '</plist>'
  );
});

// 获取任务信息（包括安装URL）
router.get('/job-info', (req, res) => {
  const { jobId } = req.query || {};
  const job = jobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ ok: false, error: '任务不存在' });
  }
  
  res.json({
    ok: true,
    data: {
      status: job.status,
      fileName: job.fileName,
      installUrl: job.installUrl
    }
  });
});

// 上传IPA文件并生成安装链接
router.post('/upload-ipa', upload.single('ipa'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: '未上传文件' });
  }
  
  // 验证文件扩展名
  if (!req.file.originalname.endsWith('.ipa')) {
    // 删除已上传的文件
    try {
      await fs.promises.unlink(req.file.path);
    } catch (e) {
      console.error('删除文件失败:', e);
    }
    return res.status(400).json({ ok: false, error: '只支持 .ipa 文件' });
  }
  
  try {
    // 创建上传目录
    const uploadDir = path.join(os.tmpdir(), 'ipa-uploads');
    await fs.promises.mkdir(uploadDir, { recursive: true });
    
    // 生成唯一的文件名
    const fileName = req.file.originalname;
    const uniqueFileName = `${Date.now()}-${fileName}`;
    const finalPath = path.join(uploadDir, uniqueFileName);
    
    // 移动文件到最终位置
    await fs.promises.rename(req.file.path, finalPath);
    
    // 生成jobId用于后续操作
    const jobId = uuidv4();
    
    // 生成安装URL
    const manifestUrl = `http://${req.headers.host || 'localhost:8080'}/api/install-manifest-upload?jobId=${jobId}`;
    const installUrl = `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;
    
    // 存储上传任务信息
    jobs.set(jobId, {
      status: 'ready',
      progress: { percent: 100 },
      filePath: finalPath,
      fileName: fileName,
      error: null,
      logs: [`[${new Date().toISOString()}] 文件上传成功：${fileName}`],
      installUrl: installUrl
    });
    
    res.json({ 
      ok: true, 
      jobId,
      fileName,
      installUrl
    });
  } catch (e) {
    // 清理上传的文件
    try {
      await fs.promises.unlink(req.file.path);
    } catch {}
    
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 上传文件的安装清单
router.get('/install-manifest-upload', async (req, res) => {
  const { jobId } = req.query || {};
  const job = jobs.get(jobId);
  
  if (!job || !job.filePath) {
    return res.status(404).json({ error: '任务不存在或文件未准备好' });
  }
  
  // 检查文件是否存在
  try {
    await fs.promises.access(job.filePath);
  } catch (e) {
    return res.status(404).json({ error: '文件不存在' });
  }
  
  // 生成下载URL
  const fileUrl = `http://${req.headers.host || 'localhost:8080'}/api/download-uploaded-file?jobId=${jobId}`;
  
  res.setHeader('Content-Type', 'application/x-plist');
  res.setHeader('Content-Disposition', 'attachment; filename="manifest.plist"');
  res.send('<?xml version="1.0" encoding="UTF-8"?>\n' + 
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
    '<plist version="1.0">\n' +
    '<dict>\n' +
    '  <key>items</key>\n' +
    '  <array>\n' +
    '    <dict>\n' +
    '      <key>assets</key>\n' +
    '      <array>\n' +
    '        <dict>\n' +
    '          <key>kind</key>\n' +
    '          <string>software-package</string>\n' +
    '          <key>url</key>\n' +
    `          <string>${fileUrl}</string>\n` +
    '        </dict>\n' +
    '      </array>\n' +
    '      <key>metadata</key>\n' +
    '      <dict>\n' +
    '        <key>bundle-identifier</key>\n' +
    '        <string>com.example.app</string>\n' +
    '        <key>bundle-version</key>\n' +
    '        <string>1.0.0</string>\n' +
    '        <key>title</key>\n' +
    `        <string>${job.fileName || 'Application'}</string>\n` +
    '      </dict>\n' +
    '    </dict>\n' +
    '  </array>\n' +
    '</dict>\n' +
    '</plist>'
  );
});

// 下载上传的文件
router.get('/download-uploaded-file', (req, res) => {
  const { jobId } = req.query || {};
  const job = jobs.get(jobId);
  
  if (!job) {
    return res.status(404).send('job not found');
  }
  
  if (job.status !== 'ready' || !job.filePath) {
    return res.status(400).send('not ready');
  }
  
  res.setHeader('Content-Type', 'application/octet-stream');
  const name = job.fileName || path.basename(job.filePath);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  
  const s = fs.createReadStream(job.filePath);
  s.pipe(res);
  
  s.on('close', async () => {
    try { 
      await fs.promises.unlink(job.filePath); 
    } catch {}
    jobs.delete(jobId);
  });
  
  s.on('error', async (e) => {
    res.destroy(e);
    try { 
      await fs.promises.unlink(job.filePath);
    } catch {}
    jobs.delete(jobId);
  });
});

// ========== 下载记录相关 API ==========

// 获取所有下载记录
router.get('/download-records', async (req, res) => {
  try {
    const records = await database.getAllDownloadRecords();
    res.json({ ok: true, data: records });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 添加下载记录
router.post('/download-records', async (req, res) => {
  try {
    const record = req.body;
    const result = await database.addDownloadRecord(record);
    res.json({ ok: true, data: result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 删除下载记录
router.delete('/download-records/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await database.deleteDownloadRecord(id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 清空所有下载记录
router.delete('/download-records', async (req, res) => {
  try {
    await database.clearAllDownloadRecords();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
