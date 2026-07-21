'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 把 DRAFT 招募一键发布为 OPEN。
 */
export function PublishDraftButton({ recruitmentId }: { recruitmentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publish = async () => {
    if (!confirm('确认发布？发布后即可被 PL 看到、报名。')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recruitments/${recruitmentId}/publish`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error?.message || '发布失败');
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card border-macaron-300 bg-macaron-50">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">这则招募还是草稿</h3>
          <p className="mt-1 text-xs text-ink-soft">PL 还看不到。点击右侧按钮立刻发布。</p>
          {error && <p className="mt-2 text-xs text-bad">{error}</p>}
        </div>
        <button className="btn-primary text-sm" onClick={publish} disabled={loading}>
          {loading ? '发布中…' : '发布招募'}
        </button>
      </div>
    </section>
  );
}