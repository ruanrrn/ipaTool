/**
 * API 服务
 * 与后端 Serverless 函数通信
 */

const API_BASE = '/api';

export const apiService = {
  // 登录
  async login(email, password, code = null) {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, code })
    });
    return await response.json();
  },

  // 验证账户
  async validateAccount(account) {
    const response = await fetch(`${API_BASE}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: account.email,
        region: account.region,
        cookieUser: account.cookieUser,
        cookies: account.cookies
      })
    });
    return await response.json();
  },

  // 搜索应用
  async searchApp(term, account) {
    const params = new URLSearchParams({
      term,
      region: account.region,
      cookieUser: account.cookieUser,
      cookies: JSON.stringify(account.cookies)
    });
    const response = await fetch(`${API_BASE}/search?${params}`);
    return await response.json();
  },

  // 获取应用详情
  async getApp(appid, account) {
    const params = new URLSearchParams({
      region: account.region,
      cookieUser: account.cookieUser,
      cookies: JSON.stringify(account.cookies)
    });
    const response = await fetch(`${API_BASE}/app/${appid}?${params}`);
    return await response.json();
  },

  // 获取下载链接
  async getDownloadUrl(appid, appVerId, account) {
    const params = new URLSearchParams({
      appid,
      appVerId: appVerId || '',
      region: account.region,
      cookieUser: account.cookieUser,
      cookies: JSON.stringify(account.cookies)
    });
    const response = await fetch(`${API_BASE}/download-url?${params}`);
    return await response.json();
  }
};
