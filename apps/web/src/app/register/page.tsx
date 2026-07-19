'use client';

import { useState } from 'react';
import type { RegisterInput } from '@coc-tools/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CaptchaBox } from '@/components/CaptchaBox';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
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
    if (password.length < 10) {
      setError('密码至少 10 位');
      return;
    }
    setLoading(true);
    const body = {
      username,
      email: email || undefined,
      password,
      captchaToken: captcha.token,
      captchaAnswer: captcha.answer,
    } satisfies RegisterInput;
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(false);
    const j = await res.json();
    if (!j.ok) {
      setError(j.error?.message || '注册失败');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md card">
        <h1 className="text-2xl font-bold mb-6">创建账号</h1>

        <a href="/api/auth/raricy/start" className="btn-primary w-full mb-4">
          使用 raricy.com 一键注册
        </a>

        <div className="flex items-center gap-3 my-4 text-ink-100/40 text-sm">
          <div className="flex-1 h-px bg-ink-800" />
          或
          <div className="flex-1 h-px bg-ink-800" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">用户名（3-20 字符）</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={20} autoComplete="username" />
          </div>
          <div>
            <label className="label">邮箱（可选）</label>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <label className="label">密码（至少 10 位）</label>
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} autoComplete="new-password" />
          </div>
          <div>
            <label className="label">验证码</label>
            <CaptchaBox onChange={setCaptcha} />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <p className="mt-4 text-sm text-ink-100/60 text-center">
          已有账号？ <Link href="/login" className="text-brand-500 hover:underline">去登录</Link>
        </p>
      </div>
    </main>
  );
}