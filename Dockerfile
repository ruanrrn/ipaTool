# 多阶段构建 Dockerfile（优化版）
# 前端构建阶段
FROM node:18-alpine AS frontend-builder

# 安装 pnpm
RUN npm install -g pnpm@9

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖（使用缓存挂载）
RUN --mount=type=cache,target=/root/.pnpm-store,id=pnpm_cache \
    pnpm install --frozen-lockfile && \
    pnpm check || echo "Warning: Some dependencies may be missing"

# 复制所有源文件（包括 index.html）
COPY . .

# 构建前端（显示详细输出）
RUN pnpm run build && \
    ls -la dist/ && \
    echo "Frontend build completed successfully"

# Rust 后端构建阶段
FROM rust:1.84-slim AS backend-builder

# 更新 Rust 到最新稳定版本（确保支持 edition2024）
RUN rustup update stable && \
    rustup default stable

WORKDIR /app

# 安装构建依赖
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libssl3 \
    perl \
    make \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 复制 Cargo 配置文件
COPY server/Cargo.toml server/Cargo.lock ./

# 使用 Cargo 缓存（BuildKit）- 预构建依赖
RUN --mount=type=cache,target=/app/target,id=cargo_cache,sharing=locked \
    --mount=type=cache,target=/usr/local/cargo,id=registry_cache,sharing=locked \
    --mount=type=cache,target=/usr/local/rust,id=rust_cache,sharing=locked \
    mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    echo "#![allow(dead_code)]" > src/lib.rs && \
    cargo build --release && \
    rm -rf src && \
    echo "Dependency build completed successfully"

# 复制实际源代码
COPY server/src ./src

# 构建应用（使用缓存）- 只构建 release 版本
RUN --mount=type=cache,target=/app/target,id=cargo_cache,sharing=locked \
    --mount=type=cache,target=/usr/local/cargo,id=registry_cache,sharing=locked \
    --mount=type=cache,target=/usr/local/rust,id=rust_cache,sharing=locked \
    cargo build --release && \
    ls -lh target/release/server && \
    echo "Backend build completed successfully"

# 生产环境镜像
FROM debian:bookworm-slim

# 安装运行时依赖
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 从 frontend-builder 阶段复制构建好的前端文件
COPY --from=frontend-builder /app/dist ./dist

# 从 backend-builder 阶段复制构建好的后端二进制文件
COPY --from=backend-builder /app/target/release/server ./server

# 创建数据目录并设置权限
RUN mkdir -p /app/data && \
    chmod 777 /app/data

# 暴露端口
EXPOSE 8080

# 设置环境变量
ENV PORT=8080
ENV RUST_LOG=info
ENV DATABASE_PATH=/app/data/ipa-webtool.db

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# 运行应用
CMD ["./server"]
