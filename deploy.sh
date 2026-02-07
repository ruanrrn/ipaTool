#!/bin/bash

# ESA Pages / EdgeOne Pages 部署脚本

set -e

echo "🚀 开始部署到 ESA Pages / EdgeOne Pages..."
echo ""

# 检查是否在正确的分支
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "feature/esa-pages-deployment" ]; then
  echo "⚠️  警告：当前不在 feature/esa-pages-deployment 分支"
  echo "当前分支: $BRANCH"
  read -p "是否继续？(y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# 安装依赖
echo "📦 安装依赖..."
pnpm install

# 构建前端
echo "🔨 构建前端..."
pnpm run build

# 检查构建结果
if [ ! -d "dist" ]; then
  echo "❌ 构建失败：dist 目录不存在"
  exit 1
fi

echo "✅ 构建成功！"
echo ""

# 显示部署选项
echo "请选择部署平台："
echo "1. 阿里云 ESA Pages"
echo "2. 腾讯云 EdgeOne Pages"
echo "3. Vercel (测试)"
echo "4. 仅构建（手动部署）"
echo ""
read -p "请输入选项 (1-4): " choice

case $choice in
  1)
    echo "🚀 部署到阿里云 ESA Pages..."
    if command -v esa &> /dev/null; then
      esa deploy
    else
      echo "❌ 未安装 ESA CLI"
      echo "请运行: npm install -g @alicloud/esa-cli"
      exit 1
    fi
    ;;
  2)
    echo "🚀 部署到腾讯云 EdgeOne Pages..."
    echo "请通过 EdgeOne 控制台部署"
    echo "或安装 EdgeOne CLI"
    ;;
  3)
    echo "🚀 部署到 Vercel..."
    if command -v vercel &> /dev/null; then
      vercel --prod
    else
      echo "❌ 未安装 Vercel CLI"
      echo "请运行: npm install -g vercel"
      exit 1
    fi
    ;;
  4)
    echo "✅ 构建完成，请手动部署"
    echo "构建产物: dist/"
    echo "API 函数: api/"
    ;;
  *)
    echo "❌ 无效选项"
    exit 1
    ;;
esac

echo ""
echo "🎉 部署完成！"
echo ""
echo "📝 注意事项："
echo "1. 当前使用内存存储，函数重启后数据会丢失"
echo "2. 建议配置云数据库以实现数据持久化"
echo "3. 查看部署文档: DEPLOYMENT.md"
