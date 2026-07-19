'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function StartSessionButton({ recruitmentId, approvedCount }: { recruitmentId: string; approvedCount: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (!confirm('启动团？启动后将创建 Session 并关闭招募。')) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/recruitments/${recruitmentId}/start`, { method: 'POST' });
    setLoading(false);
    const j = await res.json();
    if (!j.ok) {
      setError(j.error?.message || '启动失败');
      return;
    }
    router.push(`/sessions/${j.data.id}`);
  };

  if (approvedCount === 0) {
    return <p className="text-sm text-ink-100/40">至少需要 1 名通过审核的 PL 才能启动团。</p>;
  }

  return (
    <div>
      <button className="btn-primary" onClick={start} disabled={loading}>
        {loading ? '启动中...' : '启动团'}
      </button>
      {error && <p className="error-text mt-2">{error}</p>}
    </div>
  );
}