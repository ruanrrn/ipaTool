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
- 🔐 **安全存储** - 本地 SQLite 数据库，密钥自动轮换
- 🎨 **现代界面** - Vue 3 + Element Plus，响应式设计，暗黑模式支持
- ⚡ **高性能后端** - 异步处理，内存安全

## 🚀 快速开始

### Docker 部署（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/ipa-webtool.git
cd ipa-webtool

# 2. 启动服务
docker-compose up -d

# 3. 访问应用
open http://localhost:8080
```

### 本地开发

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/ipa-webtool.git
cd ipa-webtool

# 2. 安装前端依赖
pnpm install

# 3. 编译 Rust 后端
cd server
cargo build --release

# 4. 启动后端服务
cargo run

# 5. 在另一个终端启动前端
cd ..
pnpm run dev

# 6. 访问应用
# 前端: http://localhost:3000
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
./target/release/server
```

## 📖 使用说明

### 添加账号
在"账号"标签页添加 Apple ID，密码将使用 AES-256-GCM 加密存储

### 搜索应用
在"下载"标签页输入应用名称、Bundle ID 或 App ID 进行搜索

### 下载 IPA
选择版本后点击下载，支持查看下载进度和历史记录

## 🛠️ 技术栈

**前端**:
- Vue 3 - 渐进式 JavaScript 框架
- Vite - 下一代前端构建工具
- Element Plus - Vue 3 组件库
- Tailwind CSS - 实用优先的 CSS 框架
- Pinia - Vue 状态管理

**后端**:
- 高性能 Web 框架
- 异步运行时
- SQLite - 嵌入式数据库
- OpenSSL - 加密库支持

**安全**:
- AES-256-GCM - 账号密码加密存储
- 密钥自动轮换机制
- 本地数据存储，无云端依赖

**部署**:
- Docker 多阶段构建
- Docker Compose 一键部署
- 支持 linux/amd64 和 linux/arm64 平台

## 🚀 快速启动

### Docker 部署（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/ipa-webtool.git
cd ipa-webtool

# 2. 启动服务
docker-compose up -d

# 3. 访问应用
open http://localhost:8080
```

### 本地开发

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/ipa-webtool.git
cd ipa-webtool

# 2. 安装前端依赖
pnpm install

# 3. 编译 Rust 后端
cd server
cargo build --release

# 4. 启动后端服务
cargo run

# 5. 在另一个终端启动前端
cd ..
pnpm run dev

# 6. 访问应用
# 前端: http://localhost:3000
# 后端: http://localhost:8080
```

### API 端点

服务器启动后，可以访问以下端点：

- `GET /health` - 健康检查
- `GET /versions?appid={id}&region={region}` - 查询应用版本
- `GET /search?q={query}` - 搜索应用
- `POST /login` - Apple ID 登录
- `GET /download-url?token={token}&appid={id}&appVerId={ver}` - 获取下载链接
- `POST /download` - 下载 IPA 文件

## 📦 已完成功能

### 核心功能
- ✅ 多账号管理与 AES-256-GCM 加密存储
- ✅ 应用搜索（支持名称/Bundle ID/App ID）
- ✅ 版本查询与历史版本下载
- ✅ 下载队列管理与并发控制
- ✅ 下载历史记录与进度追踪

### 技术实现
- ✅ 高性能后端架构
- ✅ Vue 3 + Element Plus 现代化前端
- ✅ SQLite 本地数据持久化
- ✅ 响应式设计 + 暗黑模式支持
- ✅ Docker 多阶段构建优化
- ✅ 跨平台支持（amd64/arm64）

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
- [ ] OTA 在线安装
- [ ] 设备管理功能
- [ ] 插件系统

## � 常用命令

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
cargo build --release         # 构建发布版本
cargo run                     # 运行开发版本
cargo test                    # 运行测试
cargo clean                   # 清理构建缓存
```

## 🔒 安全说明

- 账号信息使用 AES-256-GCM 加密存储
- 密钥每 30 天自动轮换
- 数据完全存储在本地
- 建议使用 HTTPS 部署

## 🐛 故障排查

```bash
# Docker 部署问题
# 查看容器日志
docker-compose logs -f server

# 重启容器
docker-compose restart

# 删除数据库重新初始化
rm -f server/data/ipa-webtool.db*
docker-compose restart

# 本地开发问题
# 查看后端详细日志
RUST_LOG=debug cargo run

# 重新构建后端
cargo clean && cargo build --release

# 检查数据库
sqlite3 server/data/ipa-webtool.db ".tables"
```

## 📄 许可证

MIT License

## 🙏 致谢

本项目参考和使用了以下优秀的开源项目：

- [ipatool.js](https://github.com/feross/ipatool) - 核心功能参考
- [Element Plus](https://element-plus.org/) - 优秀的 Vue 3 UI 组件库
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Actix-web](https://actix.rs/) - 强大的 Web 框架
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的 CSS 框架

## 📮 联系方式

- GitHub: [ruanrrn/ipaTool](https://github.com/ruanrrn/ipaTool)
- Docker Hub: [heard/ipa-webtool](https://hub.docker.com/r/heard/ipa-webtool)

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐️**

Made with ❤️ by [ruanrrn](https://github.com/ruanrrn)

**Built with Vue 3**

</div>
