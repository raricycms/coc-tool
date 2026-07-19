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

export function JudgmentQueue({ judgments, role, currentUserId, members, onRoll, onCancel }: Props) {
  return (
    <div className="card">
      <h3 className="font-bold mb-2 text-ink-100/80">🎯 待投骰 ({judgments.length})</h3>
      {judgments.length === 0 ? (
        <p className="text-ink-100/30 text-xs text-center py-2">暂无</p>
      ) : (
        <ul className="space-y-2">
          {judgments.map((j) => {
            const owner = members.find((m) => m.character?.id === j.characterId);
            const canRoll = role === 'KP' || owner?.userId === currentUserId;
            return (
              <li key={j.id} className="text-xs border border-ink-800 rounded p-2">
                <div><b>{j.characterName}</b> - {j.skillName}</div>
                <div className="text-ink-100/40">
                  {j.difficulty} · {j.bonusDice > 0 ? `+${j.bonusDice}` : j.bonusDice} 奖励骰
                  {j.scMin != null && j.scMax != null && ` · sc ${j.scMin}/${j.scMax}`}
                </div>
                {j.note && <div className="text-ink-100/60 mt-1 italic">{j.note}</div>}
                <div className="mt-2 flex gap-1">
                  {canRoll && (
                    <button className="btn-primary text-xs flex-1" onClick={() => onRoll(j.id)}>投骰子</button>
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
    </div>
  );
}