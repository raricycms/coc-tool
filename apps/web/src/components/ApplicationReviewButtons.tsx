'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ApplicationReviewButtons({ recruitmentId, appId }: { recruitmentId: string; appId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);

  const review = async (action: 'approve' | 'reject') => {
    setLoading(action);
    const res = await fetch(`/api/recruitments/${recruitmentId}/applications/${appId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setLoading(null);
    if (res.ok) router.refresh();
    else alert('操作失败，请重试');
  };

  return (
    <div className="flex shrink-0 gap-2">
      <button className="btn-soft text-sm" onClick={() => review('approve')} disabled={!!loading}>
        {loading === 'approve' ? '处理中…' : '通过'}
      </button>
      <button className="btn-danger text-sm" onClick={() => review('reject')} disabled={!!loading}>
        {loading === 'reject' ? '处理中…' : '拒绝'}
      </button>
    </div>
  );
}