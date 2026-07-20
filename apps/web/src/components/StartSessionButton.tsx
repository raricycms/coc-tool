'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function StartSessionButton({ recruitmentId, approvedCount }: { recruitmentId: string; approvedCount: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (!confirm('确定开团？开团后这场招募会关闭，所有已通过的 PL 自动入团。')) return;
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
    return (
      <div className="card text-center text-sm text-ink-soft">
        至少需要 1 名通过审核的 PL 才能开团。
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button className="btn-primary" onClick={start} disabled={loading}>
        {loading ? '启动中…' : '🚀 开团'}
      </button>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}