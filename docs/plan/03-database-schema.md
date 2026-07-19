# 03 · 数据库设计（Prisma Schema）

> 所有表的设计原则：单一权威源、外键清晰、关键变更带 `version` 字段便于回溯。

---

## 1. ER 总览

```
User ─┬─< Character
      ├─< Recruitment
      ├─< Application >── Recruitment
      ├─< Session (as KP)
      └─< SessionMember >── Session
                            └─ Character (PC)

Session ─┬─< LogEntry
         ├─< Judgment >── LogEntry
         ├─< ClockState (1:1)
         └─< Settlement

Character ─< Skill (1:N)
         ─< Weapon (1:N)
         ─< Equipment (1:N)
```

---

## 2. 完整 Prisma Schema（v0.1 草案）

> 命名风格：snake_case 字段名 + camelCase 模型名 + `@map` 映射到下划线。

```prisma
// packages/db/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ───────────────────────────── 通用枚举 ─────────────────────────────

enum AuthProvider {
  LOCAL
  RARICY
}

enum UserStatus {
  ACTIVE
  BANNED
  DELETED          // 软删
}

enum CharacterStatus {
  ACTIVE
  RETIRED          // 撕卡 / 送疯人院（软删）
}

enum RecruitmentStatus {
  DRAFT
  OPEN
  CLOSED
  FINISHED
}

enum ApplicationStatus {
  PENDING
  APPROVED
  REJECTED
  WITHDRAWN
}

enum SessionStatus {
  SETUP            // 已创建但未开始
  RUNNING
  PAUSED
  SETTLING         // 结算中
  FINISHED
  ABANDONED
}

enum SessionMemberRole {
  KP
  PL
  SPECTATOR
}

enum LogEntryType {
  CHAT_OOC         // 画外消息
  CHAT_IC          // 画内消息
  JUDGMENT         // 判定
  HP_CHANGE
  SAN_CHANGE
  MP_CHANGE
  SKILL_CHANGE     // 技能成长
  CLOCK            // 时钟事件
  SYSTEM           // KP 进入 / 退出 / 翻车等
  CUSTOM
}

enum JudgmentStatus {
  PENDING          // KP 发布，等待 PL 投骰
  ROLLED           // 已投，结果待同步
  RESOLVED         // 完成
  CANCELLED
}

enum SettlementStep {
  SAN_RECOVERY     // KP 给 SAN 恢复值
  KNOWLEDGE_GAIN   // 克苏鲁知识增加
  RETIREMENT       // 撕卡 / 疯人院
  SKILL_GROWTH     // 技能成长投骰
  DONE
}

// ───────────────────────────── User ─────────────────────────────

model User {
  id            String        @id @default(cuid())
  email         String?       @unique
  username      String        @unique
  avatarUrl     String?
  passwordHash  String?       // LOCAL 用户；OAuth 用户为空
  provider      AuthProvider
  providerSub   String?       // raricy sub
  status        UserStatus    @default(ACTIVE)
  emailVerifiedAt DateTime?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  lastLoginAt   DateTime?

  characters    Character[]
  recruitments  Recruitment[]
  sessions      Session[]     @relation("KPSessions")
  memberships   SessionMember[]
  applications  Application[]
  oauthTokens   OAuthToken[]
  captchaVerifies CaptchaVerify[]

  @@unique([provider, providerSub])
  @@index([status])
}

model OAuthToken {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash   String   @unique                // SHA-256 of access_token
  scope       String
  expiresAt   DateTime
  revokedAt   DateTime?
  createdAt   DateTime @default(now())

  @@index([userId])
}

model CaptchaVerify {
  id          String   @id @default(cuid())
  userId      String?                           // 注册时为空
  user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  scene       String                            // login | register | reset
  ip          String
  verified    Boolean   @default(false)
  consumedAt  DateTime?
  createdAt   DateTime  @default(now())

  @@index([ip, scene, createdAt])
}

// ───────────────────────────── Character ─────────────────────────────

model Character {
  id           String          @id @default(cuid())
  ownerId      String
  owner        User            @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  // 基础信息
  name         String
  gender       String?
  age          Int?
  birthplace   String?
  residence    String?
  nationality  String?
  occupation   String?
  era          String          @default("modern")   // modern / 1920s / victorian ...

  // 八大属性 + 幸运
  str          Int
  con          Int
  siz          Int
  dex          Int
  app          Int
  int          Int
  pow          Int
  edu          Int
  luck         Int             @default(50)

  // 派生（缓存，每次更新属性时重算）
  hpMax        Int
  mpMax        Int
  sanMax       Int
  mov          Int
  build        Int                              // STR + SIZ
  damageBonus  String                          // '-2','-1','0','+1d4','+1d6'

  // 当前状态（参与跑团时会被更新）
  hpCurrent    Int
  mpCurrent    Int
  sanCurrent   Int
  luckCurrent  Int

  // 时代背景相关
  background   String?         @db.Text        // 调查员背景故事
  notes        String?         @db.Text        // 备注
  status       CharacterStatus @default(ACTIVE)
  retiredReason String?                        // dead / asylum / user_request
  retiredAt    DateTime?

  // 版本（任何字段变更 +1，便于历史回溯）
  version      Int             @default(1)
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  skills       Skill[]
  weapons      Weapon[]
  equipment    Equipment[]
  members      SessionMember[]
  judgments    Judgment[]

  @@index([ownerId])
  @@index([status])
}

model Skill {
  id           String   @id @default(cuid())
  characterId  String
  character    Character @relation(fields: [characterId], references: [id], onDelete: Cascade)
  name         String                              // '侦查' / '聆听' / '图书馆使用' ...
  value        Int                                 // 0-99+
  isMythos     Boolean  @default(false)            // Cthulhu Mythos 标识
  note         String?

  @@unique([characterId, name])
  @@index([characterId])
}

model Weapon {
  id           String   @id @default(cuid())
  characterId  String
  character    Character @relation(fields: [characterId], references: [id], onDelete: Cascade)
  name         String
  skill        String                              // 关联技能名（如 '手枪'）
  damage       String                              // '1d6' / '2d6+1d4' ...
  range        String?                             // '15m' / '近战' ...
  ammo         Int?
  note         String?
}

model Equipment {
  id           String   @id @default(cuid())
  characterId  String
  character    Character @relation(fields: [characterId], references: [id], onDelete: Cascade)
  name         String
  quantity     Int      @default(1)
  note         String?
}

// ───────────────────────────── Recruitment ─────────────────────────────

model Recruitment {
  id           String           @id @default(cuid())
  kpId         String
  kp           User             @relation(fields: [kpId], references: [id], onDelete: Cascade)
  title        String
  summary      String           @db.Text
  // 模版信息
  scenario     String?                          // 剧本名
  minPlayers   Int              @default(3)
  maxPlayers   Int              @default(5)
  expectedHours Int?                            // 预计时长（小时）
  startAt      DateTime?                         // 预计开始时间
  visibility   String           @default("public") // public / link
  status       RecruitmentStatus @default(DRAFT)
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt
  finishedAt   DateTime?

  applications Application[]
  session      Session?

  @@index([status])
  @@index([kpId])
}

model Application {
  id              String            @id @default(cuid())
  recruitmentId   String
  recruitment     Recruitment       @relation(fields: [recruitmentId], references: [id], onDelete: Cascade)
  applicantId     String
  applicant       User              @relation(fields: [applicantId], references: [id], onDelete: Cascade)
  characterId     String                            // 报名车卡
  message         String?           @db.Text         // 申请人留言
  status          ApplicationStatus @default(PENDING)
  createdAt       DateTime          @default(now())
  reviewedAt      DateTime?
  reviewNote      String?

  @@unique([recruitmentId, characterId])
  @@index([applicantId])
}

// ───────────────────────────── Session ─────────────────────────────

model Session {
  id              String         @id @default(cuid())
  recruitmentId   String?        @unique
  recruitment     Recruitment?   @relation(fields: [recruitmentId], references: [id], onDelete: SetNull)
  kpId            String
  kp              User           @relation("KPSessions", fields: [kpId], references: [id], onDelete: Cascade)
  title           String
  scenario        String?
  status          SessionStatus  @default(SETUP)
  startedAt       DateTime?
  pausedAt        DateTime?
  finishedAt      DateTime?

  // 实时信息缓存（realtime 服务会高频写）
  inGameTime      String?        @default("08:00")   // 24h "HH:mm"
  inGameDate      String?        @default("1/1")      // "月/日" 或游戏内日期
  clockRunning    Boolean        @default(false)
  clockRate       Float          @default(1)         // 时间倍率
  clockMultiplier Decimal        @default(1) @db.Decimal(6,2)

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  members         SessionMember[]
  logs            LogEntry[]
  judgments       Judgment[]
  settlement      Settlement?

  @@index([kpId])
  @@index([status])
}

model SessionMember {
  id          String            @id @default(cuid())
  sessionId   String
  session     Session           @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  userId      String
  user        User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  characterId String?                                // PL 绑定的车卡；观战 / KP 为空
  character   Character?       @relation(fields: [characterId], references: [id], onDelete: SetNull)
  role        SessionMemberRole
  joinedAt    DateTime          @default(now())
  leftAt      DateTime?

  @@unique([sessionId, userId])
  @@index([sessionId])
}

// ───────────────────────────── LogEntry ─────────────────────────────

model LogEntry {
  id          String       @id @default(cuid())
  sessionId   String
  session     Session      @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  type        LogEntryType
  // 上下文
  authorId    String?                                    // 谁发出
  characterId String?                                    // 关联车卡
  judgmentId  String?       @unique
  judgment    Judgment?     @relation(fields: [judgmentId], references: [id], onDelete: SetNull)

  // 渲染相关
  payload     Json                                       // 类型对应的内容
  realTime    DateTime     @default(now())               // 真实时间
  inGameTime  String?                                    // 游戏内时间（IC / 判定带）

  createdAt   DateTime     @default(now())

  @@index([sessionId, createdAt])
  @@index([sessionId, type])
}

// ───────────────────────────── Judgment ─────────────────────────────

model Judgment {
  id              String         @id @default(cuid())
  sessionId       String
  session         Session        @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  characterId     String                                    // 被判定的角色
  character       Character      @relation(fields: [characterId], references: [id], onDelete: Cascade)

  // 配置（KP 发布时设定）
  skillName       String                                    // 技能名 / 属性名 / 'SAN' / '幸运'
  difficulty      String         @default("regular")       // regular | hard | extreme
  bonusDice       Int            @default(0)               // -2 ~ +2（负数=惩罚）
  scMin           Int?                                     // SAN check 时扣除的最小值
  scMax           Int?                                     // SAN check 时扣除的最大值

  status          JudgmentStatus @default(PENDING)
  rolledById      String?                                   // 谁投的骰
  rolledAt        DateTime?

  // 结果（realtime 服务计算后写入）
  diceRolls       Json?                                    // [1, 5, 8] 等原始骰值
  tens            Int?                                      // 奖励/惩罚后的十位判定（成功等级比较用）
  unit            Int?                                      // 个位
  successLevel    String?                                   // critical | extreme | success | fail | fumble
  scLoss          Int?                                      // SAN 损失
  targetSnapshot  Json?                                     // 投骰时角色技能快照（防止投骰后又改了）

  note            String?                                   // KP 给 PL 的提示

  log             LogEntry?

  createdAt       DateTime       @default(now())

  @@index([sessionId, status])
  @@index([characterId])
}

// ───────────────────────────── Settlement ─────────────────────────────

model Settlement {
  id            String       @id @default(cuid())
  sessionId     String       @unique
  session       Session      @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  step          SettlementStep @default(SAN_RECOVERY)

  // KP 决定的 SAN 恢复（每名 PL 一条）
  sanRecoveries Json?        // [{ characterId, amount }]
  // 克苏鲁知识增长
  knowledgeGains Json?       // [{ characterId, amount, mythos }]
  // 撕卡 / 疯人院
  retirements   Json?        // [{ characterId, reason: 'asylum'|'dead'|'user' }]
  // 技能成长投骰记录（PL 决定哪些技能投）
  skillGrowths  Json?        // [{ characterId, skillName, currentValue, diceRoll, succeeded }]

  completedAt   DateTime?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}
```

