# IPA Tool - ESA Pages 版本

> 🚀 完全无状态的 IPA 下载工具，支持部署到阿里云 ESA Pages

## ✨ 特性

- 🌐 **静态部署**: 可部署到任何静态网站托管服务
- 💾 **本地存储**: 账户信息存储在浏览器 IndexedDB 中
- 🔒 **无后端**: 后端完全不存储数据，完全无状态
- ⚡ **直链下载**: 使用 Apple CDN 直链，下载速度快
- 🔍 **应用搜索**: 支持搜索应用、Bundle ID、App ID
- 📱 **多账户**: 支持多个 Apple ID 账户管理

## 🚀 快速开始

### 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm run dev

# 构建生产版本
pnpm run build
```

### 部署到 ESA Pages

```bash
# 1. 构建项目
pnpm run build

# 2. 上传 dist 目录到 ESA Pages
# 通过阿里云 ESA 控制台上传

# 3. 配置函数计算
# 将 api/ 目录下的文件部署为函数
```

### 部署到 Vercel（推荐）

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel --prod
```

## 📦 项目结构

```
├── api/                    # Serverless 函数
│   ├── login.js           # 登录 API
│   ├── download.js        # 下载 API
│   └── versions.js        # 版本查询 API
├── src/
│   ├── components/        # Vue 组件
│   ├── composables/       # 组合式函数
│   │   └── useStorage.js  # IndexedDB 存储
│   ├── services/          # 服务层
│   │   └── api.js         # API 调用
│   └── stores/            # Pinia 状态管理
├── dist/                  # 构建输出
└── esa-pages.yaml         # ESA Pages 配置
```

## 🔧 技术栈

- **前端**: Vue 3 + Vite + Tailwind CSS + Element Plus
- **存储**: IndexedDB (浏览器本地)
- **部署**: ESA Pages / Vercel / EdgeOne Pages
- **API**: Apple Store API (通过 Serverless 函数)

## 📝 使用说明

1. **登录账户**
   - 输入 Apple ID 和密码
   - 点击登录
   - 账户信息保存到浏览器

2. **搜索应用**
   - 输入应用名称、Bundle ID 或 App ID
   - 选择应用

3. **下载 IPA**
   - 选择账户
   - 点击"获取直链"
   - 浏览器自动下载

## ⚠️ 注意事项

- 账户信息存储在浏览器中，清除数据会丢失
- 密码仅在登录时使用，不存储
- Cookie 会过期，需要重新登录
- 建议使用 HTTPS 部署

## 📄 许可证

MIT License

## 🙏 致谢

- [ruanrrn/ipaTool](https://github.com/ruanrrn/ipaTool) - 原始项目
