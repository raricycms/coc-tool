# 01 · 技术栈与决策

> 目标：在可控复杂度下，覆盖「实时聊天 / 判定广播 / 车卡数据持久化 / 验证码安全」的核心需求。

---

## 1. 总体选型一览

| 层 | 选型 | 备选 | 选定理由 |
|---|---|---|---|
| 前端框架 | **Next.js 15（App Router）** | Remix, SvelteKit | React 生态最广，Server Actions 简化写流程，Vercel 一键部署 |
| 样式 | **TailwindCSS v4** | CSS Modules, shadcn 基础 | 用户指定；与 shadcn/ui 配合能快速搭出跑团界面 |
| 组件层 | **shadcn/ui** | Radix 直写, MUI | 无运行时依赖，可直接拷贝改，符合 Tailwind 主题 |
| 数据库 | **PostgreSQL 16** | MySQL | JSONB 强（车卡 / 日志条目），全文检索好，Prisma 支持完善 |
| ORM | **Prisma 5** | Drizzle | 迁移工具成熟，generate 出的类型对前端友好 |
| 实时层 | **Socket.IO 4** | 原生 ws, SSE | 自带房间 / 重连 / 心跳；判定广播、时钟同步、画外画内三频道好管理 |
| 认证 | **自建 session（JWT in HttpOnly cookie）** + **raricy OAuth** | NextAuth, Clerk | 用户指定走 raricy OAuth，需要自定义；NextAuth 暂不集成（可后续接） |
| 图形验证码 | **svg-captcha** + 自建服务 | Cloudflare Turnstile | 自建可控，无外部依赖（如果公网部署，后期换 Turnstile 也行） |
| 状态管理 | **Zustand** + React Query | Redux Toolkit | 客户端 UI 状态走 Zustand；服务端数据走 React Query |
| 表单 | **react-hook-form + zod** | Formik | zod 与 TypeScript 强类型互通，前后端可共享 schema |
| 部署 | **Docker Compose（本地）+ Vercel/Railway（云）** | 自建 K8s | MVP 不上 K8s；Socket.IO 单独跑一个进程 |
| 邮件 | **nodemailer + SMTP** | Resend, SES | 注册验证 / 重置密码用，可后续切换 |
| 日志 | **pino** | winston | 性能好，与 Next.js route handler 兼容 |
| 测试 | **Vitest + Playwright** | Jest | 单测 Vitest，E2E Playwright |

---

## 2. 关键决策理由

### 2.1 为什么用 Socket.IO 而不是原生 ws

- **房间（room）抽象**：一场团就是一个 room，KP / 各 PL / 观战者入房后自动收到广播
- **重连机制**：浏览器刷新、网络抖动能自动恢复，跑团过程不能掉链子
- **二进制 / 附件支持**：后期加语音 / 图片消息不用换协议
- **多语言客户端**：未来如果做 iOS / Android 端，Socket.IO 客户端跨平台

代价：包体比原生 ws 大；单实例连接数上限约 ~1w（够用）。

### 2.2 为什么用 Postgres + Prisma 而不是 Mongo

- 车卡的技能、武器、装备是**强结构**数据，需要事务与外键
- 日志是**时序**数据，Postgres 索引 + JSONB 完全能 hold
- Prisma migrate 是生产可用的迁移工具，drizzle migrate 还需补一些场景
- 后期做「车卡全文检索」可以用 `tsvector`

### 2.3 为什么不用 NextAuth

NextAuth 的 Provider 主要面向通用 OAuth / 邮箱，raricy.com 的 OAuth 流程**和标准不完全一致**（无 refresh_token、单 scope、特殊 revoke 语义），不如自己写中间层清晰。session 用 HttpOnly cookie + 服务端校验，避免 localStorage XSS。

### 2.4 自建图形验证码的原因

`svg-captcha` 轻量、无外部依赖、纯 Node 实现，能生成算式 / 字符两类验证码。本地开发无外网也能跑。生产环境上线后如果想升级无感验证，可换 Cloudflare Turnstile（API 兼容），但 v0.1 不必要。

---

## 3. 仓库结构（建议）

