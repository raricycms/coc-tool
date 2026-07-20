# Coc-tools · 项目架构说明（as-built）

> 本文描述 **当前仓库实际实现** 的架构与技术选型，用作长期参考。
> 与愿景 / 计划不同之处以「⚠️ 与最初设想的差异」标注。
> 概览见根目录 [`README.md`](../README.md)，部署见 [`deployment.md`](./deployment.md)，
> raricy OAuth 协议见 [`oauth.md`](./oauth.md)，尚未完成的工作见 [`plan/remaining-work.md`](./plan/remaining-work.md)。
>
> 版本：`0.1.0`（MVP）。最后核对：2026-07-20。

---

## 0. 术语表

| 术语 | 含义 |
|---|---|
| **KP** | Keeper，守密人 / 主持人，一场团的主控者 |
| **PL** | Player，玩家，控制一名调查员 |
| **PC** | Player Character，玩家角色（调查员） |
| **NPC** | KP 控制的角色 |
| **车卡** | 创建一名调查员（属性 / 技能 / 背景） |
| **招募帖** | KP 发布的「开团招募」，PL 用车卡报名 |
| **OOC** | Out Of Character，画外自由讨论，显示真实时间 |
| **IC** | In Character，画内 KP 描述与角色发言，显示游戏内时间 |
| **判定** | 投骰检定（技能 / 属性 / SAN / 幸运） |
| **奖励骰 / 惩罚骰** | 1d100 的十位额外投若干骰，取最低 / 最高 |
| **成功等级** | 大成功 / 极难 / 困难 / 成功 / 失败 / 大失败 |
| **时钟** | 跑团内游戏时间，可倍速、可暂停 |
| **撕卡 / 送疯人院** | 调查员死亡 / 永久疯狂，软删除，仍在列表可见 |
| **Cthulhu Mythos** | 神话知识技能，增长时反向扣 SAN |

---

## 1. 技术栈（实际）

| 层 | 实际选型 | 备注 |
|---|---|---|
| 前端框架 | **Next.js 15（App Router）+ React 19** | web dev 端口 `7766`（非 3000） |
| 样式 | **Tailwind CSS v3.4** + 手写 `globals.css`（`btn` / `input` 等原子类） | ⚠️ 计划里的 shadcn/ui **未引入**；无 `components/ui/`、无 `components.json`。⚠️ 计划里的 Tailwind v4 实际为 v3 |
| 表单 | **react-hook-form + @hookform/resolvers + zod** | |
| 实时层 | **Fastify 5 + Socket.IO 4**（独立进程 `apps/realtime`） | Socket.IO 挂在 Fastify 的底层 http server 上 |
| 数据库 | **SQLite（开发）** | ⚠️ 计划为 PostgreSQL 16；当前 `provider = "sqlite"`，`DATABASE_URL="file:./dev.db"`。生产切 Postgres 是待办，仓库内**无 docker-compose** |
| ORM | **Prisma 5.22** | |
| 校验 | **zod 3.23**，前后端共享（`packages/shared`） | |
| 认证 | **自建 session（JWT in HttpOnly cookie，jose）+ raricy OAuth + 本地账号** | |
| 密码哈希 | **Node 内置 `scrypt`**（`scrypt$<saltHex>$<keyHex>`） | ⚠️ 计划为 argon2id；实际用 scrypt，未引入 argon2 依赖 |
| 图形验证码 | **自建算式验证码**，答案存进程内 `Map` | ⚠️ 未使用 svg-captcha 依赖；纯自实现 |
| 日志 | **pino** | |
| 测试 | **Vitest**（单测 + 集成） | ⚠️ Playwright E2E **未落地**：`test:e2e` 脚本存在但无 `@playwright/test` 依赖、无配置。唯一 e2e 是手写脚本 `apps/web/tests/e2e/ws-flow.mjs`（只覆盖 WS 跨域鉴权） |
| 状态管理 / 数据请求 | 无 Zustand、无 React Query | ⚠️ 计划里列出，实际未使用；客户端用原生 state + fetch |
| 邮件 | 无 | ⚠️ 计划里的 nodemailer 未接入 |

---

## 2. 仓库结构（实际）

npm workspaces（**非 pnpm**）。根 `package.json` 声明 `workspaces: ["apps/*", "packages/*"]`。

