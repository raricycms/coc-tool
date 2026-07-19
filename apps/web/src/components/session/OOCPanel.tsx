'use client';

import { useState, useRef, useEffect } from 'react';
import type { OOCMessage } from '@coc-tools/shared';

interface Props {
  messages: OOCMessage[];
  onSend: (content: string) => void;
  canSend: boolean;
  currentUsername: string;
}

export function OOCPanel({ messages, onSend, canSend, currentUsername }: Props) {
  const [input, setInput] = useState('');
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="card flex-1 flex flex-col min-h-0">
      <h3 className="font-bold mb-2 text-ink-100/80">画外 (OOC)</h3>
      <div ref={scrollerRef} className="flex-1 overflow-y-auto space-y-2 text-sm min-h-0">
        {messages.length === 0 ? (
          <p className="text-ink-100/30 text-center py-8">还没有消息</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="border-l-2 border-ink-800 pl-2">
              <div className="text-xs text-ink-100/40">
                <span className={m.authorUsername === currentUsername ? 'text-brand-500' : ''}>
                  @{m.authorUsername}
                </span>
                {' · '}
                {new Date(m.realTime).toLocaleTimeString('zh-CN', { hour12: false })}
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          ))
        )}
      </div>
      {canSend && (
        <div className="mt-2 flex gap-2">
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="画外消息..."
            maxLength={2000}
          />
          <button className="btn-primary" onClick={send}>发送</button>
        </div>
      )}
    </div>
  );
}