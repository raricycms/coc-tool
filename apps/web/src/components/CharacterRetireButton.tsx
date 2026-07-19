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
      alert('撕卡失败');
    }
  };

  if (!confirming) {
    return (
      <div className="mt-6">
        <button className="btn-danger" onClick={() => setConfirming(true)}>撕卡 / 送疯人院</button>
      </div>
    );
  }
  return (
    <div className="mt-6 card border-red-500">
      <p className="mb-3">确认撕卡？此操作将软删除车卡（仍在列表显示，但不可加入新 Session）。</p>
      <div className="flex gap-2">
        <button className="btn-ghost" onClick={() => setConfirming(false)}>取消</button>
        <button className="btn-danger" onClick={retire} disabled={loading}>
          {loading ? '处理中...' : '确认撕卡'}
        </button>
      </div>
    </div>
  );
}