```text
Coc-tools/
├── apps/
│   ├── web/                      # Next.js 15 App Router（页面 + Route Handler + 组件）
│   └── realtime/                 # Fastify + Socket.IO 独立进程
├── packages/
│   ├── db/                       # Prisma schema + client 单例（+ setup/run-with-env 脚本）
│   ├── shared/                   # 前后端共享：zod schemas + Socket.IO 事件常量/类型
│   └── coc-rules/                # CoC 纯函数：属性派生 / 骰点 / 判定 / 技能成长（含 Vitest）
├── docs/
│   ├── ARCHITECTURE.md           # 本文
│   ├── deployment.md
│   ├── oauth.md
│   └── plan/remaining-work.md    # 未完成工作汇总
├── .env / .env.example
├── README.md
└── package.json                  # npm workspaces
```

### apps/web/src 布局（实际，非计划的路由组）

```text
app/
├── page.tsx                      # 首页
├── login/  register/             # 登录 / 注册
├── dashboard/
├── characters/  characters/new/  characters/[id]/
├── recruitments/  recruitments/new/  recruitments/[id]/  recruitments/[id]/manage/
├── sessions/[id]/  sessions/[id]/settlement/
└── api/…                         # 见 §5
components/
├── (顶层) CaptchaBox / CharacterForm / CharacterRetireButton / ApplyButton /
│          ApplicationReviewButtons / StartSessionButton / SettlementWizard /
│          SessionClient / TopNav(+Client) / FieldError …
└── session/                      # OOCPanel / ICPanel / LogPanel / JudgmentCreator /
                                  # JudgmentQueue / ClockPanel / HpChangePanel / PresenceBar
lib/                              # auth / captcha / password / rate-limit / ws-client / api / zodError …
```

> ⚠️ 计划里的路由组 `(auth)` / `(app)`、`server-actions/` 目录、`components/ui/`（shadcn）**均未采用**；写操作走 Route Handler（`app/api/**`），不用 Server Actions。

---

## 3. 数据模型（Prisma，实际）

`packages/db/prisma/schema.prisma`，`provider = "sqlite"`。

⚠️ **枚举以 `String` 存储**：SQLite 不支持原生 `enum` / `Json`，schema 头部注释已说明。所有「枚举」字段（`status` / `role` / `provider` / `difficulty` / `successLevel` / `step` / `type` / `scene` / `visibility` 等）都是 `String`，合法取值以字段旁注释文档化；`Json` 字段（`payload` / `targetSnapshot` / `diceRolls` / 结算四个数组）也以 `String` 存 JSON 文本。

模型（14 个，均已建成）：

| 模型 | 要点 |
|---|---|
| **User** | 本地 / OAuth 双轨；`passwordHash?`、`provider`、`providerSub?`、`status`；`@@unique([provider, providerSub])` |
| **OAuthToken** | `tokenHash`（access_token 的哈希）、`scope`、`expiresAt`、`revokedAt?` |
| **CaptchaVerify** | `scene` / `ip` / `verified` / `consumedAt?`（⚠️ 表存在但运行时验证码实际走进程内 Map，未真正读写此表） |
| **Character** | 八维 + `luck`；派生 `hpMax/mpMax/sanMax/mov/build/damageBonus`；当前值 `*Current`；`status`(ACTIVE/RETIRED) + `retiredReason?/retiredAt?`；`version` |
| **Skill** | `name`+`value`、`isMythos`、`note?` |
| **Weapon** | `skill` / `damage` / `range?` / `ammo?` / `note?` |
| **Equipment** | `name` / `quantity` / `note?` |
| **Recruitment** | `kp`、`title`、`summary`、`scenario?`、`min/maxPlayers`、`expectedHours?`、`startAt?`、`visibility`、`status`、`finishedAt?` |
| **Application** | `applicantId` / `characterId` / `message?` / `status` / `reviewedAt?` / `reviewNote?`；`@@unique([recruitmentId, characterId])` |
| **Session** | `kpId`、`recruitmentId? @unique`、`status`、生命周期时间戳、时钟字段 `inGameTime/inGameDate/clockRunning/clockRate` |
| **SessionMember** | `role`(KP/PL/SPECTATOR)、`characterId?`、`joinedAt/leftAt?`；`@@unique([sessionId, userId])` |
| **LogEntry** | `type`、`authorId?`、`characterId?`、`judgmentId? @unique`、`payload`(JSON文本)、`realTime`、`inGameTime?` |
| **Judgment** | `PENDING→ROLLED→RESOLVED/CANCELLED`；`skillName/difficulty/bonusDice/scMin?/scMax?`；结果 `diceRolls/tens/unit/successLevel/scLoss/targetSnapshot` |
| **Settlement** | 每团一行（`@unique sessionId`）；`step`；四个 JSON 文本数组 `sanRecoveries/knowledgeGains/retirements/skillGrowths`；`completedAt?` |