---

## 3. 关键字段设计说明

### 3.1 Character 派生字段冗余存储

`hpMax / mpMax / sanMax / mov / build / damageBonus` 是从八维计算出来的，但**冗余存储**：

- 计算密集：实时聊天中要展示，重复计算耗 CPU
- 快照语义：当玩家改属性时，要明确"现在的派生 vs 改之前的派生"，要写日志

> 修改八维时通过 DB transaction 重算并写日志。

### 3.2 Judgment 的 `targetSnapshot`

投骰瞬间把角色技能值固化下来。如果投骰之后 KP 又改了角色技能，结果不会被重算，保证公平。

### 3.3 LogEntry 的 `payload: Json`

每种 `type` 对应一个 payload schema（用 zod 在前后端共享）：

```ts
// packages/shared/zod-schemas/log.ts
export const ChatOOCPayload = z.object({
  content: z.string().min(1).max(2000),
});

export const ChatICPayload = z.object({
  kind: z.enum(['desc', 'dialogue']),
  content: z.string().min(1).max(2000),
  characterId: z.string().cuid().optional(),
});

export const JudgmentPayload = z.object({
  judgmentId: z.string(),
  // ...冗余渲染字段
});

export const HpChangePayload = z.object({
  characterId: z.string(),
  delta: z.number().int(),
  hpAfter: z.number().int(),
  reason: z.string().max(200),
});

export const SanChangePayload = z.object({
  characterId: z.string(),
  delta: z.number().int(),
  sanAfter: z.number().int(),
  reason: z.string().max(200),
});
```

