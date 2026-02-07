# 部署到 EdgeOne Pages / ESA Pages 指南

## 📋 前置要求

1. 放弃使用 SQLite3，改用内存存储
2. 了解 Serverless 环境的限制
3. 准备好云存储（可选，用于数据持久化）

## 🚀 部署步骤

### 方案 1: 部署到 Vercel（推荐，最简单）

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 登录
vercel login

# 3. 部署
vercel

# 4. 设置环境变量
vercel env add ENCRYPTION_KEY
```

### 方案 2: 部署到腾讯云 EdgeOne Pages

```bash
# 1. 构建前端
pnpm run build

# 2. 将 dist 目录上传到 EdgeOne Pages
# 通过 EdgeOne 控制台或 CLI 上传

# 3. 配置环境变量
# 在 EdgeOne 控制台配置环境变量
```

### 方案 3: 部署到阿里云 ESA Pages

```bash
# 1. 构建前端
pnpm run build

# 2. 将 dist 目录上传到 ESA Pages
# 通过 ESA 控制台上传

# 3. 配置函数计算
# 将 api/ 目录下的函数部署到函数计算
```

## ⚠️ 重要限制

### Serverless 环境的限制

1. **无文件系统**
   - 不能使用 `fs.writeFile` 等文件操作
   - 不能使用 SQLite3 等需要文件系统的数据库

2. **执行时间限制**
   - 通常最长 10-60 秒
   - 不适合长时间运行的下载任务

3. **内存限制**
   - 通常 512MB - 1GB
   - 数据存储在内存中，函数重启后丢失

4. **无状态**
   - 每次请求可能是不同的实例
   - 需要使用外部存储保持状态

## 🔧 改造建议

### 1. 数据存储

**当前方案（内存存储）**
- ✅ 简单快速
- ❌ 数据不持久化
- ❌ 函数重启后丢失

**推荐方案（云存储）**
- ✅ 数据持久化
- ✅ 多实例共享
- 需要配置云存储服务

### 2. 下载功能

**当前方案（直接下载）**
- ❌ Serverless 环境不支持长时间运行

**推荐方案（异步任务）**
1. 使用消息队列（如腾讯云 CMQ、阿里云 MQ）
2. 使用云函数 + 对象存储
3. 返回任务 ID，前端轮询状态

### 3. 账户管理

**当前方案（内存存储）**
- ✅ 简单
- ❌ 不持久化

**推荐方案（云数据库）**
- 腾讯云: TencentDB / 云开发数据库
- 阿里云: RDS / 云开发数据库
- 其他: Supabase / PlanetScale

## 📝 部署配置

### Vercel 配置

已创建 `vercel.json` 配置文件，包含：
- API 路由配置
- 静态文件配置
- 环境变量配置

### 环境变量

创建 `.env` 文件（参考 `.env.example`）：

```env
NODE_ENV=production
VITE_API_BASE_URL=/api
ENCRYPTION_KEY=your-32-character-encryption-key-here
```

## 🎯 快速开始

1. **测试本地开发**
```bash
pnpm run dev
```

2. **构建生产版本**
```bash
pnpm run build
```

3. **部署到 Vercel**
```bash
vercel --prod
```

## 💡 最佳实践

1. **使用 CDN**
   - 静态资源部署到 CDN
   - API 使用边缘函数

2. **缓存策略**
   - 应用列表缓存 1 小时
   - 账户信息缓存 24 小时

3. **错误处理**
   - 优雅降级
   - 友好的错误提示

4. **监控**
   - 使用云服务商的监控工具
   - 记录关键指标

## 🔗 相关链接

- [Vercel 文档](https://vercel.com/docs)
- [腾讯云 EdgeOne Pages](https://cloud.tencent.com/product/edgeone)
- [阿里云 ESA Pages](https://www.aliyun.com/product/esa)
