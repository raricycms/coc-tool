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
 * 跑团页车卡列表：所有人（KP/PL/SPECTATOR）可见。
 * 只显示角色名 + 玩家名；点击一行 → 弹窗展示完整数值、武器、物品。
 */
export function CharacterCardsPanel({ members, onSelectCharacter }: Props) {
  const cards: Array<{ key: string; member: Member; char: CharacterLite }> = [];
  for (const m of members) {
    if (m.role === 'KP') continue;
    if (!m.character) continue;
    cards.push({ key: m.userId, member: m, char: m.character });
  }
  if (cards.length === 0) {
    return (
      <section className="border-t border-sky-200 bg-sky-50 px-4 py-3 text-xs text-ink-muted">
        还没有 PL 选好角色。
      </section>
    );
  }

  return (
    <section className="border-t border-sky-200 bg-sky-50">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 pt-3">
        <h3 className="text-sm font-semibold text-ink-soft">📜 参与跑团的车卡 · {cards.length}</h3>
      </header>
      <ul className="mx-auto grid max-w-7xl gap-2 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {cards.map(({ key, member, char }) => {
          const hpPct = char.hpMax > 0 ? (char.hp / char.hpMax) * 100 : 0;
          const hpTone = hpPct <= 25 ? 'text-bad' : hpPct <= 50 ? 'text-warn' : 'text-ink-soft';
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onSelectCharacter(char.id)}
                className="w-full rounded-2xl border border-sky-200 bg-white px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-macaron-300 hover:shadow-paper"
              >
                <div className="truncate text-sm font-bold text-ink" title={char.name}>{char.name}</div>
                <div className="truncate text-[11px] text-ink-muted">
                  @{member.username}
                </div>
                <div className={`mt-0.5 font-mono text-[11px] ${hpTone}`}>
                  HP {char.hp}/{char.hpMax}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}