'use client';

import { useState } from 'react';
import { PRIMARY_STAT_LABELS, type PrimaryStatKey } from '@coc-tools/coc-rules';

type Tab = 'skill' | 'attribute' | 'san';
const PRIMARY_STATS = Object.entries(PRIMARY_STAT_LABELS) as Array<[PrimaryStatKey, string]>;

interface Props {
  characters: Array<{
    id: string;
    name: string;
    str: number; con: number; siz: number; dex: number;
    app: number; int: number; pow: number; edu: number;
    skills: Array<{ name: string; value: number; isMythos: boolean }>;
    sanCurrent: number;
    luck: number;
  }>;
  onCreate: (payload: any) => void;
}

export function JudgmentCreator({ characters, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('skill');
  const [targetId, setTargetId] = useState(characters[0]?.id ?? '');
  const target = characters.find((c) => c.id === targetId);
  const [skillName, setSkillName] = useState('');
  const [difficulty, setDifficulty] = useState<'regular' | 'hard' | 'extreme'>('regular');
  const [bonusDice, setBonusDice] = useState(0);
  // SAN check 新字段：成功/失败的损失骰表达式（默认 1d3 / 1d6）
  const [scSuccessExpr, setScSuccessExpr] = useState('1d3');
  const [scFailureExpr, setScFailureExpr] = useState('1d6');
  const [note, setNote] = useState('');

  if (characters.length === 0) return null;

  const isSan = tab === 'san';
  const isAttr = tab === 'attribute';

  const switchTab = (next: Tab) => {
    setTab(next);
    if (next === 'san') setSkillName('SAN');
    else if (next === 'attribute') setSkillName(PRIMARY_STATS[0][1]);
    else setSkillName(target?.skills[0]?.name ?? '');
  };

  const submit = () => {
    if (!target) return;
    onCreate({
      targetCharacterId: target.id,
      type: isSan ? 'san' : 'skill',
      skillName,
      difficulty,
      bonusDice,
      // 仅 SAN 时带表达式字段；其他判定不带
      scSuccessExpr: isSan ? scSuccessExpr : undefined,
      scFailureExpr: isSan ? scFailureExpr : undefined,
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
        <button
          className={`flex-1 text-xs py-1 rounded ${tab === 'skill' ? 'bg-brand-600' : 'bg-ink-800'}`}
          onClick={() => switchTab('skill')}
        >技能</button>
        <button
          className={`flex-1 text-xs py-1 rounded ${tab === 'attribute' ? 'bg-brand-600' : 'bg-ink-800'}`}
          onClick={() => switchTab('attribute')}
        >属性</button>
        <button
          className={`flex-1 text-xs py-1 rounded ${tab === 'san' ? 'bg-brand-600' : 'bg-ink-800'}`}
          onClick={() => switchTab('san')}
        >SAN check</button>
      </div>

      {tab === 'skill' && (
        <select className="input text-sm" value={skillName} onChange={(e) => setSkillName(e.target.value)}>
          {target?.skills.map((s) => (
            <option key={s.name} value={s.name}>{s.name} ({s.value})</option>
          ))}
        </select>
      )}

      {tab === 'attribute' && (
        <select className="input text-sm" value={skillName} onChange={(e) => setSkillName(e.target.value)}>
          {PRIMARY_STATS.map(([key, label]) => {
            const v = target ? (target as any)[key] : 0;
            return <option key={key} value={label}>{label} ({v})</option>;
          })}
        </select>
      )}

      {tab === 'san' && (
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
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">成功时扣</label>
              <input
                type="text"
                className="input text-sm font-mono"
                value={scSuccessExpr}
                placeholder="1d3"
                onChange={(e) => setScSuccessExpr(e.target.value.trim())}
              />
            </div>
            <div>
              <label className="label text-xs">失败时扣</label>
              <input
                type="text"
                className="input text-sm font-mono"
                value={scFailureExpr}
                placeholder="1d6"
                onChange={(e) => setScFailureExpr(e.target.value.trim())}
              />
            </div>
          </div>
          <p className="text-[10px] text-ink-100/40">
            成功扣 &quot;{scSuccessExpr}&quot;、失败扣 &quot;{scFailureExpr}&quot;。支持 <code>1d3</code> / <code>2d6+1</code> / <code>1d4+1d3</code>，留 <code>0</code> 表示不扣。留空则该项不扣 SAN。
          </p>
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