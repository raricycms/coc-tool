'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldErrors } from '@/lib/useFieldErrors';
import { FieldError } from './FieldError';

interface Props {
  recruitmentId: string;
  myCharacters: Array<{ id: string; name: string; era: string }>;
  existing: { status: string; characterId: string } | null;
}

export function ApplyButton({ recruitmentId, myCharacters, existing }: Props) {
  const router = useRouter();
  const { get, apply, clear, clearAll } = useFieldErrors();
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
    clearAll();
    setLoading(true);
    const res = await fetch(`/api/recruitments/${recruitmentId}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId, message }),
    });
    setLoading(false);
    const j = await res.json();
    if (!j.ok) {
      if (Array.isArray(j.error?.fields) && j.error.fields.length > 0) {
        apply(j.error.fields);
      } else {
        setError(j.error?.message || '报名失败');
      }
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
      <FieldError error={get('characterId')}>
        <label className="label">选择车卡</label>
        <select className="input" value={characterId} onChange={(e) => { setCharacterId(e.target.value); clear('characterId'); }}>
          {myCharacters.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.era})</option>
          ))}
        </select>
      </FieldError>
      <FieldError error={get('message')}>
        <label className="label">留言（可选）</label>
        <textarea className="input" value={message} onChange={(e) => { setMessage(e.target.value); clear('message'); }} maxLength={2000} />
      </FieldError>
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