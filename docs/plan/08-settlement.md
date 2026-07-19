# 08 · 跑团结算（Settlement）

> KP 在跑团结束后进入结算模式：决定每位 PL 的 SAN 恢复、克苏鲁知识增加、撕卡 / 疯人院；PL 自己掷骰决定技能成长。

---

## 1. 触发与流程

### 1.1 触发

```
KP 在跑团大厅右上角点 [结束本场 → 结算]
   → Session.status = SETTLING
   → 进入 /sessions/:id/settlement 视图
   → 跑团大厅聊天区关闭（仍可见历史，但不可发新消息）
```

### 1.2 流程

```
Step 1: SAN 恢复
        KP 录入每位 PL 的 SAN 恢复值（可正 / 负 / 0）
        - 通用规则：**TODO(规则书)** 不同剧本阶段的 SAN 恢复表
        - 实际是「KP 自由决定 + UI 给推荐值」

Step 2: 克苏鲁知识增加
        KP 给每位 PL 的 Cthulhu Mythos 技能加分
        - 单次上限由 KP 自定
        - 会自动扣减 SAN（每个 Mythos 点通常扣 1 SAN，**TODO(规则书)**）

Step 3: 撕卡 / 送疯人院
        KP 标记哪些角色需要「撕卡」
        原因：死亡 / 永久疯狂（疯人院）/ 玩家主动退出
        → 软删（Character.status = RETIRED）

Step 4: 技能成长投骰
        每位 PL 自选要投成长骰的技能（同一技能最多 1 次 / 团）
        PL 投骰决定是否成功
        - 技能值 ≤ 50%: 通过概率大
        - 技能值 > 50%: 越来越难
        - 阈值：技能值 ≥ 95 自动失败（部分版本）**TODO(规则书)**

Step 5: 完结
        KP 点 [完结]
        Session.status = FINISHED
        所有 SessionMember.leftAt = now
        写最终 LogEntry(type=SYSTEM, payload={ event: 'session_finished' })
```

每一步可保存草稿，未完成的步骤可以下次继续（断网 / 中途退出都可恢复）。

---

## 2. Settlement 数据模型

```ts
// Settlement 表字段（详细见 03-database-schema.md）
interface SettlementData {
  step: 'SAN_RECOVERY' | 'KNOWLEDGE_GAIN' | 'RETIREMENT' | 'SKILL_GROWTH' | 'DONE';

  sanRecoveries: Array<{
    characterId: string;
    amount: number;          // 可正可负
  }>;

  knowledgeGains: Array<{
    characterId: string;
    amount: number;
    mythos: number;          // 提升后的 Mythos 值
    sanCost: number;         // 因 Mythos 增加导致的 SAN 损失（自动计算）
  }>;

  retirements: Array<{
    characterId: string;
    reason: 'dead' | 'asylum' | 'user_request';
    note?: string;
  }>;

  skillGrowths: Array<{
    characterId: string;
    skillName: string;
    currentValue: number;
    diceRoll: number;        // 1-100
    succeeded: boolean;
  }>;
}
```

---

## 3. SAN 恢复

### 3.1 UI

```
┌─ Step 1: SAN 恢复 ─────────────────────────────────┐
│                                                    │
│ 林远 (Alice)        建议：+1d6    [+] [-] [当前 50]│
│ 李明 (Bob)          建议：+1d3    [+] [-] [当前 35]│
│                                                    │
│ [下一步：克苏鲁知识]                                │
└────────────────────────────────────────────────────┘
```

### 3.2 规则（占位）

> **TODO(规则书)**：SAN 恢复规则表（不同剧本 / 不同遭遇，恢复值不同）。

v0.1 实现：

- KP 可在文本框直接填整数
- 或点 [投骰恢复] 按钮：服务端掷 `XdY`，结果填入
- 范围 [-99, +99]

### 3.3 应用

```
POST /api/sessions/:id/settlement/san-recovery
body: { sanRecoveries: [{ characterId, amount }] }

事务：
1. 更新 Character.sanCurrent = min(sanMax, sanCurrent + amount)
2. 写 LogEntry(type=SAN_CHANGE, payload={delta, reason: '结算: SAN恢复'})
3. 更新 Settlement.sanRecoveries + step
```

---

## 4. 克苏鲁知识增加

### 4.1 UI

```
┌─ Step 2: 克苏鲁知识 ──────────────────────────────┐
│                                                    │
│ 林远: 当前 Mythos 5                                │
│   [+1 神话知识]  -1 SAN 自动扣除                  │
│   [+2 神话知识]  -2 SAN 自动扣除                  │
│   [自定义: __]                                     │
│                                                    │
│ 李明: 当前 Mythos 0                                │
│   [+1 神话知识]  -1 SAN 自动扣除                  │
│                                                    │
│ [下一步：撕卡 / 疯人院]                            │
└────────────────────────────────────────────────────┘
```

### 4.2 规则（占位）

> **TODO(规则书)**：Mythos 增加对应的 SAN 损失公式。常见规则：每 +1 Mythos，扣 1 SAN（即新获得神话知识让人发疯）。

