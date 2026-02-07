import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { AccountStore } from './src/client.js';
import { downipaWithAccount } from './src/ipa.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const accounts = new Map(); // token -> { email, store }
const jobs = new Map(); // jobId -> { status, progress, filePath, fileName, error, logs }

app.post('/api/login', async (req,res)=>{
  const { email, password, code } = req.body || {};
  if(!email||!password) return res.status(400).json({ ok:false, error:'缺少邮箱或密码' });
  try{
    const store = new AccountStore();
    const user = await store.authenticate(email, password, code);
    if(user._state !== 'success') return res.status(401).json({ ok:false, error:user.customerMessage || '登录失败' });
    store._cookieUser = user;
    const token = uuidv4();
    accounts.set(token, { email, store });
    return res.json({ ok:true, token, email, dsid: user.dsPersonId });
  }catch(e){ return res.status(500).json({ ok:false, error:e.message }); }
});

app.get('/api/versions', async (req,res)=>{
  const appid = req.query.appid; if(!appid) return res.status(400).json({ ok:false, error:'缺少 appid' });
  try{
    const url1 = `https://api.timbrd.com/apple/app-version/index.php?id=${encodeURIComponent(appid)}`;
    let resp = await fetch(url1); let json = await resp.json().catch(()=>null);
    if(!json || !Array.isArray(json.data)){
      const url2 = `https://apis.bilin.eu.org/history/${encodeURIComponent(appid)}`;
      resp = await fetch(url2); json = await resp.json().catch(()=>null);
    }
    if(!json || !Array.isArray(json.data)) return res.status(404).json({ ok:false, error:'未获取到版本数据' });
    const list = json.data.map(item=>({ bundle_version:String(item.bundle_version??item.version??''), external_identifier:Number(item.external_identifier??item.id??0), size:Number(item.size??0), created_at:String(item.created_at??item.date??'') })).filter(x=>x.bundle_version && x.external_identifier);
    return res.json({ ok:true, total:list.length, data:list });
  }catch(e){ return res.status(500).json({ ok:false, error:e.message }); }
});

// 直链：仅返回 Apple CDN URL 和文件名（不签名不落盘）
app.get('/api/download-url', async (req,res)=>{
  const { token, appid, appVerId } = req.query || {};
  if(!token||!appid) return res.status(400).json({ ok:false, error:'缺少 token 或 appid' });
  const acc = accounts.get(token); if(!acc) return res.status(401).json({ ok:false, error:'无效 token' });
  try{
    const meta = await acc.store.downloadProduct(appid, appVerId, acc.store._cookieUser);
    if(meta._state !== 'success') return res.status(400).json({ ok:false, error: meta.customerMessage || '下载信息获取失败' });
    const s0 = meta?.songList?.[0];
    const url = s0?.URL; const name = `${s0.metadata.bundleDisplayName}_${s0.metadata.bundleShortVersionString}.ipa`;
    return res.json({ ok:true, url, fileName:name });
  }catch(e){ return res.status(500).json({ ok:false, error:e.message }); }
});

// 创建“带进度+日志”的签名下载任务
app.post('/api/start-download-direct', async (req,res)=>{
  const { token, appid, appVerId } = req.body || {};
  if(!token||!appid) return res.status(400).json({ ok:false, error:'缺少 token 或 appid' });
  const acc = accounts.get(token); if(!acc) return res.status(401).json({ ok:false, error:'无效 token' });

  const jobId = uuidv4();
  const tmpDir = path.join(os.tmpdir(), 'ipa-webtool');
  await fs.promises.mkdir(tmpDir, { recursive:true });

  jobs.set(jobId, { status:'queued', progress:{ percent:0 }, filePath:null, fileName:null, error:null, logs:[] });
  res.json({ ok:true, jobId });

  (async()=>{
    const job = jobs.get(jobId); if(!job) return;
    job.status = 'running';
    const onProgress = (stage, payload)=>{
      const p = job.progress || {}; p.stage = stage; Object.assign(p, payload||{}); job.progress = p;
      if(payload?.message){
        const line = `[${new Date().toISOString()}] ${payload.message}`;
        job.logs.push(line);
      }
    };
    try{
      const result = await downipaWithAccount({ store: acc.store, email: acc.email, appid, appVerId, path: tmpDir, onProgress });
      if(!result?.ok){ job.status='failed'; job.error = result?.error || '下载失败'; return; }
      job.status='ready'; job.filePath = result.file; job.fileName = path.basename(result.file);
      job.logs.push(`[${new Date().toISOString()}] [ready] 文件已准备：${job.fileName}`);
    }catch(e){ job.status='failed'; job.error = e.message; job.logs.push(`[${new Date().toISOString()}] [error] ${e.message}`); }
  })();
});

// SSE：推送进度 + 增量日志；结束时发送 end 事件
app.get('/api/progress-sse', (req,res)=>{
  const { jobId } = req.query || {};
  const job = jobs.get(jobId);
  if(!job) return res.status(404).end('no job');

  res.writeHead(200, { 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache', 'Connection':'keep-alive' });
  let lastLogIndex = 0;
  const timer = setInterval(()=>{
    const j = jobs.get(jobId);
    // 进度快照
    res.write(`event: progress\n`);
    res.write(`data: ${JSON.stringify({ status:j?.status, progress:j?.progress, fileName:j?.fileName, error:j?.error })}\n\n`);
    // 增量日志
    if(Array.isArray(j?.logs) && j.logs.length > lastLogIndex){
      for(let i=lastLogIndex; i<j.logs.length; i++){
        res.write(`event: log\n`);
        res.write(`data: ${JSON.stringify({ line: j.logs[i] })}\n\n`);
      }
      lastLogIndex = j.logs.length;
    }
    // 结束
    if(!j || j.status==='failed' || j.status==='ready'){
      res.write(`event: end\n`);
      res.write(`data: ${JSON.stringify({ status: j?.status || 'unknown' })}\n\n`);
      clearInterval(timer);
    }
  }, 500);
  req.on('close', ()=> clearInterval(timer));
});

// 拉取签名结果
app.get('/api/download-file', (req,res)=>{
  const { jobId } = req.query || {};
  const job = jobs.get(jobId);
  if(!job) return res.status(404).send('job not found');
  if(job.status!=='ready' || !job.filePath) return res.status(400).send('not ready');
  res.setHeader('Content-Type','application/octet-stream');
  const name = job.fileName || path.basename(job.filePath);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  const s = fs.createReadStream(job.filePath);
  s.pipe(res);
  s.on('close', async ()=>{ try{ await fs.promises.unlink(job.filePath); }catch{} jobs.delete(jobId); });
  s.on('error', async (e)=>{ res.destroy(e); try{ await fs.promises.unlink(job.filePath);}catch{} jobs.delete(jobId); });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{ console.log(`Server started at http://localhost:${PORT}`); });
