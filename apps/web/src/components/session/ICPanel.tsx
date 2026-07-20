'use client';

import { useState, useRef, useEffect } from 'react';
import type { ICMessage } from '@coc-tools/shared';

interface Props {
  messages: ICMessage[];
  onSend: (kind: 'desc' | 'dialogue', content: string, characterId?: string) => void;
  role: 'KP' | 'PL' | 'SPECTATOR';
  myCharacterId?: string;
  myCharacterName?: string;
}

export function ICPanel({ messages, onSend, role, myCharacterId, myCharacterName }: Props) {
  const [input, setInput] = useState('');
  const [kind, setKind] = useState<'desc' | 'dialogue'>(role === 'KP' ? 'desc' : 'dialogue');
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    const characterId = kind === 'dialogue' ? myCharacterId : undefined;
    onSend(kind, input.trim(), characterId);
    setInput('');
  };

  const canSendDesc = role === 'KP';
  const canSendDialogue = (role === 'KP') || (role === 'PL' && !!myCharacterId);

  return (
    <div className="card flex min-h-0 flex-1 flex-col">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">画内 · IC</h3>
        <span className="text-[11px] text-ink-muted">{messages.length} 条</span>
      </header>
      <div ref={scrollerRef} className="flex-1 space-y-2 overflow-y-auto text-sm min-h-0">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-ink-muted">还没有消息</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`border-l-2 pl-2.5 ${m.kind === 'desc' ? 'border-macaron-300' : 'border-sky-200'}`}
            >
              <div className="text-[11px] text-ink-soft">
                {m.kind === 'desc' ? (
                  <span className="font-semibold text-macaron-600">[主持人描述]</span>
                ) : (
                  <span className="font-semibold text-ink">{m.characterName ?? m.authorUsername}</span>
                )}
                {' · '}
                {m.inGameDate} {m.inGameTime}
              </div>
              <div className="whitespace-pre-wrap text-ink">{m.content}</div>
            </div>
          ))
        )}
      </div>
      {(canSendDesc || canSendDialogue) && (
        <div className="mt-3 flex gap-2">
          {canSendDesc && (
            <select className="input w-32 shrink-0" value={kind} onChange={(e) => setKind(e.target.value as any)}>
              <option value="desc">主持人描述</option>
              <option value="dialogue">{myCharacterName ?? '角色'} 发言</option>
            </select>
          )}
          {!canSendDesc && canSendDialogue && (
            <span className="self-center text-xs text-ink-soft">以 {myCharacterName} 发言</span>
          )}
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={kind === 'desc' ? '描述场景、气氛、NPC 反应…' : '角色在说什么？'}
            maxLength={2000}
          />
          <button className="btn-primary" onClick={send}>发送</button>
        </div>
      )}
    </div>
  );
}