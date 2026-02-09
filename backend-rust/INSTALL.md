# Rust 安装指南

## macOS 安装

### 方法 1: 使用 rustup (推荐)

```bash
# 下载并安装 rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 配置当前 shell
source $HOME/.cargo/env

# 验证安装
rustc --version
cargo --version
```

### 方法 2: 使用 Homebrew

```bash
# 安装 Rust
brew install rust

# 验证安装
rustc --version
cargo --version
```

## 验证安装

```bash
# 检查 Rust 版本
rustc --version
# 应该输出类似: rustc 1.83.0 (或更高版本)

# 检查 Cargo 版本
cargo --version
# 应该输出类似: cargo 1.83.0 (或更高版本)

# 检查 Rust 工具链
rustup show
```

## 配置 Rust

### 增加编译速度

```bash
 # 使用更快的链接器
# macOS 需要先安装 lld
brew install llvm

# 配置使用 lld
mkdir -p ~/.cargo
cat > ~/.cargo/config.toml << 'EOF'
[target.x86_64-apple-darwin]
linker = "clang"
ar = "ar"
rustflags = ["-C", "link-arg=-fuse-ld=lld"]

[target.aarch64-apple-darwin]
linker = "clang"
ar = "ar"
rustflags = ["-C", "link-arg=-fuse-ld=lld"]
EOF
```

### 启用 nightly 工具链 (可选)

```bash
# 安装 nightly 版本
rustup install nightly

# 设置默认工具链
rustup default stable

# 或为特定项目使用 nightly
cd backend-rust
rustup override set nightly
```

## 常用命令

```bash
# 检查代码编译 (不构建)
cargo check

# 构建项目
cargo build

# 构建优化版本
cargo build --release

# 运行项目
cargo run

# 运行优化版本
cargo run --release

# 运行测试
cargo test

# 生成文档
cargo doc --open

# 代码格式化
cargo fmt

# 代码检查
cargo clippy

# 清理构建缓存
cargo clean
```

## 故障排查

### 问题: command not found: cargo

**解决方案**:
```bash
# 重新加载 shell 配置
source $HOME/.cargo/env

# 或重启终端
```

### 问题: 编译错误 - 缺少 OpenSSL

**解决方案**:
```bash
# macOS
brew install openssl

# 设置环境变量
export OPENSSL_DIR=/usr/local/opt/openssl
export OPENSSL_LIB_DIR=/usr/local/opt/openssl/lib
export OPENSSL_INCLUDE_DIR=/usr/local/opt/openssl/include
```

### 问题: 编译速度慢

**解决方案**:
```bash
# 使用更快的链接器 (见上方配置)
# 或使用 mold
brew install mold

# 在 ~/.cargo/config.toml 中配置
cat > ~/.cargo/config.toml << 'EOF'
[target.x86_64-apple-darwin]
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=mold"]
EOF
```

### 问题: 权限错误

**解决方案**:
```bash
# 修复权限
sudo chown -R $(whoami) ~/.cargo
sudo chown -R $(whoami) ~/.rustup
```

## IDE 支持

### VS Code

安装以下扩展:
1. **rust-analyzer** - Rust 语言服务器
2. **CodeLLDB** - 调试器
3. **Even Better TOML** - TOML 支持

配置 (`.vscode/settings.json`):
```json
{
  "rust-analyzer.checkOnSave.command": "clippy",
  "rust-analyzer.cargo.features": "all",
  "rust-analyzer.inlayHints.typeHints.enable": true,
  "rust-analyzer.inlayHints.parameterHints.enable": true
}
```

### IntelliJ IDEA / CLion

安装 **Rust 插件**:
1. 打开 Preferences
2. 搜索 "Rust"
3. 安装官方 Rust 插件

## 学习资源

- [Rust 程序设计语言](https://doc.rust-lang.org/book/)
- [通过例子学 Rust](https://rustwiki.org/zh-CN/rust-by-example/)
- [Rust 异步编程](https://rust-lang.github.io/async-book/)
- [Rust by Example](https://doc.rust-lang.org/rust-by-example/)

## 下一步

安装完成后，可以开始构建项目:

```bash
# 进入项目目录
cd backend-rust

# 检查代码
cargo check

# 构建项目
cargo build

# 运行项目
cargo run
```

## 获取帮助

如果遇到问题:
- [Rust 官方论坛](https://users.rust-lang.org/)
- [Rust 中文社区](https://rust.cc/)
- [Stack Overflow - Rust 标签](https://stackoverflow.com/questions/tagged/rust)
