# 02 · 系统架构

> 描述 Coc-tools 的进程拓扑、数据流、模块边界。

---

## 1. 进程拓扑

```
                          Browser (React/Next.js)
                                 │
            ┌────────────────────┼────────────────────┐
            │ HTTPS              │ WSS                │
            ▼                    ▼                    │
   ┌─────────────────┐  ┌──────────────────────┐    │
   │  apps/web       │  │  apps/realtime       │    │
   │  Next.js 15     │◄─┤  Fastify + Socket.IO │    │
   │  (SSR + RSC +   │  │  - rooms: sessionId  │    │
   │   Route Handler)│  │  - auth via JWT      │    │
   └────────┬────────┘  └──────────┬───────────┘    │
            │                       │                │
            │   Prisma              │   Prisma       │
            └───────────┬───────────┘                │
                        ▼                            │
              ┌──────────────────────┐               │
              │   PostgreSQL 16      │               │
              └──────────────────────┘               │
                                                     │
                        raricy.com OAuth ────────────┘
                        (外部 IdP)
```

- **apps/web**：Next.js 15 App Router，处理 SSR / RSC / 路由 / 表单提交 / Server Action / REST 端点
- **apps/realtime**：独立 Node 进程，跑 Fastify + Socket.IO，专注 WebSocket 长连接
- **PostgreSQL**：唯一持久化层
- **raricy.com**：OAuth IdP（仅 auth 时交互）

> v0.1 可把 realtime 嵌进 Next.js 自定义 server，但拆独立进程能避免 Next.js dev hot-reload 影响 WS 连接。本文档按独立进程描述。

---

## 2. 模块边界

```
apps/web/src/
├── app/                      # App Router
│   ├── (auth)/               # 路由组：未登录可见
│   │   ├── login/
│   │   ├── register/
│   │   └── oauth/
│   ├── (app)/                # 路由组：登录后
│   │   ├── dashboard/        # 首页 / 总览
│   │   ├── characters/       # 车卡管理
│   │   │   ├── [id]/
│   │   │   └── new/
│   │   ├── recruitments/     # 招募帖
│   │   │   ├── [id]/
│   │   │   └── new/
│   │   └── sessions/         # 跑团
│   │       └── [id]/         # 跑团大厅（核心）
│   ├── api/
│   │   ├── auth/             # 登录 / 注册 / 注销 / raricy callback
│   │   ├── captcha/          # 图形验证码
│   │   ├── characters/       # 车卡 CRUD
│   │   ├── recruitments/     # 招募帖 CRUD
│   │   ├── sessions/         # 跑团元数据 / 结算
│   │   └── ...
│   └── layout.tsx
├── components/
│   ├── ui/                   # shadcn
│   ├── character/            # 车卡相关组件
│   ├── session/              # 跑团大厅（ChatPanel / LogPanel / JudgmentPanel / ClockPanel）
│   └── captcha/
├── lib/
│   ├── auth/                 # session / OAuth / captcha
│   ├── db/                   # Prisma client 单例
│   ├── ws-client.ts          # 浏览器端 socket.io-client 封装
│   └── utils/
└── server-actions/           # Server Actions（写操作）

packages/
├── db/
│   ├── schema.prisma
│   └── index.ts              # Prisma client export
├── shared/
│   ├── types.ts              # 前端共享类型
│   ├── zod-schemas/          # 前后端共享 zod
│   └── events.ts             # Socket.IO 事件名 + payload schema
└── coc-rules/
    ├── attributes.ts         # 属性派生（HP / MP / SAN / MOV / DB）
    ├── judgment.ts           # 判定算法（大成功 / 极难 / 成功 / 失败 / 大失败）
    ├── skill-growth.ts       # 技能成长阈值
    └── index.ts
```

---

## 3. 关键数据流

### 3.1 登录流程

```
浏览器                              apps/web                       raricy.com
  │                                    │                              │
  │ ① GET /login                      │                              │
  │ ─────────────────────────────────► │                              │
  │ ◄────────────────────────────── 渲染登录页（含「raricy 登录」按钮）  │
  │                                                                       │
  │ ② 点击「raricy 登录」                                                 │
  │ ─────────────────────────────────► │                                │
  │                                   │ ③ 302 到 raricy /oauth/authorize│
  │                                   │ ─────────────────────────────► │
  │                                   │                                │ ④ 用户授权
  │ ◄────────────── 302 ───────────  │ ◄────────────────────────────── │
  │                                    │                                │
  │ ⑤ GET /api/auth/raricy/callback?code=…&state=…
  │ ─────────────────────────────────► │ ⑥ POST /api/oauth/token (Basic)│
  │                                   │ ─────────────────────────────► │
  │                                   │ ◄──────── {access_token} ──── │
  │                                   │ ⑦ GET /api/oauth/userinfo      │
  │                                   │ ─────────────────────────────► │
  │                                   │ ◄────── {sub, username, …} ── │
  │                                   │ ⑧ upsert User + 写 session    │
  │ ◄────── 302 + Set-Cookie ───────  │                                │
```

