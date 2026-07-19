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
    <div className="card flex-1 flex flex-col min-h-0">
      <h3 className="font-bold mb-2 text-ink-100/80">画内 (IC)</h3>
      <div ref={scrollerRef} className="flex-1 overflow-y-auto space-y-2 text-sm min-h-0">
        {messages.length === 0 ? (
          <p className="text-ink-100/30 text-center py-8">还没有消息</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`border-l-2 pl-2 ${m.kind === 'desc' ? 'border-brand-500' : 'border-ink-800'}`}>
              <div className="text-xs text-ink-100/40">
                {m.kind === 'desc' ? (
                  <span className="text-brand-500">[KP 描述]</span>
                ) : (
                  <span>{m.characterName ?? m.authorUsername}</span>
                )}
                {' · '}
                {m.inGameDate} {m.inGameTime}
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          ))
        )}
      </div>
      {(canSendDesc || canSendDialogue) && (
        <div className="mt-2 flex gap-2">
          {canSendDesc && (
            <select className="input w-24" value={kind} onChange={(e) => setKind(e.target.value as any)}>
              <option value="desc">KP 描述</option>
              <option value="dialogue">{myCharacterName ?? '角色'} 发言</option>
            </select>
          )}
          {!canSendDesc && canSendDialogue && (
            <span className="text-xs text-ink-100/40 self-center">以 {myCharacterName} 发言</span>
          )}
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={kind === 'desc' ? 'KP 描述...' : '角色发言...'}
            maxLength={2000}
          />
          <button className="btn-primary" onClick={send}>发送</button>
        </div>
      )}
    </div>
  );
}