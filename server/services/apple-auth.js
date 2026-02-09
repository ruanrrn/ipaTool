import plist from 'plist';
import fetchCookie from 'fetch-cookie';
import nodeFetch from 'node-fetch';
import os from 'os';
import https from 'https';
import { v4 as uuidv4 } from 'uuid';

const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 20 });
function generateGuid(){
  try{
    const ifs = os.networkInterfaces?.() || {};
    for(const k of Object.keys(ifs)){
      for(const nic of ifs[k] || []){
        const mac = (nic.mac || '').toUpperCase();
        if(mac && mac !== '00:00:00:00:00:00' && mac !== 'FF:FF:FF:FF:FF:FF') return mac.replace(/:/g,'');
      }
    }
  }catch(_){ }
  return uuidv4().replace(/-/g,'').toUpperCase();
}
const RETRY_ERRORS = ['ECONNRESET','EPIPE','ETIMEDOUT'];
const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));
async function requestWithRetry(fetchImpl, url, init={}, retries=3, timeoutMs=25000){
  let last;
  for(let a=0; a<=retries; a++){
    const c = new AbortController();
    const to = setTimeout(()=>c.abort(), timeoutMs);
    try{
      const resp = await fetchImpl(url, { agent: keepAliveAgent, ...init, signal: c.signal });
      clearTimeout(to);
      if(resp.status >= 500 && a < retries){ await sleep(1000*(a+1)); continue; }
      return resp;
    }catch(err){
      clearTimeout(to);
      last = err;
      const msg = String(err?.message || '').toLowerCase();
      const code = err?.code;
      const retriable = msg.includes('socket hang up') || RETRY_ERRORS.includes(code);
      if(retriable && a < retries){ await sleep(1000*(a+1)); continue; }
      throw err;
    }
  }
  throw last;
}
async function postPlistWithRetry(fetchImpl, url, data, headers, retries=3){
  const body = plist.build(data);
  const resp = await requestWithRetry(fetchImpl, url, { method: 'POST', headers, body }, retries);
  const text = await resp.text();
  return plist.parse(text || '<plist></plist>');
}

/**
 * 从 Apple 认证响应中提取认证信息
 * Apple API 可能使用不同的字段名，这个函数会尝试所有可能的字段
 */
function extractAuthInfo(authResponse) {
  if (!authResponse) return null;
  
  // 尝试所有可能的 dsPersonId 字段名
  const dsPersonId = authResponse.dsPersonId || 
                     authResponse.dsPersonID || 
                     authResponse['ds-person-id'] ||
                     authResponse.dsid ||
                     authResponse.personId;
  
  // 尝试所有可能的 passwordToken 字段名
  const passwordToken = authResponse.passwordToken || 
                       authResponse.passwordTokenInfo ||
                       authResponse.tokenInfo?.passwordToken ||
                       authResponse.accountPassword ||
                       authResponse.authToken;
  
  // 其他可能的认证信息
  const displayName = authResponse.displayName;
  const email = authResponse.email || authResponse.appleId;
  
  const authInfo = { dsPersonId, passwordToken, displayName, email };
  
  // 调试：记录提取结果
  const foundFields = Object.entries(authInfo)
    .filter(([key, value]) => value != null)
    .map(([key]) => key);
  
  console.log('[extractAuthInfo] Extracted fields:', foundFields.join(', ') || 'none');
  
  return authInfo;
}

