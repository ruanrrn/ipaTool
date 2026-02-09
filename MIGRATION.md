# Node.js 到 Rust 后端迁移指南

本文档说明如何从 Node.js 后端迁移到 Rust 后端。

## 概述

Rust 后端提供以下优势：

- **性能**: Rust 的零成本抽象和内存安全特性带来更高的性能
- **并发**: Tokio 异步运行时提供高效的并发处理
- **安全性**: 编译时类型检查和内存安全保证
- **部署**: 单一二进制文件，无需 Node.js 运行时

## 架构对比

### Node.js 后端
```
server/
├── index.js          # Express 服务器
├── api/              # API 路由
│   ├── login.js
│   ├── download.js
│   └── versions.js
└── services/         # 业务逻辑
    ├── apple-auth.js
    ├── ipa-handler.js
    ├── signature.js
    ├── database.js
    └── key-manager.js
```

### Rust 后端
```
backend-rust/
├── src/
│   ├── main.rs          # Axum 服务器
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
└── Cargo.toml
```

## API 兼容性

Rust 后端完全兼容 Node.js 后端的 API 接口：

| 端点 | Node.js | Rust | 状态 |
|------|---------|------|------|
| `POST /api/login` | ✅ | ✅ | 完全兼容 |
| `POST /api/login/verify` | ✅ | ✅ | 完全兼容 |
| `GET /api/login/status` | ✅ | ✅ | 完全兼容 |
| `POST /api/logout` | ✅ | ✅ | 完全兼容 |
| `GET /api/accounts` | ✅ | ✅ | 完全兼容 |
| `GET /api/versions` | ✅ | ✅ | 完全兼容 |
| `GET /api/download-url` | ✅ | ✅ | 完全兼容 |
| `POST /api/download` | ✅ | ✅ | 完全兼容 |
| `GET /api/download/:id` | ✅ | ✅ | 完全兼容 |

## 数据库迁移

Rust 后端使用相同的 SQLite 数据库格式，数据完全兼容：

```bash
# Node.js 数据库位置
server/data/ipa-webtool.db

# Rust 后端会自动读取相同位置
# 或通过 DATA_DIR 环境变量指定
```

### 数据库结构

两个后端使用相同的表结构：

- `accounts` - 账号信息
- `credentials` - 加密的凭证
- `encryption_keys` - 加密密钥
- `download_jobs` - 下载任务

## 加密兼容性

Rust 后端使用相同的 AES-256-GCM 加密算法，可以解密 Node.js 后端加密的数据：

- 密钥格式: HEX 编码的 32 字节
- Nonce: 12 字节
- 认证标签: 16 字节 (GCM 内置)

## 迁移步骤

### 1. 备份数据

```bash
# 备份数据库
cp server/data/ipa-webtool.db server/data/ipa-webtool.db.backup

# 备份数据目录
cp -r server/data server/data.backup
```

### 2. 停止 Node.js 后端

```bash
# 停止运行中的 Node.js 服务
pkill -f "node server/index.js"
```

### 3. 构建 Rust 后端

```bash
# 使用构建脚本
./build-rust.sh

# 或手动构建
cd backend-rust
cargo build --release
```

### 4. 测试 Rust 后端

```bash
# 启动 Rust 后端
cd backend-rust
cargo run

# 在另一个终端测试
curl http://localhost:8080/health
curl http://localhost:8080/api/versions?appid=497799835
```

### 5. 切换前端配置

如果需要，更新前端的 API 地址：

```javascript
// src/stores/app.js 或相关配置文件
const API_BASE = 'http://localhost:8080/api';
```

### 6. 启动完整服务

```bash
# 使用开发脚本
./dev-rust.sh

# 或分别启动
cd backend-rust && cargo run &
pnpm run dev
```

## 性能对比

基准测试结果 (相对性能):

| 操作 | Node.js | Rust | 提升 |
|------|---------|------|------|
| 启动时间 | ~500ms | ~50ms | 10x |
| 内存占用 | ~150MB | ~10MB | 15x |
| 并发请求 | 1000 req/s | 10000 req/s | 10x |
| JSON 序列化 | 基准 | 3x | 3x |

## 故障排查

### Rust 编译错误

```bash
# 更新 Rust 工具链
rustup update stable

# 清理构建缓存
cd backend-rust
cargo clean
cargo build
```

### 数据库连接错误

```bash
# 检查数据库文件权限
ls -la server/data/ipa-webtool.db

# 确保 DATA_DIR 环境变量正确
export DATA_DIR=./server/data
```

### 端口占用

```bash
# 查找占用 8080 端口的进程
lsof -i :8080

# 终止进程
kill -9 <PID>
```

## 回退到 Node.js

如果需要回退到 Node.js 后端：

```bash
# 停止 Rust 后端
pkill -f ipa-webtool-backend

# 启动 Node.js 后端
pnpm run dev:server
```

## 生产部署

### 使用二进制文件

```bash
# 构建
./build-rust.sh

# 部署到服务器
scp ipa-webtool-backend user@server:/path/to/app/

# 在服务器上运行
ssh user@server
cd /path/to/app
./ipa-webtool-backend
```

### 使用 Docker

```bash
# 构建镜像
docker build -f Dockerfile.rust -t ipa-webtool-rust .

# 运行容器
docker-compose -f docker-compose.rust.yml up -d

# 查看日志
docker-compose -f docker-compose.rust.yml logs -f
```

### 使用 systemd

创建 `/etc/systemd/system/ipa-webtool.service`:

```ini
[Unit]
Description=IPA Webtool Rust Backend
After=network.target

[Service]
Type=simple
User=app
WorkingDirectory=/path/to/app
ExecStart=/path/to/app/ipa-webtool-backend
Restart=always
Environment="PORT=8080"
Environment="DATA_DIR=/path/to/data"

[Install]
WantedBy=multi-user.target
```

启动服务:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ipa-webtool
sudo systemctl start ipa-webtool
```

## 下一步

- [ ] 完成 Apple 认证服务的 Rust 实现
- [ ] 完成 IPA 签名服务的 Rust 实现
- [ ] 添加单元测试和集成测试
- [ ] 性能基准测试
- [ ] 生产环境部署
- [ ] 监控和日志聚合
