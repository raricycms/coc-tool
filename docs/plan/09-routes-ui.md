# 09 · 路由与 UI 清单

> Next.js App Router 下的全部页面、布局、组件。

---

## 1. 路由总览

```
/                                            # 首页（公开）
├── /login                                   # 登录
├── /register                                # 注册
├── /oauth/raricy/start                      # → 302 raricy
├── /api/auth/raricy/callback                # OAuth 回调
│
├── /dashboard                               # 登录后首页
├── /characters                              # 车卡列表
│   ├── /characters/new                      # 新建车卡
│   └── /characters/[id]                     # 车卡详情/编辑
├── /recruitments                            # 招募列表
│   ├── /recruitments/new                    # 发布招募
│   ├── /recruitments/[id]                   # 招募详情
│   └── /recruitments/[id]/manage            # KP 管理（编辑/审核/启动）
├── /sessions                                # 我参与的团
│   └── /sessions/[id]                       # 跑团大厅（核心）
│       └── /sessions/[id]/settlement        # 结算页
│
├── /settings                                # 个人设置
└── /logout                                  # 注销
```

API 端点：

```
/api/auth/{login,register,logout}
/api/auth/raricy/{start,callback}
/api/captcha
/api/captcha/verify
/api/characters                    GET, POST
/api/characters/[id]               GET, PATCH, DELETE
/api/recruitments                  GET, POST
/api/recruitments/[id]             GET, PATCH, DELETE
/api/recruitments/[id]/publish     POST
/api/recruitments/[id]/close       POST
/api/recruitments/[id]/start       POST
/api/recruitments/[id]/applications       GET, POST
/api/recruitments/[id]/applications/[appId] PATCH
/api/sessions/[id]                          GET, PATCH
/api/sessions/[id]/members                  GET, POST, DELETE
/api/sessions/[id]/settlement/...           各步骤
/api/coc/roll                                GET（投骰辅助）
```

---

## 2. 页面详情

### 2.1 `/`（首页 / 落地页）

- 公开
- 文案：「在线 CoC 跑团工具 · 注册即用」
- CTA：「[注册] [raricy 一键登录]」

### 2.2 `/login`

- 表单：用户名、密码、验证码（图形）
- 下方：「raricy 登录」链接
- 「没有账号？[注册]」链接
- 失败提示：通用错误（防枚举）

### 2.3 `/register`

- 表单：用户名、邮箱、密码、验证码
- 下方：「raricy 一键注册」链接

### 2.4 `/dashboard`

登录后默认页。布局：

```
┌─ 顶栏：站点名 / 用户头像菜单 ─────────────────┐

┌─ 我的车卡 ──────┐ ┌─ 我参与的团 ──────┐ ┌─ 我招募的团 ──────┐
│ - 林远          │ │ - 《克苏鲁的呼唤》 │ │ - 《黄衣之王》    │
│ - 李明 (撕卡)   │ │   KP: @alice      │ │   招募中 (3/5)   │
│ [+ 新建]        │ │ - 《敦威治》       │ │ [+ 新建招募]     │
└────────────────┘ └────────────────────┘ └────────────────────┘

┌─ 公开招募（快速浏览）───────────────────────────┐
│ - 1920s 模组「无名之城」招募中                  │
│ - 现代模组「黑水街」招募中                      │
└──────────────────────────────────────────────┘
```

### 2.5 `/characters`

```
┌──────────────────────────────────────────────┐
│ 我的车卡                       [+ 新建车卡]  │
├──────────────────────────────────────────────┤
│ ☐ 林远 · 1920s 私家侦探        ✓可上场       │
│   STR 60 CON 70 SIZ 50 ... SAN 50/50  HP 12/12│
│                                              │
│ ☐ 李明 · 现代大学生           ⚰ 已撕卡（永久疯狂） │
│                                              │
│ ☐ 王医生 · 1920s              ✓可上场        │
└──────────────────────────────────────────────┘
```

### 2.6 `/characters/new`

创建向导：

```
Step 1: 选择时代背景
   ⓘ 现代  ⓘ 1920s  ⓘ 维多利亚  ⓘ 古代  ⓘ 未来

Step 2: 选择职业
   （按时代筛选后的职业列表）

Step 3: 随机生成 / 手动填写
   [随机生成]  [手动填写]

Step 4: 八维调整
   （随机生成结果或手动填表）

Step 5: 技能编辑
   （默认技能 + 自由分配职业技能 EDU×4 + 兴趣技能 INT×2）

Step 6: 武器 / 装备 / 背景
   （列表编辑 + 长文本）

Step 7: 预览 & 保存
```

### 2.7 `/characters/[id]`

Tabs：

- **概览**：基础信息 + 派生
- **属性**：八维 + 派生 + 重新投骰按钮
- **技能**：技能列表，可编辑
- **武器 / 装备**：列表
- **背景**：长文本
- **历史**：参与过的 Session 列表

### 2.8 `/recruitments`

公开招募列表 + 筛选（剧本 / 时代 / 时间）。

### 2.9 `/recruitments/new`

表单：标题 / 简介 / 剧本 / 人数 / 预计时间 / 可见性。

### 2.10 `/recruitments/[id]`

详情页：
- 完整介绍
- 当前报名 PL（已批准的）列表
- [报名] / [取消报名] 按钮
- 状态徽章（OPEN / CLOSED / FINISHED）

