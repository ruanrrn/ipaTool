# ESA Pages 部署指南

## 📋 部署前准备

1. 确保已安装 Node.js 和 pnpm
2. 确保项目可以正常构建：`pnpm run build`

## 🚀 部署步骤

### 方式 1: 通过阿里云 ESA 控制台部署

1. **登录阿里云 ESA 控制台**
   - 访问：https://esa.console.aliyun.com

2. **创建应用**
   - 点击"创建应用"
   - 选择"静态网站"
   - 输入应用名称

3. **上传构建产物**
   ```bash
   # 1. 构建项目
   pnpm run build

   # 2. 压缩 dist 目录
   cd dist
   zip -r ../dist.zip .

   # 3. 在控制台上传 dist.zip
   ```

4. **配置函数计算**
   - 在 ESA 控制台，进入"函数计算"
   - 创建以下函数：
     - `api/login` → 上传 `api/login.js`
     - `api/download` → 上传 `api/download.js`
     - `api/versions` → 上传 `api/versions.js`

5. **配置路由**
   - 添加路由规则：
     - `/api/*` → 函数计算
     - `/*` → 静态文件

### 方式 2: 使用阿里云 CLI 部署

```bash
# 1. 安装阿里云 CLI
npm install -g @alicloud/esa-cli

# 2. 登录
esa login

# 3. 部署
esa deploy --config esa-pages.yaml
```

### 方式 3: 部署到 Vercel（推荐，最简单）

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 登录
vercel login

# 3. 部署
vercel --prod
```

## ⚙️ 环境变量配置

在部署平台配置以下环境变量：

```env
NODE_ENV=production
```

## 🔧 部署后验证

1. **访问网站**
   - 检查首页是否正常加载

2. **测试登录**
   - 尝试登录 Apple ID
   - 检查账户是否保存到 IndexedDB

3. **测试搜索**
   - 搜索应用
   - 查看版本信息

4. **测试下载**
   - 获取直链
   - 浏览器下载

## 📊 架构说明

```
┌─────────────────────────────────────┐
│  前端 → 静态网站 (dist/)             │
│  - Vue.js 应用                       │
│  - IndexedDB 存储账户信息            │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  API → Serverless 函数              │
│  - /api/login (登录)                 │
│  - /api/download (获取直链)          │
│  - /api/versions (查询版本)          │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Apple Store API                    │
│  - 获取应用信息                      │
│  - 获取下载链接                      │
└─────────────────────────────────────┘
```

## ⚠️ 注意事项

1. **数据存储**
   - 所有账户信息存储在用户浏览器的 IndexedDB 中
   - 后端完全不存储数据
   - 清除浏览器数据会丢失账户信息

2. **安全性**
   - 密码仅在登录时使用，不存储
   - Cookie 信息存储在 IndexedDB 中
   - 建议使用 HTTPS

3. **限制**
   - Serverless 函数有执行时间限制
   - 直链下载不受影响
   - 不支持长时间运行的下载任务

## 🐛 常见问题

### Q: 登录后刷新页面，账户丢失？
A: 检查浏览器是否允许 IndexedDB，某些隐私模式会禁用 IndexedDB。

### Q: API 调用失败？
A: 检查函数计算是否正确配置，路由是否正确。

### Q: 下载链接无效？
A: 检查账户 Cookie 是否过期，重新登录即可。

## 📝 更新日志

- 2025-02-08: 完成无状态改造，支持 ESA Pages 部署
- 移除后端数据库依赖
- 使用 IndexedDB 存储账户信息
- API 改为无状态函数
