<div align="center">

# IPA Web Tool

**现代化的 IPA 文件下载与管理工具**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

</div>

## ✨ 功能特性

- 🔍 **应用搜索** - 支持应用名称、Bundle ID、App ID 搜索
- 📦 **版本管理** - 查看和下载应用历史版本
- 🛒 **账号管理** - 多账号管理，AES-256-GCM 加密存储
- 📥 **下载功能** - 直链下载，进度显示，队列管理
- � **IPA 安装** - 支持 OTA 在线安装（需 HTTPS 部署）
- �🔐 **安全存储** - 本地 SQLite 数据库，密钥自动轮换
- 🎨 **现代界面** - Vue 3 + Element Plus，响应式设计，暗黑模式支持
- ⚡ **高性能后端** - Rust + Actix-web，异步处理，内存安全

## 🚀 快速开始

### Docker 部署（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/ruanrrn/ipaTool.git
cd ipaTool

# 2. 启动服务
docker-compose up -d

# 3. 访问应用
open http://localhost:8080
```

### 本地开发

**前置要求：**
- Node.js 18+
- pnpm 8+
- Rust 1.70+

```bash
# 1. 克隆项目
git clone https://github.com/ruanrrn/ipaTool.git
cd ipaTool

# 2. 安装前端依赖
pnpm install

# 3. 启动前端开发服务器
pnpm run dev

# 4. 在另一个终端启动后端
cd server
cargo run

# 5. 访问应用
# 前端: http://localhost:5173
# 后端: http://localhost:8080
```

### 生产部署

```bash
# 1. 构建前端
pnpm run build

# 2. 构建后端
cd server
cargo build --release

# 3. 使用 Docker 部署
docker-compose up -d

# 或直接运行
./server/target/release/server
```

## 📖 使用说明

### 添加账号
在"账号"标签页添加 Apple ID，密码将使用 AES-256-GCM 加密存储

### 搜索应用
在"下载"标签页输入应用名称、Bundle ID 或 App ID 进行搜索

### 下载 IPA
选择版本后点击下载，支持查看下载进度和历史记录

### 安装 IPA（需 HTTPS）
> ⚠️ **重要提示**：OTA 在线安装功能需要使用 HTTPS 协议访问，iOS 系统限制 HTTP 连接无法安装应用。

**HTTPS 部署方式：**

1. **使用反向代理（推荐）**
   ```bash
   # 使用 Nginx 配置 SSL
   server {
       listen 443 ssl;
       server_name your-domain.com;
       
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
       
       location / {
           proxy_pass http://localhost:8080;
       }
   }
   ```

2. **使用 Cloudflare Tunnel（免费）**
   ```bash
   # 安装 cloudflared
   brew install cloudflared
   
   # 创建隧道
   cloudflared tunnel --url http://localhost:8080
   ```

3. **使用 Let's Encrypt（免费 SSL）**
   ```bash
   # 安装 certbot
   sudo apt-get install certbot
   
   # 获取证书
   sudo certbot certonly --standalone -d your-domain.com
   ```

**安装步骤：**
1. 在 Safari 中打开 HTTPS 链接（如：`https://your-domain.com`）
2. 下载完成后，点击"安装"按钮
3. 系统会弹出安装描述文件
4. 按照提示前往"设置" → "通用" → "VPN与设备管理"
5. 点击安装应用

## 🛠️ 技术栈

**前端：**
- Vue 3 - 渐进式 JavaScript 框架
- Vite - 下一代前端构建工具
- Element Plus - Vue 3 组件库
- Tailwind CSS - 实用优先的 CSS 框架
- Pinia - Vue 状态管理

**后端：**
- Rust - 系统编程语言
- Actix-web - 高性能 Web 框架
- Tokio - 异步运行时
- SQLite - 嵌入式数据库
- OpenSSL - 加密库支持

**安全：**
- AES-256-GCM - 账号密码加密存储
- 密钥自动轮换机制
- 本地数据存储，无云端依赖

**部署：**
- Docker 多阶段构建
- Docker Compose 一键部署
- 支持 linux/amd64 平台

## 📡 API 端点

服务器启动后，可以访问以下端点：

- `GET /health` - 健康检查
- `GET /versions?appid={id}&region={region}` - 查询应用版本
- `GET /search?q={query}` - 搜索应用
- `POST /login` - Apple ID 登录
- `GET /download-url?token={token}&appid={id}&appVerId={ver}` - 获取下载链接
- `POST /download` - 下载 IPA 文件
- `GET /install?manifest={url}` - OTA 安装（需 HTTPS）

### OTA 安装 API

**请求格式：**
```
GET /install?manifest={manifest_url}
```

**参数说明：**
- `manifest_url` - 描述文件的 URL（需 HTTPS）

**返回：**
- iOS 安装描述文件（.mobileconfig）
- 可在 Safari 中直接打开安装

**使用示例：**
```javascript
// 下载完成后生成安装链接
const installUrl = `https://your-domain.com/install?manifest=${encodeURIComponent(manifestUrl)}`;

