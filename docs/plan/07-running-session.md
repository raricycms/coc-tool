# 07 · 跑团大厅（Running Session）

> 这是 Coc-tools 的核心模块：双聊天区 + 日志 + 判定 + 时钟 + 观战，全部由 Socket.IO 驱动。

---

## 1. 总体布局

```
┌──────────────────────────────────────────────────────────────────────┐
│  跑团大厅 /sessions/:id                            [退出] [设置]    │
├─────────────────────────┬─────────────────────────┬──────────────────┤
│  画外（OOC）            │  画内（IC）             │  日志            │
│  真实时间戳              │  游戏内时间戳            │  实时            │
│                         │                         │                  │
│  [消息流]               │  [消息流]               │  [判定 / 数值]   │
│                         │                         │                  │
│  [输入框]               │  [输入框]               │  [时钟面板]      │
├─────────────────────────┴─────────────────────────┴──────────────────┤
│ 底部：参与人员 + 当前判定（待投骰列表）                              │
└──────────────────────────────────────────────────────────────────────┘
```

布局响应式：
- 桌面端三栏并排
- 平板双栏（日志可切换）
- 手机单栏，标签页切换

---

## 2. 实时频道（Socket.IO Rooms）

每个 Session 是一个 `room`，命名 `session:{id}`。所有客户端（KP / PL / 观战）订阅这个房间。

**频道分类**（同一房间内用 event 名区分）：

| Event | 方向 | 谁能发 | 谁会收 |
|---|---|---|---|
| `ooc:message` | C→S, S→C | 任何人（登录） | 房间全员 |
| `ic:message` | C→S, S→C | KP 全权；PL 仅能以自己 PC 发言 | 房间全员 |
| `judgment:created` | S→C | 服务端（KP 触发的命令） | 房间全员（PL 看到待投骰） |
| `judgment:result` | S→C | 服务端（PL 投骰后） | 房间全员 |
| `hp/san/mp:changed` | S→C | 服务端（KP / 判定触发） | 房间全员 |
| `clock:state` | S→C | 服务端 | 房间全员 |
| `clock:control` | C→S | KP | 服务端 |
| `presence:update` | S→C | 服务端 | 房间全员 |
| `character:updated` | S→C | 服务端 | 房间全员 |
| `log:entry` | S→C | 服务端 | 房间全员（用于重放 / 补发） |

> C = Client，S = Server

---

## 3. 画外（OOC）聊天区

### 3.1 数据形态

```ts
interface OOCMessage {
  id: string;
  sessionId: string;
  authorId: string;
  authorUsername: string;
  authorAvatar: string | null;
  content: string;
  realTime: string;   // ISO 真实时间
  type: 'CHAT_OOC';
}
```

### 3.2 流程

```
Client (any)                apps/realtime
  │                              │
  │  emit('ooc:send', content)   │
  │ ───────────────────────────► │
  │                              │ 1. 鉴权（登录）
  │                              │ 2. 长度校验 (≤ 2000)
  │                              │ 3. 限频（同用户 ≤ 5 条 / 10s）
  │                              │ 4. 写 LogEntry(type=CHAT_OOC, payload, realTime=now)
  │                              │ 5. 广播 ooc:message 到 room
  │ ◄─────────────────────────── │
```

### 3.3 UI 渲染

```
[头像] username         14:23:01
       嗨，今天的剧本看起来很有意思
```

- 显示**真实时间**（HH:mm:ss）
- 支持 @mention（v0.2）
- 支持表情（v0.2 简化为 emoji）

---

## 4. 画内（IC）聊天区

### 4.1 三类内容

| kind | 来源 | 显示 |
|---|---|---|
| `desc`（描述） | KP | KP 名字 + 无头像（用 KP 标签）+ 内容 |
| `dialogue`（角色发言） | KP 或 PL | 头像 = 角色头像；名字 = 角色名 |
| `system-ic`（系统） | 服务端 | "夜幕降临" / "远处传来声响" |

### 4.2 数据形态

```ts
interface ICMessage {
  id: string;
  sessionId: string;
  kind: 'desc' | 'dialogue';
  authorId: string;            // KP or PL
  authorUsername: string;
  characterId?: string;        // dialogue 时必有
  characterName?: string;
  content: string;
  inGameTime: string;          // 当前 Session.inGameTime（如 "20:32"）
  inGameDate: string;          // 当前 Session.inGameDate（如 "10/15"）
  type: 'CHAT_IC';
}
```

### 4.3 流程

