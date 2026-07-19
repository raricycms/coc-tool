# 10 · 实施阶段（Implementation Phases）

> 把整套功能切成可独立交付、可演示、可回滚的阶段。每个阶段产出可用的 demo，避免半年憋大招。

---

## 阶段总览

```
M0 基础设施          → 本地能跑 / 数据库就绪 / auth 通
M1 账号系统          → raricy OAuth + 本地 + captcha
M2 车卡管理          → CRUD + 派生计算
M3 招募 + Session 框架 → KP 开团流程闭环
M4 跑团大厅（聊天）   → 双聊天区 + 日志 + 观战
M5 判定系统          → KP 发布 + PL 投骰 + 自动判定
M6 时钟系统          → KP 控制 24h 时钟
M7 跑团结算          → SAN / Mythos / 撕卡 / 技能成长
M8 公测打磨          → Bug 修复 / 体验 / 文档
```

---

## M0 · 基础设施（3-5 天）

**目标**：本地能起 Next.js + Postgres + Socket.IO，CI 跑通单测。

任务清单：
- [ ] 创建 monorepo 结构（pnpm workspaces）
- [ ] `apps/web` Next.js 15 + Tailwind + shadcn 初始化
- [ ] `apps/realtime` Fastify + Socket.IO 初始化
- [ ] `packages/db` Prisma 初始化 + docker-compose 起 Postgres
- [ ] `packages/shared` 共享 zod schema + 类型
- [ ] `packages/coc-rules` 纯函数：属性派生 + 判定算法
- [ ] Vitest 单测：派生函数 + 判定算法
- [ ] `.env.example` + 文档说明

**验收**：`pnpm dev` 起 web (3000) + realtime (4000) + postgres，访问 `/` 看到「Hello」。

---

## M1 · 账号系统（5-7 天）

**目标**：用户能用 raricy OAuth 或本地账号（含图形验证码）注册登录。

任务清单：
- [ ] Prisma schema：User / OAuthToken / CaptchaVerify
- [ ] `/login` `/register` 页面 + 图形验证码组件
- [ ] `/api/captcha` `/api/captcha/verify`
- [ ] `/api/auth/{login,register,logout}`
- [ ] raricy OAuth：`/api/auth/raricy/{start,callback}`
- [ ] session JWT + HttpOnly cookie
- [ ] `middleware.ts` 全局鉴权
- [ ] 限频中间件（IP + 用户维度）
- [ ] E2E 测试：注册 → 登录 → 注销

**验收**：新用户走 captcha 注册成功；走 raricy 一键登录成功；未登录访问 `/dashboard` 跳 `/login`。

---

## M2 · 车卡管理（5-7 天）

**目标**：用户能创建、查看、编辑、软删车卡。

任务清单：
- [ ] Prisma schema：Character / Skill / Weapon / Equipment
- [ ] `/characters` 列表页
- [ ] `/characters/new` 向导（4 步：时代 → 职业 → 属性 → 技能/装备/背景）
- [ ] `/characters/[id]` 详情 + 编辑
- [ ] 派生计算函数（HP / MP / SAN / MOV / build / DB）
- [ ] 「重新投骰八维」按钮
- [ ] zod schema 前后端共享
- [ ] 单测：派生函数边界（CON=15, SIZ=90 等极端情况）
- [ ] E2E：创建车卡 → 编辑技能 → 软删

**验收**：能创建一张完整车卡，所有派生值正确；软删后列表显示但标"已撕卡"。

---

## M3 · 招募 + Session 框架（5-7 天）

**目标**：KP 发布招募、PL 报名、KP 审核通过后能开团。

任务清单：
- [ ] Prisma schema：Recruitment / Application / Session / SessionMember
- [ ] `/recruitments` 列表 + 筛选
- [ ] `/recruitments/new` 发布
- [ ] `/recruitments/[id]` 详情 + 报名弹窗
- [ ] `/recruitments/[id]/manage` KP 管理（编辑/审核/启动）
- [ ] 「启动团」创建 Session + SessionMember 事务
- [ ] `/sessions/[id]` 最小化空壳（仅显示成员 + 状态）
- [ ] 单测：状态机转换

**验收**：KP 能完成「发布 → PL 报名 → 审核 → 启动」全流程；Session 在 DB 中正确创建。

---

## M4 · 跑团大厅：聊天 + 日志（7-10 天）

**目标**：实时双聊天区 + 日志面板可工作。

任务清单：
- [ ] Socket.IO server 接入 JWT 鉴权
- [ ] Socket.IO 房间（session:{id}）
- [ ] `ooc:send` / `ooc:message` 事件
- [ ] `ic:send` / `ic:message` 事件（KP 描述 + PL 角色发言）
- [ ] 鉴权：PL 只能以自己 PC 发言；不能发 desc
- [ ] 观战者：自动成为 SPECTATOR SessionMember
- [ ] 日志区：拉取历史 + 实时 `log:entry`
- [ ] 客户端：三栏布局 + WebSocket 封装
- [ ] LogEntry 持久化（每条消息写库）
- [ ] 限频（5 条 / 10s）
- [ ] E2E：两端连接房间 + 发消息 + 重连

**验收**：KP + 2 PL + 1 观战者进同一房间，能正确收发 OOC / IC 消息；刷新页面历史不丢；断网自动重连。

---

## M5 · 判定系统（7-10 天）

**目标**：KP 发布判定，PL 按按钮投骰，自动判定成功等级 + 写日志。

