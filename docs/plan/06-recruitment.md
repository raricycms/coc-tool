# 06 · 招募帖（Recruitment）

> KP 发布招募 → PL 浏览 / 报名 → KP 审核通过 → 组成一场团。

---

## 1. 状态机

```
           ┌────────┐  publish    ┌──────┐  close    ┌────────┐
           │ DRAFT  │ ──────────► │ OPEN │ ────────► │ CLOSED │
           └────────┘             └──┬───┘            └────────┘
              ▲                      │                    ▲
              │                      ▼                    │
              │                  ┌──────────┐             │
              │                  │ (持续接受 │             │
              │                  │  报名)   │             │
              │                  └──────────┘             │
              │                                           │
              └────────────── 撤回 ──────────┘            │
                                                          │
                                  ┌──────────── finish ───┘
                                  ▼
                              ┌──────────┐
                              │ FINISHED │  → 对应 Session 状态转为 FINISHED
                              └──────────┘
```

`Application` 状态独立流转：

```
PENDING ──approve──► APPROVED ──(自动创建 SessionMember)──► Session 启动
   │
   ├──reject──► REJECTED
   │
   └──withdraw──► WITHDRAWN   （PL 主动撤回）
```

---

## 2. 招募帖字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| 标题 `title` | string | ✅ | 1-60 字符 |
| 简介 `summary` | text | ✅ | 富文本（v0.1 用纯文本） |
| 剧本 `scenario` | string | ⭕ | 自由文本 / 后续关联剧本库 |
| 最少 PL `minPlayers` | int | ✅ | ≥ 1 |
| 最多 PL `maxPlayers` | int | ✅ | ≥ minPlayers |
| 预计时长 `expectedHours` | int | ⭕ | 小时数 |
| 预计开团时间 `startAt` | datetime | ⭕ | |
| 可见性 `visibility` | enum | ✅ | `public` / `link`（仅链接可访问） |
| 状态 `status` | enum | ✅ | 见状态机 |

> `link` 可见性：生成不可枚举的 `shareToken`，作为 URL 一部分（如 `/recruitments/join/{token}`）。v0.1 不做。

---

## 3. CRUD / 接口

| 路径 | 方法 | 行为 |
|---|---|---|
| `GET /api/recruitments` | GET | 列表（公开 status=OPEN，支持筛选） |
| `POST /api/recruitments` | POST | KP 创建 |
| `GET /api/recruitments/:id` | GET | 详情（含 KP 公开信息 + 已批准 PL 数量） |
| `PATCH /api/recruitments/:id` | PATCH | KP 修改（DRAFT/OPEN 时） |
| `POST /api/recruitments/:id/close` | POST | KP 手动关闭 |
| `POST /api/recruitments/:id/publish` | POST | KP 发布（DRAFT → OPEN） |
| `GET /api/recruitments/:id/applications` | GET | KP 看所有报名 |
| `POST /api/recruitments/:id/applications` | POST | PL 报名 |
| `PATCH /api/recruitments/:id/applications/:appId` | PATCH | KP 审核 |
| `POST /api/recruitments/:id/start` | POST | KP 启动团：自动创建 Session + 写 SessionMember（来自已批准的 Application） |

---

## 4. 报名流程

### 4.1 PL 报名

```
前提：
- 登录
- 拥有至少 1 张 status=ACTIVE 的车卡
- 已通过 captcha（公开帖无需，私帖可选）

POST /api/recruitments/:id/applications
body: { characterId, message? }

服务端：
1. 校验车卡属于当前 PL
2. 校验车卡未 RETIRED
3. 校验招募状态 OPEN
4. 校验同一招募帖下同一车卡未重复报名（unique(recruitmentId, characterId)）
5. 校验当前已批准的 PL 数 < maxPlayers（避免 KP 通过审核后再被覆盖）

返回 { applicationId, status: 'PENDING' }
```

### 4.2 KP 审核

```
PATCH /api/recruitments/:id/applications/:appId
body: { action: 'approve' | 'reject', reviewNote? }

approve:
- Application.status = APPROVED, reviewedAt = now
- 不立即写 SessionMember（开团时才统一写）

reject:
- Application.status = REJECTED, reviewedAt = now
- 允许同车卡再次报名（删除原 Application 后再创建）
```

---

## 5. 开团（KP 启动 Session）

```
POST /api/recruitments/:id/start
（仅 KP，招募 status=OPEN，至少 1 人 APPROVED）

服务端在单事务里：
1. Recruitment.status = FINISHED, finishedAt = now
2. 创建 Session：
   - kpId = recruitment.kpId
   - title = recruitment.title
   - status = SETUP
   - clockRate / inGameTime 等初始化
3. 对每个 Application.status = APPROVED 创建 SessionMember：
   - role = PL
   - userId = application.applicantId
   - characterId = application.characterId
4. KP 自己写一个 SessionMember role=KP（characterId = null）
5. 写系统 LogEntry（启动事件，但此时 Session 还没有 LogEntry 表 FK，可延迟到首次进跑团页面时初始化）

返回 { sessionId }
KP 浏览器跳 /sessions/:sessionId
```

