'use client';

import { useState } from 'react';

interface CharacterLite {
  id: string;
  name: string;
  ownerUsername?: string;
  hp: number; hpMax: number;
  san: number; sanMax: number;
  mp: number; mpMax: number;
  luck: number;
  damageBonus: string;
  str: number; con: number; siz: number; dex: number;
  app: number; int: number; pow: number; edu: number;
  skills: Array<{ name: string; value: number; isMythos: boolean }>;
}

interface Member {
  userId: string;
  username: string;
  role: 'KP' | 'PL' | 'SPECTATOR';
  online: boolean;
  character?: CharacterLite;
}

interface Props {
  members: Member[];
}

/**
 * 跑团页车卡列表：所有人（KP/PL/SPECTATOR）可见。
 *
 *  - PL：每个 PL 的当前 PC 一张卡
 *  - KP：只在 KP 自己有 PC 时显示（避免把「GM 角色」也塞进来扰乱版面）
 *  - SPECTATOR / 离开的成员：跳过
 *
 * 每张卡显示：姓名 + 玩家、九维基础属性、HP/SAN/MP/LUCK/DB，
 * 以及技能区（按 value 降序列前若干条 + 神话技能优先）。
 */
export function CharacterCardsPanel({ members }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const cards: Array<{ key: string; member: Member; char: CharacterLite }> = [];
  for (const m of members) {
    if (m.role === 'KP') continue;          // KP 不占 PL 卡位（GM 角色不显示）
    if (!m.character) continue;             // 未选角色 → 不显示
    cards.push({ key: m.userId, member: m, char: m.character });
  }
  if (cards.length === 0) {
    return (
      <section className="border-t border-ink-800 bg-ink-900/30 px-4 py-2 text-xs text-ink-100/40">
        还没有 PL 选择角色。
      </section>
    );
  }

  return (
    <section className="border-t border-ink-800 bg-ink-900/30">
      <header className="flex items-center justify-between px-4 pt-2">
        <h3 className="font-bold text-sm text-ink-100/80">📜 参与跑团的车卡（{cards.length}）</h3>
        <button
          type="button"
          className="text-xs text-ink-100/50 hover:text-ink-100"
          onClick={() => setCollapsed((v) => !v)}
        >{collapsed ? '展开 ▾' : '收起 ▴'}</button>
      </header>
      {!collapsed && (
        <div className="p-3 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map(({ key, member, char }) => (
            <CharacterCard key={key} member={member} char={char} />
          ))}
        </div>
      )}
    </section>
  );
}

function CharacterCard({ member, char }: { member: Member; char: CharacterLite }) {
  // 排前 8 条技能：神话技能优先，然后按 value 降序
  const topSkills = [...char.skills]
    .sort((a, b) => (Number(b.isMythos) - Number(a.isMythos)) || (b.value - a.value))
    .slice(0, 8);

  const hpPct = char.hpMax > 0 ? Math.max(0, Math.min(100, (char.hp / char.hpMax) * 100)) : 0;
  const sanPct = char.sanMax > 0 ? Math.max(0, Math.min(100, (char.san / char.sanMax) * 100)) : 0;
  const mpPct = char.mpMax > 0 ? Math.max(0, Math.min(100, (char.mp / char.mpMax) * 100)) : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-sm">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="font-bold text-sm">{char.name}</div>
          <div className="text-[10px] text-ink-100/40">@{member.username} · {member.role}</div>
        </div>
        <div className="text-[10px] text-ink-100/40 font-mono">DB {char.damageBonus}</div>
      </div>

      {/* 血条/理智条/魔法条 */}
      <div className="space-y-1.5 mb-2">
        <Bar label="HP" value={char.hp} max={char.hpMax} pct={hpPct} color="bg-red-500" />
        <Bar label="SAN" value={char.san} max={char.sanMax} pct={sanPct} color="bg-violet-500" />
        {char.mpMax > 0 && <Bar label="MP" value={char.mp} max={char.mpMax} pct={mpPct} color="bg-sky-500" />}
      </div>

      {/* 九维属性 + 幸运 */}
      <div className="grid grid-cols-5 gap-1 text-center text-[10px] mb-2">
        <Stat label="STR" value={char.str} />
        <Stat label="CON" value={char.con} />
        <Stat label="SIZ" value={char.siz} />
        <Stat label="DEX" value={char.dex} />
        <Stat label="APP" value={char.app} />
        <Stat label="INT" value={char.int} />
        <Stat label="POW" value={char.pow} />
        <Stat label="EDU" value={char.edu} />
        <Stat label="LUCK" value={char.luck} />
        <div />
      </div>

      {/* 技能列表 */}
      {topSkills.length > 0 && (
        <div className="border-t border-white/5 pt-1.5 mt-1.5">
          <div className="text-[10px] text-ink-100/40 mb-1">技能</div>
          <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
            {topSkills.map((s) => (
              <li key={s.name} className="flex justify-between">
                <span className={s.isMythos ? 'text-violet-300' : 'text-ink-100/80'}>
                  {s.name}{s.isMythos && ' ✦'}
                </span>
                <span className="font-mono text-ink-100/60">{s.value}</span>
              </li>
            ))}
          </ul>
          {char.skills.length > topSkills.length && (
            <div className="text-[10px] text-ink-100/30 mt-1">+{char.skills.length - topSkills.length} 项…</div>
          )}
        </div>
      )}
    </div>
  );
}

function Bar({ label, value, max, pct, color }: { label: string; value: number; max: number; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="text-ink-100/60 font-medium">{label}</span>
        <span className="font-mono text-ink-100/80"><b>{value}</b><span className="text-ink-100/40">/{max}</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-white/[0.03] border border-white/5 py-0.5">
      <div className="text-[9px] text-ink-100/40">{label}</div>
      <div className="font-mono text-ink-100">{value}</div>
    </div>
  );
}
