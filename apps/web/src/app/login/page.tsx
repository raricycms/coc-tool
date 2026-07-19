'use client';

import { useState } from 'react';
import type { LoginInput } from '@coc-tools/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CaptchaBox } from '@/components/CaptchaBox';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState({ token: '', answer: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!captcha.token || !captcha.answer) {
      setError('请输入验证码');
      return;
    }
    setLoading(true);
    const body = {
      username,
      password,
      captchaToken: captcha.token,
      captchaAnswer: captcha.answer,
    } satisfies LoginInput;
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(false);
    const j = await res.json();
    if (!j.ok) {
      setError(j.error?.message || '登录失败');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md card">
        <h1 className="text-2xl font-bold mb-6">登录</h1>

        <a href="/api/auth/raricy/start" className="btn-primary w-full mb-4">
          使用 raricy.com 一键登录
        </a>

        <div className="flex items-center gap-3 my-4 text-ink-100/40 text-sm">
          <div className="flex-1 h-px bg-ink-800" />
          或
          <div className="flex-1 h-px bg-ink-800" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">用户名</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
          </div>
          <div>
            <label className="label">密码</label>
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <div>
            <label className="label">验证码</label>
            <CaptchaBox onChange={setCaptcha} />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <p className="mt-4 text-sm text-ink-100/60 text-center">
          还没有账号？ <Link href="/register" className="text-brand-500 hover:underline">立即注册</Link>
        </p>
      </div>
    </main>
  );
}