**KP 发描述 / 对话**：

```
KP Client                                    realtime
  │  emit('ic:send', { kind, content })     │
  │ ──────────────────────────────────────► │
  │                                          │ 鉴权 + 角色校验（必须是 KP）
  │                                          │ 写 LogEntry(type=CHAT_IC)
  │ ◄────── broadcast ic:message ─────────── │
```

**PL 发自己角色的对话**：

```
PL Client                                    realtime
  │  emit('ic:character-send', { content })   │
  │ ──────────────────────────────────────►  │
  │                                          │ 鉴权 + 必须绑定 PC
  │                                          │ 取 characterId from session member
  │                                          │ 写 LogEntry
  │ ◄────── broadcast ic:message ─────────── │
```

> PL 不能发 `kind=desc`；服务端拒绝。

### 4.4 渲染

```
[KP 标签]                          10/15 20:32
                    窗外传来凄厉的叫声...

[角色头像] 林远 (PL: Alice)         10/15 20:32
          "你们听到了吗？那是什么？"

[KP 标签]                          10/15 20:33
                    描述：林远回头望去，但只有黑暗。
```

---

## 5. 日志区（Log Panel）

### 5.1 设计目标

- **结构性**：可按类型筛选（判定 / HP 变化 / SAN 变化 / 技能变化 / 时钟事件）
- **可重放**：进房间时把历史 LogEntry 倒序拉到本地缓存
- **可滚动**：1000+ 条不卡（虚拟列表）

### 5.2 数据形态

```ts
interface LogEntry {
  id: string;
  type: 'CHAT_OOC' | 'CHAT_IC' | 'JUDGMENT'
      | 'HP_CHANGE' | 'SAN_CHANGE' | 'MP_CHANGE'
      | 'SKILL_CHANGE' | 'CLOCK' | 'SYSTEM' | 'CUSTOM';
  authorId?: string;
  characterId?: string;
  judgmentId?: string;
  payload: Record<string, any>;   // 类型对应的 zod schema
  realTime: string;
  inGameTime?: string;
}
```

### 5.3 渲染规则

| type | 渲染 |
|---|---|
| `CHAT_OOC` | 头像 + 用户名 + 内容 + 真实时间 |
| `CHAT_IC` | 头像 / KP 标签 + 内容 + 游戏内时间 |
| `JUDGMENT` | 「判定：侦查（难度 困难）→ 🎲 投骰 27 → 成功 / 极难成功 / ...」+ SAN 损失 |
| `HP_CHANGE` | 「❤️ 林远：12 → 9（被蝙蝠咬伤）」 |
| `SAN_CHANGE` | 「🧠 林远：50 → 45（目睹不可名状之物，sc: 1/1d6）」 |
| `MP_CHANGE` | 「🔮 林远：12 → 11（施法消耗）」 |
| `SKILL_CHANGE` | 「📚 林远 侦查 25 → 26（成长投骰成功）」 |
| `CLOCK` | 「⏰ 时间前进 1h → 21:32」 |
| `SYSTEM` | 系统提示（KP 加入、判定取消等） |

### 5.4 实时推送

所有 LogEntry 都通过 `log:entry` 事件广播到房间，**客户端不需要再单独订阅其它事件**——其它事件都是先写 LogEntry，再广播 `log:entry`。

> 这样设计的优势：进房间时只拉一次 log 列表，后续全靠 `log:entry` 增量。

### 5.5 客户端缓存

```
joinRoom
  → emit('log:history', { since?: cursor })
  → receive: { entries: LogEntry[] }（最新 100 条，可传 cursor 续拉）

后续
  → 收 log:entry
  → prepend/append
```

---

## 6. 判定系统（核心）

> 这是用户最强调的：**PL 只需按按钮投骰**，所有复杂逻辑都在服务端。

### 6.1 KP 发布判定

```ts
interface JudgmentCreate {
  type: 'skill' | 'san' | 'luck' | 'combat' | 'opposed';
  targetCharacterId: string;     // 被判定的 PC
  skillName: string;             // 技能名 / 'SAN' / '幸运'
  difficulty: 'regular' | 'hard' | 'extreme';
  bonusDice: number;             // -2 ~ +2（负数=惩罚）
  scMin?: number;                // SAN check 时 SAN 扣除下限
  scMax?: number;                // SAN check 时 SAN 扣除上限
  note?: string;                 // KP 给 PL 的提示
}
```

服务端处理：