class Store{
  static get guid(){ if(!this._guid) this._guid = generateGuid(); return this._guid; }
  static get Headers(){ return { 'User-Agent':'Configurator/2.15 (Macintosh; OS X 11.0.0; 16G29) AppleWebKit/2603.3.8', 'Content-Type':'application/x-www-form-urlencoded' }; }
  static async authenticate(email, password, mfa){
    const data = { appleId: email, attempt: mfa?2:4, createSession: 'true', guid: this.guid, password: `${password}${mfa??''}`, rmp: 0, why: 'signIn' };
    const url = `https://auth.itunes.apple.com/auth/v1/native/fast?guid=${this.guid}`;
    const parsed = await postPlistWithRetry(this.fetch, url, data, this.Headers, 3);
    
    // 调试：记录认证返回的所有字段
    if (parsed && !parsed.failureType) {
      console.log('[Store.authenticate] Success - Fields:', {
        hasDsPersonId: !!parsed.dsPersonId,
        hasPasswordToken: !!parsed.passwordToken,
        hasDisplayName: !!parsed.displayName,
        hasAccountPassword: !!parsed.accountPassword,
        hasTokenInfo: !!parsed.tokenInfo,
        dsPersonId: parsed.dsPersonId,
        allKeys: Object.keys(parsed)
      });
    }
    
    return { ...parsed, _state: parsed.hasOwnProperty('failureType') ? 'failure' : 'success' };
  }
  static async ensureLicense(appIdentifier, appVerId, Cookie){
    const url = `https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/buyProduct?guid=${this.guid}`;
    const data = { guid: this.guid, salableAdamId: appIdentifier, ...(appVerId && { externalVersionId: appVerId, appExtVrsId: appVerId }), pricingParameters: 'STDQ' };
    
    // 使用辅助函数提取认证信息
    const authInfo = extractAuthInfo(Cookie);
    
    // 调试：记录传递的认证信息
    console.log('[Store.ensureLicense] Cookie info:', {
      hasDsPersonId: !!authInfo?.dsPersonId,
      hasPasswordToken: !!authInfo?.passwordToken,
      dsPersonId: authInfo?.dsPersonId,
      originalCookieKeys: Cookie ? Object.keys(Cookie) : 'null'
    });
    
    const headers = { 
      ...this.Headers, 
      'X-Dsid': authInfo?.dsPersonId, 
      'iCloud-DSID': authInfo?.dsPersonId, 
      ...(authInfo?.passwordToken ? { 'X-Token': authInfo.passwordToken } : {}) 
    };
    return await postPlistWithRetry(this.fetch, url, data, headers, 3);
  }
  static async downloadProduct(appIdentifier, appVerId, Cookie){
    const url = `https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/volumeStoreDownloadProduct?guid=${this.guid}`;
    const data = { creditDisplay: '', guid: this.guid, salableAdamId: appIdentifier, ...(appVerId && { externalVersionId: appVerId }) };
    
    // 使用辅助函数提取认证信息
    const authInfo = extractAuthInfo(Cookie);
    
    // 调试：记录传递的认证信息
    console.log('[Store.downloadProduct] Cookie info:', {
      hasDsPersonId: !!authInfo?.dsPersonId,
      hasPasswordToken: !!authInfo?.passwordToken,
      dsPersonId: authInfo?.dsPersonId,
      originalCookieKeys: Cookie ? Object.keys(Cookie) : 'null'
    });
    
    const headers = { 
      ...this.Headers, 
      'X-Dsid': authInfo?.dsPersonId, 
      'iCloud-DSID': authInfo?.dsPersonId, 
      ...(authInfo?.passwordToken ? { 'X-Token': authInfo.passwordToken } : {}) 
    };
    let parsed = await postPlistWithRetry(this.fetch, url, data, headers, 3);
    
    // 调试：记录下载结果
    console.log('[Store.downloadProduct] Result:', {
      hasFailureType: !!parsed?.failureType,
      failureType: parsed?.failureType,
      customerMessage: parsed?.customerMessage,
      state: parsed?._state,
      hasSongList: !!parsed?.songList
    });
    
    // 更全面的 license 错误检测
    const errorMsg = String(parsed?.failureType || parsed?.customerMessage || parsed?.message || '').toLowerCase();
    const isLicenseError = /license|not found|未购买|未找到|未授权|not purchased/i.test(errorMsg);
    
    if (parsed?.failureType && isLicenseError){
      await this.ensureLicense(appIdentifier, appVerId, Cookie);
      parsed = await postPlistWithRetry(this.fetch, url, data, headers, 3);
    }
    return { ...parsed, _state: parsed.hasOwnProperty('failureType') ? 'failure' : 'success' };
  }
}
Store.cookieJar = new fetchCookie.toughCookie.CookieJar();
Store.fetch = fetchCookie(nodeFetch, Store.cookieJar);
export { Store };