任务清单：
- [ ] Prisma schema：Judgment（已含于 M3）
- [ ] `judgment:create` 事件（KP）
- [ ] `judgment:roll` 事件（PL）
- [ ] 服务端掷骰逻辑（`packages/coc-rules/judgment.ts`）
- [ ] 成功等级判定（大成功 / 极难 / 困难 / 成功 / 失败 / 大失败）
- [ ] SAN check 特殊处理（scMin/scMax）
- [ ] 自动写 LogEntry（JUDGMENT + SAN_CHANGE）
- [ ] 自动更新 Character.sanCurrent
- [ ] 「待投骰」面板 UI
- [ ] 单测：判定函数（成功等级各分支）
- [ ] 单测：奖励/惩罚骰逻辑

**验收**：KP 发布「侦查 +1 困难」判定 → PL 点按钮 → 日志自动写「🎲 骰 27 → 困难成功」。

---

## M6 · 时钟系统（3-5 天）

**目标**：KP 能控制游戏内 24h 时钟。

任务清单：
- [ ] Session 表 clock 字段已含
- [ ] 时钟 tick 循环（realtime 服务内 setInterval）
- [ ] `clock:control` 事件（start/pause/setRate/setTime/addTime）
- [ ] 时钟面板 UI
- [ ] 所有画内消息与判定日志带 inGameTime
- [ ] 单测：parseTime / formatInGame / setRate 不丢失 baseTime

**验收**：KP 点开始后时钟每秒走；调倍率后秒数对应加快；调整时间所有客户端即时更新。

---

## M7 · 跑团结算（5-7 天）

**目标**：跑团结束后 KP 进入结算向导，PL 投技能成长。

任务清单：
- [ ] Prisma schema：Settlement（已含）
- [ ] `Session.status = SETTLING` 转换
- [ ] `/sessions/[id]/settlement` 结算向导
- [ ] Step 1：SAN 恢复（KP 录入）
- [ ] Step 2：Mythos 增加（KP 录入 + 自动扣 SAN）
- [ ] Step 3：撕卡 / 疯人院（标记 + 软删）
- [ ] Step 4：技能成长投骰（PL 操作）
- [ ] 完结 → Session.status = FINISHED
- [ ] 每步可保存草稿

**验收**：KP 能完整跑一遍结算；PL 投技能成长后日志正确；完结后 Session 进入只读。

---

## M8 · 公测打磨（持续）

**目标**：打磨体验，修 bug，补文档。

任务清单：
- [ ] 性能：日志虚拟列表、WS 消息压缩
- [ ] 安全审计：OAuth、限频、防作弊
- [ ] E2E 覆盖核心流程
- [ ] 错误页 / 加载态 / 空态 完整
- [ ] 文档：用户手册 + 部署文档
- [ ] 数据备份策略
- [ ] 监控告警（v0.2 接 Sentry）

---

## 总人力估算

| 阶段 | 天数 | 累计 |
|---|---|---|
| M0 | 3-5 | 5 |
| M1 | 5-7 | 12 |
| M2 | 5-7 | 19 |
| M3 | 5-7 | 26 |
| M4 | 7-10 | 36 |
| M5 | 7-10 | 46 |
| M6 | 3-5 | 51 |
| M7 | 5-7 | 58 |
| M8 | 持续 | — |

> 单人全职开发约 **8-10 周** 到 MVP；如果是兼职或边学边做，预估 3-4 个月。

---

## 风险与应对

| 风险 | 应对 |
|---|---|
| raricy OAuth 不可用（站点未部署） | v0.1 允许本地账号 + 不强求 OAuth |
| Socket.IO 在 Vercel 上不支持长连接 | realtime 必须独立部署（Railway / Fly.io） |
| 时钟 tick 写库性能差 | 改为 5s 写一次 + 客户端插值 |
| 日志无限增长 | 跑团完结后归档；非活跃 Session 的日志压缩 |
| 客户端作弊（伪造判定结果） | 服务端是唯一权威，客户端无随机数生成 |
| Prisma 迁移风险 | 用 expand-migrate-contract 三段式 |
| CoC 规则细节不准 | 规则书校准前用占位，所有 `TODO(规则书)` 明确标注 |

---

## 验收 Checklist（M-MVP）

跑通以下流程即视为 MVP：

- [ ] 用 raricy OAuth 注册新用户
- [ ] 用本地账号（含图形验证码）注册新用户
- [ ] 创建一张 CoC 调查员（八维 + 技能 + 武器 + 装备 + 背景）
- [ ] KP 发布招募
- [ ] 另一用户 PL 浏览 + 报名
- [ ] KP 审核通过 + 启动团
- [ ] KP / PL 同时进跑团大厅，能发 OOC / IC 消息
- [ ] KP 发布判定 → PL 投骰 → 日志正确显示成功等级
- [ ] KP 控制时钟 → 所有客户端时间同步更新
- [ ] 观战者（未报名）能看日志 + 参与画外
- [ ] KP 进入结算 → PL 投技能成长 → 完结
- [ ] 撕卡的车卡在列表显示但不可加入新团

---

## 下一步（用户决策点）

等你确认上述方案后，再决定：

1. **开发节奏**：一次性写完，还是按 M0 → M1 节奏逐阶段交付 + 演示？
2. **是否需要我直接开始 M0**（建仓库、起 Next.js、Prisma 初始化）？
3. **是否先准备 `apps/web` 的最小可运行骨架**（即使所有页面是空壳），确认技术栈无误再继续？