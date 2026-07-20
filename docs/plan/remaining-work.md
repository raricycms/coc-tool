# Coc-tools · 未完成工作汇总

> 本文汇总 `docs/plan/` 原分阶段计划（M0–M8）中**尚未完成 / 部分完成**的部分，
> 以及散落在各功能文档里的 `TODO(规则书)` 校准项。
> 已完成的功能不再罗列 —— 现状以代码为准，架构参考见 [`../ARCHITECTURE.md`](../ARCHITECTURE.md)。
>
> 状态图例：**缺失** = 完全没做；**部分** = 做了但不完整 / 与计划有差距。
> 最后核对：2026-07-20（对照实际代码逐条验证）。

---

## 1. 与最初设想的技术差异（已实现，但偏离计划）

这些是「已经这么做了」的偏离，列出供决策是否回归计划：

- **数据库**：实际用 **SQLite**（`provider="sqlite"`），计划为 PostgreSQL 16。生产切 Postgres 未做，仓库内**无 docker-compose**。枚举 / Json 均以 `String` 存储（SQLite 限制）。
- **密码哈希**：实际 **scrypt**，计划为 argon2id。
- **UI 组件层**：**未引入 shadcn/ui**，为手写 Tailwind + `globals.css` 原子类；Tailwind 为 **v3**（计划 v4）。
- **状态 / 数据层**：**未使用 Zustand、React Query**（计划里列出）。
- **验证码**：自建算式验证码（进程内 Map），**未用 svg-captcha**。
- **邮件**：**未接 nodemailer**（注册验证 / 找回密码均未做）。
- **页面鉴权**：**无 `middleware.ts` 全局守卫**，改为每页 `requireUser()` + `redirect`。

---

## 2. 账号系统（M1 / auth）

- **缺失** — Playwright **E2E**（注册→登录→注销）。`test:e2e` 脚本存在但无 `@playwright/test` 依赖、无配置；唯一 e2e 是手写 `apps/web/tests/e2e/ws-flow.mjs`（仅 WS 鉴权）。
- **部分** — **限频覆盖不全**：只接了 login(10/min)、register(5/min)，**未接** `/api/captcha`、OAuth callback。
- **缺失** — 全局 `middleware.ts`（若决定统一鉴权而非每页 redirect）。
- **待定** — 邮箱验证（软验证：未验证用户只能发帖不能开团？）、找回密码（v0.2）、双因素 / 异地登录提醒（v0.2）。

---

## 3. 车卡（M2 / character）

- **部分** — **建卡向导**：实际 5 步（基础 → 属性 → 技能 → 装备 → 背景），计划为 ~7 步；时代 + 职业挤在第一步，**职业为自由文本**，无「按时代筛选职业」。
- **缺失** — **职业 / 兴趣技能自动分配**：`DEFAULT_OCCUPATION_POINTS(edu×4)` / `DEFAULT_INTEREST_POINTS(int×2)` 已在 `coc-rules` 定义，但**未接入**建卡流程；技能值靠手填。
- **部分** — **车卡详情页**：分区以静态卡片呈现，**无标签页（Tabs）切换**，**无页内编辑 UI**（`PATCH` 端点存在但详情页不调用，无编辑页）；「历史」（参与过的 Session）未做。
- **部分** — **派生函数边界单测**：仅 happy-path；缺 MOV 年龄分档、DB 表边界、MP 边界等边界用例；`computeMov`/`lookupDamageBonus`/`isValidPrimary` 无直接单测。
- **小 bug** — `/api/coc/roll` 传 `?d=N&s=M` 时忽略了 `s`（`rollDie(d)`）；`?expr=` 正常。

---

## 4. 招募 + Session 框架（M3 / recruitment）