class AccountStore{
  constructor(){ this.cookieJar = new fetchCookie.toughCookie.CookieJar(); this.fetch = fetchCookie(nodeFetch, this.cookieJar); this._guid = generateGuid(); this.Headers = { 'User-Agent':'Configurator/2.15 (Macintosh; OS X 11.0.0; 16G29) AppleWebKit/2603.3.8', 'Content-Type':'application/x-www-form-urlencoded' }; }
  get guid(){ return this._guid; }
  async authenticate(email, password, mfa){
    const data = { appleId: email, attempt: mfa?2:4, createSession:'true', guid:this.guid, password:`${password}${mfa??''}`, rmp:0, why:'signIn' };
    const url = `https://auth.itunes.apple.com/auth/v1/native/fast?guid=${this.guid}`;
    const parsed = await postPlistWithRetry(this.fetch, url, data, this.Headers, 3);
    
    // 调试：记录认证返回的所有字段
    if (parsed && !parsed.failureType) {
      console.log('[AccountStore.authenticate] Success - Fields:', {
        hasDsPersonId: !!parsed.dsPersonId,
        hasPasswordToken: !!parsed.passwordToken,
        hasDisplayName: !!parsed.displayName,
        hasAccountPassword: !!parsed.accountPassword,
        hasTokenInfo: !!parsed.tokenInfo,
        dsPersonId: parsed.dsPersonId,
        allKeys: Object.keys(parsed)
      });
    }
    
    return { ...parsed, _state: parsed.hasOwnProperty('failureType') ? 'failure' : 'success' };
  }
  async ensureLicense(appIdentifier, appVerId, Cookie){
    const url = `https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/buyProduct?guid=${this.guid}`;
    const data = { guid:this.guid, salableAdamId:appIdentifier, ...(appVerId && { externalVersionId:appVerId, appExtVrsId:appVerId }), pricingParameters:'STDQ' };
    
    // 使用辅助函数提取认证信息
    const authInfo = extractAuthInfo(Cookie);
    
    // 调试：记录传递的认证信息
    console.log('[AccountStore.ensureLicense] Cookie info:', {
      hasDsPersonId: !!authInfo?.dsPersonId,
      hasPasswordToken: !!authInfo?.passwordToken,
      dsPersonId: authInfo?.dsPersonId,
      originalCookieKeys: Cookie ? Object.keys(Cookie) : 'null'
    });
    
    const headers = { 
      ...this.Headers, 
      'X-Dsid': authInfo?.dsPersonId, 
      'iCloud-DSID': authInfo?.dsPersonId, 
      ...(authInfo?.passwordToken ? { 'X-Token': authInfo.passwordToken } : {}) 
    };
    return await postPlistWithRetry(this.fetch, url, data, headers, 3);
  }
  async downloadProduct(appIdentifier, appVerId, Cookie){
    const url = `https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/volumeStoreDownloadProduct?guid=${this.guid}`;
    const data = { creditDisplay:'', guid:this.guid, salableAdamId:appIdentifier, ...(appVerId && { externalVersionId:appVerId }) };
    
    // 使用辅助函数提取认证信息
    const authInfo = extractAuthInfo(Cookie);
    
    // 调试：记录传递的认证信息
    console.log('[AccountStore.downloadProduct] Cookie info:', {
      hasDsPersonId: !!authInfo?.dsPersonId,
      hasPasswordToken: !!authInfo?.passwordToken,
      dsPersonId: authInfo?.dsPersonId,
      originalCookieKeys: Cookie ? Object.keys(Cookie) : 'null'
    });
    
    const headers = { 
      ...this.Headers, 
      'X-Dsid': authInfo?.dsPersonId, 
      'iCloud-DSID': authInfo?.dsPersonId, 
      ...(authInfo?.passwordToken ? { 'X-Token': authInfo.passwordToken } : {}) 
    };
    let parsed = await postPlistWithRetry(this.fetch, url, data, headers, 3);
    
    // 调试：记录下载结果
    console.log('[AccountStore.downloadProduct] Result:', {
      hasFailureType: !!parsed?.failureType,
      failureType: parsed?.failureType,
      customerMessage: parsed?.customerMessage,
      state: parsed?._state,
      hasSongList: !!parsed?.songList
    });
    
    // 更全面的 license 错误检测
    const errorMsg = String(parsed?.failureType || parsed?.customerMessage || parsed?.message || '').toLowerCase();
    const isLicenseError = /license|not found|未购买|未找到|未授权|not purchased/i.test(errorMsg);
    
    if (parsed?.failureType && isLicenseError){
      await this.ensureLicense(appIdentifier, appVerId, Cookie);
      parsed = await postPlistWithRetry(this.fetch, url, data, headers, 3);
    }
    return { ...parsed, _state: parsed.hasOwnProperty('failureType') ? 'failure' : 'success' };
  }
}
export { AccountStore };
