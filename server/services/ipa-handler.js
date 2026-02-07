import { promises as fsPromises, createWriteStream, createReadStream } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { SignatureClient } from './signature.js';

const CHUNK_SIZE = 5 * 1024 * 1024;
const MAX_CONCURRENT_DOWNLOADS = 10;
const MAX_RETRIES = 5;
const RETRY_DELAY = 3000;

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

export async function downipaWithAccount({ store, email, appid, appVerId, path: downloadPath='.', onProgress }){
  onProgress?.('auth', { message: '[auth] 查询下载信息' });
  const app = await store.downloadProduct(appid, appVerId, store._cookieUser);
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
  return { ok:true, file: outputFilePath };
}
