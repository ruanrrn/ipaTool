# HTTPS 部署指南

本文档详细介绍如何为 IPA Web Tool 配置 HTTPS 部署，以启用 OTA 在线安装功能。

## 目录

- [为什么需要 HTTPS](#为什么需要-https)
- [快速开始](#快速开始)
- [方案一：Cloudflare Tunnel（推荐）](#方案一cloudflare-tunnel推荐)
- [方案二：Nginx + Let's Encrypt](#方案二nginx--lets-encrypt)
- [方案三：Caddy（自动 HTTPS）](#方案三caddy自动-https)
- [方案四：Traefik（Docker 环境）](#方案四traefikdocker-环境)
- [方案五：使用已有 SSL 证书](#方案五使用已有-ssl-证书)
- [验证 HTTPS 配置](#验证-https-配置)
- [常见问题](#常见问题)

---

## 为什么需要 HTTPS

iOS 系统出于安全考虑，**强制要求** OTA（Over-The-Air）安装 IPA 文件时必须使用 HTTPS 协议。如果使用 HTTP 访问，安装描述文件将无法正常工作。

**HTTPS 的好处：**
- ✅ 启用 OTA 在线安装功能
- ✅ 数据传输加密，保护账号安全
- ✅ 防止中间人攻击
- ✅ 提升用户信任度

---

## 快速开始

如果你只是想快速测试，推荐使用 **Cloudflare Tunnel**，无需域名配置，5 分钟即可完成。

```bash
# 安装 cloudflared
brew install cloudflared

# 启动隧道
cloudflared tunnel --url http://localhost:8080
```

访问生成的 HTTPS URL 即可！

---

## 方案一：Cloudflare Tunnel（推荐）

**优点：**
- ✅ 完全免费
- ✅ 无需域名配置
- ✅ 自动 HTTPS
- ✅ 内置 DDoS 防护
- ✅ 配置简单，5 分钟完成

**缺点：**
- ⚠️ 需要注册 Cloudflare 账号
- ⚠️ 依赖 Cloudflare 服务

### 步骤 1：安装 cloudflared

**macOS:**
```bash
brew install cloudflared
```

**Linux:**
```bash
# Ubuntu/Debian
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# CentOS/RHEL
yum install cloudflared -y

# 验证安装
cloudflared --version
```

**Windows:**
```powershell
# 使用 Chocolatey
choco install cloudflared

# 或手动下载
# https://github.com/cloudflare/cloudflared/releases/latest
```

### 步骤 2：启动隧道

**临时测试（推荐新手）：**
```bash
cloudflared tunnel --url http://localhost:8080
```

输出示例：
```
2024-02-12T10:00:00Z INF Your quick Tunnel has been created! 
Visit it at: https://random-name.trycloudflare.com
```

**永久隧道（推荐生产环境）：**

1. **登录 Cloudflare：**
```bash
cloudflared tunnel login
```

2. **创建隧道：**
```bash
cloudflared tunnel create my-ipa-tool
```

3. **配置隧道：**

创建配置文件 `~/.cloudflared/config.yml`：
```yaml
tunnel: <你的隧道ID>
credentials-file: /root/.cloudflared/<你的隧道ID>.json

ingress:
  - hostname: your-domain.com
    service: http://localhost:8080
  - service: http_status:404
```

4. **启动服务：**
```bash
# 测试配置
cloudflared tunnel run my-ipa-tool

# 安装为系统服务（Linux）
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

### 步骤 3：配置 DNS

在 Cloudflare 控制台添加 CNAME 记录：
```
类型: CNAME
名称: your-domain.com
目标: <你的隧道ID>.cfargotunnel.com
代理: 已启用
```

### 步骤 4：验证访问

访问 `https://your-domain.com`，应该能看到 IPA Web Tool 界面。

---

## 方案二：Nginx + Let's Encrypt

**优点：**
- ✅ 完全免费
- ✅ 行业标准方案
- ✅ 性能优秀
- ✅ 自动续期

**缺点：**
- ⚠️ 需要有域名
- ⚠️ 需要 80 端口用于验证
- ⚠️ 配置相对复杂

### 步骤 1：安装 Nginx 和 Certbot

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y
```

**CentOS/RHEL:**
```bash
sudo yum install nginx certbot python3-certbot-nginx -y
```

**macOS:**
```bash
brew install nginx certbot
```

### 步骤 2：配置 Nginx

创建配置文件 `/etc/nginx/sites-available/ipa-webtool`：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 用于 Let's Encrypt 验证
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # 其他请求重定向到 HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL 证书（稍后配置）
    # ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # 日志
    access_log /var/log/nginx/ipa-webtool-access.log;
    error_log /var/log/nginx/ipa-webtool-error.log;
    
    # 反向代理
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

启用配置：
```bash
# Ubuntu/Debian
sudo ln -s /etc/nginx/sites-available/ipa-webtool /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# CentOS/RHEL
sudo nginx -t
sudo systemctl reload nginx
```

### 步骤 3：获取 SSL 证书

```bash
# 停止 Nginx（使用 standalone 模式）
sudo systemctl stop nginx

# 获取证书
sudo certbot certonly --standalone -d your-domain.com

# 重启 Nginx
sudo systemctl start nginx
```

### 步骤 4：启用 SSL

取消注释 Nginx 配置中的 SSL 证书行：
```bash
sudo nano /etc/nginx/sites-available/ipa-webtool
```

修改为：
```nginx
ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
```

重载配置：
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 步骤 5：设置自动续期

```bash
# 测试续期
sudo certbot renew --dry-run

# 添加定时任务（每天凌晨 2 点检查）
sudo crontab -e
```

添加：
```
0 2 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

---

## 方案三：Caddy（自动 HTTPS）

**优点：**
- ✅ 自动 HTTPS，无需手动配置
- ✅ 配置极其简单
- ✅ 自动续期
- ✅ 内置 Let's Encrypt 集成

**缺点：**
- ⚠️ 相对较新
- ⚠️ 需要有域名
- ⚠️ 需要 80/443 端口

### 步骤 1：安装 Caddy

**macOS:**
```bash
brew install caddy
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

**Windows:**
```powershell
choco install caddy
```

### 步骤 2：创建 Caddyfile

创建 `Caddyfile`：
```caddy
your-domain.com {
    reverse_proxy localhost:8080
    
    # 日志
    log {
        output file /var/log/caddy/ipa-webtool.log
    }
}
```

### 步骤 3：启动 Caddy

**手动启动：**
```bash
sudo caddy run --config Caddyfile
```

**系统服务：**
```bash
# 复制配置文件
sudo cp Caddyfile /etc/caddy/Caddyfile

# 启动服务
sudo systemctl enable caddy
sudo systemctl start caddy

# 查看状态
sudo systemctl status caddy
```

### 步骤 4：验证

访问 `https://your-domain.com`，Caddy 会自动获取并配置 SSL 证书。

---

## 方案四：Traefik（Docker 环境）

**优点：**
- ✅ 原生 Docker 支持
- ✅ 自动服务发现
- ✅ 自动 HTTPS
- ✅ 内置监控面板

**缺点：**
- ⚠️ 配置较复杂
- ⚠️ 学习曲线较陡

### 步骤 1：创建 docker-compose.yml

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.email=your-email@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"  # Traefik Dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./letsencrypt:/letsencrypt
    restart: unless-stopped

  ipa-webtool:
    image: ipa-webtool:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.ipa-webtool.rule=Host(`your-domain.com`)"
      - "traefik.http.routers.ipa-webtool.entrypoints=websecure"
      - "traefik.http.routers.ipa-webtool.tls.certresolver=letsencrypt"
      - "traefik.http.services.ipa-webtool.loadbalancer.server.port=8080"
    restart: unless-stopped
```

### 步骤 2：启动服务

```bash
docker-compose up -d
```

### 步骤 3：访问

- 应用: `https://your-domain.com`
- Traefik Dashboard: `http://localhost:8080`

---

## 方案五：使用已有 SSL 证书

如果你已经有 SSL 证书（如从 CA 购买），可以直接使用。

### 步骤 1：准备证书文件

确保你有以下文件：
- `cert.pem` - 证书文件
- `key.pem` - 私钥文件
- 可能还需要 `chain.pem` - 证书链

### 步骤 2：配置 Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_certificate_chain /path/to/chain.pem;  # 如果有
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 步骤 3：重载配置

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 验证 HTTPS 配置

### 1. 检查 SSL 证书

```bash
# 使用 openssl
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# 使用 curl
curl -Iv https://your-domain.com

# 在线工具
# https://www.ssllabs.com/ssltest/
```

### 2. 测试 OTA 安装

1. 在 Safari 中访问 `https://your-domain.com`
2. 搜索并下载一个应用
3. 下载完成后，点击"安装"按钮
4. 系统应该弹出安装描述文件
5. 按照提示安装应用

### 3. 检查证书有效期

```bash
echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates
```

---

## 常见问题

### Q1: 证书验证失败

**问题：** `ERR_CERT_AUTHORITY_INVALID`

**解决方案：**
- 确保域名 DNS 正确解析
- 检查防火墙是否开放 80/443 端口
- 等待 DNS 传播（最多 48 小时）

### Q2: Let's Encrypt 速率限制

**问题：** `Too many certificates already issued`

**解决方案：**
- Let's Encrypt 有速率限制（每周 5 次）
- 使用 `--staging` 参数测试配置
- 等待一周后重试
- 或使用 Let's Encrypt 生产环境限制

### Q3: 混合内容警告

**问题：** 浏览器控制台显示 `Mixed Content` 错误

**解决方案：**
- 确保所有资源都使用 HTTPS
- 检查 API 请求是否使用 `https://`
- 使用相对路径而非绝对路径

### Q4: WebSocket 连接失败

**问题：** 实时更新功能不工作

**解决方案：**
Nginx 配置中添加：
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### Q5: 证书自动续期失败

**问题：** 证书过期后未自动续期

**解决方案：**
```bash
# 手动测试续期
sudo certbot renew --dry-run

# 检查定时任务
sudo crontab -l

# 查看 certbot 日志
sudo journalctl -u certbot.timer
```

### Q6: Cloudflare Tunnel 无法访问

**问题：** `502 Bad Gateway`

**解决方案：**
- 确保本地服务正在运行：`curl http://localhost:8080`
- 检查 cloudflared 日志
- 重新启动隧道

### Q7: 端口被占用

**问题：** `Error: listen tcp :443: bind: address already in use`

**解决方案：**
```bash
# 查看占用端口的进程
sudo lsof -i :443

# 停止占用端口的进程
sudo systemctl stop nginx  # 或其他服务

# 或更改端口
```

---

## 推荐方案总结

| 方案 | 难度 | 成本 | 适用场景 |
|------|------|------|----------|
| Cloudflare Tunnel | ⭐ | 免费 | 快速测试、个人使用 |
| Nginx + Let's Encrypt | ⭐⭐⭐ | 免费 | 生产环境、有域名 |
| Caddy | ⭐⭐ | 免费 | 简单部署、自动 HTTPS |
| Traefik | ⭐⭐⭐⭐ | 免费 | Docker 环境、微服务 |
| 已有证书 | ⭐⭐ | 付费 | 企业环境、已有证书 |

---

## 参考资源

- [Let's Encrypt 文档](https://letsencrypt.org/docs/)
- [Certbot 官方文档](https://certbot.eff.org/docs/)
- [Nginx SSL 配置](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [Caddy 文档](https://caddyserver.com/docs/)
- [Cloudflare Tunnel 文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Traefik 文档](https://doc.traefik.io/traefik/)

---

## 获取帮助

如果遇到问题：

1. 查看日志文件
2. 搜索错误信息
3. 提交 [GitHub Issue](https://github.com/ruanrrn/ipaTool/issues)

---

**最后更新：** 2026-02-12
