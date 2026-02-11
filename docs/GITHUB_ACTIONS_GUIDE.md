# GitHub Actions 指南

本文档详细介绍 IPA Web Tool 项目的 CI/CD 流程和 GitHub Actions 配置。

## 目录

- [概述](#概述)
- [工作流文件](#工作流文件)
- [CI 工作流](#ci-工作流)
- [Docker 构建工作流](#docker-构建工作流)
- [版本发布工作流](#版本发布工作流)
- [手动触发工作流](#手动触发工作流)
- [本地测试 Actions](#本地测试-actions)
- [故障排查](#故障排查)

---

## 概述

本项目使用 GitHub Actions 实现自动化 CI/CD，包括：

- **持续集成（CI）** - 自动运行测试和代码检查
- **Docker 构建** - 自动构建和推送 Docker 镜像
- **版本发布** - 自动创建 GitHub Release
- **手动部署** - 支持手动触发部署流程

### 工作流触发条件

| 工作流 | 触发条件 |
|--------|----------|
| CI | Pull Request、Push 到 main 分支 |
| Docker Build | Push 到 main 分支、版本标签、手动触发 |
| Release | 创建版本标签 |

---

## 工作流文件

所有工作流配置文件位于 `.github/workflows/` 目录：

```
.github/
└── workflows/
    ├── ci.yml              # CI 测试工作流
    ├── docker-build.yml    # Docker 构建工作流
    └── release.yml         # 版本发布工作流
```

---

## CI 工作流

### 文件位置

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

### 功能说明

CI 工作流在以下情况自动运行：

- Pull Request 创建或更新
- 代码推送到 `main` 分支

### 检查项目

1. **代码格式检查**
   - Rust: `cargo fmt --check`
   - 前端: ESLint

2. **代码质量检查**
   - Rust: `cargo clippy`
   - 前端: Prettier

3. **单元测试**
   - Rust: `cargo test`
   - 前端: Vitest

4. **构建验证**
   - 前端: `pnpm run build`
   - 后端: `cargo build`

### 工作流配置示例

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout 代码
        uses: actions/checkout@v4
      
      - name: 安装 Rust
        uses: actions-rust-lang/setup-rust-toolchain@v1
      
      - name: 安装 Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: 安装 pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: 安装依赖
        run: pnpm install
      
      - name: 运行 Rust 测试
        run: |
          cd server
          cargo test --verbose
      
      - name: 运行前端测试
        run: pnpm test
      
      - name: 构建验证
        run: |
          pnpm run build
          cd server
          cargo build --release
```

### 查看结果

1. 进入 Pull Request 页面
2. 滚动到页面底部
3. 查看 "Checks" 部分
4. 点击 "Details" 查看详细日志

---

## Docker 构建工作流

### 文件位置

[`.github/workflows/docker-build.yml`](../.github/workflows/docker-build.yml)

### 功能说明

自动构建 Docker 镜像并推送到 Docker Hub。

### 触发条件

- 推送到 `main` 分支
- 创建版本标签（如 `v1.0.0`）
- 手动触发

### 工作流配置示例

```yaml
name: Docker Build

on:
  push:
    branches: [main]
    tags:
      - 'v*.*.*'
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout 代码
        uses: actions/checkout@v4
      
      - name: 设置 Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: 登录 Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: 提取元数据
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: your-dockerhub-username/ipa-webtool
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-
      
      - name: 构建并推送
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 必需的 Secrets

在 GitHub 仓库设置中添加以下 Secrets：

| Secret 名称 | 说明 | 获取方式 |
|-------------|------|----------|
| `DOCKER_USERNAME` | Docker Hub 用户名 | Docker Hub 账号 |
| `DOCKER_PASSWORD` | Docker Hub 密码/访问令牌 | Docker Hub → Account Settings → Security → New Access Token |

### 配置 Secrets

1. 进入仓库设置页面
2. 点击 "Secrets and variables" → "Actions"
3. 点击 "New repository secret"
4. 添加上述 Secrets

### 镜像标签策略

| 触发条件 | 生成的标签 | 示例 |
|----------|------------|------|
| Push to main | `main-<sha>` | `main-a1b2c3d` |
| Tag `v1.2.3` | `v1.2.3`, `v1.2`, `v1` | `v1.2.3`, `v1.2`, `v1` |
| Latest | `latest` | `latest` |

---

## 版本发布工作流

### 文件位置

[`.github/workflows/release.yml`](../.github/workflows/release.yml)

### 功能说明

创建版本标签时自动创建 GitHub Release。

### 触发条件

- 推送版本标签（如 `v1.0.0`）

### 工作流配置示例

```yaml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout 代码
        uses: actions/checkout@v4
      
      - name: 提取版本号
        id: version
        run: echo "version=${GITHUB_REF#refs/tags/}" >> $GITHUB_OUTPUT
      
      - name: 生成 Release Notes
        id: release_notes
        run: |
          echo "## 🎉 Release ${{ steps.version.outputs.version }}" > release_notes.md
          echo "" >> release_notes.md
          echo "### 📦 变更内容" >> release_notes.md
          echo "" >> release_notes.md
          echo "请查看 [CHANGELOG.md](https://github.com/ruanrrn/ipaTool/blob/main/CHANGELOG.md)" >> release_notes.md
      
      - name: 创建 Release
        uses: softprops/action-gh-release@v1
        with:
          body_path: release_notes.md
          draft: false
          prerelease: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 创建版本发布

**方法 1: 使用 Git 标签**

```bash
# 1. 更新版本号
echo "1.0.0" > VERSION

# 2. 提交变更
git add VERSION
git commit -m "Bump version to 1.0.0"

# 3. 创建标签
git tag v1.0.0

# 4. 推送标签
git push origin v1.0.0
```

**方法 2: 使用 GitHub 界面**

1. 进入仓库页面
2. 点击 "Releases" → "Create a new release"
3. 选择标签或创建新标签
4. 填写 Release 标题和描述
5. 点击 "Publish release"

---

## 手动触发工作流

### 使用 GitHub 界面

1. 进入仓库的 "Actions" 页面
2. 选择要运行的工作流
3. 点击 "Run workflow"
4. 选择分支
5. 点击 "Run workflow"

### 使用 GitHub CLI

```bash
# 安装 GitHub CLI
brew install gh

# 登录
gh auth login

# 触发工作流
gh workflow run docker-build.yml

# 查看工作流运行状态
gh run list

# 查看特定运行的日志
gh run view <run-id> --log
```

---

## 本地测试 Actions

### 使用 Act

[Act](https://github.com/nektos/act) 是一个可以在本地运行 GitHub Actions 的工具。

#### 安装 Act

**macOS:**
```bash
brew install act
```

**Linux:**
```bash
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
```

#### 使用 Act

```bash
# 列出所有工作流
act -l

# 运行所有工作流
act -n

# 运行特定工作流
act -j test

# 使用 Docker 镜像
act -P ubuntu-latest=catthehacker/ubuntu:act-latest

# 查看环境变量
act -n -v
```

### 本地测试脚本

创建 `scripts/test-ci.sh`：

```bash
#!/bin/bash

set -e

echo "🔍 运行代码格式检查..."
cargo fmt --all -- --check
pnpm run format:check

echo "🔍 运行代码质量检查..."
cargo clippy --all-targets --all-features -- -D warnings
pnpm run lint

echo "🧪 运行测试..."
cargo test
pnpm test

echo "📦 验证构建..."
pnpm run build
cd server && cargo build --release

echo "✅ 所有检查通过！"
```

运行：
```bash
chmod +x scripts/test-ci.sh
./scripts/test-ci.sh
```

---

## 故障排查

### 常见问题

#### 1. Docker 登录失败

**错误信息：**
```
Error: Username and password required
```

**解决方案：**
- 检查 `DOCKER_USERNAME` 和 `DOCKER_PASSWORD` Secrets 是否正确
- 确认 Docker Hub 访问令牌有写入权限
- 重新生成访问令牌

#### 2. 构建缓存问题

**错误信息：**
```
Error: failed to solve: failed to load cache
```

**解决方案：**
```yaml
# 在工作流中禁用缓存
- name: 构建并推送
  uses: docker/build-push-action@v5
  with:
    cache-from: ""  # 禁用缓存
    cache-to: ""    # 禁用缓存
```

#### 3. Rust 依赖下载慢

**解决方案：**
```yaml
- name: 配置 Rust 缓存
  uses: Swatinem/rust-cache@v2
  with:
    workspaces: server -> target
```

#### 4. pnpm 安装失败

**错误信息：**
```
Error: pnpm command not found
```

**解决方案：**
```yaml
- name: 安装 pnpm
  uses: pnpm/action-setup@v2
  with:
    version: 8
  run_install: false  # 不要自动安装依赖

- name: 安装依赖
  run: pnpm install
```

#### 5. 权限错误

**错误信息：**
```
Error: Resource not accessible by integration
```

**解决方案：**
```yaml
# 在工作流中添加权限
permissions:
  contents: read
  packages: write
```

### 调试技巧

#### 1. 启用调试日志

在仓库 Secrets 中添加：
- `ACTIONS_STEP_DEBUG`: `true`
- `ACTIONS_RUNNER_DEBUG`: `true`

#### 2. 使用 tmate 进行交互式调试

```yaml
- name: 设置 tmate 会话
  uses: mxschmitt/action-tmate@v3
  if: failure()
```

#### 3. 保存构建产物

```yaml
- name: 上传构建产物
  uses: actions/upload-artifact@v3
  with:
    name: dist
    path: dist/
```

#### 4. 查看环境变量

```yaml
- name: 显示环境变量
  run: |
    echo "Home: ${HOME}"
    echo "GITHUB_WORKFLOW: ${GITHUB_WORKFLOW}"
    echo "GITHUB_REF: ${GITHUB_REF}"
    env | sort
```

---

## 最佳实践

### 1. 使用矩阵构建

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        rust: [stable, beta, nightly]
    steps:
      - uses: actions/checkout@v4
      - uses: actions-rust-lang/setup-rust-toolchain@v1
        with:
          toolchain: ${{ matrix.rust }}
```

### 2. 使用复合操作

创建 `.github/actions/setup/action.yml`：

```yaml
name: 'Setup Environment'
description: 'Setup Rust and Node.js'
runs:
  using: 'composite'
  steps:
    - name: Setup Rust
      uses: actions-rust-lang/setup-rust-toolchain@v1
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'pnpm'
    
    - name: Install pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 8
```

使用：
```yaml
steps:
  - name: Setup Environment
    uses: ./.github/actions/setup
```

### 3. 使用依赖缓存

```yaml
- name: Cache Cargo
  uses: actions/cache@v3
  with:
    path: |
      ~/.cargo/registry
      ~/.cargo/git
      target/
    key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

- name: Cache pnpm
  uses: actions/cache@v3
  with:
    path: |
      ~/.pnpm-store
      node_modules
    key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
```

### 4. 并行执行

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps: [...]
  
  test:
    runs-on: ubuntu-latest
    steps: [...]
  
  build:
    needs: [lint, test]  # 等待 lint 和 test 完成
    runs-on: ubuntu-latest
    steps: [...]
```

### 5. 条件执行

```yaml
- name: 部署到生产环境
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  run: |
    echo "Deploying to production..."
```

---

## 参考资源

- [GitHub Actions 官方文档](https://docs.github.com/en/actions)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [Rust Setup Action](https://github.com/actions-rust-lang/setup-rust-toolchain)
- [pnpm Setup Action](https://github.com/pnpm/action-setup)
- [Act - 本地运行 Actions](https://github.com/nektos/act)

---

## 获取帮助

如果遇到问题：

1. 查看 [Actions 运行日志](https://github.com/ruanrrn/ipaTool/actions)
2. 搜索 [GitHub Actions 文档](https://docs.github.com/en/actions)
3. 提交 [GitHub Issue](https://github.com/ruanrrn/ipaTool/issues)

---

**最后更新：** 2026-02-12
