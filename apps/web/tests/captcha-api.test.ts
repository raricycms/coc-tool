/**
 * 集成测试：/api/captcha 端点。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { callRoute, resetCookies } from './helpers';
import * as captchaRoute from '@/app/api/captcha/route';

describe('/api/captcha', () => {
  beforeEach(() => {
    resetCookies();
  });

  it('返回 token + text + type，且不要求登录', async () => {
    const res = await callRoute(captchaRoute.GET, {
      url: 'http://localhost/api/captcha',
    });
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
    expect(res.data.data.token).toMatch(/^[0-9a-f]{32}$/);
    expect(res.data.data.text).toBeTruthy();
    expect(['math', 'chars']).toContain(res.data.data.type);
  });

  it('两次请求 token 不同（不冲突）', async () => {
    const a = await callRoute(captchaRoute.GET, { url: 'http://localhost/api/captcha' });
    const b = await callRoute(captchaRoute.GET, { url: 'http://localhost/api/captcha' });
    expect(a.data.data.token).not.toBe(b.data.data.token);
  });
});
