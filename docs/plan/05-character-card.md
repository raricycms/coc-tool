# 05 · CoC 调查员车卡（Character Card）

> 一张 CoC 7e 调查员卡的完整建模、创建流程、规则计算、与跑团中的状态流转。

---

## 1. 调查员卡的字段一览

### 1.1 基础信息

| 字段 | 类型 | 必填 | 备注 |
|---|---|---|---|
| 姓名 `name` | string | ✅ | 1-30 字符 |
| 性别 `gender` | enum | ⭕ | 男 / 女 / 其他 |
| 年龄 `age` | int | ⭕ | 15-90 |
| 出生地 `birthplace` | string | ⭕ | 自由文本 |
| 住址 `residence` | string | ⭕ | 自由文本 |
| 国籍 `nationality` | string | ⭕ | 默认 "中国" |
| 职业 `occupation` | string | ⭕ | "私家侦探" / "记者" / ... |
| 时代 `era` | string | ✅ | `modern` / `1920s` / `victorian` |

### 1.2 派生基础：八大属性（PRIMARY）

| 属性 | 默认生成方式 | 范围 |
|---|---|---|
| STR 力量 | 3D6 × 5 | 15-90 |
| CON 体质 | 3D6 × 5 | 15-90 |
| SIZ 体型 | (2D6 + 6) × 5 | 25-90 |
| DEX 敏捷 | 3D6 × 5 | 15-90 |
| APP 魅力 | 3D6 × 5 | 15-90 |
| INT 智力 | (2D6 + 6) × 5 | 25-90 |
| POW 意志 | 3D6 × 5 | 15-90 |
| EDU 教育 | (2D6 + 6) × 5 × 3 *修正* | 25-90 |
| LUCK 幸运 | 3D6 × 5 | 15-90 |

> EDU 在一些版本里要额外乘 / 加修正。**TODO(规则书)**：核对 EDU 公式。

### 1.3 派生值（DERIVED）

```
HP_max  = (CON + SIZ) / 2        // 整数除，向上取整
MP_max  = POW / 5                // 向上取整
SAN_max = POW × 5
MOV     = DEX 若年龄 < 40
         DEX - 1 若 40 ≤ 年龄 < 50
         DEX - 2 若 50 ≤ 年龄 < 60
         DEX - 3 若 60 ≤ 年龄 < 70
         DEX - 4 若 70 ≤ 年龄 < 80
         DEX - 5 若 ≥ 80
         // 部分版本 STR < SIZ 时 -1
build   = STR + SIZ
DB      = 根据 build 表查 '伤害加成'
```

**伤害加成对照表（CoC 7e 占位）**：

| 体格 build | DB |
|---|---|
| 2-64 | -2 |
| 65-84 | -1 |
| 85-124 | 0 |
| 125-164 | +1d4 |
| 165-204 | +1d6 |

> **TODO(规则书)**：完整 build 表（含 +2d6 等更大加成区间）。

### 1.4 技能（Skill）

技能以 `(name, value)` 列表存储。CoC 7e 有 ~80 项技能 + 一些特殊技能：

```
侦查 / 聆听 / 潜行 / 说服 / 心理学 / 神秘学 / 图书馆使用 / 急救 /
攀爬 / 游泳 / 跳跃 / 投掷 / 驾驶 / 机械维修 / 电子学 / 锁匠 / 撬锁 /
格斗 (斗殴) / 手枪 / 步枪 / 霰弹枪 / 弓术 / 机枪 / 重武器 /
母语 / 其他语言 / 法律 / 会计 / 人类学 / 考古学 / 美术 / 工艺 ...
```

每张调查员卡技能由以下部分组成：

| 来源 | 数量（占位） |
|---|---|
| 默认技能（侦查 25、聆听 20 等） | 固定 |
| 职业技能（EDU × 4 自由分配） | **TODO(规则书)** |
| 兴趣技能（INT × 2 自由分配） | **TODO(规则书)** |
| Cthulhu Mythos | 初始 0 |

> 技能成长空间：技能值上限 99（Cthulhu Mythos 上限 100 或类似，**TODO(规则书)**）。

### 1.5 武器（Weapon）

| 字段 | 类型 | 说明 |
|---|---|---|
| name | string | 例：「柯尔特 .38」 |
| skill | string | 例：「手枪」 |
| damage | string | 例：「1d6」 / 「2d6+1d4」 |
| range | string | 例：「15m」 / 「近战」 |
| ammo | int | 当前弹药（可选） |
| note | string | 自由备注 |

### 1.6 装备（Equipment）

| 字段 | 类型 | 说明 |
|---|---|---|
| name | string | 例：「手电筒」 |
| quantity | int | 默认 1 |
| note | string | 自由备注 |

### 1.7 资产

> **v0.1** 不做独立表，用 `Equipment.note` 或 `Character.notes` 表达现金 / 资产即可。v0.2 加 `Asset` 表。

### 1.8 背景 / 备注

