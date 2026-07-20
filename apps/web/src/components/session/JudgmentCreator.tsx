'use client';

import { useState } from 'react';
import { PRIMARY_STAT_LABELS, type PrimaryStatKey } from '@coc-tools/coc-rules';

type Tab = 'skill' | 'attribute' | 'san';
const PRIMARY_STATS = Object.entries(PRIMARY_STAT_LABELS) as Array<[PrimaryStatKey, string]>;

interface CharacterLite {
  id: string;
  name: string;
  str: number; con: number; siz: number; dex: number;
  app: number; int: number; pow: number; edu: number;
  skills: Array<{ name: string; value: number; isMythos: boolean }>;
  sanCurrent: number;
  luck: number;
}

interface Props {
  characters: CharacterLite[];
  plCharacters: CharacterLite[];
  onCreate: (payload: any) => void;
}

export function JudgmentCreator({ characters, plCharacters, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('skill');
  const [targetId, setTargetId] = useState(characters[0]?.id ?? '');
  const [broadcast, setBroadcast] = useState(false);
  const target = characters.find((c) => c.id === targetId);
  const [skillName, setSkillName] = useState('');
  const [difficulty, setDifficulty] = useState<'regular' | 'hard' | 'extreme'>('regular');
  const [bonusDice, setBonusDice] = useState(0);
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
    if (!target && !broadcast) return;
    const payload: any = {
      type: isSan ? 'san' : 'skill',
      skillName,
      difficulty,
      bonusDice,
      scSuccessExpr: isSan ? scSuccessExpr : undefined,
      scFailureExpr: isSan ? scFailureExpr : undefined,
      note: note || undefined,
    };
    if (broadcast && plCharacters.length > 0) {
      payload.targetCharacterIds = plCharacters.map((c) => c.id);
    } else {
      payload.targetCharacterId = target!.id;
    }
    onCreate(payload);
    setOpen(false);
    setNote('');
  };

  if (!open) {
    return <button className="btn-primary w-full text-sm" onClick={() => setOpen(true)}>＋ 发布判定</button>;
  }

  return (
    <section className="card space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">发布判定</h3>
        <button className="btn-ghost text-xs" onClick={() => setOpen(false)}>收起</button>
      </header>

      {plCharacters.length > 1 && (
        <label className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs text-ink-soft">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-sky-300 text-macaron-300 focus:ring-macaron-300"
            checked={broadcast}
            onChange={(e) => setBroadcast(e.target.checked)}
          />
          <span>📢 群发给所有 PL（{plCharacters.length} 个角色同时掷骰）</span>
        </label>
      )}

      <div>
        <label className="label">判定对象</label>
        <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)} disabled={broadcast}>
          {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {broadcast && (
          <p className="mt-1 text-[11px] text-ink-muted">
            将对 {plCharacters.map((c) => c.name).join('、')} 同时发布。
          </p>
        )}
      </div>

      {/* tab：每格独立单元，不再把 label/input 拆到不同列 */}
      <div className="grid grid-cols-3 gap-1.5">
        <button className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${tab === 'skill' ? 'border-macaron-300 bg-macaron-300 text-white' : 'border-sky-200 bg-white text-ink-soft hover:bg-sky-50'}`} onClick={() => switchTab('skill')}>技能</button>
        <button className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${tab === 'attribute' ? 'border-macaron-300 bg-macaron-300 text-white' : 'border-sky-200 bg-white text-ink-soft hover:bg-sky-50'}`} onClick={() => switchTab('attribute')}>属性</button>
        <button className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${tab === 'san' ? 'border-macaron-300 bg-macaron-300 text-white' : 'border-sky-200 bg-white text-ink-soft hover:bg-sky-50'}`} onClick={() => switchTab('san')}>SAN</button>
      </div>

      {tab === 'skill' && (
        <div>
          <label className="label">技能</label>
          <select className="input" value={skillName} onChange={(e) => setSkillName(e.target.value)}>
            {target?.skills.map((s) => (
              <option key={s.name} value={s.name}>{s.name}（{s.value}）</option>
            ))}
          </select>
        </div>
      )}

      {tab === 'attribute' && (
        <div>
          <label className="label">属性</label>
          <select className="input" value={skillName} onChange={(e) => setSkillName(e.target.value)}>
            {PRIMARY_STATS.map(([key, label]) => {
              const v = target ? (target as any)[key] : 0;
              return <option key={key} value={label}>{label}（{v}）</option>;
            })}
          </select>
        </div>
      )}

      {tab === 'san' && (
        <div className="rounded-2xl bg-sky-50 px-3 py-2 text-sm text-ink-soft">
          当前 SAN：<span className="font-bold text-ink">{target?.sanCurrent}</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">难度</label>
          <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)}>
            <option value="regular">常规</option>
            <option value="hard">困难</option>
            <option value="extreme">极难</option>
          </select>
        </div>
        <div>
          <label className="label">奖励 / 惩罚骰</label>
          <select className="input" value={bonusDice} onChange={(e) => setBonusDice(parseInt(e.target.value))}>
            {[-2, -1, 0, 1, 2].map((b) => <option key={b} value={b}>{b > 0 ? `+${b}` : b}</option>)}
          </select>
        </div>
      </div>

      {isSan && (
        <div className="subpanel space-y-3">
          <p className="text-xs font-semibold text-ink-soft">SAN 损失（成功 / 失败）</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label text-xs">成功时扣</label>
              <input className="input font-mono" value={scSuccessExpr} placeholder="1d3" onChange={(e) => setScSuccessExpr(e.target.value.trim())} />
            </div>
            <div>
              <label className="label text-xs">失败时扣</label>
              <input className="input font-mono" value={scFailureExpr} placeholder="1d6" onChange={(e) => setScFailureExpr(e.target.value.trim())} />
            </div>
          </div>
          <p className="text-[11px] text-ink-muted">
            支持 <code className="font-mono">1d3</code> / <code className="font-mono">2d6+1</code>，填 0 或留空表示不扣 SAN。
          </p>
        </div>
      )}

      <div>
        <label className="label">提示（PL 可见）</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="例：你推开腐朽的木门，霉味扑面而来…" />
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-ghost text-sm" onClick={() => setOpen(false)}>取消</button>
        <button className="btn-primary text-sm" onClick={submit} disabled={!skillName || (!target && !broadcast)}>
          {broadcast ? `群发 ${plCharacters.length} 人` : '发布'}
        </button>
      </div>
    </section>
  );
}