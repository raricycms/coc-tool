# 部署指南

Coc-tools 是 monorepo（npm workspaces），由三个常驻进程组成：

| 进程 | 作用 | 默认端口 | 启动命令 |
| --- | --- | --- | --- |
| `apps/web` | Next.js 15 前端 + Route Handlers | `7766`（可改） | `next start -p 7766` |
| `apps/realtime` | Fastify + Socket.IO 实时服务 | `4000`（可改） | `node apps/realtime/dist/server.js` |
| `packages/db` | Prisma 客户端 + schema | — | 不单独启动，嵌在 web / realtime 进程里 |

数据库开发用 SQLite（`packages/db/prisma/dev.db`）；生产建议切到 PostgreSQL（见 [§3 切到 Postgres](#3-切到-postgresql-可选)）。

---

## 0. 前置条件

- Linux 服务器（Ubuntu 22.04+ / Debian 12+），Node.js ≥ 20，npm ≥ 10。
- 一个能反向代理的入口（nginx / Caddy / Cloudflare Tunnel 任选）。
- 一个域名（例如 `coc.example.com`），并能签发 TLS 证书（Let's Encrypt）。
- **生产必须用 HTTPS**：`apps/web` 的 session Cookie 通过 `WEB_ORIGIN` 协议决定是否带 `Secure`，跨源的 socket.io 也只有 HTTPS 才能正常带 cookie / token。

---

## 1. 首次部署

### 1.1 拉代码 & 装依赖

```bash
git clone <repo-url> /opt/coc-tools
cd /opt/coc-tools
npm ci --omit=dev   # 只装 prod 依赖
npm ci              # 或者保留 dev（typecheck / build 时要用）
```

### 1.2 写 `.env`

```bash
cp .env.example .env
$EDITOR .env
```

把以下字段改成生产值：

```ini
# 强烈建议：32+ 字节随机
SESSION_SECRET=<openssl rand -hex 32>

# 对外 HTTPS 域名（影响 session Cookie 的 Secure 标记）
WEB_ORIGIN=https://coc.example.com

# 实时服务监听端口（仅本机；外层用 nginx 反代）
REALTIME_PORT=4000

# 浏览器侧 socket.io 直连地址（同源反代时与 WEB_ORIGIN 一致；
# 跨源时填 https://coc.example.com/realtime 这种前缀，详见 §2.2）
NEXT_PUBLIC_WS_URL=https://coc.example.com

LOG_LEVEL=info

# 数据库（SQLite 直接落地到磁盘，Postgres 用连接串）
DATABASE_URL="file:./prisma/prod.db"
# 或：DATABASE_URL="postgresql://user:pass@127.0.0.1:5432/coc?schema=public"
```

> ⚠️ 不要把 `.env` 提交到 git。仓库已 `.gitignore`。

### 1.3 数据库初始化

```bash
# 推 schema 到 dev.db（SQLite 直接落地文件）
npm run db:push

# 如果走 Postgres，先建库再：
DATABASE_URL="postgresql://..." npm run db:migrate
```

### 1.4 构建

```bash
npm run build
```

会编译 `apps/web`（`.next/`）和 `apps/realtime`（`apps/realtime/dist/`）。

---

## 2. 反向代理 / 跨源 WebSocket

实时服务跑在 4000 端口，浏览器在 7766 端口。两者之间有两种部署姿势，二选一即可。

### 2.1 路径前缀反代（推荐，零跨源）

让 nginx 把 `/socket.io/` 和 `/realtime/` 全部反代到 4000 端口，前端只暴露 7766。**浏览器只会看到 7766 一个源**，session Cookie 自然带上跨路径的 socket.io 握手，没有 sameSite / CORS 烦恼。

nginx 示例：

```nginx
server {
  listen 443 ssl http2;
  server_name coc.example.com;

  ssl_certificate     /etc/letsencrypt/live/coc.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/coc.example.com/privkey.pem;

  # 长连接超时：实时服务靠 WebSocket 长连
  proxy_http_version 1.1;
  proxy_set_header Host              $host;
  proxy_set_header X-Real-IP         $remote_addr;
  proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_read_timeout 3600s;
  proxy_send_timeout 3600s;

  # 实时服务（socket.io 默认路径是 /socket.io）
  location /socket.io/ {
    proxy_pass http://127.0.0.1:4000/socket.io/;
  }

  # realtime 自带的 /health（可选：放给监控）
  location = /realtime-health {
    proxy_pass http://127.0.0.1:4000/health;
  }

  # Next.js
  location / {
    proxy_pass http://127.0.0.1:7766;
  }
}
```

此时：

```ini
NEXT_PUBLIC_WS_URL=https://coc.example.com   # 浏览器通过同一域名连 WebSocket
```

### 2.2 子域 / 跨源反代

如果实时服务单独挂在另一个域名（例如 `ws.example.com`），则属于跨源场景。**必须配合 [`/api/auth/ws-token`](#30-api-auth-ws-token跨源-websocket-认证) 才能连上**，否则浏览器因为 `sameSite=lax` 不带 session Cookie，realtime 一直返回 `unauthorized: no token`。

nginx 示例：

```nginx
server {
  listen 443 ssl http2;
  server_name coc.example.com;
  # ... Next.js 反代到 127.0.0.1:7766
}

server {
  listen 443 ssl http2;
  server_name ws.example.com;
  # ... realtime 反代到 127.0.0.1:4000
  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
  }
}
```

此时 `realtime` 进程必须允许 `coc.example.com` 跨源：

```ini
WEB_ORIGIN=https://coc.example.com
```

### 3.0 /api/auth/ws-token（跨源 WebSocket 认证）

跨源时 socket.io 握手拿不到 session Cookie，前端会先 `GET /api/auth/ws-token`（同源带 Cookie）拿一份 JWT 副本，再通过 `socket.io` 的 `auth.token` 传给 realtime。**此端点已内置，跨源部署必须保留**（默认就开着）。

---

## 4. systemd 单元

把两个进程用 systemd 管理：

`/etc/systemd/system/coc-realtime.service`：

```ini
[Unit]
Description=Coc-tools realtime (Fastify + Socket.IO)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/coc-tools
EnvironmentFile=/opt/coc-tools/.env
ExecStart=/usr/bin/node apps/realtime/dist/server.js
Restart=on-failure
RestartSec=5
User=coc
Group=coc

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/coc-web.service`：

```ini
[Unit]
Description=Coc-tools web (Next.js)
After=network.target coc-realtime.service

[Service]
Type=simple
WorkingDirectory=/opt/coc-tools
EnvironmentFile=/opt/coc-tools/.env
ExecStart=/usr/bin/npx next start -p 7766
Restart=on-failure
RestartSec=5
User=coc
Group=coc

[Install]
WantedBy=multi-user.target
```

启用：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now coc-realtime coc-web
sudo systemctl status coc-realtime coc-web
```

日志：`journalctl -u coc-web -f` / `journalctl -u coc-realtime -f`。

---

## 5. 升级流程

```bash
cd /opt/coc-tools
git pull
npm ci
npm run build
npm run db:migrate     # 有新 migration 才需要
sudo systemctl restart coc-realtime coc-web
```

> 升级期间会出现短暂断连。`realtime` 内每个 Session 的内存时钟状态会丢失（重启会从数据库的 `inGameTime/inGameDate` 重建，运行中的 `clockRunning` 状态需要预先 persist）——线上升级前建议先把所有团暂停时钟。

---

## 6. 备份

- **SQLite**：直接打包 `packages/db/prisma/prod.db`（升级或重启前停 `coc-realtime` 避免半写状态）。
- **Postgres**：`pg_dump -Fc coc > backup.dump`，加进 cron 即可。
- 不要忘了 `.env`（在仓库外单独保存一份加密备份，否则重装后 SESSION_SECRET 一变所有 Cookie 失效）。

---

## 7. 监控 / 健康检查

- realtime 自带 `GET /health`：反代后 `https://coc.example.com/realtime-health`，挂监控即可。
- web 没有公开 `/health`，可以用外部 HTTP 探针打首页 `200`。
- 当前 captcha / 限频是**单进程内存**（`Map`）。多实例横向扩展前必须迁到 Redis（见 [`ARCHITECTURE.md`](./ARCHITECTURE.md) 与 [`plan/remaining-work.md`](./plan/remaining-work.md)）。

---

## 8. 排错速查

| 症状 | 看哪里 | 修复 |
| --- | --- | --- |
| 进入跑团页一直显示「连接已断开，正在重连…」 | realtime 日志：`unauthorized: no token` | 没跨源：检查 nginx 是否漏配 `/socket.io/`；跨源：检查 `WEB_ORIGIN` 和 `NEXT_PUBLIC_WS_URL` 是否匹配 |
| 同上，但 realtime 日志是 `unauthorized: invalid token` | 两端 `SESSION_SECRET` 不一致（web 签的 JWT 在 realtime 验不过） | 两端都用 `set -a && source .env && set +a` 启动，或在 systemd 单元加 `EnvironmentFile=/opt/coc-tools/.env`。运行 `node apps/web/tests/e2e/ws-flow.mjs` 会先对账 fingerprint 并直接报出哪一端用了不同的密钥 |
| 启动 realtime 立刻看到大段红色边框的「启动被拒绝」 | SESSION_SECRET 未设置或仍是仓库占位串 | 这是有意为之的 fail-loud。按提示 `set -a && source .env && set +a` 再启动 |
| 登录后 Cookie 没生效，跳回 `/login` | `apps/web` 日志 + 浏览器 Cookie 面板 | `WEB_ORIGIN` 是否 `https://`；若 `http` 部署又想让 Cookie 带 Secure，浏览器会静默丢弃 |
| 注册报 500 | web 日志 `Environment variable not found: DATABASE_URL` | systemd 没读 `.env`，给单元加 `EnvironmentFile=` |
| 时钟升级后回退 | realtime 日志 `session not found` | 数据库迁移没跑：`npm run db:migrate` |