'use client';

import { useEffect, useState } from 'react';

interface CaptchaResp {
  ok: boolean;
  data?: { token: string; text: string; type: 'math' | 'chars' };
}

export function CaptchaBox({ onChange }: { onChange: (data: { token: string; answer: string }) => void }) {
  const [data, setData] = useState<{ token: string; text: string } | null>(null);
  const [answer, setAnswer] = useState('');

  const refresh = async () => {
    const res = await fetch('/api/captcha');
    const j: CaptchaResp = await res.json();
    if (j.ok && j.data) setData({ token: j.data.token, text: j.data.text });
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
    <div className="flex items-stretch gap-2">
      <div className="flex flex-1 items-center justify-center rounded-2xl border border-sky-300 bg-sky-50 px-3 py-2 font-mono text-lg tracking-wider text-ink select-none">
        {data?.text ?? '加载中…'}
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
  );
}