// 在 Safari 中打开此链接即可安装
window.open(installUrl);
```

## 📦 已完成功能

### 核心功能
- ✅ 多账号管理与 AES-256-GCM 加密存储
- ✅ 应用搜索（支持名称/Bundle ID/App ID）
- ✅ 版本查询与历史版本下载
- ✅ 下载队列管理与并发控制
- ✅ 下载历史记录与进度追踪
- ✅ OTA 在线安装（需 HTTPS 部署）

### 技术实现
- ✅ Rust 高性能后端架构
- ✅ Vue 3 + Element Plus 现代化前端
- ✅ SQLite 本地数据持久化
- ✅ 响应式设计 + 暗黑模式支持
- ✅ Docker 多阶段构建优化
- ✅ 跨平台支持（linux/amd64）

## 🗺️ 开发计划

### 近期计划
- [ ] 批量下载功能
- [ ] 下载失败自动重试机制
- [ ] 应用订阅和更新通知
- [ ] 下载速度优化与断点续传

### 中期计划
- [ ] 桌面应用打包（Windows/macOS/Linux）
- [ ] 系统托盘集成
- [ ] 自动更新功能
- [ ] 更多区域支持

### 长期规划
- [ ] IPA 文件签名功能
- [x] OTA 在线安装（已完成）
- [ ] 设备管理功能
- [ ] 插件系统
- [ ] 企业证书签名支持

## 🔧 常用命令

```bash
# Docker 部署
docker-compose up -d          # 启动服务
docker-compose down           # 停止服务
docker-compose logs -f        # 查看日志
docker-compose restart        # 重启服务

# 前端开发
pnpm install                  # 安装依赖
pnpm run dev                  # 启动开发服务器
pnpm run build                # 构建生产版本
pnpm run preview              # 预览构建结果

# 后端开发
cd server
cargo build --release         # 构建发布版本
cargo run                     # 运行开发版本
cargo test                    # 运行测试
cargo clean                   # 清理构建缓存
```

## 🔒 安全说明

### 数据安全
- 账号信息使用 AES-256-GCM 加密存储
- 密钥每 30 天自动轮换
- 数据完全存储在本地
- 无云端依赖，隐私安全

### 部署安全
- **强烈建议使用 HTTPS 部署**
- OTA 安装功能必须使用 HTTPS
- 使用 Let's Encrypt 获取免费 SSL 证书
- 或使用 Cloudflare Tunnel 提供 HTTPS

### HTTPS 部署方案

#### 方案 1: Nginx 反向代理
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 方案 2: Cloudflare Tunnel（免费）
```bash
# 1. 下载 cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64 -o cloudflared
chmod +x cloudflared

# 2. 创建隧道
./cloudflared tunnel --url http://localhost:8080

# 3. 访问生成的 HTTPS URL
```

#### 方案 3: Caddy（自动 HTTPS）
```bash
# 1. 安装 Caddy
brew install caddy

# 2. 创建 Caddyfile
echo 'your-domain.com {
    reverse_proxy localhost:8080
}' > Caddyfile

# 3. 启动 Caddy
caddy run
```

## 🐛 故障排查

```bash
# Docker 部署问题
# 查看容器日志
docker-compose logs -f ipa-webtool

# 重启容器
docker-compose restart

# 删除数据库重新初始化
docker-compose down -v
docker-compose up -d

# 本地开发问题
# 查看后端详细日志
cd server
RUST_LOG=debug cargo run

# 重新构建后端
cargo clean && cargo build --release

# 检查数据库
sqlite3 server/data/ipa-webtool.db ".tables"
```

## 🔄 CI/CD

项目使用 GitHub Actions 进行持续集成和部署：

- **CI 工作流** - 自动运行测试和代码检查
- **Docker 工作流** - 自动构建和推送 Docker 镜像

**触发条件：**
- Pull Request - 自动运行 CI 测试
- 推送版本标签 - 自动构建 Docker 镜像
- 修改版本号 - 自动触发构建
- 手动触发 - 可随时手动运行

详细说明请查看 [GITHUB_ACTIONS_GUIDE.md](./GITHUB_ACTIONS_GUIDE.md)

## 🔐 HTTPS 部署

**重要提示：** OTA 在线安装功能必须使用 HTTPS 协议。

### 快速方案（免费）

1. **Cloudflare Tunnel**（推荐）
   ```bash
   brew install cloudflared
   cloudflared tunnel --url http://localhost:8080
   ```

2. **Let's Encrypt + Nginx**
   ```bash
   sudo certbot certonly --standalone -d your-domain.com
   ```

3. **Caddy**（自动 HTTPS）
   ```bash
   brew install caddy
   echo 'your-domain.com { reverse_proxy localhost:8080 }' > Caddyfile
   caddy run
   ```

详细配置请查看 [HTTPS_DEPLOYMENT.md](./HTTPS_DEPLOYMENT.md)

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件

## 🙏 致谢

本项目参考和使用了以下优秀的开源项目：

- [ipatool.js](https://github.com/feross/ipatool) - 核心功能参考
- [Element Plus](https://element-plus.org/) - 优秀的 Vue 3 UI 组件库
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Actix-web](https://actix.rs/) - 强大的 Rust Web 框架
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的 CSS 框架

## 📮 联系方式

- GitHub: [ruanrrn/ipaTool](https://github.com/ruanrrn/ipaTool)
- Issues: [提交问题](https://github.com/ruanrrn/ipaTool/issues)

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐️**

Made with ❤️ by [ruanrrn](https://github.com/ruanrrn)

**Built with Vue 3 + Rust**

</div>
