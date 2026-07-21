'use client';

/**
 * 只读车卡查看弹窗：用于 KP 在招募详情页查看已通过 PL 的角色卡。
 * 与 session/CharacterDetailModal 的区别：
 *   - 剥离 KP 编辑能力（避免在招募阶段 KP 可改 PL 的武器/物品）
 *   - 顶部多展示一行「报名者 @username」便于把车卡与申请人对应
 *   - 不依赖 socket，直接 props-in 数据
 */

import { useEffect } from 'react';

export interface ReadOnlyCharacter {
  id: string;
  name: string;
  str: number; con: number; siz: number; dex: number;
  app: number; int: number; pow: number; edu: number;
  hpCurrent: number; hpMax: number;
  sanCurrent: number; sanMax: number;
  mpCurrent: number; mpMax: number;
  luckCurrent: number;
  damageBonus: string;
  era?: string | null;
  occupation?: string | null;
  background?: string | null;
  skills: Array<{ name: string; value: number; isMythos: boolean }>;
  weapons: Array<{
    id: string; name: string; skill: string; damage: string;
    range?: string | null; ammo?: number | null; note?: string | null;
  }>;
  equipment: Array<{
    id: string; name: string; quantity: number; note?: string | null;
  }>;
}

interface Props {
  character: ReadOnlyCharacter | null;
  applicantUsername?: string;
  onClose: () => void;
}

export function CharacterViewModal({ character, applicantUsername, onClose }: Props) {
  useEffect(() => {
    if (!character) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [character, onClose]);

  if (!character) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="-mx-5 -mt-5 mb-4 flex shrink-0 items-start justify-between border-b border-sky-200 px-5 py-3">
          <div>
            <h2 className="text-lg font-bold text-ink">{character.name}</h2>
            <div className="mt-0.5 text-xs text-ink-muted">
              {applicantUsername ? <>报名者 <span className="font-semibold text-ink-soft">@{applicantUsername}</span> · </> : null}
              {character.occupation ?? '无职业'} · {character.era ?? 'modern'}
            </div>
          </div>
          <button className="btn-ghost text-xs" onClick={onClose}>关闭 ✕</button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-2 text-sm">
          <DerivedStats char={character} />
          <PrimaryStats char={character} />
          <SkillsSection char={character} />
          <div className="grid gap-5 sm:grid-cols-2">
            <WeaponsSection char={character} />
            <EquipmentSection char={character} />
          </div>
          {character.background && <BackgroundSection background={character.background} />}
        </div>
      </div>
    </div>
  );
}

function DerivedStats({ char }: { char: ReadOnlyCharacter }) {
  const hpPct = char.hpMax > 0 ? Math.max(0, Math.min(100, (char.hpCurrent / char.hpMax) * 100)) : 0;
  const sanPct = char.sanMax > 0 ? Math.max(0, Math.min(100, (char.sanCurrent / char.sanMax) * 100)) : 0;
  const mpPct = char.mpMax > 0 ? Math.max(0, Math.min(100, (char.mpCurrent / char.mpMax) * 100)) : 0;
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">状态</h3>
      <div className="space-y-2">
        <Bar label="HP" value={char.hpCurrent} max={char.hpMax} pct={hpPct} color="bg-bad" />
        <Bar label="SAN" value={char.sanCurrent} max={char.sanMax} pct={sanPct} color="bg-mythos" />
        {char.mpMax > 0 && <Bar label="MP" value={char.mpCurrent} max={char.mpMax} pct={mpPct} color="bg-macaron-300" />}
        <div className="flex flex-wrap gap-4 pt-1 text-xs text-ink-soft">
          <span>LUCK <b className="text-ink">{char.luckCurrent}</b></span>
          <span>伤害加值 <b className="text-ink">{char.damageBonus}</b></span>
        </div>
      </div>
    </section>
  );
}

function PrimaryStats({ char }: { char: ReadOnlyCharacter }) {
  const cells: Array<[string, number]> = [
    ['STR', char.str], ['CON', char.con], ['SIZ', char.siz], ['DEX', char.dex], ['APP', char.app],
    ['INT', char.int], ['POW', char.pow], ['EDU', char.edu], ['LUCK', char.luckCurrent],
  ];
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">基础属性</h3>
      <div className="grid grid-cols-9 gap-1.5">
        {cells.map(([label, val]) => (
          <div key={label} className="rounded-2xl border border-sky-200 bg-sky-50 py-1.5 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
            <div className="font-mono text-sm font-bold text-ink">{val}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SkillsSection({ char }: { char: ReadOnlyCharacter }) {
  const sorted = [...char.skills].sort(
    (a, b) => (Number(b.isMythos) - Number(a.isMythos)) || (b.value - a.value),
  );
  if (sorted.length === 0) {
    return (
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">技能</h3>
        <p className="text-xs text-ink-muted">该角色暂无技能。</p>
      </section>
    );
  }
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">技能 · {sorted.length}</h3>
      <ul className="grid grid-cols-2 gap-x-4 text-xs">
        {sorted.map((s) => (
          <li key={s.name} className="flex justify-between border-b border-sky-100 py-0.5">
            <span className={s.isMythos ? 'text-mythos font-semibold' : 'text-ink'}>
              {s.name}{s.isMythos && ' ✦'}
            </span>
            <span className="font-mono text-ink-soft">{s.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WeaponsSection({ char }: { char: ReadOnlyCharacter }) {
  return (
    <section className="card">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">武器 · {char.weapons.length}</h3>
      {char.weapons.length === 0 ? (
        <p className="text-xs text-ink-muted">无。</p>
      ) : (
        <ul className="divide-y divide-sky-100">
          {char.weapons.map((w) => (
            <li key={w.id} className="py-2">
              <div className="font-semibold text-ink">{w.name}</div>
              <div className="text-xs text-ink-soft">
                {w.skill} · 伤害 {w.damage}
                {w.range && ` · 射程 ${w.range}`}
                {w.ammo != null && ` · 弹药 ${w.ammo}`}
              </div>
              {w.note && <div className="mt-0.5 text-[10px] italic text-ink-muted">{w.note}</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EquipmentSection({ char }: { char: ReadOnlyCharacter }) {
  return (
    <section className="card">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">物品 · {char.equipment.length}</h3>
      {char.equipment.length === 0 ? (
        <p className="text-xs text-ink-muted">无。</p>
      ) : (
        <ul className="divide-y divide-sky-100">
          {char.equipment.map((e) => (
            <li key={e.id} className="py-2">
              <div className="font-semibold text-ink">{e.name} <span className="text-ink-soft font-normal">× {e.quantity}</span></div>
              {e.note && <div className="text-xs text-ink-soft">{e.note}</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Bar({ label, value, max, pct, color }: {
  label: string; value: number; max: number; pct: number; color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-ink-soft">{label}</span>
        <span className="font-mono text-ink"><b>{value}</b><span className="text-ink-muted">/{max}</span></span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sky-100">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BackgroundSection({ background }: { background: string }) {
  return (
    <section className="card">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">调查员背景</h3>
      <p className="whitespace-pre-wrap text-sm text-ink">{background}</p>
    </section>
  );
}
