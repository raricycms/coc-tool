'use client';

interface Member {
  userId: string;
  username: string;
  avatar: string | null;
  role: 'KP' | 'PL' | 'SPECTATOR';
  online: boolean;
  character?: { id: string; name: string; hp: number; hpMax: number; san: number; sanMax: number };
}

/**
 * 底栏名单。KP/PL 与旁观者是两种东西，分开显示：
 *
 * - KP/PL 是名册，掉线也留在列表里显示灰点（KP 需要知道谁掉了）。
 *   「在线 N/M」的分母只数他们，否则路人进出会让分母一直跳。
 * - 旁观者只在真的连着时才会出现在 members 里（服务端 buildPresence 已过滤），
 *   所以这里不逐个列名，只在尾部给一个人数，避免热闹的团把玩家挤出屏幕。
 */
export function PresenceBar({ members }: { members: Member[] }) {
  const roster = members.filter((m) => m.role !== 'SPECTATOR');
  const spectatorCount = members.length - roster.length;
  const onlineCount = roster.reduce((n, m) => (m.online ? n + 1 : n), 0);
  return (
    <footer className="border-t border-sky-200 bg-white px-4 py-2.5">
      <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto text-xs">
        <span className="shrink-0 rounded-full bg-macaron-100 px-2.5 py-1 font-semibold text-macaron-600">
          在线 {onlineCount}/{roster.length}
        </span>
        <div className="flex gap-3">
          {roster.map((m) => (
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
        {spectatorCount > 0 && (
          <span
            className="ml-auto shrink-0 rounded-full bg-sky-100 px-2.5 py-1 font-semibold text-ink-soft"
            title="正在观战的用户数（离开即消失）"
          >
            观战 {spectatorCount}
          </span>
        )}
      </div>
    </footer>
  );
}