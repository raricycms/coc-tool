/**
 * 集成测试：账号系统
 * - 注册 / 登录 / 验证码
 * - session cookie 写入
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@coc-tools/db';
import { createCaptcha } from '@/lib/captcha';
import { callRoute, resetCookies, getCookie, getCookieOptions } from './helpers';

import * as registerRoute from '@/app/api/auth/register/route';
import * as loginRoute from '@/app/api/auth/login/route';
import * as logoutRoute from '@/app/api/auth/logout/route';

describe('auth integration', () => {
  beforeEach(() => {
    resetCookies();
  });

  it('captcha can be created and verified', async () => {
    const { createCaptcha } = await import('@/lib/captcha');
    const { verifyCaptcha } = await import('@/lib/captcha');
    const c = createCaptcha();
    expect(c.token).toBeTruthy();
    expect(c.text).toBeTruthy();
    // 答对
    expect(verifyCaptcha(c.token, c.answer)).toBe(true);
    // 一次性
    expect(verifyCaptcha(c.token, c.answer)).toBe(false);
  });

  it('full register + login flow', async () => {
    const c1 = createCaptcha();

    // 1) register
    const reg = await callRoute(registerRoute.POST, {
      url: 'http://localhost/api/auth/register',
      method: 'POST',
      body: {
        username: 'alice',
        email: 'alice@test.local',
        password: 'longpassword123',
        captchaToken: c1.token,
        captchaAnswer: c1.answer,
      },
    });
    expect(reg.status).toBe(200);
    expect(reg.data.ok).toBe(true);

    // session cookie 应已写入
    const sessionCookie = getCookie('session');
    expect(sessionCookie).toBeTruthy();

    // DB 写入检查
    const user = await prisma.user.findUnique({ where: { username: 'alice' } });
    expect(user).toBeTruthy();
    expect(user?.email).toBe('alice@test.local');
    expect(user?.passwordHash).toMatch(/^scrypt\$/);

    // 2) 登出：服务端应 303 重定向到主页（避免停留在 JSON 响应）
    const out = await callRoute(logoutRoute.POST, {
      url: 'http://localhost/api/auth/logout',
      method: 'POST',
    });
    expect(out.status).toBe(303);

    // 3) 用错密码登录
    const c2 = createCaptcha();
    const wrong = await callRoute(loginRoute.POST, {
      url: 'http://localhost/api/auth/login',
      method: 'POST',
      body: {
        username: 'alice',
        password: 'wrongpassword',
        captchaToken: c2.token,
        captchaAnswer: c2.answer,
      },
    });
    expect(wrong.status).toBe(401);
    expect(wrong.data.error.code).toBe('invalid_credentials');

    // 4) 用正确密码登录
    const c3 = createCaptcha();
    const ok = await callRoute(loginRoute.POST, {
      url: 'http://localhost/api/auth/login',
      method: 'POST',
      body: {
        username: 'alice',
        password: 'longpassword123',
        captchaToken: c3.token,
        captchaAnswer: c3.answer,
      },
    });
    expect(ok.status).toBe(200);
    expect(ok.data.ok).toBe(true);
    expect(getCookie('session')).toBeTruthy();
  });

  it('rejects registration with bad captcha', async () => {
    const c = createCaptcha();
    const res = await callRoute(registerRoute.POST, {
      url: 'http://localhost/api/auth/register',
      method: 'POST',
      body: {
        username: 'bob',
        password: 'longpassword123',
        captchaToken: c.token,
        captchaAnswer: 'wrong',
      },
    });
    expect(res.status).toBe(400);
    expect(res.data.error.code).toBe('captcha_invalid');
  });

  it('rejects registration with weak password (caught by zod)', async () => {
    const c = createCaptcha();
    const res = await callRoute(registerRoute.POST, {
      url: 'http://localhost/api/auth/register',
      method: 'POST',
      body: {
        username: 'weakpw',
        password: 'short',
        captchaToken: c.token,
        captchaAnswer: c.answer,
      },
    });
    // zod schema 先于 weak_password 检查，捕获短密码
    expect(res.status).toBe(400);
    expect(res.data.error.code).toBe('invalid_input');
  });

  it('rejects duplicate username', async () => {
    const c1 = createCaptcha();
    await callRoute(registerRoute.POST, {
      url: 'http://localhost/api/auth/register', method: 'POST',
      body: { username: 'dupe', password: 'longpassword123', captchaToken: c1.token, captchaAnswer: c1.answer },
    });
    const c2 = createCaptcha();
    const res = await callRoute(registerRoute.POST, {
      url: 'http://localhost/api/auth/register', method: 'POST',
      body: { username: 'dupe', password: 'longpassword123', captchaToken: c2.token, captchaAnswer: c2.answer },
    });
    expect(res.status).toBe(409);
    expect(res.data.error.code).toBe('user_exists');
  });

  it('remember=true 时 session cookie maxAge = 365 天；否则 7 天', async () => {
    const SEVEN_DAYS = 7 * 24 * 3600;
    const ONE_YEAR = 365 * 24 * 3600;

    // a) 默认（不传 remember）= 短期
    const c1 = createCaptcha();
    const r1 = await callRoute(registerRoute.POST, {
      url: 'http://localhost/api/auth/register', method: 'POST',
      body: { username: 'short', password: 'longpassword123', captchaToken: c1.token, captchaAnswer: c1.answer },
    });
    expect(r1.status).toBe(200);
    expect(getCookieOptions('session')?.maxAge).toBe(SEVEN_DAYS);

    // b) remember=true = 长期
    resetCookies();
    const c2 = createCaptcha();
    const r2 = await callRoute(registerRoute.POST, {
      url: 'http://localhost/api/auth/register', method: 'POST',
      body: {
        username: 'longterm', password: 'longpassword123',
        captchaToken: c2.token, captchaAnswer: c2.answer,
        remember: true,
      },
    });
    expect(r2.status).toBe(200);
    expect(getCookieOptions('session')?.maxAge).toBe(ONE_YEAR);

    // c) 登录时传 remember 也走长期
    resetCookies();
    const c3 = createCaptcha();
    const r3 = await callRoute(loginRoute.POST, {
      url: 'http://localhost/api/auth/login', method: 'POST',
      body: {
        username: 'longterm', password: 'longpassword123',
        captchaToken: c3.token, captchaAnswer: c3.answer,
        remember: true,
      },
    });
    expect(r3.status).toBe(200);
    expect(getCookieOptions('session')?.maxAge).toBe(ONE_YEAR);

    // d) 登录不传 remember = 短期
    resetCookies();
    const c4 = createCaptcha();
    const r4 = await callRoute(loginRoute.POST, {
      url: 'http://localhost/api/auth/login', method: 'POST',
      body: {
        username: 'longterm', password: 'longpassword123',
        captchaToken: c4.token, captchaAnswer: c4.answer,
      },
    });
    expect(r4.status).toBe(200);
    expect(getCookieOptions('session')?.maxAge).toBe(SEVEN_DAYS);
  });
});