# ipaTool

一个用于处理IPA文件的Web工具。

## 安装依赖

本项目使用 [pnpm](https://pnpm.io/) 作为包管理器。

### 安装 pnpm

如果你还没有安装 pnpm，可以通过以下命令安装：

```bash
npm install -g pnpm
```

或者使用 Homebrew（macOS）：

```bash
brew install pnpm
```

### 安装项目依赖

```bash
pnpm install
```

## 运行项目

```bash
pnpm start
```

## 项目结构

```
.
├── public/          # 静态资源文件
│   ├── index.html
│   ├── main.js
│   └── styles.css
├── src/            # 源代码文件
│   ├── client.js
│   ├── ipa.js
│   └── Signature.js
├── server.js       # 服务器入口文件
├── package.json    # 项目配置文件
└── .gitignore      # Git忽略文件配置
```

## 技术栈

- Node.js
- Express
- pnpm

## 许可证

MIT
