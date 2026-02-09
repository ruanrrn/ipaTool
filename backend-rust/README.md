# Rust 后端

这是用 Rust 重写的后端服务，提供更好的性能和安全性。

## 功能特性

- ⚡️ 高性能异步处理 (Tokio)
- 🔐 AES-256-GCM 加密
- 🗄️ SQLite 数据库
- 📦 IPA 下载和签名
- 🌐 CORS 支持
- 📊 结构化日志

## 开发

### 安装 Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 运行开发服务器

```bash
cd backend-rust
cargo run
```

### 构建生产版本

```bash
cargo build --release
```

## API 端点

### 认证
- `POST /api/login` - 登录
- `POST /api/login/verify` - 验证二次验证码
- `GET /api/login/status` - 获取登录状态
- `POST /api/logout` - 登出

### 账号管理
- `GET /api/accounts` - 列出所有账号
- `GET /api/accounts/:token` - 获取账号详情
- `DELETE /api/accounts/:token` - 删除账号

### 版本查询
- `GET /api/versions?appid=xxx&region=US` - 查询应用版本

### 下载
- `GET /api/download-url` - 获取下载链接
- `POST /api/download` - 创建下载任务
- `GET /api/download/:job_id` - 获取任务状态
- `POST /api/download/:job_id/cancel` - 取消任务
- `GET /api/downloads` - 列出所有下载任务

## 环境变量

```bash
PORT=8080                    # 服务端口
DATA_DIR=./data              # 数据目录
MAX_FILE_SIZE=2147483648     # 最大文件大小 (2GB)
MAX_CONCURRENT_DOWNLOADS=10  # 最大并发下载数
```

## 项目结构

```
backend-rust/
├── src/
│   ├── main.rs          # 入口点
│   ├── config.rs        # 配置管理
│   ├── error.rs         # 错误处理
│   ├── models.rs        # 数据模型
│   ├── db.rs            # 数据库操作
│   ├── crypto.rs        # 加密服务
│   ├── api/             # API 路由
│   │   ├── login.rs
│   │   ├── download.rs
│   │   └── versions.rs
│   └── services/        # 业务逻辑
│       ├── apple_auth.rs
│       ├── ipa_handler.rs
│       └── signature.rs
├── Cargo.toml
└── README.md
```
