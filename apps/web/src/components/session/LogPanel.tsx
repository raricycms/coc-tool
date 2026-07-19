'use client';

import { useRef, useEffect } from 'react';
import type { LogEntryPayload } from '@coc-tools/shared';

interface Member {
  userId: string;
  username: string;
  character?: { id: string; name: string };
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
                {e.type} · {new Date(e.realTime).toLocaleTimeString('zh-CN', { hour12: false })}
                {e.inGameTime && ` · ${e.inGameTime}`}
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
      return (
        <div>
          🎯 <b>{p.skillName}</b> ({p.difficulty}, 奖励/惩罚 {p.bonusDice ?? 0}) · 骰 {p.rawRolls?.join(',')} → <b>{p.final ?? (p.tens * 10 + p.unit)}</b>
          {' → '}<span className="font-bold">{SUCCESS_LABEL[p.successLevel] ?? p.successLevel}</span>
          {p.scLoss != null && p.scLoss > 0 && (
            <span className="text-red-400"> · SAN -{(p as any).scLoss}</span>
          )}
        </div>
      );
    case 'HP_CHANGE':
      return <div>❤️ {findChar(entry.characterId)?.name ?? '?'}：HP {p.hpAfter}（{p.delta > 0 ? '+' : ''}{p.delta}）· {p.reason}</div>;
    case 'SAN_CHANGE':
      return <div>🧠 {findChar(entry.characterId)?.name ?? '?'}：SAN {p.sanAfter}（{p.delta > 0 ? '+' : ''}{p.delta}）· {p.reason}</div>;
    case 'CLOCK':
      return <div>⏰ 时钟 {p.action?.action ?? ''} → {p.inGameTime ?? ''} {p.inGameDate ?? ''}</div>;
    case 'SYSTEM':
      return <div className="text-ink-100/50">⚙ {p.event ?? JSON.stringify(p)}</div>;
    default:
      return <div className="text-ink-100/30">[{entry.type}] {JSON.stringify(p)}</div>;
  }
}