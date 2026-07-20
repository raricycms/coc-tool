'use client';

import type { JudgmentCreatedEvent } from '@coc-tools/shared';

interface Member {
  userId: string;
  username: string;
  character?: { id: string; name: string };
}

interface Props {
  judgments: JudgmentCreatedEvent[];
  role: 'KP' | 'PL' | 'SPECTATOR';
  currentUserId: string;
  members: Member[];
  onRoll: (judgmentId: string) => void;
  onCancel: (judgmentId: string) => void;
}

const DIFFICULTY_LABEL: Record<string, string> = {
  regular: '常规', hard: '困难', extreme: '极难',
};

export function JudgmentQueue({ judgments, role, currentUserId, members, onRoll, onCancel }: Props) {
  return (
    <section className="card">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">🎯 待投骰</h3>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
          {judgments.length}
        </span>
      </header>
      {judgments.length === 0 ? (
        <p className="py-3 text-center text-xs text-ink-muted">暂无</p>
      ) : (
        <ul className="space-y-2">
          {judgments.map((j) => {
            const owner = members.find((m) => m.character?.id === j.characterId);
            const canRoll = role === 'KP' || owner?.userId === currentUserId;
            return (
              <li key={j.id} className="rounded-2xl border border-sky-200 bg-sky-50 p-3">
                <div className="text-sm font-bold text-ink">{j.characterName}</div>
                <div className="mt-0.5 text-xs text-ink-soft">
                  <span className="font-semibold text-ink">{j.skillName}</span>
                  {' · '}{DIFFICULTY_LABEL[j.difficulty] ?? j.difficulty}
                  {j.bonusDice !== 0 && (
                    <> · 奖励骰 {j.bonusDice > 0 ? `+${j.bonusDice}` : j.bonusDice}</>
                  )}
                  {j.scSuccessExpr != null && j.scFailureExpr != null && (
                    <>
                      {' · 成功扣 '}
                      <code className="font-mono">{j.scSuccessExpr}</code>
                      {' / 失败扣 '}
                      <code className="font-mono">{j.scFailureExpr}</code>
                    </>
                  )}
                </div>
                {j.note && <div className="mt-1 text-xs italic text-ink-soft">{j.note}</div>}
                <div className="mt-3 flex gap-1.5">
                  {canRoll && (
                    <button className="btn-primary flex-1 text-xs" onClick={() => onRoll(j.id)}>投骰子</button>
                  )}
                  {role === 'KP' && (
                    <button className="btn-ghost text-xs" onClick={() => onCancel(j.id)}>取消</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}