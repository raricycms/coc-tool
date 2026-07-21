'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
    router.push(`/recruitments/${j.data.id}`);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">发布招募</h1>
        <p className="mt-1 text-sm text-ink-soft">把你的剧本介绍给未来的 PL。</p>
      </header>

      <form onSubmit={submit} className="card space-y-5">
        <FieldError error={get('title')}>
          <label className="label">标题 <span className="text-bad">*</span></label>
          <input className="input" value={title} onChange={(e) => { setTitle(e.target.value); clear('title'); }} required maxLength={60} placeholder="例：克苏鲁的呼唤 · 黄衣之王 · 都市怪谈" />
        </FieldError>

        <FieldError error={get('scenario')}>
          <label className="label">剧本名（可选）</label>
          <input className="input" value={scenario} onChange={(e) => { setScenario(e.target.value); clear('scenario'); }} placeholder="克苏鲁的呼唤 / 黄衣之王 / 自制模组" />
        </FieldError>

        <FieldError error={get('summary')}>
          <label className="label">简介 <span className="text-bad">*</span></label>
          <textarea className="input min-h-[200px]" value={summary} onChange={(e) => { setSummary(e.target.value); clear('summary'); }} required maxLength={20000} placeholder="你想招募的 PL 类型、希望的风格、注意事项……" />
        </FieldError>

        {/* 关键修复：每格是完整字段组，不再让 label 与输入框错行 */}
        <div className="grid gap-4 sm:grid-cols-3">
          <FieldError error={get('minPlayers')}>
            <label className="label">最少人数</label>
            <input type="number" className="input" value={minPlayers} min={1} max={20}
              onChange={(e) => { setMinPlayers(parseInt(e.target.value) || 1); clear('minPlayers'); }} />
          </FieldError>
          <FieldError error={get('maxPlayers')}>
            <label className="label">最多人数</label>
            <input type="number" className="input" value={maxPlayers} min={1} max={20}
              onChange={(e) => { setMaxPlayers(parseInt(e.target.value) || 1); clear('maxPlayers'); }} />
          </FieldError>
          <FieldError error={get('expectedHours')}>
            <label className="label">预计时长（小时）</label>
            <input type="number" className="input" value={expectedHours} min={1} max={100}
              onChange={(e) => { setExpectedHours(e.target.value === '' ? '' : parseInt(e.target.value)); clear('expectedHours'); }} />
          </FieldError>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '发布中…' : '发布招募'}
          </button>
        </div>
      </form>
    </main>
  );
}