# Coc-tools · 项目总览

> 在线 CoC（克苏鲁的呼唤 TRPG）跑团工具。Next.js + TailwindCSS + Socket.IO + PostgreSQL/Prisma。

---

## 0. 一句话定义

让 **KP（守密人）** 和 **PL（玩家）** 通过浏览器完成「建卡 → 招募 → 跑团（含实时聊天 / 判定 / 时钟）→ 结算」的完整闭环，并支持 **raricy.com 账号一键登录** 与本地账号（带图形验证码）双轨注册登录。

---

## 1. 核心概念（术语表）

| 术语 | 含义 |
|---|---|
| **KP** | Keeper，守密人 / 主持人，对应一场团的主控者 |
| **PL** | Player，玩家，控制一名调查员 |
| **PC** | Player Character，玩家角色，即「调查员」 |
| **NPC** | Non-Player Character，KP 控制的角色 |
| **车卡** | 创建一名调查员（生成属性 / 技能 / 背景） |
| **招募帖** | KP 发布的「开团招募」，PL 用车卡报名 |
| **OOC** | Out Of Character，画外自由讨论，显示**真实时间** |
| **IC** | In Character，画内 KP 描述与角色发言，显示**游戏内时间** |
| **判定** | 投骰检定，对应技能 / 属性 / SAN / 幸运 |
| **奖励骰 / 惩罚骰** | CoC 特色：基础 1d10 + 奖励 / 惩罚骰若干，取最低 / 最高 |
| **成功等级** | 大成功 / 极难成功 / 成功 / 失败 / 大失败 |
| **时钟** | 跑团内的游戏内时间，可倍速，可暂停 |
| **撕卡** | 调查员死亡 / 永久疯狂，软删除，仍在列表可见 |
| **送进疯人院** | 不可逆精神崩溃，软删除但保留查看 |
| **Cthulhu Mythos** | 神话知识技能，会反向扣 SAN |
| **sc 扣除** | SAN Check 时失败扣除的 SAN 值 |

---

## 2. 文档索引

| # | 文档 | 主题 |
|---|---|---|
| 01 | [tech-stack.md](./01-tech-stack.md) | 技术栈与决策理由 |
| 02 | [architecture.md](./02-architecture.md) | 系统架构、数据流、部署形态 |
| 03 | [database-schema.md](./03-database-schema.md) | Prisma 全量 Schema（ER、字段、约束） |
| 04 | [auth.md](./04-auth.md) | 认证：raricy OAuth + 本地账号 + 图形验证码 |
| 05 | [character-card.md](./05-character-card.md) | CoC 调查员车卡（属性 / 技能 / 装备 / 背景） |
| 06 | [recruitment.md](./06-recruitment.md) | 招募帖：发布 / 浏览 / 报名 / 审核 |
| 07 | [running-session.md](./07-running-session.md) | 跑团大厅：双聊天区 + 日志 + 判定 + 时钟 + 观战 |
| 08 | [settlement.md](./08-settlement.md) | 跑团结算：SAN 恢复 / 神话知识 / 技能成长 / 撕卡 / 疯人院 |
| 09 | [routes-ui.md](./09-routes-ui.md) | 全部路由 / 页面 / 组件清单 |
| 10 | [implementation-phases.md](./10-implementation-phases.md) | 分阶段实施计划（M0 → MVP → 公测） |

---

## 3. MVP 范围（v0.1，第一轮交付）

- 用户系统：raricy OAuth 一键登录 + 本地注册登录（图形验证码）
- 调查员车卡：基础属性（STR/CON/SIZ/DEX/APP/INT/POW/EDU/LUCK）+ 技能 + 武器 + 装备 + 背景
- 招募帖：发布 / 浏览 / 报名 / KP 审核
- 跑团大厅：
  - 双 Socket.IO 聊天区（OOC 真实时间 / IC 游戏时间）
  - 日志区（判定 / HP 变化 / SAN 变化）
  - 判定系统：KP 发布判定 → PL 一键投骰 → 自动计算成功等级 + 写日志
  - 24h 时钟：KP 控制开始 / 暂停 / 倍速 / 调整
  - 观战：未报名用户进画外区 + 看日志
- 跑团结算：SAN 恢复 / 撕卡（软删）/ 技能成长投骰

## 4. v0.2+（后续迭代，预留接口）

- 剧本模版、剧情节点标记、音频 / 图片附件
- 公开团 / 私人团可见性、PL 黑名单
- 车卡导出 PDF / JSON、跨平台车卡导入（兼容 dndbeyond / 各类车卡工具格式）
- WebSocket 加密 / 录像回放
- 移动端 PWA 适配
- i18n（中 / 英）

---

## 5. 首次运行（从零启动）

```bash
# 1. 装依赖（含 prisma 5 + Next.js 15 + Socket.IO 4 等）
npm install

# 2. 生成 .env（自动从 .env.example 复制到 monorepo 根，并生成 SESSION_SECRET）
npm run db:setup      # packages/db/scripts/setup-env.mjs

# 3. 生成 Prisma client（生成到 node_modules/.prisma/client/，每次 clone 必跑）
npm run db:generate

# 4. 推 schema 到 SQLite（首次必跑，之后改 schema 时再跑）
npm run db:push

# 5. 启动两端
npm run dev:realtime   # :4000 Socket.IO
npm run dev:web        # :3000 Next.js

# 6. 跑测试
npm test --workspaces --if-present
```

> **关键**：Prisma client 是从 `schema.prisma` 生成的 JS，不会进 git。
> 任何机器 clone 后必须 `npm run db:generate` 一次，否则会报
> `@prisma/client did not initialize yet`。
>
> `DATABASE_URL` 在 monorepo 根 `.env`。`packages/db/` 自身不再放 .env，
> 避免 Prisma 5 报「conflicting env vars」。

---

## 6. 非目标（v0.1 不做）

- 非 CoC TRPG 规则适配（仅 7e 基线，规则书校准前数值表先占位）
- 语音 / 视频通话
- 复杂的剧本编排工具（v0.1 用纯文本 + 日志即可）
- 移动 App（仅做响应式 Web）

---

## 7. 待校准（需规则书）

下列数值 / 表先按 CoC 7e 基线占位，等用户补规则书后核对：

1. 各职业默认技能表（每个职业 EDU×4 的可分配技能清单）
2. 伤害加成与体格对照表
3. 疯狂症状表（临时 / 不定 / 长期）
4. 技能成长判定阈值（1/2 技能值、95+、fumble 范围等）
5. SAN 恢复表（不同剧本阶段的恢复值）
6. Cthulhu Mythos 各条目对应的 SAN 损失值
7. 大成功 / 大失败判定边界（1 vs 5 的差异）

所有「待规则书校准」之处会在对应文档中明确标注 `TODO(规则书)`。