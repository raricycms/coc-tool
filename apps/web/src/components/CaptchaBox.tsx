'use client';

import { useEffect, useState } from 'react';

interface CaptchaResp {
  ok: boolean;
  data?: { token: string; text: string; type: 'math' | 'chars' };
}

export function CaptchaBox({ onChange }: { onChange: (data: { token: string; answer: string }) => void }) {
  const [data, setData] = useState<{ token: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');

  const refresh = async () => {
    setError(null);
    try {
      const res = await fetch('/api/captcha');
      const j: CaptchaResp = await res.json();
      if (j.ok && j.data) {
        setData({ token: j.data.token, text: j.data.text });
      } else {
        setError('加载失败');
      }
    } catch {
      setError('加载失败，请重试');
    }
    setAnswer('');
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (data && answer) onChange({ token: data.token, answer });
    else onChange({ token: '', answer: '' });
  }, [data, answer, onChange]);

  return (
    <div className="space-y-1">
      <div className="flex items-stretch gap-2">
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-sky-300 bg-sky-50 px-3 py-2 font-mono text-lg tracking-wider text-ink select-none">
          {error ? <span className="text-bad text-sm">{error}</span> : (data?.text ?? '加载中…')}
        </div>
        <input
          type="text"
          className="input w-32"
          placeholder="答案"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          autoComplete="off"
        />
        <button type="button" onClick={refresh} className="btn-ghost px-3" title="换一题" aria-label="换一题">
          ↻
        </button>
      </div>
      {error && (
        <button type="button" onClick={refresh} className="text-xs text-macaron-600 hover:underline">
          点击重试
        </button>
      )}
    </div>
  );
}