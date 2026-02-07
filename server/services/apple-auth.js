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

class Store{
  static get guid(){ if(!this._guid) this._guid = generateGuid(); return this._guid; }
  static get Headers(){ return { 'User-Agent':'Configurator/2.15 (Macintosh; OS X 11.0.0; 16G29) AppleWebKit/2603.3.8', 'Content-Type':'application/x-www-form-urlencoded' }; }
  static async authenticate(email, password, mfa){
    const data = { appleId: email, attempt: mfa?2:4, createSession: 'true', guid: this.guid, password: `${password}${mfa??''}`, rmp: 0, why: 'signIn' };
    const url = `https://auth.itunes.apple.com/auth/v1/native/fast?guid=${this.guid}`;
    const parsed = await postPlistWithRetry(this.fetch, url, data, this.Headers, 3);
    return { ...parsed, _state: parsed.hasOwnProperty('failureType') ? 'failure' : 'success' };
  }
  static async ensureLicense(appIdentifier, appVerId, Cookie){
    const url = `https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/buyProduct?guid=${this.guid}`;
    const data = { guid: this.guid, salableAdamId: appIdentifier, ...(appVerId && { externalVersionId: appVerId, appExtVrsId: appVerId }), pricingParameters: 'STDQ' };
    const headers = { ...this.Headers, 'X-Dsid': Cookie.dsPersonId, 'iCloud-DSID': Cookie.dsPersonId, ...(Cookie.passwordToken ? { 'X-Token': Cookie.passwordToken } : {}) };
    return await postPlistWithRetry(this.fetch, url, data, headers, 3);
  }
  static async downloadProduct(appIdentifier, appVerId, Cookie){
    const url = `https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/volumeStoreDownloadProduct?guid=${this.guid}`;
    const data = { creditDisplay: '', guid: this.guid, salableAdamId: appIdentifier, ...(appVerId && { externalVersionId: appVerId }) };
    const headers = { ...this.Headers, 'X-Dsid': Cookie.dsPersonId, 'iCloud-DSID': Cookie.dsPersonId, ...(Cookie.passwordToken ? { 'X-Token': Cookie.passwordToken } : {}) };
    let parsed = await postPlistWithRetry(this.fetch, url, data, headers, 3);
    if ((parsed?.failureType && /license/i.test(String(parsed.failureType))) || /license/i.test(String(parsed?.customerMessage||''))){
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
    return { ...parsed, _state: parsed.hasOwnProperty('failureType') ? 'failure' : 'success' };
  }
  async ensureLicense(appIdentifier, appVerId, Cookie){
    const url = `https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/buyProduct?guid=${this.guid}`;
    const data = { guid:this.guid, salableAdamId:appIdentifier, ...(appVerId && { externalVersionId:appVerId, appExtVrsId:appVerId }), pricingParameters:'STDQ' };
    const headers = { ...this.Headers, 'X-Dsid': Cookie.dsPersonId, 'iCloud-DSID': Cookie.dsPersonId, ...(Cookie.passwordToken ? { 'X-Token': Cookie.passwordToken } : {}) };
    return await postPlistWithRetry(this.fetch, url, data, headers, 3);
  }
  async downloadProduct(appIdentifier, appVerId, Cookie){
    const url = `https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/volumeStoreDownloadProduct?guid=${this.guid}`;
    const data = { creditDisplay:'', guid:this.guid, salableAdamId:appIdentifier, ...(appVerId && { externalVersionId:appVerId }) };
    const headers = { ...this.Headers, 'X-Dsid': Cookie.dsPersonId, 'iCloud-DSID': Cookie.dsPersonId, ...(Cookie.passwordToken ? { 'X-Token': Cookie.passwordToken } : {}) };
    let parsed = await postPlistWithRetry(this.fetch, url, data, headers, 3);
    if ((parsed?.failureType && /license/i.test(String(parsed.failureType))) || /license/i.test(String(parsed?.customerMessage||''))){
      await this.ensureLicense(appIdentifier, appVerId, Cookie);
      parsed = await postPlistWithRetry(this.fetch, url, data, headers, 3);
    }
    return { ...parsed, _state: parsed.hasOwnProperty('failureType') ? 'failure' : 'success' };
  }
}
export { AccountStore };
