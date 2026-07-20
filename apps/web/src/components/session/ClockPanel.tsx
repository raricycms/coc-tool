'use client';

interface Props {
  clock: { inGameTime: string; inGameDate: string; running: boolean; rate: number };
  role: 'KP' | 'PL' | 'SPECTATOR';
  onControl: (data: any) => void;
}

const MIN_RATE = 0.1;
const MAX_RATE = 100;
const round = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number) => Math.max(MIN_RATE, Math.min(MAX_RATE, n));

export function ClockPanel({ clock, role, onControl }: Props) {
  const isKp = role === 'KP';

  const setRateSafe = (r: number) => {
    if (!Number.isFinite(r)) return;
    onControl({ action: 'setRate', rate: clamp(round(r)) });
  };

  return (
    <section className="card">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">⏰ 游戏内时钟</h3>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${clock.running ? 'bg-ok/15 text-ok' : 'bg-sky-100 text-ink-soft'}`}>
          {clock.running ? `▶ ${clock.rate}× 加速` : '⏸ 暂停'}
        </span>
      </header>
      <div className="text-center">
        <div className="font-mono text-3xl font-bold text-ink">{clock.inGameTime}</div>
        <div className="mt-1 text-xs text-ink-muted">{clock.inGameDate}</div>
      </div>
      {isKp && (
        <div className="mt-4 space-y-3">
          <button
            className={clock.running ? 'btn-ghost w-full text-sm' : 'btn-primary w-full text-sm'}
            onClick={() => onControl({ action: clock.running ? 'pause' : 'start' })}
          >
            {clock.running ? '⏸ 暂停' : '▶ 开始'}
          </button>

          {/* 倍率：每个控件自带 label 和输入框，不再让 label 与控件错位 */}
          <div>
            <label className="label text-xs flex items-center justify-between">
              <span>时间倍率</span>
              <span className="text-[10px] text-ink-muted">{MIN_RATE}–{MAX_RATE}×</span>
            </label>
            <div className="flex items-center gap-1.5">
              <button className="btn-ghost px-3 text-xs" onClick={() => setRateSafe(clock.rate - 1)} title="倍率 -1">−1</button>
              <button className="btn-ghost px-3 text-xs" onClick={() => setRateSafe(clock.rate - 0.1)} title="倍率 -0.1">−0.1</button>
              <input
                type="number"
                className="input text-center font-mono"
                min={MIN_RATE}
                max={MAX_RATE}
                step={0.1}
                value={clock.rate}
                onChange={(e) => setRateSafe(parseFloat(e.target.value))}
              />
              <button className="btn-ghost px-3 text-xs" onClick={() => setRateSafe(clock.rate + 0.1)} title="倍率 +0.1">+0.1</button>
              <button className="btn-ghost px-3 text-xs" onClick={() => setRateSafe(clock.rate + 1)} title="倍率 +1">+1</button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <button className="btn-ghost text-xs" onClick={() => onControl({ action: 'addTime', deltaMinutes: 15 })}>+15 分钟</button>
            <button className="btn-ghost text-xs" onClick={() => onControl({ action: 'addTime', deltaMinutes: 60 })}>+1 小时</button>
            <button className="btn-ghost text-xs" onClick={() => onControl({ action: 'addTime', deltaMinutes: -15 })}>−15 分钟</button>
          </div>
        </div>
      )}
    </section>
  );
}