'use client';

import { useState } from 'react';

interface Props {
  characters: Array<{
    id: string;
    name: string;
    skills: Array<{ name: string; value: number; isMythos: boolean }>;
    sanCurrent: number;
    luck: number;
  }>;
  onCreate: (payload: any) => void;
}

export function JudgmentCreator({ characters, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState(characters[0]?.id ?? '');
  const target = characters.find((c) => c.id === targetId);
  const [skillName, setSkillName] = useState('');
  const [difficulty, setDifficulty] = useState<'regular' | 'hard' | 'extreme'>('regular');
  const [bonusDice, setBonusDice] = useState(0);
  const [scMin, setScMin] = useState(1);
  const [scMax, setScMax] = useState(6);
  const [isSan, setIsSan] = useState(false);
  const [note, setNote] = useState('');

  if (characters.length === 0) return null;

  const submit = () => {
    if (!target) return;
    onCreate({
      targetCharacterId: target.id,
      type: isSan ? 'san' : 'skill',
      skillName,
      difficulty,
      bonusDice,
      scMin: isSan ? scMin : undefined,
      scMax: isSan ? scMax : undefined,
      note: note || undefined,
    });
    setOpen(false);
    setNote('');
  };

  if (!open) {
    return <button className="btn-primary text-sm" onClick={() => setOpen(true)}>+ 发布判定</button>;
  }

  return (
    <div className="card space-y-2">
      <h3 className="font-bold text-sm">发布判定</h3>
      <div>
        <label className="label text-xs">角色</label>
        <select className="input text-sm" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button className={`flex-1 text-xs py-1 rounded ${!isSan ? 'bg-brand-600' : 'bg-ink-800'}`} onClick={() => { setIsSan(false); setSkillName(target?.skills[0]?.name ?? ''); }}>技能</button>
        <button className={`flex-1 text-xs py-1 rounded ${isSan ? 'bg-brand-600' : 'bg-ink-800'}`} onClick={() => { setIsSan(true); setSkillName('SAN'); }}>SAN check</button>
      </div>
      {!isSan ? (
        <select className="input text-sm" value={skillName} onChange={(e) => setSkillName(e.target.value)}>
          {target?.skills.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.value})</option>)}
        </select>
      ) : (
        <div className="text-sm text-ink-100/60">SAN: 当前 {target?.sanCurrent}</div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label text-xs">难度</label>
          <select className="input text-sm" value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)}>
            <option value="regular">常规</option>
            <option value="hard">困难</option>
            <option value="extreme">极难</option>
          </select>
        </div>
        <div>
          <label className="label text-xs">奖励/惩罚</label>
          <select className="input text-sm" value={bonusDice} onChange={(e) => setBonusDice(parseInt(e.target.value))}>
            {[-2, -1, 0, 1, 2].map((b) => <option key={b} value={b}>{b > 0 ? `+${b}` : b}</option>)}
          </select>
        </div>
      </div>
      {isSan && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label text-xs">sc 最小</label>
            <input type="number" className="input text-sm" value={scMin} min={0} onChange={(e) => setScMin(parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className="label text-xs">sc 最大</label>
            <input type="number" className="input text-sm" value={scMax} min={0} onChange={(e) => setScMax(parseInt(e.target.value) || 0)} />
          </div>
        </div>
      )}
      <div>
        <label className="label text-xs">提示（PL 可见）</label>
        <input className="input text-sm" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </div>
      <div className="flex gap-2 justify-end">
        <button className="btn-ghost text-sm" onClick={() => setOpen(false)}>取消</button>
        <button className="btn-primary text-sm" onClick={submit} disabled={!skillName}>发布</button>
      </div>
    </div>
  );
}