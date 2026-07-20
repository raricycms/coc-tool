'use client';

import { useState } from 'react';

interface Props {
  characters: Array<{ id: string; name: string; hp: number; hpMax: number }>;
  onChange: (characterId: string, delta: number, reason: string) => void;
  onDice: (characterId: string, diceExpr: string, reason: string) => void;
}

/**
 * HP 改动面板：
 *  - 默认收起（只露一个按钮），跟「发布判定」一致
 *  - 「变动值」一栏自动识别：
 *      · 纯整数（如 -3）→ 手动扣 / 加血
 *      · 含 d 的表达式（如 1d6、1d6+1d4）→ 走骰子扣血路径
 */
export function HpChangePanel({ characters, onChange, onDice }: Props) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState(characters[0]?.id ?? '');
  const [expr, setExpr] = useState('-1');
  const [reason, setReason] = useState('');

  if (characters.length === 0) return null;

  const submit = () => {
    if (!targetId || !expr.trim() || !reason.trim()) {
      alert('需要填写变动值和原因');
      return;
    }
    const trimmed = expr.trim();
    if (/d/i.test(trimmed)) {
      onDice(targetId, trimmed, reason.trim());
    } else {
      const delta = parseInt(trimmed, 10);
      if (!Number.isFinite(delta) || delta === 0) {
        alert('变动值必须是整数或骰子表达式（如 -3 或 1d6）');
        return;
      }
      onChange(targetId, delta, reason.trim());
    }
    setReason('');
  };

  if (!open) {
    return (
      <button className="btn-primary w-full text-sm" onClick={() => setOpen(true)}>
        ❤️ 修改 HP
      </button>
    );
  }

  const looksLikeDice = /d/i.test(expr);

  return (
    <section className="card space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">修改 HP</h3>
        <button className="btn-ghost text-xs" onClick={() => setOpen(false)}>收起</button>
      </header>

      <div>
        <label className="label">目标角色</label>
        <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          {characters.map((c) => <option key={c.id} value={c.id}>{c.name}（{c.hp}/{c.hpMax}）</option>)}
        </select>
      </div>

      <div>
        <label className="label">
          变动值
          <span className="ml-2 text-[11px] font-normal text-ink-muted">
            整数手动 / 含 d 走骰子
          </span>
        </label>
        <input
          className="input font-mono"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          placeholder="如 -3 或 1d6"
        />
        <p className="mt-1 text-[11px] text-ink-muted">
          {looksLikeDice
            ? `🎲 将对 ${expr} 掷骰，按结果扣 / 加血`
            : '✍️ 按输入整数扣 / 加血（负数扣血）'}
        </p>
      </div>

      <div>
        <label className="label">原因</label>
        <input
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="被飞刀划伤 / 治疗法术…"
          maxLength={200}
        />
      </div>

      <button className="btn-primary w-full text-sm" onClick={submit}>
        {looksLikeDice ? '🎲 掷骰并应用' : '应用'}
      </button>
    </section>
  );
}