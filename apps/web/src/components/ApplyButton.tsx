'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  recruitmentId: string;
  myCharacters: Array<{ id: string; name: string; era: string }>;
  existing: { status: string; characterId: string } | null;
}

export function ApplyButton({ recruitmentId, myCharacters, existing }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [characterId, setCharacterId] = useState(myCharacters[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (myCharacters.length === 0) {
    return (
      <div className="card text-ink-100/60 text-sm">你需要先创建至少一张车卡才能报名。<br /><a href="/characters/new" className="text-brand-500">立即创建 →</a></div>
    );
  }

  const submit = async () => {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/recruitments/${recruitmentId}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId, message }),
    });
    setLoading(false);
    const j = await res.json();
    if (!j.ok) {
      setError(j.error?.message || '报名失败');
      return;
    }
    setOpen(false);
    router.refresh();
  };

  if (existing) {
    return (
      <div className="card">
        <p>已报名（状态：{existing.status}）</p>
      </div>
    );
  }

  if (!open) {
    return <button className="btn-primary" onClick={() => setOpen(true)}>报名</button>;
  }

  return (
    <div className="card space-y-3">
      <div>
        <label className="label">选择车卡</label>
        <select className="input" value={characterId} onChange={(e) => setCharacterId(e.target.value)}>
          {myCharacters.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.era})</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">留言（可选）</label>
        <textarea className="input" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button className="btn-ghost" onClick={() => setOpen(false)}>取消</button>
        <button className="btn-primary" onClick={submit} disabled={loading || !characterId}>
          {loading ? '提交中...' : '提交报名'}
        </button>
      </div>
    </div>
  );
}