- **缺失** — **发布端点** `/api/recruitments/[id]/publish`（无 DRAFT→OPEN 概念，POST 创建即 `OPEN`）。
- **缺失** — **关闭端点** `/api/recruitments/[id]/close`（现用 `DELETE` 置 `CLOSED` 代替）。
- **部分** — `/recruitments` **列表筛选 UI**：API 支持 `?status=`/`?mine=` 且有测试，但页面无筛选控件。
- **部分** — `/recruitments/[id]/manage` **无页内编辑表单**（编辑只有 PATCH API）。
- **部分** — **状态机测试**：覆盖 OPEN→FINISHED、无审核不能开团、DELETE→CLOSED、maxPlayers 校验；缺 OPEN→CLOSED 显式转换、非 OPEN 时 PATCH 锁定的测试。

---

## 5. 会话页面 / 端点（Session）

- **缺失** — `/sessions` **我的团列表页**（只有 `/sessions/[id]`）。
- **缺失** — `/api/sessions/[id]` 的 **GET / PATCH**（读 / 改会话元数据）。
- **缺失** — `/api/sessions/[id]/members`（成员增删查）。

---

## 6. 跑团大厅实时（M4）

- **缺失** — **聊天限频**（计划 5 条/10s）：realtime 的 OOC/IC 处理器未接任何限频。
- **部分** — **IC 归属校验**：服务端只拒绝「非 KP 发 desc」；PL 的 `characterId` 由客户端传入，**服务端未核对是否为本人 PC**（越权发言风险）。
- **缺失** — **日志虚拟列表**：`LogPanel` 为普通 `overflow-y-auto`，1000+ 条无虚拟化（`@tanstack/react-virtual` 未引入）。

---

## 7. 时钟（M6）

- **缺失** — **时钟单测**：`parseTime`/`formatTime`/`setRate` 在 `state.ts` 内**未导出、无单测**；`coc-rules/tests` 无时钟用例；仅集成测试间接触及。

---

## 8. 结算（M7）

- **部分** — **草稿回填**：各步输入已持久化到 `Settlement` 的 JSON 列，但向导挂载时**不从草稿回填**（只读 `initialStep`，未读 `initialDrafts`）；无显式「保存草稿」按钮 / 自动保存。

---

## 9. 公测打磨（M8，基本未做）

- **缺失** — 错误 / 加载 / 空态页面：无 `error.tsx`、`not-found.tsx`、`loading.tsx`（骨架屏）。
- **缺失** — WS 断线重连的顶部提示条（红条「连接已断开，正在重连…」）—— 需核对 `SessionClient` 现有横幅是否覆盖。
- **缺失** — 性能：日志虚拟列表（见 §6）、WS 消息压缩；时钟 tick 远程写库优化（5s 一次 + 客户端插值）。
- **缺失** — 安全审计（OAuth / 限频 / 防作弊全链路）。
- **缺失** — E2E 覆盖核心流程（见 §2）。
- **缺失** — 用户手册；数据备份策略；监控告警（v0.2 接 Sentry）。

---

## 10. 待规则书校准（TODO(规则书)）

以下数值 / 规则当前为 CoC 7e 占位，需按规则书核对后改 `coc-rules` 及相关文案：

1. 各职业默认技能表（每职业 EDU×4 可分配清单）
2. 伤害加成与体格（build）完整对照表（含 +2d6 等更大区间）
3. EDU 生成公式的版本约定
4. HP / MP 公式的「位制」约定（`(CON+SIZ)/2` vs 十位制）
5. MOV 计算修正（STR<SIZ、年龄 ≥40 分档）
6. Cthulhu Mythos 初始上限 / 增长上限、扣 SAN 公式
7. 成功等级边界（1 vs 5、96–100、掷出 100 的处理）
8. SAN 检定失败后是否自动触发理智检定（int×1/1d6）
9. 战斗 / 对抗判定特殊规则；是否支持「临时技能值」（援助他人）
10. 不同剧本阶段的 SAN 恢复表
11. 技能成长成功概率与成长量（+1d10 / +1d6 / 固定 +1）；每团成长投骰数量上限；≥95 是否自动失败
12. 临时疯狂 vs 长期疯狂的判定流程（v0.1 仅用 LogEntry 简单表达）