---

## 6. 列表 / 浏览

### 6.1 列表 `/recruitments`

```
筛选：
- status = OPEN
- 按开团时间 / 创建时间排序
- 可按剧本 / 时代背景筛

每条卡片显示：
- 标题、KP 用户名、已批准 PL / 最多 PL
- 预计开团时间、预计时长
- 简介（前 200 字）
- [报名] 按钮（已报名则显示状态徽章）
```

### 6.2 详情 `/recruitments/:id`

- 完整简介（富文本）
- 招募要求（如「需要 1920s 调查员」）
- 当前已报名 PL 列表（仅 PL 用户名 / 头像，不暴露车卡细节）
- [报名] 按钮 → 弹窗选车卡 + 留言

---

## 7. UI 流程图

```
                            ┌──────────────────┐
                            │   招募列表页      │
                            │  /recruitments   │
                            └────────┬─────────┘
                                     │ 点击
                                     ▼
              ┌──────────────────────────────────────┐
              │       招募详情页 /recruitments/:id   │
              │  - 标题 / 简介 / KP 信息            │
              │  - 已批准 PL / 最多 PL              │
              │  - [报名] [取消报名（已 PENDING）]   │
              └────────────┬─────────────────────────┘
                           │ 点击 [报名]
                           ▼
                  ┌──────────────────────┐
                  │ 弹窗：选择车卡 + 留言 │
                  └──────────┬───────────┘
                             │ 提交
                             ▼
                  ┌──────────────────────┐
                  │ PENDING 状态         │
                  │ （等 KP 审核）        │
                  └──────────┬───────────┘
                             │ KP 审核通过
                             ▼
                  ┌──────────────────────┐
                  │ APPROVED             │
                  │ （开团时自动加入团） │
                  └──────────────────────┘
```

KP 端流程：

```
                            ┌──────────────────┐
                            │  /recruitments/new│
                            │  创建表单         │
                            └────────┬─────────┘
                                     │ 保存草稿 / 发布
                                     ▼
                       ┌──────────────────────────┐
                       │  /recruitments/:id/manage │
                       │  - 编辑 / 关闭 / 查看报名 │
                       └────────┬─────────────────┘
                                │
                                ▼
                       ┌──────────────────────────┐
                       │ 审核报名列表             │
                       │  [通过] [拒绝] [留言]    │
                       └────────┬─────────────────┘
                                │ 启动团
                                ▼
                       ┌──────────────────────────┐
                       │ /sessions/:id            │
                       │ （跑团大厅）             │
                       └──────────────────────────┘
```

---

## 8. 校验规则

```ts
// packages/shared/zod-schemas/recruitment.ts
export const RecruitmentCreateSchema = z.object({
  title: z.string().min(1).max(60),
  summary: z.string().min(1).max(20_000),
  scenario: z.string().max(100).optional(),
  minPlayers: z.number().int().min(1).max(20),
  maxPlayers: z.number().int().min(1).max(20),
  expectedHours: z.number().int().min(1).max(100).optional(),
  startAt: z.coerce.date().optional(),
  visibility: z.enum(['public', 'link']).default('public'),
}).refine(d => d.maxPlayers >= d.minPlayers, { path: ['maxPlayers'] });

export const ApplicationCreateSchema = z.object({
  characterId: z.string().cuid(),
  message: z.string().max(2000).optional(),
});
```

---

## 9. 权限矩阵

| 操作 | 游客 | PL（未报名） | PL（已报名） | KP |
|---|---|---|---|---|
| 浏览公开招募 | ✅ | ✅ | ✅ | ✅ |
| 报名 | ❌ | ✅（如未 RETIRED） | ❌（重复） | ❌（自己的团） |
| 编辑招募 | ❌ | ❌ | ❌ | ✅（自己） |
| 审核报名 | ❌ | ❌ | ❌ | ✅（自己） |
| 关闭 / 启动 | ❌ | ❌ | ❌ | ✅（自己） |

---

## 10. 通知（v0.2 预留）

- PL 报名成功 → 站内信给 KP
- KP 审核结果 → 站内信给 PL
- 团启动 → 站内信给所有 PL

v0.1 暂用前端轮询 / 刷新提示实现。

---

## 11. 待校准

- 是否需要「招募要求」字段（如"必须 1920s 调查员"、"必须有神秘学 ≥ 30"）？v0.2 再做
- 是否需要私聊 / 留言板？v0.2 再做
- 是否允许 KP 设定 PL 自带规则（如"本团允许 PC 互殴"）？v0.2