### 3.2 跑团流程（一次判定）

```
浏览器(PL)                         apps/web                  apps/realtime
  │                                   │                           │
  │ ① KP 已发布 judgment(id=A)        │                           │
  │   PL 在判定面板看到「投骰」按钮     │                           │
  │ ② socket.emit('judgment:roll',{A})                              │
  │ ──────────────────────────────────────────────────────────►    │
  │                                   │                           │ ③ 校验权限（PL 是不是
  │                                   │                           │   被分配的角色）
  │                                   │                           │ ④ 读取该角色技能值
  │                                   │                           │ ⑤ 计算奖励/惩罚骰
  │                                   │                           │   1d10 → 取值
  │                                   │                           │   判定成功等级
  │                                   │                           │   写 LogEntry
  │ ◄────────── 'log:entry' ──────────────────────────────────── │
  │ ◄────────── 'judgment:result' ──────────────────────────────── │
```

> 服务端是单一权威：所有判定**只在 realtime 服务端**掷骰，PL 端只发「投骰意图」。客户端不参与随机数生成，杜绝作弊。

### 3.3 招募 → 开团流程

```
KP                          apps/web                apps/realtime
 │  POST /api/recruitments    │
 │ ─────────────────────────► │ 写 Recruitment + 状态=open
 │                            │
 │ PL 浏览 /recruitments      │
 │ PL 提交报名 → apps/web     │
 │ 写 Application (status=pending) │
 │                            │
 │ KP 审核通过 → apps/web     │
 │ 写 SessionMember +         │
 │ 创建 Session (status=ready) │
 │                            │
 │ KP 进入 /sessions/[id]     │
 │ 浏览器建立 WS 连接         │
 │ ─────────────────────────────────────────►  join room(sessionId)
 │                            │                   │
 │                            │                   │ start session
```

---

## 4. 部署形态

### 4.1 本地开发

```
docker-compose up -d postgres      # 起 Postgres
pnpm dev                            # 并行起 web (3000) 与 realtime (4000)
```

### 4.2 生产（推荐）

- **apps/web** → Vercel（Next.js 原生支持，零运维）
- **apps/realtime** → Railway / Fly.io / 自建 Docker（任意支持长连接 WebSocket 的平台）
- **Postgres** → Neon / Supabase / Railway（托管 PG）

跨域：realtime 服务允许 `WEB_ORIGIN` 来源；浏览器 WS 时携带 cookie / JWT。

### 4.3 单实例兜底

v0.1 阶段如果不想拆，可以把 Socket.IO 跑在 Next.js custom server 内部，绑定同一进程。后续访问量上来再拆。代码上 `apps/realtime` 和 `apps/web` 的边界是清晰的，切换代价低。

---

## 5. 横切关注点

| 关注点 | 实现位置 | 备注 |
|---|---|---|
| 鉴权（页面） | `middleware.ts` + Server Component `getSession()` | 未登录跳 `/login` |
| 鉴权（WS） | Socket.IO `io.use(jwtAuthMiddleware)` | 在握手阶段校验 JWT |
| 限频 | `lib/rate-limit.ts`（进程内 LRU + Map） | v0.1 不上 Redis |
| 日志 | `pino` 统一 logger | reqId 贯穿 HTTP 与 WS |
| 错误处理 | `app/error.tsx` + Server Action throw | 统一 4xx / 5xx 形态 |
| i18n | next-intl（v0.2） | v0.1 先中文 |
| 监控 | 暂用 `console.log` + 自带 logger（v0.2 接 Sentry） | |

---

## 6. 数据隔离边界

- **User**：所有资源的 owner（character / recruitment / session 创建者 / application）
- **Character**：属于一个 User，可被多个 Session 引用（通过 SessionMember）
- **Session**：KP 是 owner；SessionMember 是 PL 与 PC 的关联；LogEntry 关联 Session
- **Recruitment**：发布后是公开只读；Application 仅 KP 与申请人可见

外键级联策略：
- User 删号 → 软删（`deletedAt`），其下资源转为匿名 `deleted_user` 命名空间（保留可读性）
- Session 关闭后数据保留；硬删由管理员操作
- Character 撕卡 = 软删（`isRetired` / `retiredReason`），仍在列表可见

---

## 7. 性能基线（目标）

- 跑团大厅首屏 < 1.5s（SSR）
- 判定广播端到端 < 200ms（本地）
- 日志无限滚动 1000 条不卡（虚拟列表）
- 单场团 50 PL（理论值）下 WS 消息 ≤ 50msg/s