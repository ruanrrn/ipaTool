#!/bin/bash

# 开发脚本 - 同时运行前端和后端

set -e

echo "🚀 启动开发环境..."

# 检查端口是否被占用
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  端口 8080 已被占用，尝试终止..."
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
fi

# 启动 Rust 后端
echo "🔧 启动 Rust 后端..."
cd backend-rust
cargo run &
BACKEND_PID=$!

# 等待后端启动
sleep 3

# 启动前端
echo "🎨 启动前端开发服务器..."
cd ..
pnpm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 开发环境已启动!"
echo "   后端: http://localhost:8080"
echo "   前端: http://localhost:5173"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 捕获退出信号
trap "echo '🛑 停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# 等待进程
wait
