'use client';

import { useState, useRef, useMemo } from 'react';
import type { OOCMessage, LogEntryPayload } from '@coc-tools/shared';
import { HistorySentinel } from './HistorySentinel';
import { useStickyScroll } from './useStickyScroll';
import { LogEntryRender, type LogCharInfo } from './LogEntryRender';

interface MemberCharacter {
  id: string; name: string;
  hp: number; hpMax: number;
  san: number; sanMax: number;
}

interface MemberLite {
  userId: string;
  username: string;
  character?: MemberCharacter;
}

interface Props {
  messages: OOCMessage[];
  logs: LogEntryPayload[];
  members: MemberLite[];
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

/**
 * 单条统一时间轴的渲染单元：
 *  - kind=ooc：画外聊天消息
 *  - kind=log：事件日志（判定 / HP 变动 / SAN 变动 / 公开掷骰 / 时钟 / 系统…）
 * 用 realTime 排序，所以「在场的人说了一句」和「KP 投了一只骰」能按发生顺序穿插。
 */
type FeedItem =
  | { kind: 'ooc'; t: number; id: string; msg: OOCMessage }
  | { kind: 'log'; t: number; id: string; entry: LogEntryPayload };

function toMs(iso: string): number {
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function OOCPanel({
  messages,
  logs,
  members,
  onSend,
  canSend,
  currentUsername,
  history,
  prependSignal,
}: Props) {
  const [input, setInput] = useState('');
  const scrollerRef = useRef<HTMLDivElement>(null);

  // 按 realTime 合并并排序；stable 排序基于数组索引，同时间戳时 OOC 在前。
  const feed: FeedItem[] = useMemo(() => {
    const oocItems: FeedItem[] = messages.map((m) => ({ kind: 'ooc', t: toMs(m.realTime), id: m.id, msg: m }));
    const logItems: FeedItem[] = logs.map((e) => ({ kind: 'log', t: toMs(e.realTime), id: e.id, entry: e }));
    const all = [...oocItems, ...logItems];
    all.sort((a, b) => (a.t - b.t) || (a.kind === 'ooc' ? -1 : 1));
    return all;
  }, [messages, logs]);

  // useStickyScroll 需要感知「消息数量变化」，用 feed.length 作为依赖。
  const { onScroll } = useStickyScroll(scrollerRef, [feed.length], prependSignal);

  const send = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  const findChar = (id?: string): LogCharInfo | undefined => {
    const m = members.find((x) => x.character?.id === id);
    return m?.character;
  };

  return (
    <div className="card flex min-h-0 flex-col">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">画外 · OOC</h3>
        <span className="text-[11px] text-ink-muted">{feed.length} 条</span>
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
        {feed.length === 0 ? (
          <p className="py-8 text-center text-ink-muted">还没有消息</p>
        ) : (
          feed.map((item) => {
            if (item.kind === 'ooc') {
              const m = item.msg;
              return (
                <div key={`ooc-${item.id}`} className="border-l-2 border-sky-200 pl-2.5">
                  <div className="text-[11px] text-ink-soft">
                    <span className={m.authorUsername === currentUsername ? 'font-semibold text-macaron-600' : ''}>
                      @{m.authorUsername}
                    </span>
                    {' · '}
                    {new Date(m.realTime).toLocaleTimeString('zh-CN', { hour12: false })}
                  </div>
                  <div className="whitespace-pre-wrap text-ink">{m.content}</div>
                </div>
              );
            }
            // 事件日志：复用原 LogPanel 的渲染逻辑，但与 OOC 共用左侧色条样式。
            return (
              <div key={`log-${item.id}`} className="border-l-2 border-sky-200 pl-2.5">
                <div className="text-[11px] text-ink-soft">
                  <span className="font-mono">⚙ 事件</span>
                  {' · '}
                  {new Date(item.entry.realTime).toLocaleTimeString('zh-CN', { hour12: false })}
                  {item.entry.inGameTime && ` · ⏰ ${item.entry.inGameTime}`}
                </div>
                <div className="break-words">
                  <LogEntryRender entry={item.entry} findChar={findChar} />
                </div>
              </div>
            );
          })
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