```
1. 鉴权（KP）
2. 取该 PC 的技能快照（当前技能值）
3. 写 Judgment(status=PENDING, targetSnapshot={ skillName, value, hp, san })
4. 写 LogEntry(type=JUDGMENT, payload=judgmentSummary)
5. 广播 judgment:created 到房间
   → PL 端在「待投骰」面板看到这个判定
```

### 6.2 PL 投骰

```ts
interface JudgmentRoll {
  judgmentId: string;
}
```

服务端处理（**这是服务端掷骰，不是客户端**）：

```ts
import { rollD10, applyBonusDice, judgeSuccess } from '@coc-tools/coc-rules';

const judgment = await prisma.judgment.findUnique(...);
if (!judgment || judgment.status !== 'PENDING') throw new Error('not_pending');

const target = judgment.targetSnapshot as any;
// target.skillValue = 当前技能值（投骰时快照）

// 1. 准备骰子
const rolls = [rollD10()];                // 基础 1d10
const bonusDice = Math.max(-2, Math.min(2, judgment.bonusDice));
for (let i = 0; i < Math.abs(bonusDice); i++) rolls.push(rollD10());

// 2. 应用奖励/惩罚（取最低为 tens）
const finalValue = applyBonusDice(rolls, bonusDice);  // { tens, unit }
//    bonusDice >= 0 → 取最小；< 0 → 取最大

// 3. 与技能比较得成功等级
const success = judgeSuccess({
  skillValue: target.skillValue,
  difficulty: judgment.difficulty,
  tens: finalValue.tens,
});

// 4. 若 SAN check，计算 sc 损失
let scLoss = 0;
if (judgment.skillName === 'SAN') {
  scLoss = randomInt(judgment.scMin!, judgment.scMax!);
}

// 5. 更新 PC 状态
if (scLoss > 0) {
  const c = await prisma.character.findUnique({ where: { id: judgment.characterId } });
  await prisma.$transaction([
    prisma.character.update({
      where: { id: judgment.characterId },
      data: { sanCurrent: Math.max(0, c!.sanCurrent - scLoss) },
    }),
    prisma.judgment.update({
      where: { id: judgment.id },
      data: {
        status: 'RESOLVED',
        diceRolls: rolls,
        tens: finalValue.tens, unit: finalValue.unit,
        successLevel: success, scLoss,
        rolledAt: new Date(),
      },
    }),
    prisma.logEntry.create({
      data: {
        sessionId, type: 'JUDGMENT',
        judgmentId: judgment.id,
        payload: { rolls, finalValue, success, scLoss, targetSkillValue: target.skillValue, ... },
      },
    }),
    prisma.logEntry.create({
      data: {
        sessionId, type: 'SAN_CHANGE',
        characterId: judgment.characterId,
        payload: { delta: -scLoss, reason: `SAN check 失败，扣 ${scLoss}` },
      },
    }),
  ]);
}

// 6. 广播 judgment:result + log:entry（×2）
```

### 6.3 成功等级规则

```ts
// packages/coc-rules/judgment.ts
export function judgeSuccess(params: {
  skillValue: number;
  difficulty: 'regular' | 'hard' | 'extreme';
  tens: number;    // 1-10（十位）
  unit: number;    // 0-9（个位）
  rawRolls: number[];  // 原始骰值（含奖励/惩罚）
}): 'critical' | 'extreme' | 'hard' | 'success' | 'fail' | 'fumble' {
  const { skillValue, difficulty, tens, unit, rawRolls } = params;
  const final = tens * 10 + unit;     // 0-99

  // 大失败：骰出 100
  if (final >= 100) return 'fumble';

  // 大成功：个位为 0，且 tens × 10 ≤ skillValue / 5
  // CoC 7e 规则：若骰出 1（即个位 = 0，十位 = 0），且 tens ≤ skillValue / 5
  if (tens === 0 && unit === 0) return 'critical';

  // 极难成功：final ≤ skillValue / 5
  if (final <= Math.floor(skillValue / 5)) return 'extreme';

  // 困难成功：final ≤ skillValue / 2
  if (final <= Math.floor(skillValue / 2)) {
    if (difficulty === 'hard' || difficulty === 'extreme') return 'hard';
    return 'extreme';   // 若 KP 设了 hard，自动升级
  }

  // 常规成功：final ≤ skillValue
  if (final <= skillValue) return 'success';

  return 'fail';
}
```

> **TODO(规则书)**：核对成功等级边界（部分版本对 1 vs 5、96-100、骰出 100 的处理有差异）。

