# Node.js vs Rust 后端对比

## 技术栈对比

### Node.js 后端
- **运行时**: Node.js
- **框架**: Express
- **数据库**: better-sqlite3
- **加密**: crypto (内置)
- **包管理**: pnpm

### Rust 后端
- **运行时**: 原生二进制
- **框架**: Axum
- **数据库**: SQLx
- **加密**: aes-gcm
- **包管理**: Cargo

## 性能对比

| 指标 | Node.js | Rust | 说明 |
|------|---------|------|------|
| **启动时间** | ~500ms | ~50ms | Rust 无需解释器 |
| **内存占用** | ~150MB | ~10MB | Rust 零成本抽象 |
| **CPU 使用** | 中等 | 低 | Rust 更高效的调度 |
| **并发请求** | 1000/s | 10000/s | Tokio 异步运行时 |
| **JSON 序列化** | 基准 | 3x 快 | serde-json 优化 |
| **文件 I/O** | 基准 | 2x 快 | tokiofs 优化 |

## 代码对比

### 路由定义

**Node.js (Express)**
```javascript
import express from 'express';
const router = express.Router();

router.get('/versions', async (req, res) => {
  const appid = req.query.appid;
  // ...
  res.json({ ok: true, data });
});

app.use('/api', router);
```

**Rust (Axum)**
```rust
use axum::{routing::get, Router};

async fn get_versions(
    Query(params): Query<HashMap<String, String>>
) -> AppResult<Json<VersionsResponse>> {
    let appid = params.get("appid").ok_or_else(|| ...)?;
    // ...
    Ok(Json(VersionsResponse { ok: true, data }))
}

let app = Router::new()
    .route("/api/versions", get(get_versions));
```

### 错误处理

**Node.js**
```javascript
try {
  const result = await someOperation();
  res.json({ ok: true, data: result });
} catch (error) {
  console.error(error);
  res.status(500).json({ ok: false, error: error.message });
}
```

**Rust**
```rust
pub type AppResult<T> = Result<T, AppError>;

async fn handler() -> AppResult<Json<Response>> {
    let result = some_operation().await?;
    Ok(Json(Response { ok: true, data: result }))
}
// AppError 自动转换为 HTTP 响应
```

### 数据库操作

**Node.js**
```javascript
import db from './database.js';

const account = await db.getAccount(token);
if (!account) {
  return res.status(404).json({ error: 'Not found' });
}
```

**Rust**
```rust
use crate::db::Database;

let account = db.get_account(token).await?
    .ok_or_else(|| AppError::NotFound("Not found".to_string()))?;
// ? 自动传播错误
```

### 加密

**Node.js**
```javascript
import crypto from 'crypto';

const key = Buffer.from(keyHex, 'hex');
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

let encrypted = cipher.update(plaintext, 'utf8', 'hex');
encrypted += cipher.final('hex');
const authTag = cipher.getAuthTag();
```

**Rust**
```rust
use aes_gcm::{Aes256Gcm, KeyInit, Aead};

let key = Aes256Gcm::new_from_slice(&key_bytes)?;
let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
let ciphertext = key.encrypt(&nonce, plaintext.as_bytes())?;
```

## 部署对比

### Node.js 部署

**依赖**
- Node.js 运行时 (~50MB)
- node_modules (可能很大)
- package.json

**启动**
```bash
node server/index.js
```

**Docker 镜像大小**
- 基础镜像: node:20-slim (~200MB)
- 应用依赖: ~100MB
- 总计: ~300MB

### Rust 部署

**依赖**
- 无 (静态链接)

**启动**
```bash
./ipa-webtool-backend
```

**Docker 镜像大小**
- 基础镜像: debian:bookworm-slim (~80MB)
- 二进制: ~5MB
- 总计: ~85MB

## 开发体验

### Node.js 优势

✅ **快速原型开发**
- 动态类型，无需编译
- 丰富的 npm 生态
- 热重载支持

✅ **易于调试**
- Chrome DevTools 集成
- 丰富的调试工具
- 错误堆栈清晰

✅ **团队熟悉度高**
- JavaScript/TypeScript 通用
- 学习曲线平缓

### Rust 优势

✅ **性能卓越**
- 零成本抽象
- 无 GC 开销
- 内存效率高

✅ **类型安全**
- 编译时检查
- 无 null/undefined
- 线程安全保证

✅ **部署简单**
- 单一二进制
- 无运行时依赖
- 跨平台编译

✅ **维护性好**
- 编译器捕获错误
- 重构更安全
- 文档内嵌

## 迁移建议

### 何时使用 Rust

- ✅ 需要高性能和高并发
- ✅ 内存受限环境
- ✅ 长期维护的项目
- ✅ 需要类型安全
- ✅ 部署到生产环境

### 何时使用 Node.js

- ✅ 快速原型开发
- ✅ 团队不熟悉 Rust
- ✅ 需要大量 npm 包
- ✅ 开发/测试环境
- ✅ 简单的 CRUD 应用

### 混合方案

可以同时保留两个后端:

```bash
# 开发环境使用 Node.js (快速迭代)
pnpm run dev:all

# 生产环境使用 Rust (高性能)
./start-rust.sh
```

## 学习资源

### Rust 学习

- [Rust 程序设计语言](https://doc.rust-lang.org/book/)
- [通过例子学 Rust](https://rustwiki.org/zh-CN/rust-by-example/)
- [Rust 异步编程](https://rust-lang.github.io/async-book/)

### 框架文档

- [Axum 文档](https://docs.rs/axum/)
- [Tokio 教程](https://tokio.rs/tokio/tutorial)
- [SQLx 指南](https://docs.rs/sqlx/)

## 总结

| 方面 | Node.js | Rust | 推荐 |
|------|---------|------|------|
| 开发速度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Node.js |
| 运行性能 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Rust |
| 内存效率 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Rust |
| 部署简单 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Rust |
| 生态丰富 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Node.js |
| 类型安全 | ⭐⭐ | ⭐⭐⭐⭐⭐ | Rust |
| 学习曲线 | ⭐⭐⭐⭐⭐ | ⭐⭐ | Node.js |

**建议**: 
- 开发阶段使用 Node.js 快速迭代
- 生产环境使用 Rust 获得最佳性能
- 逐步迁移关键路径到 Rust
