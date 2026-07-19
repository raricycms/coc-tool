'use client';

import { useState } from 'react';

interface Props {
  characters: Array<{ id: string; name: string; hp: number; hpMax: number }>;
  onChange: (characterId: string, delta: number, reason: string) => void;
}

export function HpChangePanel({ characters, onChange }: Props) {
  const [targetId, setTargetId] = useState(characters[0]?.id ?? '');
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');

  if (characters.length === 0) return null;

  const submit = () => {
    if (!targetId || delta === 0 || !reason.trim()) {
      alert('需要填写 delta 和 reason');
      return;
    }
    onChange(targetId, delta, reason.trim());
    setDelta(0);
    setReason('');
  };

  return (
    <div className="card space-y-2">
      <h3 className="font-bold text-sm">❤️ 修改 HP</h3>
      <select className="input text-sm" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
        {characters.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.hp}/{c.hpMax})</option>)}
      </select>
      <input type="number" className="input text-sm" value={delta} onChange={(e) => setDelta(parseInt(e.target.value) || 0)} placeholder="变动（负数扣血）" />
      <input className="input text-sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="原因" maxLength={200} />
      <button className="btn-primary text-sm w-full" onClick={submit}>应用</button>
    </div>
  );
}