### 3.4 Settlement 的 Json 字段

结算的每一步都允许 KP 半途保存，"未完成"状态可断网续接。

### 3.5 Character 软删

`status = RETIRED` + `retiredReason`：

- 车卡列表仍显示，但不可再加入新 Session
- 历史 SessionMember 仍指向它（`characterId` 外键 `onDelete: SetNull` 是兜底，正常情况不删）

---

## 4. 索引策略

| 查询模式 | 索引 |
|---|---|
| 用户登录后查自己的车卡 | `Character.ownerId` |
| 浏览公开招募 | `Recruitment(status, createdAt)` |
| 跑团中拉日志（最新 N 条） | `LogEntry(sessionId, createdAt)` |
| 一场内查判定（按状态过滤） | `Judgment(sessionId, status)` |
| 软删车卡过滤 | `Character(status)` |

---

## 5. 迁移策略

- 用 Prisma Migrate：每次 schema 变动生成 migration 文件
- 破坏性变更（删字段、改类型）走 expand-migrate-contract 三段式
- 所有 migration 文件进 git，CI 跑 `prisma migrate deploy`

---

## 6. 待校准（TODO(规则书)）

- Cthulhu Mythos 技能初始上限、扣 SAN 公式
- 疯狂发作机制（是否需要存当前疯狂状态）—— 当前用 `LogEntry` + `Judgment` 表达
- 是否需要「临时 HP / 临时 SAN」概念（v0.1 用 `hpCurrent` / `sanCurrent` 即可）

---

## 7. 后续可能的表（v0.2+）

- `ScriptNode`：剧本节点（标记剧情进度）
- `Attachment`：跑团附件（图片 / 音频 / 链接）
- `Notification`：通知（站内信）
- `AuditLog`：管理员操作审计
- `Badge`：成就系统