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
  // 在线 = 真正连着这个 session 房间里的 socket；离线 = DB 还在成员，但人不在这里。
  const onlineCount = members.reduce((n, m) => (m.online ? n + 1 : n), 0);
  return (
    <footer className="border-t border-ink-800 px-4 py-2 flex gap-3 items-center overflow-x-auto text-xs">
      <span className="text-ink-100/40 shrink-0">
        在线 {onlineCount}/{members.length}
      </span>
      <div className="flex gap-3">
        {members.map((m) => (
          <div
            key={m.userId}
            className={`flex items-center gap-2 whitespace-nowrap ${m.online ? '' : 'opacity-50'}`}
            title={m.online ? '在线' : '离线（已离开跑团）'}
          >
            <span
              aria-hidden
              className={`inline-block w-2 h-2 rounded-full ${m.online ? 'bg-green-500' : 'bg-ink-100/30'}`}
            />
            <span className={m.role === 'KP' ? 'text-brand-500' : 'text-ink-100/80'}>
              @{m.username}
            </span>
            <span className="text-ink-100/40">[{m.role}]</span>
            {m.character && (
              <span className="text-ink-100/60">
                {m.character.name} · HP {m.character.hp}/{m.character.hpMax} · SAN {m.character.san}/{m.character.sanMax}
              </span>
            )}
          </div>
        ))}
      </div>
    </footer>
  );
}