### 6.4 SAN 检定特殊逻辑

`skillName === 'SAN'` 时：

- `targetSnapshot.value = sanCurrent`（投骰瞬间的 SAN）
- `scLoss = scMin` 若成功 / 极难成功；`scLoss = randomInt(scMin, scMax)` 若失败
- 失败时还要**再投一次理智检定（int × 1/1d6）**（**TODO(规则书)** 是否自动触发？）

### 6.5 PL 投骰按钮 UI

```
┌─ 待投骰 ─────────────────────┐
│                              │
│ 🎯 KP 要求你进行判定          │
│                              │
│   技能：侦查                  │
│   难度：困难（hard）          │
│   奖励/惩罚骰：+1             │
│                              │
│   KP 备注：偷偷靠近观察         │
│                              │
│   [   投 骰 子   ]            │
│                              │
└──────────────────────────────┘

→ 点按后，服务端掷骰，结果同步到日志
```

> PL 端**看不到**任何骰子结果预览，必须等服务端推送——这是公平的。

---

## 7. 时钟系统（Clock）

### 7.1 数据形态

```ts
interface ClockState {
  sessionId: string;
  inGameTime: string;        // "20:32"
  inGameDate: string;        // "10/15"
  running: boolean;
  rate: number;              // 时间倍率：1 / 2 / 4 / 0.5
  // 累计偏移（用于在 PAUSED 时继续计时）
  offsetMs: number;
  // 服务端权威基准时间
  serverStartedAt: Date | null;   // 上次 start 时刻
  serverBaseTime: number;         // 暂停时累加
}
```

### 7.2 服务端推进

```ts
// 每秒 tick（仅 running = true 时）
function tickClock(sessionId: string) {
  const s = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!s || !s.clockRunning) return;

  const elapsedMs = Date.now() - s.serverStartedAt.getTime();
  const inGameDeltaMs = elapsedMs * s.clockRate;

  const base = parseTime(s.serverBaseTime);  // 累计的 inGame 毫秒
  const newInGameMs = base + inGameDeltaMs;

  const [hh, mm, dd] = formatInGame(newInGameMs);

  await prisma.session.update({
    where: { id: sessionId },
    data: { inGameTime: hh + ':' + mm, inGameDate: dd },
  });

  io.to(`session:${sessionId}`).emit('clock:state', {
    inGameTime: hh + ':' + mm, inGameDate: dd, running: true, rate: s.clockRate,
  });
}
```

### 7.3 KP 控制

```ts
type ClockControlAction =
  | { action: 'start' }
  | { action: 'pause' }
  | { action: 'setRate'; rate: number }   // 0.5 / 1 / 2 / 4 / 8
  | { action: 'setTime'; inGameTime: string; inGameDate: string }
  | { action: 'addTime'; deltaMinutes: number };   // 跳进 / 倒退
```

服务端处理：

```
start: serverStartedAt = now, serverBaseTime = parseTime(inGameTime), clockRunning = true
pause: serverBaseTime += (now - serverStartedAt) × rate, serverStartedAt = null, clockRunning = false
setRate: 同 pause + start（但保留旧 baseTime 与新 rate）
setTime: serverBaseTime = parseTime(inGameTime)
addTime: serverBaseTime += deltaMinutes × 60_000
```

### 7.4 KP 时钟 UI

```
┌─ 时钟 ──────────────────┐
│  ⏰ 10/15 20:32         │
│  状态：▶ 运行           │
│  倍率：[1x][2x][4x][8x] │
│                        │
│  [开始][暂停]           │
│  [+15m][+1h][-15m]      │
│  [设定时间: __:__]      │
└────────────────────────┘
```

### 7.5 客户端展示

- 顶部固定显示 `10/15 20:32`
- 所有画内消息、判定日志的「游戏内时间」都跟着这个时钟走
- 观战者也能看到时钟

### 7.6 跑团开始时初始化

```
创建 Session 时默认 inGameTime = "08:00", inGameDate = "1/1"
KP 可在开团时改一次作为"出发时间"
```

---

## 8. 观战（SPECTATOR）

### 8.1 加入条件

- 登录用户
- 不是 SessionMember（既不是 KP 也不是 PL）

### 8.2 进入方式

- 浏览器直接访问 `/sessions/:id`（未报名 / 未邀请）
- 服务端在 Socket.IO 握手时校验：用户不存在于 SessionMember 中 → 创建临时 SPECTATOR SessionMember

### 8.3 权限