### 4.3 应用

```
POST /api/sessions/:id/settlement/knowledge
body: { knowledgeGains: [{ characterId, amount }] }

事务：
1. 更新 Skill(name='Cthulhu Mythos').value += amount
2. Character.sanCurrent -= amount  （神话知识 SAN 损失）
3. 写两条 LogEntry：SKILL_CHANGE + SAN_CHANGE
4. 更新 Settlement.knowledgeGains + step
```

---

## 5. 撕卡 / 疯人院

### 5.1 UI

```
┌─ Step 3: 撕卡 / 疯人院 ───────────────────────────┐
│                                                    │
│ □ 林远      [ 标记撕卡 ]  原因: [ 死亡 / 疯人院 ]  │
│ ☑ 李明      [ 已撕卡 ] 原因: 永久疯狂              │
│ □ 王医生    [ 标记撕卡 ]  原因: [ 死亡 / 疯人院 ]  │
│                                                    │
│ [下一步：技能成长]                                 │
└────────────────────────────────────────────────────┘
```

### 5.2 应用

```
POST /api/sessions/:id/settlement/retirements
body: { retirements: [{ characterId, reason, note? }] }

事务：
1. Character.status = RETIRED
2. Character.retiredReason = reason
3. Character.retiredAt = now
4. 写 LogEntry(type=SYSTEM, payload={event: 'character_retired', reason})
5. 更新 Settlement.retirements + step
```

撕卡后：
- 车卡列表仍显示，但有「撕卡」徽章
- 不可再加入新 Session
- 历史数据保留

---

## 6. 技能成长投骰（PL 操作）

### 6.1 规则（占位）

> **TODO(规则书)**：CoC 7e 技能成长规则：
> - 投 1d100
> - 大于当前技能值 → 失败
> - 小于等于 → 成功 +1d10（即技能值 +1d10 个百分点）
> - 部分版本：技能值 ≥ 95 自动失败；技能值 < 50% 时通过概率更大

### 6.2 UI

PL 视角：

```
┌─ 我的技能成长 ──────────────────────────────────┐
│                                                  │
│ 选择要尝试成长的技能（最多 N 个，TODO(规则书)）:  │
│                                                  │
│ □ 侦查 (当前 50)                                 │
│ ☑ 聆听 (当前 40)                                 │
│ □ 潜行 (当前 35)                                 │
│ □ 神秘学 (当前 30)                               │
│                                                  │
│              [ 投 骰 子 ]                         │
└──────────────────────────────────────────────────┘

→ 服务端掷 1d100
→ 每个技能比较：
   - 若 dice ≤ 当前值 → 成功（+1d10）
   - 若 dice > 当前值 → 失败
→ 写 LogEntry(type=SKILL_CHANGE)
```

KP 视角（汇总）：

```
┌─ 技能成长汇总 ──────────────────────────────────┐
│                                                  │
│ 林远 (Alice):                                    │
│   ✓ 侦查 50 → 56  (骰 32 ≤ 50, +1d6)            │
│   ✗ 聆听 40 → 40  (骰 67 > 40)                  │
│                                                  │
│ 李明 (Bob):                                      │
│   ✗ 神秘学 30 → 30  (骰 88 > 30)                 │
│                                                  │
│ [继续：完结本场]                                │
└──────────────────────────────────────────────────┘
```

### 6.3 应用

```
POST /api/sessions/:id/settlement/skill-growth
body: { growths: [{ characterId, skillName }] }

服务端：
1. 对每个 growth 取当前技能值
2. 掷 1d100
3. 若 dice <= currentValue → succeeded=true → skill.value += 1d10
4. 写 LogEntry(SKILL_CHANGE)
5. 更新 Settlement.skillGrowths
```

> **关键设计**：技能成长投骰由**服务端掷**（和判定一致），PL 端只发「我要投」的意图。

---

## 7. 完结

```
POST /api/sessions/:id/settlement/complete

事务：
1. Session.status = FINISHED
2. Session.finishedAt = now
3. Settlement.completedAt = now
4. Settlement.step = DONE
5. 所有 SessionMember.leftAt = now（自动）
6. 写 LogEntry(SYSTEM, 'session_finished')

返回 { ok: true }
```

完结后 Session 进入只读状态，PL 仍可访问 `/sessions/:id` 查看历史日志。

---

## 8. 跑团快照（v0.2 预留）

v0.2 考虑在完结时为每名 PC 创建一个 `SessionSnapshot` 表，记录当时的 HP/SAN/MP/技能值，便于后期回顾。

v0.1 通过现有 LogEntry 已经能反推，暂不实现。

---

## 9. 待校准（TODO(规则书)）

- [ ] 不同剧本阶段对应的 SAN 恢复表
- [ ] Mythos 增加对应 SAN 损失公式
- [ ] 技能成长成功概率与成长量（+1d10 还是 +1d6 还是固定 +1）
- [ ] 每次跑团允许成长投骰的数量上限
- [ ] 临时疯狂 vs 长期疯狂的判定流程（v0.1 用 LogEntry 简单表达）