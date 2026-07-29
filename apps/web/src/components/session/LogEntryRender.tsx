/**
 * 把一条 LogEntryPayload 渲染成画外聊天里的事件行。
 * 事件日志与 OOC 消息共用同一时间轴展示，所以行样式与 OOC 一致（左侧色条 + 时间戳 + 内容）。
 */

import type { LogEntryPayload } from '@coc-tools/shared';

export interface LogCharInfo {
  id: string; name: string;
  hp: number; hpMax: number;
  san: number; sanMax: number;
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

export function LogEntryRender({
  entry,
  findChar,
}: {
  entry: LogEntryPayload;
  findChar: (id?: string) => LogCharInfo | undefined;
}) {
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
  // 多颗骰时把个体值以「（3+4+2）」追加在合计后，方便看明细；单颗直接 expr=total。
  const rollDetail = rolls.length
    ? `${expr}=${total ?? '?'}（${rolls.join('+')}）`
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
  entry: LogEntryPayload; payload: any; findChar: (id?: string) => LogCharInfo | undefined;
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
  entry: LogEntryPayload; payload: any; findChar: (id?: string) => LogCharInfo | undefined;
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
  entry: LogEntryPayload; payload: any; findChar: (id?: string) => LogCharInfo | undefined;
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