### 2.11 `/recruitments/[id]/manage`（KP only）

- 编辑招募信息
- 关闭招募
- 审核报名（每条 approve / reject + 留言）
- [启动团] 按钮

### 2.12 `/sessions`

我作为 KP 的团 + 我作为 PL 的团 + 我观战过的团（v0.2）。

### 2.13 `/sessions/[id]` ⭐ 核心

```
┌────────────────────────────────────────────────────────────────────┐
│ 《克苏鲁的呼唤》 ⏰ 10/15 20:32 [KP 模式 / PL 模式 / 观战]   [···] │
├──────────────────────────┬──────────────────────────┬──────────────┤
│ 画外 (OOC)               │ 画内 (IC)                 │ 日志         │
│ 真实时间戳                │ 游戏内时间戳              │              │
│                          │                          │              │
│ [消息流]                  │ [消息流]                  │ [判定 / 数值]│
│                          │                          │              │
│ [输入框]                  │ [输入框]                  │              │
├──────────────────────────┴──────────────────────────┴──────────────┤
│ ⏰ 时钟面板  │  待投骰列表  │  参与人员头像                         │
└────────────────────────────────────────────────────────────────────┘
```

**KP 专属**：

- 时钟面板：开始 / 暂停 / 倍率 / 调整
- 「发布判定」按钮：弹出 Modal 配置判定
- 「修改车卡」按钮（KP 可改任意 PL 的车卡 HP / SAN / MP）
- 「结束本场 → 结算」按钮

**PL 专属**：

- 待投骰时显示「投骰子」按钮
- 不能发 KP 描述（服务端拒绝）

**观战**：

- 画外可发言
- 画内只读
- 日志只读

### 2.14 `/sessions/[id]/settlement`

结算向导：

```
Step 1: SAN 恢复   →  Step 2: Mythos  →  Step 3: 撕卡 → Step 4: 技能成长 → 完成
```

PL 端：进入结算页时只看到自己的部分（SAN / Mythos / 撕卡都是 KP 决定，但 PL 自己能在 Step 4 投骰）。

### 2.15 `/settings`

- 修改用户名（v0.2）
- 修改密码（v0.2）
- 绑定 raricy 账号（v0.2）
- 解绑 raricy 账号（v0.2）
- 注销账号（v0.2）
- 危险区：清空所有数据

---

## 3. 关键组件

| 组件 | 路径 | 说明 |
|---|---|---|
| `<AppShell>` | `components/layout/AppShell.tsx` | 顶栏 + 内容区 |
| `<CaptchaBox>` | `components/captcha/CaptchaBox.tsx` | 图形验证码 |
| `<CharacterCard>` | `components/character/CharacterCard.tsx` | 车卡概要 |
| `<CharacterEditor>` | `components/character/CharacterEditor.tsx` | 车卡编辑器 |
| `<SkillTable>` | `components/character/SkillTable.tsx` | 技能列表 |
| `<ChatPanel>` | `components/session/ChatPanel.tsx` | 通用聊天面板（OOC / IC） |
| `<LogPanel>` | `components/session/LogPanel.tsx` | 日志区 |
| `<ClockPanel>` | `components/session/ClockPanel.tsx` | 时钟面板 |
| `<JudgmentCreator>` | `components/session/JudgmentCreator.tsx` | KP 发布判定 |
| `<JudgmentRoller>` | `components/session/JudgmentRoller.tsx` | PL 投骰按钮 |
| `<PresenceBar>` | `components/session/PresenceBar.tsx` | 在线人员 |
| `<SettlementWizard>` | `components/session/SettlementWizard.tsx` | 结算向导 |
| `<VirtualList>` | `components/ui/VirtualList.tsx` | 虚拟列表 |

---

## 4. 样式约定

- 主色：暗灰 / 深紫（神秘氛围）
- 字体：`Inter` + `Noto Sans SC`
- shadcn 主题：自定义 dark 配色
- 跑团大厅三栏布局用 CSS Grid，移动端降级为 Tabs

---

## 5. 国际化（v0.1 占位）

- v0.1 仅中文，文案全部 hard-code 在组件内
- v0.2 接 next-intl，所有文案迁到 `messages/zh.json`

---

## 6. 可访问性

- 所有交互组件支持键盘操作
- 颜色对比度 ≥ 4.5:1
- 聊天区 `aria-live="polite"` 让屏幕阅读器读新消息

---

## 7. 移动端（PWA 友好）

- v0.1 响应式即可，不做 PWA install
- 跑团大厅移动端用 Tabs 切换三栏
- 屏幕 < 640px：聊天区隐藏时钟面板，时钟移到底部

---

## 8. 加载态 / 错误态

| 场景 | 表现 |
|---|---|
| WebSocket 断开 | 顶部红条「连接已断开，正在重连…」 |
| 加载历史 | 日志区骨架屏 |
| 服务器错误 | toast 提示 + 自动重试按钮 |
| 表单校验失败 | 字段下方红字 + 顶部 banner |

---

## 9. 待补充

- [ ] 通知中心 `/notifications`（v0.2）
- [ ] 用户主页 `/users/[username]`（v0.2）
- [ ] 剧本市场 `/scripts`（v0.2）