```
Coc-tools/
├── apps/
│   ├── web/                  # Next.js 主应用
│   └── realtime/             # Socket.IO 服务（独立进程）
├── packages/
│   ├── db/                   # Prisma schema + client
│   ├── shared/               # 前后端共享类型 / zod schema
│   └── coc-rules/            # CoC 判定 / 派生计算逻辑（纯函数）
├── docs/
│   ├── oauth.md              # （已有）
│   └── plan/                 # 当前文档集
├── docker-compose.yml        # 本地 Postgres + Redis（可选）
├── package.json              # pnpm workspaces
└── pnpm-workspace.yaml
```

> v0.1 可以简化为单仓单包（直接 `apps/web/` 内放 `prisma/` 与 `lib/`），后续再切 monorepo。本文档按 monorepo 描述便于扩展。

---

## 4. 第三方依赖清单（关键）

```jsonc
// apps/web/package.json 关键依赖
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19",
    "react-dom": "^19",
    "tailwindcss": "^4.0.0",
    "@prisma/client": "^5.20.0",
    "socket.io-client": "^4.8.0",
    "react-hook-form": "^7.53.0",
    "zod": "^3.23.0",
    "zustand": "^5.0.0",
    "@tanstack/react-query": "^5.59.0",
    "svg-captcha": "^1.4.0",
    "jose": "^5.9.0",                 // JWT 签名
    "nodemailer": "^6.9.0",
    "pino": "^9.5.0"
  },
  "devDependencies": {
    "prisma": "^5.20.0",
    "vitest": "^2.1.0",
    "@playwright/test": "^1.48.0",
    "typescript": "^5.6.0"
  }
}

// apps/realtime/package.json 关键依赖
{
  "dependencies": {
    "fastify": "^5.0.0",              // 用来包 Socket.IO（也可换 express）
    "socket.io": "^4.8.0",
    "@prisma/client": "^5.20.0",
    "pino": "^9.5.0",
    "jose": "^5.9.0"
  }
}
```

---

## 5. 环境变量

```bash
# apps/web/.env.local
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/coc_tools
WEB_ORIGIN=http://localhost:3000
SESSION_SECRET=__32bytes_base64__                 # JWT 签名

RARICY_OAUTH_CLIENT_ID=xxx                        # raricy.com 后台获取
RARICY_OAUTH_CLIENT_SECRET=xxx
RARICY_OAUTH_AUTHORIZE_URL=https://raricy.com/oauth/authorize
RARICY_OAUTH_TOKEN_URL=https://raricy.com/api/oauth/token
RARICY_OAUTH_USERINFO_URL=https://raricy.com/api/oauth/userinfo
RARICY_OAUTH_REVOKE_URL=https://raricy.com/api/oauth/revoke
RARICY_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/raricy/callback

SMTP_HOST=smtp.example.com
SMTP_USER=...
SMTP_PASS=...

# apps/realtime/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/coc_tools
SESSION_SECRET=__32bytes_base64__                 # 与 web 一致，用于校验 session JWT
PORT=4000
WEB_ORIGIN=http://localhost:3000
```

---

## 6. 安全基线

- 所有写操作走 Server Action / Route Handler 二次校验（不在客户端 only 判权限）
- WebSocket 鉴权：`auth` 字段带 session JWT，服务端 `jose` 校验
- 图形验证码：仅校验一次后立即失效；5 分钟过期
- 密码：argon2id（成本 ≥ 19MB / 2 iterations），不能用 bcrypt（撞库成本问题）
- OAuth `state`：服务端存 session，过 callback 时比对（防 CSRF）
- Cookie：`HttpOnly; Secure; SameSite=Lax`
- 日志：永不打印 token / 密码 / 验证码原文
- 限频：登录 / 注册 / OAuth callback 走 IP + 账号双重桶

---

## 7. 待定项

- [ ] 是否使用 Redis（限频 / Socket.IO 横向扩展 adapter）—— v0.1 可不接，靠进程内桶 + 单实例
- [ ] 邮件验证是否做强制（v0.1 可做软验证：未验证用户只能发帖不能开团）
- [ ] 是否提供访客匿名观战（v0.1 建议必须登录才能观战，便于留存用户）