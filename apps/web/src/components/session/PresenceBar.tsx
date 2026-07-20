'use client';

interface Member {
  userId: string;
  username: string;
  avatar: string | null;
  role: 'KP' | 'PL' | 'SPECTATOR';
  online: boolean;
  character?: { id: string; name: string; hp: number; hpMax: number; san: number; sanMax: number };
}

export function PresenceBar({ members }: { members: Member[] }) {
  const onlineCount = members.reduce((n, m) => (m.online ? n + 1 : n), 0);
  return (
    <footer className="border-t border-sky-200 bg-white px-4 py-2.5">
      <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto text-xs">
        <span className="shrink-0 rounded-full bg-macaron-100 px-2.5 py-1 font-semibold text-macaron-600">
          在线 {onlineCount}/{members.length}
        </span>
        <div className="flex gap-3">
          {members.map((m) => (
            <div
              key={m.userId}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap ${m.online ? '' : 'opacity-50'}`}
              title={m.online ? '在线' : '离线'}
            >
              <span
                aria-hidden
                className={`inline-block h-2 w-2 rounded-full ${m.online ? 'bg-ok' : 'bg-ink-muted/40'}`}
              />
              <span className={m.role === 'KP' ? 'font-semibold text-macaron-600' : 'font-semibold text-ink'}>
                @{m.username}
              </span>
              <span className="text-ink-muted">· {m.role}</span>
              {m.character && (
                <span className="text-ink-soft">
                  {m.character.name} · HP {m.character.hp}/{m.character.hpMax} · SAN {m.character.san}/{m.character.sanMax}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}