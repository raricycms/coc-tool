'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 旁观者退出按钮：POST /api/sessions/[id]/leave 把自己的 SPECTATOR 行打 leftAt。
 * 然后 router.push 回 dashboard，避免 dashboard 仍把已退出的 session 列在「可观战」里。
 */
export function SpectateExitButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const exit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/leave`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        alert(j?.error?.message || '退出失败');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-semibold text-macaron-600 hover:underline"
      >
        退出这场观战
      </button>
    );
  }
  return (
    <div className="flex items-center justify-center gap-3">
      <span className="text-sm text-ink-soft">确认退出这场观战？</span>
      <button
        type="button"
        className="btn-ghost text-xs"
        onClick={() => setConfirming(false)}
        disabled={loading}
      >
        取消
      </button>
      <button
        type="button"
        className="btn-danger text-xs"
        onClick={exit}
        disabled={loading}
      >
        {loading ? '处理中…' : '确认退出'}
      </button>
    </div>
  );
}