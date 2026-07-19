'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFieldErrors } from '@/lib/useFieldErrors';
import { FieldError } from '@/components/FieldError';

export default function NewRecruitmentPage() {
  const router = useRouter();
  const { get, apply, clear, clearAll } = useFieldErrors();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [scenario, setScenario] = useState('');
  const [minPlayers, setMinPlayers] = useState(3);
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [expectedHours, setExpectedHours] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    clearAll();
    setLoading(true);
    const res = await fetch('/api/recruitments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, summary, scenario: scenario || undefined,
        minPlayers, maxPlayers,
        expectedHours: expectedHours === '' ? undefined : Number(expectedHours),
        visibility: 'public',
      }),
    });
    setLoading(false);
    const j = await res.json();
    if (!j.ok) {
      if (Array.isArray(j.error?.fields) && j.error.fields.length > 0) {
        apply(j.error.fields);
      } else {
        setError(j.error?.message || '发布失败');
      }
      return;
    }
    router.push(`/recruitments/${j.data.id}/manage`);
  };

  return (
    <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">发布招募</h1>
        <Link href="/recruitments" className="btn-ghost text-sm">← 返回</Link>
      </header>

      <form onSubmit={submit} className="card space-y-4">
        <FieldError error={get('title')}>
          <label className="label">标题 *</label>
          <input className="input" value={title} onChange={(e) => { setTitle(e.target.value); clear('title'); }} required maxLength={60} />
        </FieldError>
        <FieldError error={get('scenario')}>
          <label className="label">剧本（可选）</label>
          <input className="input" value={scenario} onChange={(e) => { setScenario(e.target.value); clear('scenario'); }} placeholder="例如：克苏鲁的呼唤 / 黄衣之王" />
        </FieldError>
        <FieldError error={get('summary')}>
          <label className="label">简介 *</label>
          <textarea className="input min-h-[200px]" value={summary} onChange={(e) => { setSummary(e.target.value); clear('summary'); }} required maxLength={20000} />
        </FieldError>
        <div className="grid grid-cols-3 gap-3">
          <FieldError error={get('minPlayers')}>
            <label className="label">最少 PL</label>
            <input type="number" className="input" value={minPlayers} min={1} max={20} onChange={(e) => { setMinPlayers(parseInt(e.target.value) || 1); clear('minPlayers'); }} />
          </FieldError>
          <FieldError error={get('maxPlayers')}>
            <label className="label">最多 PL</label>
            <input type="number" className="input" value={maxPlayers} min={1} max={20} onChange={(e) => { setMaxPlayers(parseInt(e.target.value) || 1); clear('maxPlayers'); }} />
          </FieldError>
          <FieldError error={get('expectedHours')}>
            <label className="label">预计时长 (h)</label>
            <input type="number" className="input" value={expectedHours} min={1} max={100} onChange={(e) => { setExpectedHours(e.target.value === '' ? '' : parseInt(e.target.value)); clear('expectedHours'); }} />
          </FieldError>
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '发布中...' : '发布招募'}
          </button>
        </div>
      </form>
    </main>
  );
}