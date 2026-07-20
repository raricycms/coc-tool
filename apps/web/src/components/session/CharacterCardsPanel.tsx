'use client';

interface CharacterLite {
  id: string;
  name: string;
  hp: number;
  hpMax: number;
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
  onSelectCharacter: (characterId: string) => void;
}

/**
 * 跑团页车卡列表：所有人（KP/PL/SPECTATOR）可见。只显示角色名字 + 玩家名；
 * 点击一行 → 弹窗（由父组件控制）展示完整数值、武器、物品。
 *
 *  - PL：每个 PL 的当前 PC 一行
 *  - KP：跳过（让 KP 自己手动点「我的角色」入口，未来再做）
 *  - SPECTATOR / 离开的成员：跳过
 */
export function CharacterCardsPanel({ members, onSelectCharacter }: Props) {
  const cards: Array<{ key: string; member: Member; char: CharacterLite }> = [];
  for (const m of members) {
    if (m.role === 'KP') continue;          // KP 不占 PL 卡位
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
      </header>
      <div className="p-3 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {cards.map(({ key, member, char }) => {
          const hpPct = char.hpMax > 0 ? (char.hp / char.hpMax) * 100 : 0;
          const hpTone = hpPct <= 25 ? 'text-red-400' : hpPct <= 50 ? 'text-amber-300' : 'text-ink-100/80';
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectCharacter(char.id)}
              className="group rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-brand-500/40 backdrop-blur-sm px-3 py-2.5 text-left transition"
            >
              <div className="font-bold text-sm truncate" title={char.name}>{char.name}</div>
              <div className="text-[10px] text-ink-100/40 truncate">
                @{member.username} · {member.role}
              </div>
              <div className={`text-[10px] font-mono mt-0.5 ${hpTone}`}>
                ❤️ {char.hp}/{char.hpMax}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