派生值冗余存储（每次改八维用事务重算并写日志），判定的 `targetSnapshot` 固化投骰瞬间技能值防作弊。

---

## 4. 认证（实际）

两条路径收敛到「写 User + 发 session cookie」，realtime 用同一份 `SESSION_SECRET` 校验。

- **本地账号**：`/api/auth/register`、`/api/auth/login`、`/api/auth/logout`
  - 密码 **scrypt** 哈希（`lib/password.ts`）
  - 验证码 **在 register/login 内联校验**（`verifyCaptcha(token, answer)`）— ⚠️ **无独立 `/api/captcha/verify` 端点**；`/api/captcha` 生成算式题、答案存进程内 Map（`lib/captcha.ts`）
  - 限频（`lib/rate-limit.ts`，进程内桶）：login 10/min·IP、register 5/min·IP — ⚠️ **未接** captcha / OAuth 路由
- **raricy OAuth**：`/api/auth/raricy/start`（生成 state + HttpOnly cookie，302 到授权页）、`/api/auth/raricy/callback`（校验 state → 换 token → userinfo → upsert User → 发 session）
- **Session**：`lib/auth.ts` 用 jose 签 HS256 JWT，写 `session` cookie（`httpOnly`、`sameSite=lax`、`secure` 视环境、7d）；`getSession()` / `requireUser()` 校验
- **页面鉴权**：⚠️ **无 `middleware.ts` 全局守卫**；改为**每页** `getCurrentUser()`/`requireUser()` + `redirect('/login')`
- **WS 鉴权**：`apps/realtime/src/auth.ts` 握手时先读 `cookie` 再退回 `handshake.auth.token`，jose 校验。前端跨域时先取 `/api/auth/ws-token`（返回同一 JWT）交给 socket.io-client（`lib/ws-client.ts`）

---

## 5. 路由与 API 端点（实际存在）

**页面**：`/`、`/login`、`/register`、`/dashboard`、`/characters`、`/characters/new`、`/characters/[id]`、`/recruitments`、`/recruitments/new`、`/recruitments/[id]`、`/recruitments/[id]/manage`、`/sessions/[id]`、`/sessions/[id]/settlement`。
共享 `layout.tsx` + `TopNav`（服务端）/`TopNavClient`（客户端，含移动抽屉、登出表单）。

> ⚠️ 未实现的页面：`/sessions`（我的团列表）、`/settings`、独立 `/logout` 页（登出仅 POST 端点）、独立 `/oauth/raricy/start` UI 页。无 `error.tsx` / `not-found.tsx` / `loading.tsx`。

**API（Route Handler）**：

```text
/api/auth/{login,register,logout}          POST
/api/auth/raricy/{start,callback}          GET
/api/auth/ws-token                          GET
/api/captcha                                GET          （无 /verify）
/api/characters                             GET, POST
/api/characters/[id]                        GET, PATCH, DELETE(软删=RETIRED)
/api/coc/roll                               GET          （投骰辅助）
/api/recruitments                           GET(?status=,?mine=), POST(直接建为 OPEN)
/api/recruitments/[id]                      GET, PATCH, DELETE(=置 CLOSED)
/api/recruitments/[id]/start                POST         （事务开团）
/api/recruitments/[id]/applications         GET, POST
/api/recruitments/[id]/applications/[appId] PATCH        （approve/reject）
/api/sessions/[id]/settlement               POST         （进入 SETTLING）
/api/sessions/[id]/settlement/san-recovery      POST
/api/sessions/[id]/settlement/knowledge         POST
/api/sessions/[id]/settlement/retirements       POST
/api/sessions/[id]/settlement/skill-growth      POST
/api/sessions/[id]/settlement/complete          POST
/api/diag/health                            GET
```

> ⚠️ 未实现的端点：`/api/recruitments/[id]/publish`（无 DRAFT→OPEN，创建即 OPEN）、`/close`（用 DELETE 代替）、`/api/sessions/[id]` 的 GET/PATCH、`/api/sessions/[id]/members`。

---

## 6. 实时跑团（apps/realtime）

一个 Session = 一个 room `session:{id}`。所有 KP/PL/观战入房收广播；非成员访问 `/sessions/[id]` 自动建 `SPECTATOR` 成员。

Socket.IO 事件常量（`packages/shared/src/events.ts`）：

