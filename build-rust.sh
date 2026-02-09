#!/bin/bash

# 构建脚本 - 用于打包可执行文件

set -e

echo "🔨 开始构建 Rust 后端..."

# 进入 Rust 项目目录
cd backend-rust

# 检查 Rust 工具链
if ! command -v cargo &> /dev/null; then
    echo "❌ 未找到 Rust，请先安装: https://rustup.rs/"
    exit 1
fi

# 构建优化版本
echo "📦 构建生产版本..."
cargo build --release

# 检查构建结果
if [ -f "target/release/ipa-webtool-backend" ]; then
    echo "✅ 构建成功!"
    echo "📁 可执行文件位置: backend-rust/target/release/ipa-webtool-backend"
    
    # 显示文件大小
    SIZE=$(du -h target/release/ipa-webtool-backend | cut -f1)
    echo "📊 文件大小: $SIZE"
    
    # 复制到根目录方便使用
    cp target/release/ipa-webtool-backend ../ipa-webtool-backend
    echo "📋 已复制到根目录: ipa-webtool-backend"
    
    echo ""
    echo "🚀 运行方式:"
    echo "   ./ipa-webtool-backend"
    echo ""
    echo "或使用 cargo:"
    echo "   cd backend-rust && cargo run --release"
else
    echo "❌ 构建失败"
    exit 1
fi
