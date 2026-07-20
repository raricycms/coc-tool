'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CharacterRetireButton({ characterId }: { characterId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const retire = async () => {
    setLoading(true);
    const res = await fetch(`/api/characters/${characterId}`, { method: 'DELETE' });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      alert('操作失败');
    }
  };

  if (!confirming) {
    return (
      <div className="flex justify-end">
        <button className="btn-danger" onClick={() => setConfirming(true)}>
          退役这张车卡
        </button>
      </div>
    );
  }
  return (
    <div className="card border-bad/40 bg-bad/5">
      <p className="text-sm text-ink">
        确定要退役这张车卡吗？退役后会保留在列表中，但不能再加入新的跑团。
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button className="btn-ghost" onClick={() => setConfirming(false)}>取消</button>
        <button className="btn-danger" onClick={retire} disabled={loading}>
          {loading ? '处理中…' : '确认退役'}
        </button>
      </div>
    </div>
  );
}