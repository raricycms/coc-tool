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
      alert('需要填写 delta 和 reason');
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
    <div className="card space-y-2">
      <h3 className="font-bold text-sm">❤️ 修改 HP</h3>
      <select className="input text-sm" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
        {characters.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.hp}/{c.hpMax})</option>)}
      </select>

      {/* 手动扣/加血 */}
      <div className="subpanel space-y-1">
        <div className="text-xs text-ink-100/60">手动</div>
        <input
          type="number"
          className="input text-sm"
          value={delta}
          onChange={(e) => setDelta(parseInt(e.target.value) || 0)}
          placeholder="变动（负数扣血）"
        />
        <input
          className="input text-sm"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="原因"
          maxLength={200}
        />
        <button className="btn-ghost text-sm w-full" onClick={submitManual}>应用</button>
      </div>

      {/* 1dN 扣血骰 */}
      <div className="subpanel space-y-1">
        <div className="text-xs text-ink-100/60">骰子扣血（1dN）</div>
        <div className="flex gap-1">
          <input
            className="input text-sm font-mono flex-1"
            value={diceExpr}
            onChange={(e) => setDiceExpr(e.target.value.trim())}
            placeholder="1d6"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {DICE_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              className="btn-ghost text-[10px] px-2 py-0.5 font-mono"
              onClick={() => setDiceExpr(p)}
            >{p}</button>
          ))}
        </div>
        <button className="btn-primary text-sm w-full" onClick={submitDice}>🎲 掷骰扣血</button>
      </div>
    </div>
  );
}
