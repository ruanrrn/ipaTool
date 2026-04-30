#!/bin/bash
# 同步前后端版本号脚本
# 使用方法: ./sync-version.sh [version]
# 如果不提供版本号，则从 package.json 读取并同步到 Cargo.toml

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -n "$1" ]; then
    # 使用命令行参数作为版本号
    VERSION="$1"
    echo "Setting version to: $VERSION"
    
    # 更新 package.json
    if command -v npm &> /dev/null; then
        npm version "$VERSION" --no-git-tag-version
    else
        # 手动更新 package.json
        TEMP_FILE=$(mktemp)
        jq ".version = \"$VERSION\"" package.json > "$TEMP_FILE"
        mv "$TEMP_FILE" package.json
    fi
else
    # 从 package.json 读取版本号
    VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.0")
    echo "Current version from package.json: $VERSION"
fi

# 验证版本号格式
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Invalid version format. Expected format: x.y.z (e.g., 1.0.0)"
    exit 1
fi

# 更新 Cargo.toml
echo "Updating server/Cargo.toml to version $VERSION"
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/^version = \".*\"/version = \"$VERSION\"/" server/Cargo.toml
else
    # Linux
    sed -i "s/^version = \".*\"/version = \"$VERSION\"/" server/Cargo.toml
fi

# 验证更新
CARGO_VERSION=$(grep "^version = " server/Cargo.toml | head -1 | sed 's/version = "\(.*\)"/\1/')
PACKAGE_VERSION=$(node -p "require('./package.json').version")

echo ""
echo "✅ Version sync complete!"
echo "   package.json: $PACKAGE_VERSION"
echo "   Cargo.toml:   $CARGO_VERSION"

if [ "$PACKAGE_VERSION" != "$CARGO_VERSION" ]; then
    echo "⚠️  Warning: Versions don't match!"
    exit 1
fi
