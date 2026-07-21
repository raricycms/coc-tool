'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 放弃结算：从 SETTLING 拉回 RUNNING，清空 settlement 草稿。
 * 二次确认；因为会丢失所有已填的 SAN/神话/撕卡/成长数据。
 */
export function ResumeSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const resume = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/resume`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        alert(j?.error?.message || '操作失败');
        return;
      }
      router.push(`/sessions/${sessionId}`);
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
        放弃结算，回到跑团
      </button>
    );
  }
  return (
    <div className="rounded-2xl border border-bad/40 bg-bad/5 px-4 py-3 text-center text-xs">
      <p className="text-ink">确认放弃结算？已填的 SAN 恢复 / 神话 / 撕卡 / 成长数据将丢失。</p>
      <div className="mt-2 flex justify-center gap-2">
        <button type="button" className="btn-ghost text-xs" onClick={() => setConfirming(false)} disabled={loading}>
          取消
        </button>
        <button type="button" className="btn-danger text-xs" onClick={resume} disabled={loading}>
          {loading ? '处理中…' : '确认放弃'}
        </button>
      </div>
    </div>
  );
}