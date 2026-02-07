<div align="center">

# 🎯 IPA Tool

### 🚀 现代化 IPA 下载、签名与管理工具

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Vue 3](https://img.shields.io/badge/Vue-3.5.13-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.4.1-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Element Plus](https://img.shields.io/badge/Element%20Plus-2.13.2-409EFF?logo=element&logoColor=white)](https://element-plus.org/)

**功能强大、界面精美的 IPA 文件管理工具，支持应用搜索、多账号管理、实时进度显示和自动登录**

</div>

---

## ✨ 核心功能

- **🔍 智能搜索** - 支持应用名称、Bundle ID、App ID 三种搜索方式
- **👥 多账号管理** - 同时登录多个 Apple ID，自动检测区域（US/CN/JP 等）
- **📥 高级下载** - 直链模式 + SSE 实时进度，支持历史版本下载
- **🔒 安全存储** - AES-256-GCM 加密，Better-SQLite3 数据库
- **🎨 现代界面** - Element Plus + Tailwind CSS，支持深色模式

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/ruanrrn/ipaTool.git
cd ipaTool

# 2. 安装依赖（会自动构建原生模块）
pnpm install

# 3. 启动服务
pnpm run dev:server  # 终端 1：后端服务器（端口 8080）
pnpm dev             # 终端 2：前端开发服务器（端口 3000）
```

访问 http://localhost:3000

### 首次启动

系统会自动：
- 🔐 生成安全的加密密钥
- 💾 创建 Better-SQLite3 数据库
- ⏰ 设置密钥自动轮换（每 30 天）

---

## 📖 使用指南

### 1. 登录账号

1. 进入"账号"标签页
2. 输入 Apple ID 邮箱和密码
3. 勾选"保存密码以便下次自动登录"（可选）
4. 点击"登录"按钮
5. 如需两步验证码，输入验证码后重试

**区域自动检测**：
- 中国区邮箱（@qq.com、@163.com 等）自动识别为 CN 区
- 其他邮箱默认识别为 US 区
- 登录成功后会在账号列表显示检测到的区域

### 2. 搜索与下载

1. 进入"下载"标签页
2. 系统自动选择第一个已登录账号
3. 在搜索框中输入应用名称、Bundle ID 或 App ID
4. 从搜索结果中选择应用
5. 点击"查询版本"查看历史版本
6. 选择版本后点击下载：
   - **直链**：浏览器原生下载，速度快
   - **带进度**：实时显示进度和详细日志

**区域自动切换**：
- 选择不同账号时，系统自动使用该账号的区域查询应用
- 界面会显示当前使用的商店区域（如：🇨🇳 CN、🇺🇸 US）

### 3. 管理队列

在"队列"标签页查看所有下载任务，支持：
- 查看实时进度
- 下载完成后下载文件
- 删除任务

---

## 🔒 安全特性

### 凭证存储

- **数据库**：Better-SQLite3（轻量级嵌入式数据库）
- **加密算法**：AES-256-GCM
- **密钥管理**：自动生成并定期轮换（每 30 天）
- **存储位置**：`server/data/ipa-webtool.db`

### 数据表结构

- `accounts` - 账号信息（token、email、region、cookies）
- `credentials` - 加密的账号密码
- `encryption_keys` - 加密密钥历史记录

---

## 🛠️ 技术栈

### 前端
- Vue 3 - 渐进式 JavaScript 框架
- Vite - 下一代前端构建工具
- Element Plus - Vue 3 组件库
- Tailwind CSS - 实用优先的 CSS 框架
- Pinia - Vue 状态管理

### 后端
- Node.js - JavaScript 运行时
- Express - Web 应用框架
- Better-SQLite3 - 轻量级嵌入式数据库
- crypto - 加密模块

---

## 📁 项目结构

```
ipa-webtool-browser-progress-logs/
├── src/                    # 前端源码
│   ├── components/         # Vue 组件
│   ├── stores/            # Pinia 状态管理
│   ├── composables/       # Vue 组合式函数
│   └── App.vue            # 根组件
├── server/                # 后端源码
│   ├── api/              # API 路由
│   ├── services/         # 业务逻辑
│   │   ├── database.js    # 数据库服务（双存储模式）
│   │   └── key-manager.js # 密钥管理服务
│   └── data/             # 数据目录（运行时生成）
│       ├── ipa-webtool.db # SQLite 数据库
│       └── ipa-webtool.json # JSON 备用存储
├── docs/                  # 项目文档
│   ├── database-architecture.md # 数据库架构说明
│   └── download-workflow-improvements.md # 下载流程改进
└── package.json          # 项目配置
```

---

## 🌐 部署

### 生产环境部署

```bash
# 1. 构建前端
pnpm build

# 2. 使用 PM2 部署（推荐）
npm install -g pm2
pm2 start server.js --name ipa-tool
pm2 startup
pm2 save
```

### Docker 部署

```bash
# 构建镜像
docker build -t ipa-tool .

# 运行容器
docker run -d -p 8080:8080 --name ipa-tool ipa-tool
```

详细部署说明请参考 [docs/](docs/) 目录。

---

## ❓ 常见问题

### 1. 登录失败怎么办？

- 确认是否开启了两步验证，如已开启需要输入验证码
- 检查网络连接是否正常
- 尝试使用其他 Apple ID 账号测试

### 2. 下载速度慢怎么办？

- 优先使用"直链模式"下载，速度更快
- 检查网络带宽是否充足
- 某些地区可能需要使用代理

### 3. 原生模块构建失败？

```bash
# 手动构建 better-sqlite3
cd node_modules/better-sqlite3
npm run build-release
cd ../..
```

### 4. 端口被占用？

```bash
# 查找并杀死占用端口的进程
lsof -ti:8080 | xargs kill -9
```

更多问题请查看 [GitHub Issues](https://github.com/ruanrrn/ipaTool/issues)

---

## 📝 更新日志

### v2.1.0 (2025-02-08)

#### 🎉 重大更新
- **数据库存储**：使用 Better-SQLite3 替代 JSON 文件存储
- **区域自动检测**：登录时自动检测账号区域
- **智能区域切换**：下载时自动使用所选账号的区域查询应用
- **账号前置验证**：下载页强制要求先选择账号

#### ✨ 新增功能
- 账号登录时自动检测区域（基于邮箱域名）
- 下载页面自动选择第一个账号
- 切换账号时自动切换到对应的 App Store 区域
- 账号列表显示区域徽章
- 数据库自动迁移和升级支持

#### 🔧 优化改进
- 优化数据库操作性能
- 改进区域显示样式
- 添加区域切换提示信息
- 配置原生模块自动构建

### v2.0.0 (2024-02-08)

#### 🎉 重大更新
- **引入 Element Plus 组件库**
- **状态持久化**：修复页面切换后状态丢失的问题
- **实时队列更新**：修复队列页进度未更新的问题

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发规范

- 遵循现有代码风格
- 使用 Composition API（`<script setup>`）
- 添加必要的注释
- 遵循 Conventional Commits 规范

---

## 📄 许可证

[MIT License](LICENSE)

---

## 🙏 致谢

- [Vue.js](https://vuejs.org/)
- [Vite](https://vitejs.dev/)
- [Element Plus](https://element-plus.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Express](https://expressjs.com/)

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐️ 支持一下！**

**你的支持是我们持续更新的动力！**

Made with ❤️ by [ruanrrn](https://github.com/ruanrrn)

**[⬆ 返回顶部](#-ipa-tool)**

</div>
