import { promises as fsPromises, createWriteStream, createReadStream } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { SignatureClient } from './signature.js';
import { accounts } from '../api/login.js';

const CHUNK_SIZE = 5 * 1024 * 1024;
const MAX_CONCURRENT_DOWNLOADS = 10;
const MAX_RETRIES = 5;
const RETRY_DELAY = 3000;

/**
 * 检测错误是否由会话失效导致
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
    'not authenticated'
  ];
  
  return sessionErrorPatterns.some(pattern => errorMsg.includes(pattern));
}

async function downloadChunk({ url, start, end, output }){
  const headers = { Range: `bytes=${start}-${end}` };
  for(let attempt=0; attempt<MAX_RETRIES; attempt++){
    try{
      const response = await fetch(url, { headers });
      if(!response.ok) throw new Error(`无法获取区块: ${response.statusText}`);
      const fileStream = createWriteStream(output, { flags: 'a' });
      await new Promise((resolve, reject)=>{
        response.body.pipe(fileStream);
        response.body.on('error', reject);
        fileStream.on('finish', resolve);
      });
      return;
    }catch(error){
      if(attempt < MAX_RETRIES - 1){ await new Promise(r=>setTimeout(r, RETRY_DELAY)); } else { throw error; }
    }
  }
}

async function clearCache(cacheDir){
  try{
    const files = await fsPromises.readdir(cacheDir);
    for(const file of files){ await fsPromises.unlink(path.join(cacheDir, file)); }
  }catch(error){ if(error.code !== 'ENOENT'){ console.error(`无法清理缓存文件夹: ${error.message}`); } }
}

/**
 * 获取友好的 license 错误消息
 * @param {Object} result - Apple API 返回的结果对象
 * @returns {string} 用户友好的错误消息
 */
function getLicenseErrorMessage(result) {
  const customerMessage = result.customerMessage || '';
  const failureType = result.failureType || '';
  
  // 常见 license 错误映射
  const licenseErrorMap = {
    'license not found': '您尚未购买此应用，正在尝试免费获取...',
    'License not found': '您尚未购买此应用，正在尝试免费获取...',
    'not found': '未找到此应用，请检查 App ID 是否正确',
    'not purchased': '您尚未购买此应用',
    '未购买': '您尚未购买此应用',
    '未找到': '未找到此应用',
    'unauthorized': '无权下载此应用',
    'Unauthorized': '无权下载此应用',
    'invalid request': '无效的请求',
    'item not found': '未找到此应用',
    'Item not found': '未找到此应用',
    'store front mismatch': '账号区域与应用不匹配',
    'store front error': '账号区域错误，请切换账号区域',
  };
  
  // 检查 failureType 和 customerMessage
  const errorMsg = String(failureType || customerMessage || '').toLowerCase();
  
  for (const [key, message] of Object.entries(licenseErrorMap)) {
    if (errorMsg.includes(key.toLowerCase())) {
      return message;
    }
  }
  
  // 如果包含中文，直接返回
  if (/[\u4e00-\u9fa5]/.test(customerMessage)) {
    return customerMessage;
  }
  
  // 默认错误消息
  return customerMessage || '无法下载此应用，可能需要先购买';
}

