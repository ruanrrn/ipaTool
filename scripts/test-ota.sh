#!/bin/bash

# 测试 OTA 安装功能的脚本
# 注意：此脚本需要在 Rust 后端成功编译并启动后运行

echo "================================"
echo "OTA 安装功能测试"
echo "================================"

BASE_URL="${1:-http://localhost:8080}"

echo ""
echo "测试环境: $BASE_URL"
echo ""

# 测试 1: 生成 plist 文件
echo "测试 1: 生成 plist 文件"
MANIFEST_URL="${BASE_URL}/manifest?url=https%3A%2F%2Fexample.com%2Fapp.ipa&bundle_id=com.example.app&bundle_version=1.0.0&title=Test%20App"
echo "请求: $MANIFEST_URL"

# 使用 curl 请求 plist 文件
curl -s "$MANIFEST_URL" -o /tmp/test_manifest.plist

if [ -f /tmp/test_manifest.plist ]; then
    echo "✓ plist 文件已生成"
    echo "内容预览:"
    head -20 /tmp/test_manifest.plist
else
    echo "✗ plist 文件生成失败"
fi

echo ""
echo "================================"
echo ""

# 测试 2: 生成 mobileconfig 文件
echo "测试 2: 生成 mobileconfig 文件"
INSTALL_URL="${BASE_URL}/install?manifest=${MANIFEST_URL}"
echo "请求: $INSTALL_URL"

curl -s "$INSTALL_URL" -o /tmp/test_install.mobileconfig

if [ -f /tmp/test_install.mobileconfig ]; then
    echo "✓ mobileconfig 文件已生成"
    echo "内容预览:"
    head -20 /tmp/test_install.mobileconfig
else
    echo "✗ mobileconfig 文件生成失败"
fi

echo ""
echo "================================"
echo ""

# 检查文件内容
echo "测试 3: 验证文件内容"
if [ -f /tmp/test_manifest.plist ]; then
    if grep -q "SoftwarePackageURL" /tmp/test_manifest.plist; then
        echo "✓ plist 文件包含必需的 SoftwarePackageURL 字段"
    else
        echo "✗ plist 文件缺少 SoftwarePackageURL 字段"
    fi

    if grep -q "bundle-identifier" /tmp/test_manifest.plist; then
        echo "✓ plist 文件包含 bundle-identifier 字段"
    else
        echo "✗ plist 文件缺少 bundle-identifier 字段"
    fi
fi

if [ -f /tmp/test_install.mobileconfig ]; then
    if grep -q "itms-services://" /tmp/test_install.mobileconfig; then
        echo "✓ mobileconfig 文件包含 itms-services:// 协议"
    else
        echo "✗ mobileconfig 文件缺少 itms-services:// 协议"
    fi

    if grep -q "PayloadType" /tmp/test_install.mobileconfig; then
        echo "✓ mobileconfig 文件包含 PayloadType 字段"
    else
        echo "✗ mobileconfig 文件缺少 PayloadType 字段"
    fi
fi

echo ""
echo "================================"
echo "测试完成"
echo "================================"
echo ""
echo "生成的文件:"
echo "- /tmp/test_manifest.plist"
echo "- /tmp/test_install.mobileconfig"
