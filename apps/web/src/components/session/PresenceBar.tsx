'use client';

interface Member {
  userId: string;
  username: string;
  avatar: string | null;
  role: 'KP' | 'PL' | 'SPECTATOR';
  character?: { id: string; name: string; hp: number; hpMax: number; san: number; sanMax: number };
}

export function PresenceBar({ members }: { members: Member[] }) {
  return (
    <footer className="border-t border-ink-800 px-4 py-2 flex gap-3 overflow-x-auto text-xs">
      {members.map((m) => (
        <div key={m.userId} className="flex items-center gap-2 whitespace-nowrap">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className={m.role === 'KP' ? 'text-brand-500' : ''}>@{m.username}</span>
          <span className="text-ink-100/40">[{m.role}]</span>
          {m.character && (
            <span className="text-ink-100/60">
              {m.character.name} · HP {m.character.hp}/{m.character.hpMax} · SAN {m.character.san}/{m.character.sanMax}
            </span>
          )}
        </div>
      ))}
    </footer>
  );
}