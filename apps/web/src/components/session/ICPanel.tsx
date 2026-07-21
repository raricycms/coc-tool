'use client';

import { useState, useRef } from 'react';
import type { ICMessage } from '@coc-tools/shared';
import { HistorySentinel } from './HistorySentinel';
import { useStickyScroll } from './useStickyScroll';

interface Props {
  messages: ICMessage[];
  onSend: (kind: 'desc' | 'dialogue', content: string, characterId?: string, characterName?: string) => void;
  role: 'KP' | 'PL' | 'SPECTATOR';
  myCharacterId?: string;
  myCharacterName?: string;
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

export function ICPanel({ messages, onSend, role, myCharacterId, myCharacterName, history, prependSignal }: Props) {
  const [input, setInput] = useState('');
  const [kind, setKind] = useState<'desc' | 'dialogue'>(role === 'KP' ? 'desc' : 'dialogue');
  // KP 在「角色发言」模式下可输入任意角色名（用于旁白 NPC）；PL 锁定为自己角色。
  const [characterName, setCharacterName] = useState('');
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { onScroll } = useStickyScroll(scrollerRef, [messages.length], prependSignal);

  const send = () => {
    if (!input.trim()) return;
    if (kind === 'dialogue') {
      const cid = role === 'PL' ? myCharacterId : undefined;
      const cname = role === 'PL' ? myCharacterName : characterName.trim() || undefined;
      onSend(kind, input.trim(), cid, cname);
    } else {
      onSend(kind, input.trim());
    }
    setInput('');
  };

  const canSendDesc = role === 'KP';
  const canSendDialogue = role === 'KP' || (role === 'PL' && !!myCharacterId);

  // PL 永远用「dialogue」+ 自己的角色名，禁用 kind 切换。
  const showKindSwitch = role === 'KP';
  const showCharacterInput = kind === 'dialogue' && canSendDialogue;

  return (
    <div className="card flex min-h-0 flex-col">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">画内 · IC</h3>
        <span className="text-[11px] text-ink-muted">{messages.length} 条</span>
      </header>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="h-[480px] space-y-2 overflow-y-auto overflow-x-hidden pr-1 text-sm lg:h-[640px]"
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
            <div
              key={m.id}
              className={`min-w-0 border-l-2 pl-2.5 ${m.kind === 'desc' ? 'border-macaron-300' : 'border-sky-200'}`}
            >
              <div className="text-[11px] text-ink-soft break-words">
                {m.kind === 'desc' ? (
                  <span className="font-semibold text-macaron-600">[主持人描述]</span>
                ) : (
                  <span className="font-semibold text-ink break-all">{m.characterName ?? m.authorUsername}</span>
                )}
                {' · '}
                {m.inGameDate} {m.inGameTime}
              </div>
              <div className="whitespace-pre-wrap break-words text-ink">{m.content}</div>
            </div>
          ))
        )}
      </div>
      {(canSendDesc || canSendDialogue) && (
        <div className="mt-3 space-y-2">
          {showKindSwitch && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setKind('desc')}
                className={`flex-1 rounded-2xl border px-3 py-1.5 text-xs font-semibold transition ${kind === 'desc' ? 'border-macaron-300 bg-macaron-300 text-white' : 'border-sky-200 bg-white text-ink-soft hover:bg-sky-50'}`}
              >
                描述
              </button>
              <button
                type="button"
                onClick={() => setKind('dialogue')}
                className={`flex-1 rounded-2xl border px-3 py-1.5 text-xs font-semibold transition ${kind === 'dialogue' ? 'border-macaron-300 bg-macaron-300 text-white' : 'border-sky-200 bg-white text-ink-soft hover:bg-sky-50'}`}
              >
                角色发言
              </button>
            </div>
          )}
          <div className="flex gap-2">
            {showCharacterInput && (
              role === 'PL' ? (
                <span className="inline-flex shrink-0 items-center rounded-2xl border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-ink-soft">
                  @{myCharacterName}
                </span>
              ) : (
                <input
                  className="input !w-32 shrink-0"
                  placeholder="角色名"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  maxLength={40}
                />
              )
            )}
            <input
              className="input min-w-0 flex-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder={kind === 'desc' ? '描述场景、气氛、NPC 反应…' : '角色在说什么？'}
              maxLength={2000}
            />
            <button className="btn-primary shrink-0" onClick={send}>发送</button>
          </div>
        </div>
      )}
    </div>
  );
}