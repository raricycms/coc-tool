'use client';

import { useState } from 'react';
import type { RegisterInput } from '@coc-tools/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CaptchaBox } from '@/components/CaptchaBox';
import { useFieldErrors } from '@/lib/useFieldErrors';
import { FieldError } from '@/components/FieldError';

export default function RegisterPage() {
  const router = useRouter();
  const { get, apply, clear, clearAll } = useFieldErrors();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [captcha, setCaptcha] = useState({ token: '', answer: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    clearAll();
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
      remember,
    } satisfies RegisterInput;
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(false);
    const j = await res.json();
    if (!j.ok) {
      if (Array.isArray(j.error?.fields) && j.error.fields.length > 0) {
        apply(j.error.fields);
      } else {
        setError(j.error?.message || '注册失败');
      }
      return;
    }
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-12">
      <div className="w-full">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-ink">创建账号</h1>
          <p className="mt-2 text-sm text-ink-soft">几秒钟就能开始建卡</p>
        </header>

        <a href="/api/auth/raricy/start" className="btn-primary w-full">
          ⚡ 使用 raricy.com 一键注册
        </a>

        <div className="my-6 flex items-center gap-3 text-xs text-ink-muted">
          <div className="h-px flex-1 bg-sky-200" />
          或填写信息
          <div className="h-px flex-1 bg-sky-200" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <FieldError error={get('username')}>
            <label className="label">用户名（3-20 字符）</label>
            <input className="input" value={username} onChange={(e) => { setUsername(e.target.value); clear('username'); }} required minLength={3} maxLength={20} autoComplete="username" />
          </FieldError>
          <FieldError error={get('email')}>
            <label className="label">邮箱（可选）</label>
            <input type="email" className="input" value={email} onChange={(e) => { setEmail(e.target.value); clear('email'); }} autoComplete="email" />
          </FieldError>
          <FieldError error={get('password')}>
            <label className="label">密码（至少 10 位）</label>
            <input type="password" className="input" value={password} onChange={(e) => { setPassword(e.target.value); clear('password'); }} required minLength={10} autoComplete="new-password" />
          </FieldError>

          <div>
            <label className="label">验证码</label>
            <CaptchaBox onChange={setCaptcha} />
          </div>

          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-sky-300 text-macaron-300 focus:ring-macaron-300"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>记住我（保持登录 365 天；不勾则 7 天）</span>
          </label>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-soft">
          已有账号？{' '}
          <Link href="/login" className="font-semibold text-macaron-600 hover:underline">
            去登录
          </Link>
        </p>
      </div>
    </main>
  );
}