---

## 11. 用户反馈的具体待办（2026-07-20）

按需求逐条登记：

1. **基础数值输入从三列网格改每行一条** — `apps/web/src/components/CharacterForm.tsx:202` 第 2 步「属性」用了 `grid grid-cols-3 gap-3`，九大属性分三行三列，密集不易点。改为每条一行的纵向布局。
2. **可以修改车卡** — `PATCH /api/characters/[id]` 已实现，但 `/characters/[id]` 详情页**无页内编辑表单**（静态分区展示），也没有跳转去 `/characters/[id]/edit` 的入口。需要详情页「编辑」按钮 + 编辑表单（按基础 / 属性 / 技能 / 装备 / 背景 分步或单页）。
3. **数值可以超过 100** — `packages/shared/src/schemas/character.ts` 中 `PrimaryStatsSchema` 与 `SkillSchema` 的 `max(100)` 限制太死；`CharacterForm.tsx:206` 的 `<input max={100}>` 也写死了。八维 / 技能值允许 > 100（如高阶技能成长、神话知识），需把 zod 与表单输入上限放宽。
4. **新增技能后应可修改数值** — 当前 `CharacterForm` 第 3 步「技能」可编辑列表；需要确认新增技能行（点「+ 添加技能」后）能立即编辑数值（非只读 + 保存后才生效）。如果当前是只读新增，要改成可即时编辑。
5. **长期保存登录** — 当前 session cookie `maxAge: 7 * 24 * 3600`（7 天）。如需「记住我」长期保持，要做：单独的「记住我」勾选 → 写更长寿 cookie（如 90 天 / 1 年），同时服务端允许 refresh。JWT 本身无续期机制，需要在服务端加 refresh 端点 + cookie 续期逻辑。
6. **算法 vs `docs/技能.md` 对齐** — 教程是「简易版」规则，与代码现行的「CoC 7e 十位制」派生**不一致**：

   | 量 | 教程 | 代码（`packages/coc-rules/src/attributes.ts`） | 是否一致 |
   |---|---|---|---|
   | HP | `(CON + SIZ) // 10` | `Math.ceil((con + siz) / 10)` | ✓（ceil vs floor 在偶数时差 1，需统一） |
   | MOV | 人类固定 8 | `computeMov(DEX, STR, SIZ, age)`：DEX 基础 + STR<SIZ -1 + 年龄分档减 1~5 | ❌ |
   | SAN_max | 等于 POW | `pow * 5` | ❌ |
   | MP | `POW // 5` | `Math.ceil(pow / 5)` | ✓（同上 ceil vs floor） |
   | 幸运 | 3d6 × 5 | `roll3D6x5() * 5` | ✓ |
   | 伤害加成 / build | 给出对照表 2-64:-2 / 65-84:-1 / 85-124:0 / 125-164:+1d4 / 165-204:+1d6 | `lookupDamageBonus(build)` 表 2-64:-2 / 65-84:-1 / 85-124:0 / 125-164:+1d4 / 165+:+1d6 | ✓（无 +2d6 区间一致） |

   **结论**：MOV 与 SAN_max 与教程不一致。要么按教程改代码，要么在 `ARCHITECTURE.md` / `remaining-work.md` 标注「代码走 CoC 7e 通用规则，与项目自带简易教程不同」并保留双套说明。

---

## 12. 明确的 v0.2+（预留，非当前欠账）

剧本模版 / 剧情节点、附件（图片 / 音频）、公开团 / 私人团可见性与 `link` 分享 token、PL 黑名单、车卡导出 PDF/JSON 与跨平台导入、WS 加密 / 录像回放、移动端 PWA、i18n（next-intl）、站内通知中心、用户主页、剧本市场、`/settings` 页（改名 / 改密 / 绑定解绑 raricy / 注销账号）、管理员硬删。
