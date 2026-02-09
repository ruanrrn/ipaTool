<div align="center">

# IPA Web Tool

**现代化的 IPA 文件下载与管理工具**

</div>

## ✨ 功能特性

- 🔍 **智能搜索** - 支持应用名称、Bundle ID、App ID 搜索
- 📦 **版本下载** - 查看和下载应用历史版本
- 🛒 **一键购买** - 自动购买未购买的应用
- 📥 **一键安装** - 下载完成后直接安装到 iOS 设备
- 🔐 **安全存储** - AES-256-GCM 加密存储账号信息
- 📋 **下载队列** - 实时查看下载进度和状态

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### 安装与运行

```bash
# 克隆项目
git clone <repository-url>
cd ipa-webtool-browser-progress-logs

# 安装依赖
pnpm install

# 启动服务（前端 + 后端）
pnpm run dev:all
```

访问 http://localhost:3000

## 📖 使用说明

### 1. 登录账号

在"账号"标签页添加您的 Apple ID 账号

### 2. 搜索应用

在"下载"标签页：
- 输入应用名称、Bundle ID 或 App ID 搜索
- 或切换到"直接输入 App ID"模式，直接输入 App ID

### 3. 选择版本

查询并选择要下载的历史版本

### 4. 开始下载

- **直链下载** - 仅下载 IPA 文件
- **下载并安装** - 下载后可直接安装到设备
- 如未购买应用，会提示是否购买

### 5. 查看队列

在"队列"标签页查看下载进度和状态

## 🛠️ 技术栈

- **前端**: Vue 3 + Vite + Element Plus + Tailwind CSS
- **后端**: Node.js + Express
- **数据库**: Better-SQLite3
- **加密**: AES-256-GCM

## 📦 部署说明

### Docker 部署（推荐）

```bash
# 构建镜像
docker build -t ipa-webtool .

# 运行容器
docker run -d \
  -p 3000:3000 \
  -p 8080:8080 \
  -v $(pwd)/server/data:/app/server/data \
  --name ipa-webtool \
  ipa-webtool
```

### 手动部署

```bash
# 1. 安装依赖
pnpm install

# 2. 构建前端
pnpm run build

# 3. 启动后端服务
NODE_ENV=production pnpm run start

# 或使用 PM2
pm2 start server/index.js --name ipa-webtool
```

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔒 安全说明

- 所有账号信息使用 AES-256-GCM 加密存储
- 密钥定期自动轮换（默认 30 天）
- 建议在生产环境使用 HTTPS
- 不要在公网环境暴露默认端口

## 📄 许可证

MIT License

## 🙏 致谢

本项目基于 [ipatool.js](https://github.com/feross/ipatool) 开发