| 方向 | 事件 |
|---|---|
| C→S | `session:join` `session:leave` `log:history` `ooc:send` `ic:send` `judgment:create` `judgment:roll` `judgment:cancel` `clock:control` `hp:change` |
| S→C | `ooc:message` `ic:message` `judgment:created` `judgment:result` `judgment:cancelled` `clock:state` `hp:changed` `presence:update` `log:entry` `log:history:res` `error` |

关键机制（均已实现）：

- **日志唯一真相**：OOC/IC/判定/HP/时钟事件都先写 `LogEntry` 再广播 `log:entry`；入房拉最近 100 条历史，之后增量。
- **判定服务端权威**：KP `judgment:create` 写快照 → PL `judgment:roll` 由**服务端**掷骰（`coc-rules` 的 `judge()`），算成功等级；SAN 检定（`skillName==='SAN'` + scMin/scMax）自动算 `scLoss`、更新 `Character.sanCurrent`、写 `JUDGMENT`+`SAN_CHANGE` 两条日志。客户端不产生随机数。
- **时钟**：`state.ts` 每秒 `setInterval` tick（仅 running），按 `实时流逝 × rate` 推进游戏内时间，广播 `clock:state`；KP `clock:control` 支持 `start/pause/setRate/setTime/addTime`。IC / 判定 / HP 日志都带 `inGameTime`。
- **在线状态**：`presence.ts` 维护 bySession/bySocket 索引，进出房广播 `presence:update`（`online` 布尔驱动绿/灰点，`PresenceBar`）。
- **HP 变更**：KP-only `hp:change`，夹取 `[0, hpMax]`，写 `HP_CHANGE` 日志（`HpChangePanel`）。

⚠️ 差异 / 缺口：聊天**无限频**；IC 发言只校验「非 KP 不能发 desc」，PL 的 `characterId` 由客户端传入、**服务端未严格核对归属**；日志区**无虚拟列表**（普通滚动）。

---

## 7. 结算（Settlement）

KP 从跑团页触发进入 `SETTLING`，`SettlementWizard` 四步（均已实现，各自一个 POST 端点，服务端写库 + 写日志 + 推进 `step`）：

1. **SAN 恢复** — KP 录入，夹取 `[0, sanMax]`，写 `SAN_CHANGE`
2. **神话知识** — 增 Cthulhu Mythos（无则建），自动扣同量 SAN，写 `SKILL_CHANGE`+`SAN_CHANGE`
3. **撕卡 / 疯人院** — 置 `Character.status=RETIRED` + reason/time（软删），写 `SYSTEM`
4. **技能成长** — 服务端掷骰（`coc-rules` `judgeSkillGrowth`），成功则 `skill.value` 增长，写 `SKILL_CHANGE`

**完结**：`/complete` 事务 → `Session.status=FINISHED` + `finishedAt`、`Settlement.step=DONE`+`completedAt`、所有成员 `leftAt`、写 `SYSTEM`。

⚠️ 各步的输入会持久化到 `Settlement` 的 JSON 列，但向导 `useState` 挂载时**不会从持久化草稿回填**（只读 `initialStep`，未读 `initialDrafts`），无显式「保存草稿」按钮。

---

## 8. 规则引擎（packages/coc-rules）

纯函数，前后端同构，Vitest 覆盖：

- `attributes.ts` — `derive(primary, age)` → `{hpMax,mpMax,sanMax,mov,build,damageBonus}`；`computeMov`、`lookupDamageBonus`；`DEFAULT_SKILLS` / `DEFAULT_OCCUPATION_POINTS(edu*4)` / `DEFAULT_INTEREST_POINTS(int*2)`（后两者尚**未接入**建卡流程）
- `dice.ts` — `rollDie` / `rollExpression`（`XdY`）等
- `judgment.ts` — `judge()`（掷骰 + 奖励/惩罚骰 + 成功等级）、`calculateSuccessLevel`、`calculateSanLoss`
- `skill-growth.ts` — 技能成长判定

> 具体数值（EDU 公式、完整 build/DB 表、成功等级临界、SAN 恢复/神话扣减、技能成长量）多为 CoC 7e 占位，待规则书校准 —— 详见 [`plan/remaining-work.md`](./plan/remaining-work.md)。

---

## 9. 安全基线（现状）

已落地：JWT HttpOnly cookie（`sameSite=lax`）、OAuth `state` 服务端校验、验证码一次性 + TTL、登录失败不区分「无此人 / 密码错」、WS 握手鉴权、服务端唯一权威掷骰 + 投骰快照。

差异 / 缺口：密码为 **scrypt**（非 argon2id）；限频只在 login/register；聊天无限频；无全局 `middleware.ts`。
