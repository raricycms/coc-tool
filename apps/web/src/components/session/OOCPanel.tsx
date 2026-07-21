'use client';

import { useState, useRef } from 'react';
import type { OOCMessage } from '@coc-tools/shared';
import { HistorySentinel } from './HistorySentinel';
import { useStickyScroll } from './useStickyScroll';

interface Props {
  messages: OOCMessage[];
  onSend: (content: string) => void;
  canSend: boolean;
  currentUsername: string;
  history: {
    initialized: boolean;
    hasMore: boolean;
    loading: boolean;
    error?: string | null;
    onLoadMore: () => void;
  };
  /**
   * 父组件递增此值时通知 hook 「下一次消息变化是 prepend」，保持 scrollTop 不动。
   * 与 history.onLoadMore 配套使用：loadMore 前 increment 一次。
   */
  prependSignal: number;
}

export function OOCPanel({ messages, onSend, canSend, currentUsername, history, prependSignal }: Props) {
  const [input, setInput] = useState('');
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { onScroll } = useStickyScroll(scrollerRef, [messages.length], prependSignal);

  const send = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="card flex min-h-0 flex-col">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">画外 · OOC</h3>
        <span className="text-[11px] text-ink-muted">{messages.length} 条</span>
      </header>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="h-[480px] space-y-2 overflow-y-auto overflow-x-hidden text-sm lg:h-[640px]"
      >
        <HistorySentinel
          initialized={history.initialized}
          loading={history.loading}
          hasMore={history.hasMore}
          error={history.error ?? null}
          onLoadMore={history.onLoadMore}
        />
        {messages.length === 0 ? (
          <p className="py-8 text-center text-ink-muted">还没有消息</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="border-l-2 border-sky-200 pl-2.5">
              <div className="text-[11px] text-ink-soft">
                <span className={m.authorUsername === currentUsername ? 'font-semibold text-macaron-600' : ''}>
                  @{m.authorUsername}
                </span>
                {' · '}
                {new Date(m.realTime).toLocaleTimeString('zh-CN', { hour12: false })}
              </div>
              <div className="whitespace-pre-wrap text-ink">{m.content}</div>
            </div>
          ))
        )}
      </div>
      {canSend && (
        <div className="mt-3 flex gap-2">
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="说点什么（OOC）..."
            maxLength={2000}
          />
          <button className="btn-primary" onClick={send}>发送</button>
        </div>
      )}
    </div>
  );
}