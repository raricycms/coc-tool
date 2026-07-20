'use client';

import { useState } from 'react';

interface Props {
  characters: Array<{ id: string; name: string; hp: number; hpMax: number }>;
  onChange: (characterId: string, delta: number, reason: string) => void;
  onDice: (characterId: string, diceExpr: string, reason: string) => void;
}

const DICE_PRESETS = ['1d3', '1d4', '1d6', '1d8', '1d10', '2d6', '1d6+1d4'];

export function HpChangePanel({ characters, onChange, onDice }: Props) {
  const [targetId, setTargetId] = useState(characters[0]?.id ?? '');
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');
  const [diceExpr, setDiceExpr] = useState('1d6');

  if (characters.length === 0) return null;

  const submitManual = () => {
    if (!targetId || delta === 0 || !reason.trim()) {
      alert('需要填写变动值和原因');
      return;
    }
    onChange(targetId, delta, reason.trim());
    setDelta(0);
    setReason('');
  };

  const submitDice = () => {
    if (!targetId || !diceExpr.trim() || !reason.trim()) {
      alert('需要填写骰子表达式和原因');
      return;
    }
    onDice(targetId, diceExpr.trim(), reason.trim());
    setReason('');
  };

  return (
    <section className="card space-y-4">
      <header>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">❤️ 修改 HP</h3>
      </header>

      <div>
        <label className="label">目标角色</label>
        <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          {characters.map((c) => <option key={c.id} value={c.id}>{c.name}（{c.hp}/{c.hpMax}）</option>)}
        </select>
      </div>

      <div className="subpanel space-y-3">
        <p className="text-xs font-semibold text-ink-soft">手动</p>
        <div>
          <label className="label text-xs">变动值（负数扣血）</label>
          <input type="number" className="input" value={delta} onChange={(e) => setDelta(parseInt(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label text-xs">原因</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="被飞刀划伤 / 治疗法术…" />
        </div>
        <button className="btn-ghost w-full text-sm" onClick={submitManual}>应用</button>
      </div>

      <div className="subpanel space-y-3">
        <p className="text-xs font-semibold text-ink-soft">骰子扣血</p>
        <div>
          <label className="label text-xs">骰子表达式</label>
          <input className="input font-mono" value={diceExpr} onChange={(e) => setDiceExpr(e.target.value.trim())} placeholder="1d6" />
        </div>
        <div className="flex flex-wrap gap-1">
          {DICE_PRESETS.map((p) => (
            <button key={p} type="button" className="btn-ghost px-2 py-0.5 font-mono text-[11px]" onClick={() => setDiceExpr(p)}>{p}</button>
          ))}
        </div>
        <div>
          <label className="label text-xs">原因</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
        </div>
        <button className="btn-primary w-full text-sm" onClick={submitDice}>🎲 掷骰扣血</button>
      </div>
    </section>
  );
}