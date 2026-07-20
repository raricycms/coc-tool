'use client';

import { useRef, useEffect } from 'react';
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

export function LogPanel({ logs, members }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [logs]);

  const findChar = (id?: string) => members.find((m) => m.character?.id === id)?.character;

  return (
    <div className="card flex-1 flex flex-col min-h-0">
      <h3 className="font-bold mb-2 text-ink-100/80">日志</h3>
      <div ref={scrollerRef} className="flex-1 overflow-y-auto space-y-1 text-xs min-h-0">
        {logs.length === 0 ? (
          <p className="text-ink-100/30 text-center py-8">暂无</p>
        ) : (
          logs.map((e) => (
            <div key={e.id} className="border-l-2 border-ink-800 pl-2">
              <div className="text-ink-100/40 text-[10px]">
                {new Date(e.realTime).toLocaleTimeString('zh-CN', { hour12: false })}
                {e.inGameTime && ` · ⏰ ${e.inGameTime}`}
              </div>
              <LogEntryRender entry={e} findChar={findChar} />
            </div>
          ))
        )}
      </div>
    </div>
  );
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
      return <div>⏰ 时钟 {p.action?.action ?? ''} → {p.inGameTime ?? ''} {p.inGameDate ?? ''}</div>;
    case 'SYSTEM':
      return <div className="text-ink-100/50">⚙ {p.event ?? JSON.stringify(p)}</div>;
    default:
      return <div className="text-ink-100/30">[{entry.type}] {JSON.stringify(p)}</div>;
  }
}

/**
 * KP 公开掷骰日志：
 *   🎲 [标题] · 1d100=42
 *      说明（可选）
 */
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
      {roller && <span className="text-ink-100/40 text-[10px] ml-1">by @{roller}</span>}
      {' · '}<span className="font-mono">{rollDetail}</span>
      {description && <div className="text-ink-100/50 italic ml-4 mt-0.5">↳ {description}</div>}
    </div>
  );
}

/**
 * 判定日志：
 *  通用：「xx 进行 STR 鉴定，1d100=30, 30/60 → 困难成功」
 *  SC  ：「xx 进行 SC，1d100=80, 80/60 失败，1d6=6, SAN 54（-6）」
 *  失败标签以最终成功等级为准；SAN 的结果同时附损失明细。
 */
function JudgmentLogLine({ entry, payload, findChar }: {
  entry: LogEntryPayload; payload: any; findChar: (id?: string) => Member['character'] | undefined;
}) {
  const char = findChar(entry.characterId);
  const charName = char?.name ?? entry.characterId ?? '?';
  const final = payload.final ?? 0;
  const target = payload.targetSnapshot?.value ?? null; // 1d100 拿来比的目标值
  const difficulty = DIFFICULTY_LABEL[payload.difficulty] ?? payload.difficulty;
  const bonus = payload.bonusDice ?? 0;
  const bonusTag = bonus === 0 ? '' : `（${bonus > 0 ? `+${bonus}` : bonus} 奖励骰）`;
  const successText = SUCCESS_LABEL[payload.successLevel] ?? payload.successLevel ?? '';

  // SAN check：单独走 SC 渲染
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
        🧠 <b>{charName}</b> 进行 <b>SC</b> 鉴定
        {' '}· <span className="font-mono">1d100={final}</span>
        {target != null && <>, <span className="font-mono">{final}/{target}</span></>}
        {' · '}<span className={passed ? 'text-green-400' : 'text-red-400'}>{passText}</span>
        {scLoss > 0 && (
          <span className="text-red-400">
            {rollDetail && ` · ${rollDetail}`}
            {sanAfter != null && ` · SAN ${sanAfter}/${payload.targetSnapshot?.sanMax ?? '?'}（-${scLoss}）`}
          </span>
        )}
      </div>
    );
  }

  // 普通 / 属性 判定
  const skillLabel = payload.skillName;
  const rollExpr = bonus === 0
    ? `1d100=${final}`
    : `1d100=${final}（含 ${bonus > 0 ? `+${bonus}` : bonus} 奖励骰）`;
  return (
    <div>
      🎯 <b>{charName}</b> 进行 <b>{skillLabel}</b> 鉴定（{difficulty}）
      {' · '}<span className="font-mono">{rollExpr}</span>
      {target != null && <>, <span className="font-mono">{final}/{target}</span></>}
      {bonusTag && <span className="text-ink-100/40">{bonusTag}</span>}
      {' → '}<b>{successText}</b>
      {payload.note && <span className="text-ink-100/40 italic"> · {payload.note}</span>}
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
    ? <span className="text-ink-100/60"> · 骰 <code className="font-mono">{payload.diceExpr}</code>=<b>{payload.diceTotal ?? '?'}</b></span>
    : null;
  return (
    <div>
      ❤️ <b>{name}</b>：HP <b>{hpAfter}/{hpMax}</b>
      <span className={delta >= 0 ? 'text-green-400' : 'text-red-400'}>（{delta > 0 ? '+' : ''}{delta}）</span>
      {diceDetail}
      {reason && <span className="text-ink-100/60"> · {reason}</span>}
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
      <span className={delta >= 0 ? 'text-green-400' : 'text-red-400'}>（{delta > 0 ? '+' : ''}{delta}）</span>
      {reason && <span className="text-ink-100/60"> · {reason}</span>}
    </div>
  );
}
