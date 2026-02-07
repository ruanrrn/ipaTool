# 部署到阿里云 ESA Pages / 腾讯云 EdgeOne Pages 指南

## 🎯 改造完成！

本项目已完成 ESA Pages / EdgeOne Pages 部署改造，主要变更：

### ✅ 已完成的改造

1. **移除 SQLite3 依赖**
   - 删除了 `better-sqlite3` 原生模块依赖
   - 改用纯内存存储

2. **重构数据库服务**
   - [server/services/database.js](server/services/database.js) - 纯内存数据库
   - 支持开发环境本地文件持久化
   - 生产环境使用内存存储

3. **重构 API 为 Serverless 函数**
   - [api/login.js](api/login.js) - 登录和账户管理
   - [api/versions.js](api/versions.js) - 应用搜索
   - [api/download.js](api/download.js) - 直链下载

4. **前端配置优化**
   - 使用相对路径 `/api` 调用后端
   - 自动适配 Pages 路由

5. **部署配置文件**
   - [esa.json](esa.json) - ESA Pages 配置
   - [vercel.json](vercel.json) - Vercel 配置（可选）

---

## 🚀 部署步骤

### 方案 1: 阿里云 ESA Pages

```bash
# 1. 构建前端
pnpm run build

# 2. 安装 ESA CLI
npm install -g @alicloud/esa-cli

# 3. 登录
esa login

# 4. 部署
esa deploy
```

### 方案 2: 腾讯云 EdgeOne Pages

```bash
# 1. 构建前端
pnpm run build

# 2. 通过 EdgeOne 控制台部署
# 或使用 EdgeOne CLI
```

### 方案 3: Vercel（推荐测试）

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 部署
vercel --prod
```

---

## 📋 部署前检查清单

- [ ] 已移除 `better-sqlite3` 依赖
- [ ] 已安装所有依赖：`pnpm install`
- [ ] 本地测试通过：`pnpm run dev`
- [ ] 构建成功：`pnpm run build`
- [ ] 环境变量已配置（如需要）

---

## ⚙️ 环境变量配置

创建 `.env.production` 文件：

```env
NODE_ENV=production
```

**注意**：由于使用内存存储，不需要配置数据库连接。

---

## 🎨 架构说明

### 部署架构

```
┌─────────────────────────────────────┐
│  前端 (Vue.js)                       │
│  静态文件部署到 Pages                │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  API (Serverless 函数)              │
│  - /api/login                       │
│  - /api/versions                    │
│  - /api/download-url                │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  数据存储 (内存)                     │
│  - 账户信息                         │
│  - 会话状态                         │
└─────────────────────────────────────┘
```

### API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/login` | POST | 登录 Apple ID |
| `/api/accounts` | GET | 获取所有账户 |
| `/api/accounts/:token` | DELETE | 删除账户 |
| `/api/verify/:token` | GET | 验证 token |
| `/api/versions` | GET | 搜索应用 |
| `/api/app/:appid` | GET | 获取应用详情 |
| `/api/download-url` | GET | 获取下载直链 |

---

## ⚠️ 重要限制

### 内存存储限制

由于使用内存存储，有以下限制：

1. **数据不持久化**
   - 函数实例重启后数据丢失
   - 适合短期使用和测试

2. **无多实例共享**
   - 每个函数实例独立存储
   - 不同实例间数据不共享

3. **内存限制**
   - 通常限制 512MB - 1GB
   - 大量账户可能超出限制

### 解决方案

如需持久化存储，可集成：

1. **云数据库**
   - 阿里云: RDS / 云开发数据库
   - 腾讯云: TencentDB / 云开发数据库
   - 其他: Supabase / PlanetScale

2. **Redis 缓存**
   - 阿里云: Redis 实例
   - 腾讯云: Redis 实例

3. **对象存储**
   - 阿里云: OSS
   - 腾讯云: COS

---

## 🔧 本地开发

### 开发模式

```bash
# 启动开发服务器（前端 + 后端）
pnpm run dev:all

# 或分别启动
pnpm run dev          # 前端 (localhost:3000)
pnpm run dev:server   # 后端 (localhost:8080)
```

### 构建生产版本

```bash
pnpm run build
```

构建产物在 `dist/` 目录。

---

## 📊 性能优化

### 前端优化

- ✅ 使用 Vite 构建，速度快
- ✅ 代码分割，按需加载
- ✅ 静态资源 CDN 加速

### 后端优化

- ✅ Serverless 函数按需启动
- ✅ 内存存储，访问快速
- ✅ 直链下载，无需服务器带宽

---

## 🐛 常见问题

### 1. 部署后 API 调用失败

**原因**：路由配置错误

**解决**：检查 `esa.json` 或 `vercel.json` 的路由配置

### 2. 登录后刷新页面数据丢失

**原因**：内存存储，函数重启导致数据丢失

**解决**：这是预期行为，可集成云数据库解决

### 3. CORS 错误

**原因**：跨域配置问题

**解决**：已在 API 函数中添加 CORS 头，检查是否正确配置

---

## 🎯 下一步优化

### 短期优化

1. **添加错误监控**
   - 集成 Sentry
   - 记录错误日志

2. **添加性能监控**
   - 监控 API 响应时间
   - 监控函数启动时间

3. **优化缓存策略**
   - 应用列表缓存
   - 账户信息缓存

### 长期优化

1. **集成云数据库**
   - 实现数据持久化
   - 支持多实例共享

2. **实现异步任务**
   - 长时间下载任务
   - 任务队列管理

3. **添加用户认证**
   - JWT 认证
   - 权限管理

---

## 📞 支持

如有问题，请：

1. 查看 [GitHub Issues](https://github.com/your-repo/issues)
2. 提交新的 Issue
3. 参考文档：[docs/](docs/)

---

## 📄 许可证

MIT License
