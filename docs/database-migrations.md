# 数据库迁移教程

> 本文档记录 Coc-tools 数据库（Prisma）非破坏式 / 破坏式迁移的操作步骤。
> 每加一个新字段、新表、新索引都应当在此添加一段。

---

## 2026-07-20 · `add_judgment_sc_dice_expr`

### 背景

SAN check 之前用 `Judgment.scMin` / `Judgment.scMax`（整数范围）按 successLevel 选损失；
但 KP 实际想要的是「成功扣多少 / 失败扣多少」的两条**骰子表达式**（例如 `1d3` / `1d6`）。
本次新增字段：

| 字段                | 类型      | 默认 | 用途                                          |
| ------------------- | --------- | ---- | --------------------------------------------- |
| `scSuccessExpr`     | `String?` | NULL | SAN check 成功时的损失骰表达式（如 `"1d3"`）   |
| `scFailureExpr`     | `String?` | NULL | SAN check 失败时的损失骰表达式（如 `"1d6"`）   |
| `sanPassed`         | `Bool?`   | NULL | 投骰后写入：1d100 是否 ≤ 当前 SAN（非 fumble）  |
| `sanLossExpr`       | `String?` | NULL | 投骰后写入：实际使用的骰子表达式原文           |
| `sanLossRolls`      | `String?` | NULL | 投骰后写入：实际投出的骰子值 JSON 数组         |

旧字段 `scMin` / `scMax` 保留但不再写入，仅供历史数据查询。

### 步骤

#### 1. 改 `packages/db/prisma/schema.prisma`

参见 commit `feat(sancheck): 改写为双骰表达式`：在 `Judgment` 模型里加上述 5 个字段，并保留
`scMin` / `scMax` 标 `@deprecated`。

#### 2. 生成迁移

仓库默认 dev DB 是 SQLite，prod 是 Postgres。两边命令一致：

```bash
# 仓库根目录
pnpm prisma migrate dev --name add_judgment_sc_dice_expr
```

> 这一步会自动：
> - 生成 `packages/db/prisma/migrations/<timestamp>_add_judgment_sc_dice_expr/migration.sql`
> - 把它打到本地 dev DB
> - 调 `prisma generate` 重生 client

如果你的 dev DB 是 Postgres（`DATABASE_URL` 指向 postgres://），同样命令即可——Prisma
会根据当前数据源生成正确的 SQL。

#### 3. 手动同步到 prod / 远端

在 prod / 远端 DB 上手动跑生成的 SQL：

```bash
# 看一下生成的 SQL
cat packages/db/prisma/migrations/<timestamp>_add_judgment_sc_dice_expr/migration.sql

# 然后 psql 进去（或用其他客户端）执行
psql "$DATABASE_URL" < packages/db/prisma/migrations/<timestamp>_add_judgment_sc_dice_expr/migration.sql
```

或者用 Prisma 直接跑（**注意：在 prod 上不会自动确认，需要 `--create-only` 之后再人工确认**）：

```bash
pnpm prisma migrate deploy
```

#### 4. 重生 client

如果第 2 步已经自动跑了，这步可跳过；否则：

```bash
pnpm prisma generate
```

#### 5. 验证

```sql
-- Postgres
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'Judgment'
ORDER BY ordinal_position;

-- SQLite
PRAGMA table_info(Judgment);
```

期望看到 `scSuccessExpr` / `scFailureExpr` / `sanPassed` / `sanLossExpr` / `sanLossRolls` 五列。

#### 6. 回滚

回滚 `migration.sql` 反向 SQL（Postgres）：

```sql
ALTER TABLE "Judgment"
  DROP COLUMN IF EXISTS "sanLossRolls",
  DROP COLUMN IF EXISTS "sanLossExpr",
  DROP COLUMN IF EXISTS "sanPassed",
  DROP COLUMN IF EXISTS "scFailureExpr",
  DROP COLUMN IF EXISTS "scSuccessExpr";
```

或直接 `pnpm prisma migrate rollback`（仅 dev SQLite 自动支持；prod 需手工 SQL）。

### 应用代码同步

- `apps/realtime/src/handlers.ts`：SAN check 改用 `calculateSanLossFromExpr`；写入新字段；
  老 `scMin/scMax` 不再写入
- `apps/web/src/components/session/JudgmentCreator.tsx`：UI 改成两个表达式输入框，默认 `1d3` / `1d6`
- `packages/coc-rules/src/judgment.ts`：保留 `calculateSanLoss` 标 `@deprecated`；新增
  `calculateSanLossFromExpr`

### 兼容性

- 旧版 SAN check（仅 scMin/scMax）的判定记录仍可读，但不再有"loss 范围"语义
- 新 UI 默认填 `1d3` / `1d6`，KP 看到的发布表与旧版差异明显