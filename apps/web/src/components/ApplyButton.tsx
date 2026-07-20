'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFieldErrors } from '@/lib/useFieldErrors';
import { FieldError } from './FieldError';

interface Props {
  recruitmentId: string;
  myCharacters: Array<{ id: string; name: string; era: string }>;
  existing: { status: string; characterId: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
};

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
      <div className="card text-center">
        <p className="text-sm text-ink">报名前需要至少一张可用的车卡。</p>
        <Link href="/characters/new" className="btn-primary mt-3 inline-flex">立即创建车卡 →</Link>
      </div>
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
      <div className="card flex items-center justify-between">
        <p className="text-sm text-ink">你已经报名了这场招募</p>
        <span className="rounded-full bg-macaron-100 px-3 py-1 text-xs font-semibold text-macaron-600">
          {STATUS_LABEL[existing.status] ?? existing.status}
        </span>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setOpen(true)}>报名这场招募</button>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <h2 className="text-lg font-bold text-ink">报名这场招募</h2>
      <FieldError error={get('characterId')}>
        <label className="label">使用哪张车卡</label>
        <select className="input" value={characterId} onChange={(e) => { setCharacterId(e.target.value); clear('characterId'); }}>
          {myCharacters.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.era})</option>
          ))}
        </select>
      </FieldError>
      <FieldError error={get('message')}>
        <label className="label">给 KP 的留言（可选）</label>
        <textarea className="input" value={message} onChange={(e) => { setMessage(e.target.value); clear('message'); }} maxLength={2000} />
      </FieldError>
      {error && <p className="error-text">{error}</p>}
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={() => setOpen(false)}>取消</button>
        <button className="btn-primary" onClick={submit} disabled={loading || !characterId}>
          {loading ? '提交中…' : '提交报名'}
        </button>
      </div>
    </div>
  );
}