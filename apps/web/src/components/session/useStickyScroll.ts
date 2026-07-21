'use client';

import { useEffect, useRef } from 'react';

/**
 * 「智能滚到底」：聊天/日志面板共享的滚动行为。
 *
 * 行为细则：
 *  - 消息数量变化时，如果用户原本「贴底」则滚到底，让其看到刚发生的事；
 *    否则保持当前 scrollTop 不被强制改变，避免把正在读历史的用户拽走。
 *  - 「贴底」用 scrollHeight - scrollTop - clientHeight < 32px 的容差判定，
 *    由 onScroll 维护（ref，不入 state，避免每次滚动触发 render）。
 *  - 主动加载更早（prepend）的场景：用户在底部时点「加载更早」后，scrollHeight
 *    会因为 prepend 增加，若继续按「贴底则滚到底」的规则，新 prepend 进来的
 *    内容会立刻被甩出视口。外部可在 prepend 前递增 `prependSignal`，
 *    hook 会捕捉到这次变化并跳过「滚到底」逻辑，让用户继续读刚刚加载的历史。
 *
 * 用法：
 *   const scrollerRef = useRef<HTMLDivElement>(null);
 *   const { onScroll } = useStickyScroll(scrollerRef, [messages.length], prependSignal);
 *   <div ref={scrollerRef} onScroll={onScroll}>...</div>
 *
 *   // 触发翻页前：递增 prependSignal
 *   setPrependSignal((n) => n + 1);
 *   socket.emit(...);
 */
export function useStickyScroll(
  scrollerRef: React.RefObject<HTMLElement | null>,
  deps: ReadonlyArray<unknown>,
  prependSignal: number = 0,
): {
  onScroll: () => void;
} {
  // 用户当前是否处于「贴底」状态。用 ref 而非 state：避免每次 onScroll 都触发 render。
  const stickToBottomRef = useRef(true);
  // 标记：下一次 deps 触发时是否要按「prepend」处理（保持当前 scrollTop）。
  // 在 prependSignal 变化的 effect 里置 true，在 deps 触发的 effect 里消费后清零。
  const expectPrependNextRef = useRef(false);

  // 注意：必须在「scroll 处理 effect」之前定义，确保同一次 render 内两个 effect
  // 都被调度时，先 set flag、再 read flag，顺序确定。
  useEffect(() => {
    expectPrependNextRef.current = true;
  }, [prependSignal]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    // 距离底部 < 32px 视为贴底（容差：换行 / emoji 高度抖动）。
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distFromBottom < 32;
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (expectPrependNextRef.current) {
      // 主动 prepend：保持当前 scrollTop 不变，让用户继续读刚刚加载的历史。
      expectPrependNextRef.current = false;
      return;
    }
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { onScroll };
}