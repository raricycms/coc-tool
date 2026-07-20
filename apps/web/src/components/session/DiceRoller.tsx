'use client';

import { useState } from 'react';

interface Props {
  onRoll: (title: string, description: string | undefined, diceExpr: string) => void;
}

const DICE_PRESETS = ['1d10', '1d100', '2d6', '1d6+1d4', '1d20', '1d8', '3d6'];

export function DiceRoller({ onRoll }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [diceExpr, setDiceExpr] = useState('1d100');

  const submit = () => {
    if (!title.trim() || !diceExpr.trim()) return;
    onRoll(title.trim(), description.trim() || undefined, diceExpr.trim());
    setTitle('');
    setDescription('');
  };

  if (!open) {
    return <button className="btn-primary w-full text-sm" onClick={() => setOpen(true)}>🎲 公开掷骰</button>;
  }

  return (
    <section className="card space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">🎲 公开掷骰</h3>
        <button className="btn-ghost text-xs" onClick={() => setOpen(false)}>收起</button>
      </header>
      <div>
        <label className="label text-xs">标题 <span className="text-bad">*</span></label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：决定先攻顺序" maxLength={60} />
      </div>
      <div>
        <label className="label text-xs">说明（可选）</label>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例：掷高者先动" maxLength={200} />
      </div>
      <div>
        <label className="label text-xs">骰子表达式 <span className="text-bad">*</span></label>
        <input className="input font-mono" value={diceExpr} onChange={(e) => setDiceExpr(e.target.value.trim())} placeholder="1d100" />
        <div className="mt-2 flex flex-wrap gap-1">
          {DICE_PRESETS.map((p) => (
            <button key={p} type="button" className="btn-ghost px-2 py-0.5 font-mono text-[11px]" onClick={() => setDiceExpr(p)}>{p}</button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-ghost text-sm" onClick={() => setOpen(false)}>取消</button>
        <button className="btn-primary text-sm" onClick={submit} disabled={!title.trim() || !diceExpr.trim()}>掷！</button>
      </div>
    </section>
  );
}