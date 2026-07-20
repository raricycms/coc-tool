'use client';

import { useState, useRef, useEffect } from 'react';
import type { LogEntryPayload } from '@coc-tools/shared';

interface Member {
  userId: string;
  username: string;
  character?: {
    id: string; name: string;
    hp: number; hpMax: number;
    san: number; sanMax: number;
  };
}

interface Props {
  logs: LogEntryPayload[];
  members: Member[];
}

const SUCCESS_LABEL: Record<string, string> = {
  critical: '🌟 大成功',
  extreme: '✨ 极难成功',
  hard: '🔥 困难成功',
  success: '✅ 成功',
  fail: '❌ 失败',
  fumble: '💀 大失败',
};

const DIFFICULTY_LABEL: Record<string, string> = {
  regular: '常规',
  hard: '困难',
  extreme: '极难',
};

/**
 * 日志面板：默认收起成一条「最近事件」摘要。
 *  - 收起：仅显示「最新一条事件摘要」，不撑高页面
 *  - 展开：可滚动的完整列表
 */
export function LogPanel({ logs, members }: Props) {
  const [open, setOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [logs, open]);

  const findChar = (id?: string) => members.find((m) => m.character?.id === id)?.character;

  const latest = logs.length > 0 ? logs[logs.length - 1] : null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="card flex w-full items-center justify-between text-left transition hover:border-macaron-300"
      >
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold uppercase tracking-wider text-ink-soft">
            事件日志 · {logs.length}
          </span>
          {latest ? (
            <div className="mt-1 truncate text-xs text-ink-muted">
              最近：<LatestSummary entry={latest} findChar={findChar} />
            </div>
          ) : (
            <div className="mt-1 text-xs text-ink-muted">暂无事件</div>
          )}
        </div>
        <span className="ml-3 shrink-0 text-xs text-ink-muted">展开 ▾</span>
      </button>
    );
  }

  return (
    <section className="card flex min-h-0 flex-1 flex-col">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">
          事件日志 · {logs.length}
        </h3>
        <button className="btn-ghost text-xs" onClick={() => setOpen(false)}>收起 ▴</button>
      </header>
      <div ref={scrollerRef} className="flex-1 space-y-1 overflow-y-auto pr-1 text-xs min-h-0">
        {logs.length === 0 ? (
          <p className="py-6 text-center text-ink-muted">暂无</p>
        ) : (
          logs.map((e) => (
            <div key={e.id} className="border-l-2 border-sky-200 pl-2.5">
              <div className="text-[10px] text-ink-muted">
                {new Date(e.realTime).toLocaleTimeString('zh-CN', { hour12: false })}
                {e.inGameTime && ` · ⏰ ${e.inGameTime}`}
              </div>
              <LogEntryRender entry={e} findChar={findChar} />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function LatestSummary({ entry, findChar }: { entry: LogEntryPayload; findChar: (id?: string) => Member['character'] | undefined }) {
  const p = entry.payload as any;
  switch (entry.type) {
    case 'JUDGMENT':
      return <>{entry.type} · {p.skillName ?? '?'}</>;
    case 'HP_CHANGE':
      return <>HP 变动 · {p.delta ?? 0}</>;
    case 'SAN_CHANGE':
      return <>SAN 变动 · {p.delta ?? 0}</>;
    case 'DICE_ROLL':
      return <>🎲 {p.title ?? '掷骰'}</>;
    case 'CLOCK':
      return <>⏰ 时钟调整</>;
    case 'SYSTEM':
      return <>系统事件</>;
    default:
      return <>{entry.type}</>;
  }
}

function LogEntryRender({ entry, findChar }: { entry: LogEntryPayload; findChar: (id?: string) => Member['character'] | undefined }) {
  const p = entry.payload as any;
  switch (entry.type) {
    case 'JUDGMENT':
      return <JudgmentLogLine entry={entry} payload={p} findChar={findChar} />;
    case 'HP_CHANGE':
      return <HpChangeLogLine entry={entry} payload={p} findChar={findChar} />;
    case 'SAN_CHANGE':
      return <SanChangeLogLine entry={entry} payload={p} findChar={findChar} />;
    case 'DICE_ROLL':
      return <DiceRollLogLine payload={p} />;
    case 'CLOCK':
      return <ClockLogLine payload={p} />;
    case 'SYSTEM':
      return <div className="text-ink-soft">⚙ {p.event ?? JSON.stringify(p)}</div>;
    default:
      return <div className="text-ink-muted">[{entry.type}] {JSON.stringify(p)}</div>;
  }
}

function DiceRollLogLine({ payload }: { payload: any }) {
  const title = payload.title ?? '掷骰';
  const expr = payload.diceExpr ?? '';
  const rolls: number[] = payload.diceRolls ?? [];
  const total = payload.diceTotal;
  const description = payload.description ?? '';
  const roller = payload.rolledByUsername ?? '';
  const rollDetail = rolls.length
    ? `${expr}=${rolls.join('+')}=${total}`
    : `${expr}=${total ?? '?'}`;
  return (
    <div>
      🎲 <b>{title}</b>
      {roller && <span className="ml-1 text-[10px] text-ink-muted">by @{roller}</span>}
      {' · '}<span className="font-mono">{rollDetail}</span>
      {description && <div className="ml-4 mt-0.5 italic text-ink-soft">↳ {description}</div>}
    </div>
  );
}

function ClockLogLine({ payload }: { payload: any }) {
  const action = payload.action ?? {};
  const verb =
    action.action === 'start' ? '开始' :
    action.action === 'pause' ? '暂停' :
    action.action === 'setRate' ? `调整倍率 ${action.rate}×` :
    action.action === 'addTime' ? `时间 ${action.deltaMinutes > 0 ? '+' : ''}${action.deltaMinutes} 分钟` :
    action.action === 'setTime' ? '设定时间' :
    '调整';
  return (
    <div>
      ⏰ <b>时钟</b> · {verb}
      <span className="ml-1 font-mono text-ink-muted">{payload.inGameTime ?? ''} {payload.inGameDate ?? ''}</span>
    </div>
  );
}

function JudgmentLogLine({ entry, payload, findChar }: {
  entry: LogEntryPayload; payload: any; findChar: (id?: string) => Member['character'] | undefined;
}) {
  const char = findChar(entry.characterId);
  const charName = char?.name ?? entry.characterId ?? '?';
  const final = payload.final ?? 0;
  const target = payload.targetSnapshot?.value ?? null;
  const difficulty = DIFFICULTY_LABEL[payload.difficulty] ?? payload.difficulty;
  const bonus = payload.bonusDice ?? 0;
  const successText = SUCCESS_LABEL[payload.successLevel] ?? payload.successLevel ?? '';

  if (payload.skillName === 'SAN') {
    const sanBefore = payload.targetSnapshot?.san ?? null;
    const sanAfter = sanBefore != null && payload.scLoss != null ? Math.max(0, sanBefore - payload.scLoss) : null;
    const passed = payload.sanPassed;
    const passText = passed ? '成功' : '失败';
    const lossExpr = payload.sanLossExpr ?? '';
    const lossRolls: number[] = payload.sanLossRolls ?? [];
    const scLoss = payload.scLoss ?? 0;
    const rollDetail = lossRolls.length
      ? `${lossExpr}=${lossRolls.join('+')}`
      : (lossExpr ? `${lossExpr}=0` : '');
    return (
      <div>
        🧠 <b>{charName}</b> 进行 <b>理智检定</b>
        {' · '}<span className="font-mono">1d100={final}</span>
        {target != null && <>, <span className="font-mono">{final}/{target}</span></>}
        {' · '}<span className={passed ? 'text-ok' : 'text-bad'}>{passText}</span>
        {scLoss > 0 && (
          <span className="text-bad">
            {rollDetail && ` · ${rollDetail}`}
            {sanAfter != null && ` · SAN ${sanAfter}/${payload.targetSnapshot?.sanMax ?? '?'}（−${scLoss}）`}
          </span>
        )}
      </div>
    );
  }

  const skillLabel = payload.skillName;
  const rollExpr = bonus === 0
    ? `1d100=${final}`
    : `1d100=${final}（含 ${bonus > 0 ? `+${bonus}` : bonus} 奖励骰）`;
  return (
    <div>
      🎯 <b>{charName}</b> 进行 <b>{skillLabel}</b>（{difficulty}）
      {' · '}<span className="font-mono">{rollExpr}</span>
      {target != null && <>, <span className="font-mono">{final}/{target}</span></>}
      {' → '}<b>{successText}</b>
      {payload.note && <span className="italic text-ink-soft"> · {payload.note}</span>}
    </div>
  );
}

function HpChangeLogLine({ entry, payload, findChar }: {
  entry: LogEntryPayload; payload: any; findChar: (id?: string) => Member['character'] | undefined;
}) {
  const char = findChar(entry.characterId);
  const name = char?.name ?? entry.characterId ?? '?';
  const hpMax = payload.hpMax ?? char?.hpMax ?? '?';
  const delta = payload.delta ?? 0;
  const hpAfter = payload.hpAfter ?? '?';
  const reason = payload.reason ?? '';
  const diceDetail = payload.diceExpr
    ? <span className="text-ink-soft"> · 骰 <code className="font-mono">{payload.diceExpr}</code>=<b>{payload.diceTotal ?? '?'}</b></span>
    : null;
  return (
    <div>
      ❤️ <b>{name}</b>：HP <b>{hpAfter}/{hpMax}</b>
      <span className={delta >= 0 ? 'text-ok' : 'text-bad'}>（{delta > 0 ? '+' : ''}{delta}）</span>
      {diceDetail}
      {reason && <span className="text-ink-soft"> · {reason}</span>}
    </div>
  );
}

function SanChangeLogLine({ entry, payload, findChar }: {
  entry: LogEntryPayload; payload: any; findChar: (id?: string) => Member['character'] | undefined;
}) {
  const char = findChar(entry.characterId);
  const name = char?.name ?? entry.characterId ?? '?';
  const sanMax = payload.sanMax ?? char?.sanMax ?? '?';
  const delta = payload.delta ?? 0;
  const sanAfter = payload.sanAfter ?? '?';
  const reason = payload.reason ?? '';
  return (
    <div>
      🧠 <b>{name}</b>：SAN <b>{sanAfter}/{sanMax}</b>
      <span className={delta >= 0 ? 'text-ok' : 'text-bad'}>（{delta > 0 ? '+' : ''}{delta}）</span>
      {reason && <span className="text-ink-soft"> · {reason}</span>}
    </div>
  );
}