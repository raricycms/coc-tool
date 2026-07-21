'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldErrors } from '@/lib/useFieldErrors';
import { FieldError } from './FieldError';

interface Initial {
  title: string;
  summary: string;
  scenario: string;
  minPlayers: number;
  maxPlayers: number;
  expectedHours: number | null;
  visibility: 'public' | 'link';
  status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'FINISHED';
}

interface Props {
  recruitmentId: string;
  initial: Initial;
  /** 已开团：人数字段锁定 */
  locked: boolean;
}

export function RecruitmentEditForm({ recruitmentId, initial, locked }: Props) {
  const router = useRouter();
  const { get, apply, clear, clearAll } = useFieldErrors();
  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary);
  const [scenario, setScenario] = useState(initial.scenario);
  const [minPlayers, setMinPlayers] = useState(initial.minPlayers);
  const [maxPlayers, setMaxPlayers] = useState(initial.maxPlayers);
  const [expectedHours, setExpectedHours] = useState<number | ''>(initial.expectedHours ?? '');
  const [visibility, setVisibility] = useState(initial.visibility);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    clearAll();
    setLoading(true);
    const body: any = {
      title,
      summary,
      scenario: scenario || undefined,
      expectedHours: expectedHours === '' ? undefined : Number(expectedHours),
      visibility,
    };
    if (!locked) {
      body.minPlayers = minPlayers;
      body.maxPlayers = maxPlayers;
    }
    const res = await fetch(`/api/recruitments/${recruitmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(false);
    const j = await res.json();
    if (!j.ok) {
      if (Array.isArray(j.error?.fields) && j.error.fields.length > 0) {
        apply(j.error.fields);
      } else {
        setError(j.error?.message || '保存失败');
      }
      return;
    }
    router.push(`/recruitments/${recruitmentId}`);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="card space-y-5">
      <FieldError error={get('title')}>
        <label className="label">标题 <span className="text-bad">*</span></label>
        <input
          className="input"
          value={title}
          onChange={(e) => { setTitle(e.target.value); clear('title'); }}
          required maxLength={60}
        />
      </FieldError>

      <FieldError error={get('scenario')}>
        <label className="label">剧本名（可选）</label>
        <input
          className="input"
          value={scenario}
          onChange={(e) => { setScenario(e.target.value); clear('scenario'); }}
          maxLength={100}
        />
      </FieldError>

      <FieldError error={get('summary')}>
        <label className="label">简介 <span className="text-bad">*</span></label>
        <textarea
          className="input min-h-[200px]"
          value={summary}
          onChange={(e) => { setSummary(e.target.value); clear('summary'); }}
          required maxLength={20000}
        />
      </FieldError>

      <fieldset className={`grid gap-4 sm:grid-cols-3 ${locked ? 'opacity-60' : ''}`} disabled={locked}>
        <FieldError error={get('minPlayers')}>
          <label className="label">最少人数</label>
          <input
            type="number" className="input" value={minPlayers}
            min={1} max={20}
            onChange={(e) => { setMinPlayers(parseInt(e.target.value) || 1); clear('minPlayers'); }}
          />
        </FieldError>
        <FieldError error={get('maxPlayers')}>
          <label className="label">最多人数</label>
          <input
            type="number" className="input" value={maxPlayers}
            min={1} max={20}
            onChange={(e) => { setMaxPlayers(parseInt(e.target.value) || 1); clear('maxPlayers'); }}
          />
        </FieldError>
        <FieldError error={get('expectedHours')}>
          <label className="label">预计时长（小时）</label>
          <input
            type="number" className="input" value={expectedHours}
            min={1} max={100}
            onChange={(e) => {
              setExpectedHours(e.target.value === '' ? '' : parseInt(e.target.value));
              clear('expectedHours');
            }}
          />
        </FieldError>
      </fieldset>
      {locked && (
        <p className="text-xs text-ink-soft">已开团，人数字段已锁定。</p>
      )}

      <div>
        <label className="label">可见性</label>
        <select
          className="input w-48"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as 'public' | 'link')}
        >
          <option value="public">公开</option>
          <option value="link">链接私密</option>
        </select>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => router.push(`/recruitments/${recruitmentId}`)}>
          取消
        </button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? '保存中…' : '保存修改'}
        </button>
      </div>
    </form>
  );
}