export async function downipaWithAccount({ store, email, appid, appVerId, path: downloadPath='.', onProgress, autoPurchase=false, token=null }){
  onProgress?.('auth', { message: '[auth] 查询下载信息' });
  let app = await store.downloadProduct(appid, appVerId, store._cookieUser);
  
  // 检查是否是会话失效错误
  if (app._state !== 'success' && isSessionError(app)) {
    onProgress?.('auth', { message: '[session] 检测到会话失效，尝试刷新...' });
    
    if (token) {
      // 动态导入避免循环依赖
      const { refreshAccountSession } = await import('../api/login.js');
      const refreshResult = await refreshAccountSession(token);
      
      if (refreshResult.success) {
        onProgress?.('auth', { message: '[session] 会话刷新成功，重新查询下载信息' });
        store = refreshResult.store; // 使用新的 store
        app = await store.downloadProduct(appid, appVerId, store._cookieUser);
      } else {
        onProgress?.('auth', { message: `[session] 会话刷新失败: ${refreshResult.error}` });
        return { ok: false, error: `会话已失效且无法自动刷新：${refreshResult.error}`, needsReauth: true };
      }
    } else {
      return { ok: false, error: '会话已失效，请重新登录', needsReauth: true };
    }
  }
  
  // 检查是否需要购买 - 更全面的错误检测
  const errorMsg = String(app?.failureType || app?.customerMessage || app?.message || '').toLowerCase();
  const isLicenseError = /license|not found|未购买|未找到|未授权/i.test(errorMsg);
  
  if(app._state !== 'success' && isLicenseError) {
    if (autoPurchase) {
      onProgress?.('auth', { message: '[purchase] 正在购买应用...' });
      const licenseResult = await store.ensureLicense(appid, appVerId, store._cookieUser);
      if(licenseResult._state !== 'success') {
        // 优化错误消息
        const errorMsg = getLicenseErrorMessage(licenseResult);
        return { ok:false, error: errorMsg, needsPurchase: true };
      }
      onProgress?.('auth', { message: '[purchase] 购买成功，重新查询下载信息' });
      app = await store.downloadProduct(appid, appVerId, store._cookieUser);
      
      // 再次检查购买后的结果
      if(app._state !== 'success') {
        const errorMsg = getLicenseErrorMessage(app);
        return { ok:false, error: errorMsg, needsPurchase: true };
      }
    } else {
      const errorMsg = getLicenseErrorMessage(app);
      return { ok:false, error: errorMsg, needsPurchase: true };
    }
  }
  
  if(app._state !== 'success') return { ok:false, error: app.customerMessage };
  const songList0 = app?.songList?.[0];
  const fileURL = songList0.URL;

  await fsPromises.mkdir(downloadPath, { recursive:true });
  const outputFilePath = path.join(downloadPath, `${songList0.metadata.bundleDisplayName}_${songList0.metadata.bundleShortVersionString}.ipa`);
  const cacheDir = path.join(downloadPath, 'cache');
  await fsPromises.mkdir(cacheDir, { recursive:true });
  await clearCache(cacheDir);

  const resp = await fetch(fileURL);
  if(!resp.ok) throw new Error(`无法获取文件: ${resp.statusText}`);
  const fileSize = Number(resp.headers.get('content-length'));
  const numChunks = Math.ceil(fileSize / CHUNK_SIZE);
  onProgress?.('download-start', { fileSize, numChunks, message: `[download] 开始：${(fileSize/1024/1024).toFixed(2)}MB，分块=${numChunks}` });

  let downloaded = 0;
  const progress = new Array(numChunks).fill(0);
  const downloadQueue = [];

  for(let i=0;i<numChunks;i++){
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE - 1, fileSize - 1);
    const tempOutput = path.join(cacheDir, `part${i}`);
    downloadQueue.push(async ()=>{
      await downloadChunk({ url:fileURL, start, end, output: tempOutput });
      progress[i] = Math.min(CHUNK_SIZE, fileSize - start);
      downloaded = progress.reduce((a,b)=>a+b,0);
      onProgress?.('download-progress', {
        downloaded, fileSize,
        percent: Math.min(100, Math.round(downloaded/fileSize*100)),
        message: `[download] 进度 ${(downloaded/1024/1024).toFixed(2)}MB / ${(fileSize/1024/1024).toFixed(2)}MB`
      });
    });
  }
  for(let i=0;i<downloadQueue.length;i+=MAX_CONCURRENT_DOWNLOADS){
    await Promise.all(downloadQueue.slice(i,i+MAX_CONCURRENT_DOWNLOADS).map(fn=>fn()));
  }

  onProgress?.('merge', { message: '[merge] 合并分块...' });
  const finalFile = createWriteStream(outputFilePath);
  for(let i=0;i<numChunks;i++){
    const tempOutput = path.join(cacheDir, `part${i}`);
    const tempStream = createReadStream(tempOutput);
    tempStream.pipe(finalFile, { end:false });
    await new Promise((resolve)=> tempStream.on('end', resolve));
    await fsPromises.unlink(tempOutput);
  }
  finalFile.end();

  onProgress?.('sign', { message: '[sign] 写入签名...' });
  const sigClient = new SignatureClient(songList0, email);
  await sigClient.loadFile(outputFilePath);
  await sigClient.appendMetadata().appendSignature();
  await sigClient.write();

  await fsPromises.rmdir(cacheDir);
  onProgress?.('done', { file: outputFilePath, message: `[done] 产物：${outputFilePath}` });
  
  // 返回完整的元数据信息
  const metadata = {
    bundleDisplayName: songList0.metadata.bundleDisplayName,
    bundleShortVersionString: songList0.metadata.bundleShortVersionString,
    bundleId: songList0.metadata.bundleId,
    artworkUrl: songList0.metadata.artworkUrl60 || songList0.metadata.artworkUrl512 || songList0.metadata.artworkUrl100 || '',
    artistName: songList0.metadata.artistName
  };
  
  return { ok:true, file: outputFilePath, metadata };
}