| 字段 | 类型 |
|---|---|
| `background` | text（调查员背景故事 / 背景包） |
| `notes` | text（玩家私有备注） |

---

## 2. 车卡创建流程（两种入口）

### 2.1 入口 A：随机生成（推荐新手）

```
Step 1 选时代背景（modern / 1920s / victorian）
Step 2 选职业（按时代筛选）
Step 3 系统按 CoC 公式投骰生成：
        - 八大属性 + 幸运
        - 默认技能
        - 职业技能（系统按职业给出可分配技能 + 推荐值）
        - 兴趣技能
Step 4 系统自动算 HP / MP / SAN / MOV / build / DB
Step 5 用户编辑：
        - 姓名 / 性别 / 年龄 / 出生地 / 住址 / 国籍
        - 职业技能与兴趣技能的自由分配
        - 武器 / 装备 / 背景故事
Step 6 保存
```

### 2.2 入口 B：手动填写（高级玩家）

```
Step 1 选时代背景与职业
Step 2 手动填写八大属性（提供「投骰」按钮辅助）
Step 3 自由编辑技能 / 武器 / 装备 / 背景
Step 4 保存
```

> v0.1 的「投骰辅助」按钮就是让前端调 `/api/coc/roll?expr=3d6*5` 算出来给前端填入。

---

## 3. CRUD 接口

| 路径 | 方法 | 行为 |
|---|---|---|
| `GET /api/characters` | GET | 列出当前用户的车卡（含 RETIRED） |
| `POST /api/characters` | POST | 创建（校验派生） |
| `GET /api/characters/:id` | GET | 详情（含 skills / weapons / equipment） |
| `PATCH /api/characters/:id` | PATCH | 部分更新（影响派生时重算） |
| `DELETE /api/characters/:id` | DELETE | **软删**：写 `isRetired` |

> 软删对应业务上的「撕卡」或「送疯人院」，而不是用户删除卡本身。普通用户没有真正删卡按钮，只能由跑团结算触发 RETIRED。

> 管理员（v0.2）有强制硬删。

---

## 4. 派生计算：纯函数实现

放在 `packages/coc-rules/`，前后端共用（Node 与浏览器同构）。

```ts
// packages/coc-rules/attributes.ts
export interface PrimaryStats {
  str: number; con: number; siz: number; dex: number;
  app: number; int: number; pow: number; edu: number;
  luck: number;
}

export interface DerivedStats {
  hpMax: number; mpMax: number; sanMax: number;
  mov: number; build: number; damageBonus: string;
}

export function derive(primary: PrimaryStats, age: number): DerivedStats {
  const hpMax  = Math.ceil((primary.con + primary.siz) / 2 / 5) * 5;
  // 注意：HP 是 (CON+SIZ)/2 向上取整，常见规则是不再 ×5；
  // 这里给的是常见 (CON+SIZ)/10 的「十位制」派生。
  // TODO(规则书)：核对 CoC 7e HP 公式（不同版本差异较大）
  const mpMax  = Math.ceil(primary.pow / 5 / 5) * 5;
  const sanMax = primary.pow * 5;
  const mov = computeMov(primary.dex, primary.str, primary.siz, age);
  const build = primary.str + primary.siz;
  const damageBonus = lookupDamageBonus(build);
  return { hpMax, mpMax, sanMax, mov, build, damageBonus };
}

function computeMov(dex: number, str: number, siz: number, age: number): number {
  let m = dex;
  if (str < siz) m -= 1;
  if (age >= 80) m -= 5;
  else if (age >= 70) m -= 4;
  else if (age >= 60) m -= 3;
  else if (age >= 50) m -= 2;
  else if (age >= 40) m -= 1;
  return Math.max(1, m);
}

function lookupDamageBonus(build: number): string {
  if (build <= 64) return '-2';
  if (build <= 84) return '-1';
  if (build <= 124) return '0';
  if (build <= 164) return '+1d4';
  return '+1d6';
}
```

> **TODO(规则书)**：CoC 7e 的 HP 公式有 `(CON+SIZ)/2`（原始值）与「十位制（除 10）」两种约定；本项目以「十位制」实现（HP=ceil((CON+SIZ)/10)），按常见做法。如规则书另有规定请改。

---

## 5. 跑团中的车卡状态

### 5.1 初始状态

创建时 `hpCurrent = hpMax`, `mpCurrent = mpMax`, `sanCurrent = sanMax`, `luckCurrent = luck`。

### 5.2 HP / SAN / MP 变化

只有 KP 可以直接修改。PL 只能通过：

- 判定结果（自动结算）
- 在「申请调整」中请求（KP 确认后才生效）
- 跑团结算时 KP 决定

所有变化都写 `LogEntry`（详见 07-running-session.md）。

### 5.3 撕卡 / 送进疯人院

> 详细流程见 `08-settlement.md`。此处是数据层面的影响：

