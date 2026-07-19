'use client';

interface Props {
  clock: { inGameTime: string; inGameDate: string; running: boolean; rate: number };
  role: 'KP' | 'PL' | 'SPECTATOR';
  onControl: (data: any) => void;
}

export function ClockPanel({ clock, role, onControl }: Props) {
  const isKp = role === 'KP';

  return (
    <div className="card">
      <h3 className="font-bold mb-2 text-ink-100/80">⏰ 时钟</h3>
      <div className="text-center mb-3">
        <div className="text-3xl font-mono">{clock.inGameTime}</div>
        <div className="text-xs text-ink-100/40">{clock.inGameDate} · {clock.running ? `▶ ${clock.rate}x` : '⏸ 暂停'}</div>
      </div>
      {isKp && (
        <div className="space-y-2">
          <div className="flex gap-1">
            {!clock.running ? (
              <button className="btn-primary text-xs flex-1" onClick={() => onControl({ action: 'start' })}>▶ 开始</button>
            ) : (
              <button className="btn-ghost text-xs flex-1" onClick={() => onControl({ action: 'pause' })}>⏸ 暂停</button>
            )}
          </div>
          <div className="flex gap-1">
            {[0.5, 1, 2, 4, 8].map((r) => (
              <button
                key={r}
                className={`text-xs flex-1 px-1 py-1 rounded ${clock.rate === r ? 'bg-brand-600' : 'bg-ink-800'}`}
                onClick={() => onControl({ action: 'setRate', rate: r })}
              >
                {r}x
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <button className="btn-ghost text-xs flex-1" onClick={() => onControl({ action: 'addTime', deltaMinutes: 15 })}>+15m</button>
            <button className="btn-ghost text-xs flex-1" onClick={() => onControl({ action: 'addTime', deltaMinutes: 60 })}>+1h</button>
            <button className="btn-ghost text-xs flex-1" onClick={() => onControl({ action: 'addTime', deltaMinutes: -15 })}>-15m</button>
          </div>
        </div>
      )}
    </div>
  );
}