'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * PL 撤回自己的报名（PENDING 状态下）。
 * DELETE /api/recruitments/[id]/applications/[appId] 把 status 置 WITHDRAWN。
 */
export function WithdrawButton({ recruitmentId, applicationId }: { recruitmentId: string; applicationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const withdraw = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/recruitments/${recruitmentId}/applications/${applicationId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        alert(j?.error?.message || '撤回失败');
        return;
      }
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
        className="text-xs text-ink-soft underline-offset-4 hover:underline hover:text-bad"
      >
        撤回报名
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="btn-ghost text-[11px]"
        onClick={() => setConfirming(false)}
        disabled={loading}
      >
        取消
      </button>
      <button
        type="button"
        className="btn-danger text-[11px]"
        onClick={withdraw}
        disabled={loading}
      >
        {loading ? '处理中…' : '确认撤回'}
      </button>
    </div>
  );
}