- `Character.status = RETIRED`
- `Character.retiredReason = 'asylum' | 'dead' | 'user_request'`
- `Character.retiredAt = now()`
- 历史 `SessionMember.characterId` 仍指向它（FK 已 set null 兜底）
- 列表中显示但有「已撕卡」徽章，不可再加入新 Session

---

## 6. UI 视图

### 6.1 车卡列表 `/characters`

```
┌──────────────────────────────────────────────┐
│ 我的车卡                          [+ 新建车卡]│
├──────────────────────────────────────────────┤
│ □ 阿卡姆调查员：林远  ✓可上场                │
│   STR 60 CON 70 SIZ 50 ... SAN 50/50  HP 12/12│
│                                              │
│ □ 大学生：李明        ⚰ 已撕卡（永久疯狂）   │
│   STR 50 CON 55 ... SAN 0/55     HP 8/12     │
│                                              │
│ □ 1920s：怀特医生     ✓可上场                │
│   ...                                        │
└──────────────────────────────────────────────┘
```

### 6.2 车卡详情 `/characters/:id`

分标签：

```
[ 概览 ] [ 属性 ] [ 技能 ] [ 武器/装备 ] [ 背景 ] [ 历史 ]
```

**概览**：姓名 / 职业 / 时代 / 当前 HP/MP/SAN/Luck + 全部派生

**属性**：八大属性 + 派生计算表 + 重新投骰按钮（每次重新投会写日志）

**技能**：技能列表（可编辑 / 可加行 / 可标记 Cthulhu Mythos）

**武器/装备**：增删改

**背景**：长文本 + 公开/私有切换（公开 = 在跑团中 KP 可见）

**历史**：所有参与过的 Session 列表（只读链接）

### 6.3 车卡编辑权限

| 字段 | 谁可改 | 限制 |
|---|---|---|
| 基础信息 | PL | 任何时候 |
| 八大属性 | PL | **未参与任何 running session 时可改**，否则锁 |
| 技能（创建期） | PL | 自由编辑（创建期） |
| 技能（游戏中） | PL | 锁；只能通过成长投骰改 |
| 武器 / 装备 | PL | 任何时候可加备注 / 加装备；删武器需 KP 同意（v0.2） |
| HP / SAN / MP | KP | 仅 KP |
| 状态（撕卡） | KP | 仅 KP（结算时） |

> 锁定逻辑：当前用户是否存在于 `SessionMember` 中且对应 `Session.status in (RUNNING, PAUSED)`。

---

## 7. 校验规则（zod schema）

```ts
// packages/shared/zod-schemas/character.ts
import { z } from 'zod';

export const PrimaryStatsSchema = z.object({
  str: z.number().int().min(1).max(100),
  con: z.number().int().min(1).max(100),
  siz: z.number().int().min(1).max(100),
  dex: z.number().int().min(1).max(100),
  app: z.number().int().min(1).max(100),
  int: z.number().int().min(1).max(100),
  pow: z.number().int().min(1).max(100),
  edu: z.number().int().min(1).max(100),
  luck: z.number().int().min(1).max(100),
});

export const SkillSchema = z.object({
  name: z.string().min(1).max(40),
  value: z.number().int().min(0).max(100),
  isMythos: z.boolean().default(false),
  note: z.string().max(200).optional(),
});

export const WeaponSchema = z.object({
  name: z.string().min(1).max(40),
  skill: z.string().min(1).max(40),
  damage: z.string().max(20),
  range: z.string().max(20).optional(),
  ammo: z.number().int().min(0).max(9999).optional(),
  note: z.string().max(200).optional(),
});

export const EquipmentSchema = z.object({
  name: z.string().min(1).max(60),
  quantity: z.number().int().min(1).max(9999),
  note: z.string().max(200).optional(),
});

export const CharacterCreateSchema = z.object({
  name: z.string().min(1).max(30),
  gender: z.enum(['male', 'female', 'other']).optional(),
  age: z.number().int().min(15).max(90).optional(),
  birthplace: z.string().max(60).optional(),
  residence: z.string().max(60).optional(),
  nationality: z.string().max(40).optional(),
  occupation: z.string().max(40).optional(),
  era: z.enum(['modern', '1920s', 'victorian', 'ancient', 'future']),
  primary: PrimaryStatsSchema,
  skills: z.array(SkillSchema).max(200),
  weapons: z.array(WeaponSchema).max(50),
  equipment: z.array(EquipmentSchema).max(100),
  background: z.string().max(10_000).optional(),
  notes: z.string().max(10_000).optional(),
});
```

---

## 8. 待校准（TODO(规则书)）

- [ ] CoC 7e 完整 80+ 技能列表与默认初始值
- [ ] 职业与 EDU×4 / INT×2 技能分配规则
- [ ] 完整 build / DB 表（含 +2d6 等）
- [ ] HP / MP 公式的"位制"约定
- [ ] MOV 计算（部分版本考虑 STR < SIZ、年龄 ≥ 40 的修正）
- [ ] Cthulhu Mythos 上限（部分版本允许超过 100）