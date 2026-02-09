# 多阶段构建 Dockerfile
# 前端构建阶段
FROM node:18-alpine AS frontend-builder

# 安装 pnpm
RUN npm install -g pnpm

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY src/ ./src/
COPY index.html ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY vite.config.js ./

# 构建前端
RUN pnpm run build

# Rust 后端构建阶段
FROM rust:1.83-slim AS backend-builder

WORKDIR /app

# 安装构建依赖
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# 复制 Cargo 配置
COPY server/Cargo.toml server/Cargo.lock ./

# 创建虚拟源文件以缓存依赖
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# 复制实际源代码
COPY server/src ./src

# 构建应用
RUN cargo build --release

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
ENV NODE_ENV=production \
    PORT=8080

# 添加一个非 root 用户来运行应用（可选，提高安全性）
# RUN addgroup -g 1001 -S nodejs && \
#     adduser -S nodejs -u 1001 && \
#     chown -R nodejs:nodejs /app/server/data

# USER nodejs

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# 启动命令
CMD ["node", "server/index.js"]
