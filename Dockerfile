# 多阶段构建 Dockerfile
FROM node:18-alpine AS builder

# 安装 pnpm
RUN npm install -g pnpm

# 接受构建参数
ARG NODE_ENV=production

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建前端
RUN NODE_ENV=production pnpm run build

# 生产环境镜像
FROM node:18-alpine

# 安装系统依赖和构建工具
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    sqlite-dev \
    build-base

# 安装 pnpm
RUN npm install -g pnpm

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# 安装所有依赖（包括 better-sqlite3 等原生模块）
# 这会在 Alpine Linux 上重新编译原生模块
RUN pnpm install --frozen-lockfile

# 从 builder 阶段复制构建好的前端文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

# 创建数据目录并设置权限
# 注意：这个目录会被 docker-compose.yml 中的 volumes 覆盖
RUN mkdir -p /app/server/data && \
    chmod 777 /app/server/data && \
    ls -la /app/server/

# 暴露端口
EXPOSE 8080

# 设置环境变量
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
