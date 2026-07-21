'use client';

/**
 * 历史加载哨兵：放在聊天/日志 scroller 的最顶部。
 *
 * 状态机：
 *  - !initialized       ：首屏历史还没回来，显示「正在加载历史…」+ spinner，按钮不渲染
 *                        （避免误导用户以为「加载更早」按钮可用）。
 *  - initialized + loading  ：正在拉更早的批次，按钮禁用并显示 spinner + 加载中…
 *  - initialized + hasMore ：还有更早的可加载，按钮可点。
 *  - initialized + !hasMore ：已加载全部，显示低饱和度的「已加载全部历史消息」分隔线。
 *  - error              ：上一次加载失败，保留按钮可重试，并把错误信息显示出来。
 *
 * 设计要点：
 *  - 不做成「滚到顶自动加载」——人还没看清就已经被刷走，破坏阅读位置；
 *    让按钮成为显式的「翻页动作」。
 *  - 错误状态下保留按钮可点，避免一次失败就要刷新整页。
 *  - 「已加载全部」用一条非常淡的分隔线，避免占太多视觉权重（聊天/日志本质
 *    是信息流，不是以加载按钮为主角）。
 */
interface Props {
  /** 首屏历史是否已加载完毕。false 时只渲染加载提示，不渲染按钮。 */
  initialized: boolean;
  loading: boolean;
  hasMore: boolean;
  error?: string | null;
  /** 文案：「加载更早的消息」之类。 */
  label?: string;
  /** 已全部加载时的文案。 */
  exhaustedLabel?: string;
  onLoadMore: () => void;
}

export function HistorySentinel({
  initialized,
  loading,
  hasMore,
  error,
  label = '加载更早的消息',
  exhaustedLabel = '已加载全部历史消息',
  onLoadMore,
}: Props) {
  // 首屏还没回来：只渲染一行轻量提示，不渲染按钮。
  if (!initialized) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 text-[11px] text-ink-muted">
        <SmallSpinner />
        <span>正在加载历史…</span>
      </div>
    );
  }

  // 已加载全部且没出错 → 最小化展示，避免占太多空间。
  if (!loading && !hasMore && !error) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-3 text-[11px] text-ink-muted"
        aria-label={exhaustedLabel}
      >
        <span aria-hidden className="h-px w-6 bg-sky-300" />
        <span>{exhaustedLabel}</span>
        <span aria-hidden className="h-px w-6 bg-sky-300" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-3">
      <button
        type="button"
        onClick={onLoadMore}
        disabled={loading || !hasMore}
        className="group inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-macaron-300 hover:bg-macaron-50 hover:text-macaron-600 disabled:cursor-not-allowed disabled:opacity-60"
        aria-busy={loading || undefined}
        aria-label={loading ? '正在加载更早的消息' : label}
      >
        {loading ? <Spinner /> : <UpArrow />}
        <span>{loading ? '加载中…' : error ? '重试' : label}</span>
      </button>
      {error && (
        <span className="ml-2 max-w-[18rem] truncate text-[11px] text-bad" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin text-macaron-400"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 比 Spinner 小一档，给「首屏加载中」这种次要状态用。 */
function SmallSpinner() {
  return (
    <svg
      className="h-3 w-3 animate-spin text-ink-soft"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UpArrow() {
  return (
    <svg
      className="h-3.5 w-3.5 text-ink-soft transition group-hover:text-macaron-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}