| 区域 | 可见 | 可发 |
|---|---|---|
| 画外（OOC） | ✅ | ✅ |
| 画内（IC） | ✅ | ❌ |
| 日志 | ✅（仅系统/IC/判定） | ❌ |
| HP / SAN / MP 数值 | ✅ | ❌ |
| 判定投骰 | ❌ | ❌ |
| 时钟 | ✅（只读） | ❌ |
| 车卡详情（PL 视角） | ✅ 公开部分 | ❌ |

### 8.4 实时表现

观战者的画外发言带「观战」徽章，方便区分。

---

## 9. 状态机：Session.status

```
SETUP ──kp click start──► RUNNING ──kp pause──► PAUSED
                              │                    │
                              ├──kp resume─────────┘
                              │
                              └──kp finish────► SETTLING ──kp close──► FINISHED
                                                                  │
                                                                  └─ kp abandon ──► ABANDONED
```

- **SETUP**：KP 创建团后、首次进跑团大厅前。允许编辑 SessionMember
- **RUNNING**：时钟走、聊天可发、判定可进行
- **PAUSED**：时钟停，其它不变
- **SETTLING**：结算阶段（详见 08-settlement.md）
- **FINISHED**：不可再进入（v0.2 可回放）
- **ABANDONED**：团取消（数据保留但不可再开）

---

## 10. 房间生命周期

```
joinRoom(sessionId, userId)
  → 鉴权 + 必须是 SessionMember 或 SPECTATOR
  → socket.join(`session:${sessionId}`)
  → 发 presence:update
  → 推 log:history(最新 100 条)
  → 推当前 clock:state

leaveRoom
  → socket.leave
  → 发 presence:update

sessionFinish
  → 所有 socket leave
  → 关闭 tick 循环
  → 写最终 LogEntry(type=SYSTEM, payload={ event: 'finished' })
```

---

## 11. 关键 Socket.IO 事件 schema（zod）

```ts
// packages/shared/zod-schemas/events.ts
export const OOCSendSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const ICSendSchema = z.object({
  kind: z.enum(['desc', 'dialogue']),
  content: z.string().min(1).max(2000),
  characterId: z.string().cuid().optional(),
});

export const JudgmentCreateSchema = z.object({
  targetCharacterId: z.string().cuid(),
  type: z.enum(['skill', 'san', 'luck', 'combat', 'opposed']),
  skillName: z.string().min(1).max(40),
  difficulty: z.enum(['regular', 'hard', 'extreme']).default('regular'),
  bonusDice: z.number().int().min(-5).max(5).default(0),
  scMin: z.number().int().min(0).max(100).optional(),
  scMax: z.number().int().min(0).max(100).optional(),
  note: z.string().max(500).optional(),
});

export const JudgmentRollSchema = z.object({
  judgmentId: z.string().cuid(),
});

export const ClockControlSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start') }),
  z.object({ action: z.literal('pause') }),
  z.object({ action: z.literal('setRate'), rate: z.number().min(0.1).max(100) }),
  z.object({ action: z.literal('setTime'), inGameTime: z.string().regex(/^\d{1,2}:\d{2}$/), inGameDate: z.string() }),
  z.object({ action: z.literal('addTime'), deltaMinutes: z.number().int().min(-1440).max(1440) }),
]);
```

---

## 12. 反作弊 / 一致性

- **服务端掷骰**：所有判定结果由服务端生成，客户端无权修改
- **服务端时钟**：客户端不维护游戏内时间，所有时间从服务端推
- **快照**：投骰瞬间记录 `targetSnapshot`，防投骰后改属性作弊
- **限频**：聊天 / 投骰请求 5 条 / 10s
- **session JWT 校验**：realtime 服务用同一份 `SESSION_SECRET`

---

## 13. 性能

- 每秒时钟 tick 只写一次 DB（PG 在本地够用，远程可优化为 5s 一次 + 客户端插值）
- log 历史批量拉：默认 100 条，cursor 续拉
- 大量日志渲染用虚拟列表（`@tanstack/react-virtual`）
- 一场团最大连接数理论 ~50，Socket.IO 单实例承载万级无压力

---

## 14. 待校准（TODO(规则书)）

- [ ] 成功等级的 1/5、1/2、临界值是否完全准确
- [ ] 大失败是否包括「100」或「96-100」或「>= 96」
- [ ] SAN 失败后是否自动触发理智检定
- [ ] 战斗 / 对抗判定的特殊规则
- [ ] 是否支持「临时技能值」（如援助他人）