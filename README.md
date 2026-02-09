<div align="center">

# IPA Web Tool

**现代化的 IPA 文件下载与管理工具**

[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://hub.docker.com/r/heard/ipa-webtool)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%3E=18.0.0-brightgreen)](https://nodejs.org)

</div>

## ✨ 功能特性

- 🔍 **应用搜索** - 支持应用名称、Bundle ID、App ID 搜索
- 📦 **版本管理** - 查看和下载应用历史版本
- 🛒 **账号管理** - 多账号管理，AES-256-GCM 加密存储
- 📥 **下载功能** - 直链下载，进度显示，队列管理
- 🔐 **安全存储** - 本地数据存储，密钥自动轮换
- 🎨 **现代界面** - 响应式设计，暗黑模式支持

## 🚀 快速开始

### Docker 部署（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/ruanrrn/ipaTool.git
cd ipaTool

# 2. 启动服务
docker-compose up -d

# 3. 访问应用
open http://localhost:3030
```

### 本地开发

```bash
# 1. 克隆项目
git clone https://github.com/ruanrrn/ipaTool.git
cd ipaTool

# 2. 安装依赖
pnpm install

# 3. 启动开发服务
pnpm run dev:all

# 4. 访问应用
# 前端: http://localhost:3000
# 后端: http://localhost:8080
```

### 生产部署

```bash
# 1. 构建前端
pnpm run build

# 2. 启动后端
NODE_ENV=production pnpm run start
```

## 📖 使用说明

### 添加账号
在"账号"标签页添加 Apple ID，密码将使用 AES-256-GCM 加密存储

### 搜索应用
在"下载"标签页输入应用名称、Bundle ID 或 App ID 进行搜索

### 下载 IPA
选择版本后点击下载，支持查看下载进度和历史记录

## 🛠️ 技术栈

**前端**: Vue 3 + Vite + Element Plus + Tailwind CSS  
**后端**: Node.js + Express  
**数据库**: Better-SQLite3  
**加密**: AES-256-GCM  
**部署**: Docker + Docker Compose

## 📦 已完成功能

- ✅ 多账号管理与加密存储
- ✅ 应用搜索（名称/Bundle ID/App ID）
- ✅ 版本查询与下载
- ✅ 下载队列管理
- ✅ 下载历史记录
- ✅ 响应式设计 + 暗黑模式
- ✅ Docker 部署支持

## 🗺️ 开发计划

### 近期计划
- 批量下载功能
- 下载失败自动重试
- 应用订阅和更新通知

### 中期计划
- 桌面应用打包（Windows/macOS/Linux）
- 系统托盘集成
- 自动更新功能

### 长期规划
- IPA 文件签名
- OTA 在线安装
- 设备管理功能

## � 常用命令

```bash
# Docker 部署
docker-compose up -d          # 启动
docker-compose down           # 停止
docker-compose logs -f        # 查看日志

# 本地开发
pnpm install                  # 安装依赖
pnpm run dev:all              # 启动开发服务
pnpm run build                # 构建前端
pnpm run start                # 启动生产服务
```

## 🔒 安全说明

- 账号信息使用 AES-256-GCM 加密存储
- 密钥每 30 天自动轮换
- 数据完全存储在本地
- 建议使用 HTTPS 部署

## 🐛 故障排查

```bash
# 查看容器日志
docker-compose logs -f

# 重启容器
docker-compose restart

# 删除数据库重新初始化
rm -f server/data/ipa-webtool.db*
docker-compose restart
```

## 📄 许可证

MIT License

## 🙏 致谢

- [ipatool.js](https://github.com/feross/ipatool) - 核心功能参考
- [Element Plus](https://element-plus.org/) - UI 组件库
- [Vue.js](https://vuejs.org/) - 前端框架

## 📮 联系方式

- GitHub: [ruanrrn/ipaTool](https://github.com/ruanrrn/ipaTool)
- Docker Hub: [heard/ipa-webtool](https://hub.docker.com/r/heard/ipa-webtool)

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐️**

Made with ❤️ by [ruanrrn](https://github.com/ruanrrn)

</div>
