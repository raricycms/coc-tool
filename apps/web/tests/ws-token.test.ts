/**
 * 单元测试：/api/auth/ws-token
 *
 * 这个端点是「跨源 socket.io 认证」的关键：浏览器因为 sameSite=lax，
 * 不会把 session cookie 带到跨端口的 realtime 握手；这里换成「同源
 * 先拿一份 JWT 副本 → 通过 socket.io 的 auth.token 跨源带回」。
 *
 * 因此本测试断言：
 *   1) 未登录 → 401；
 *   2) 已登录 → 200，返回的 token 等于 Cookie 里的 session JWT；
 *   3) 拿到的 token 能被同一个 SESSION_SECRET 验签通过。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { jwtVerify, SignJWT } from 'jose';

// 在本文件内声明 mock：helpers.ts 里的 vi.mock 在跨文件复用时偶尔不生效，
// 直接在本文件声明一次最稳。注意：必须在本测试文件其它 import 之前执行。
const _cookieStore = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) => {
      const v = _cookieStore.get(name);
      return v ? { value: v } : undefined;
    },
    set: (name: string, value: string, _opts: any) => {
      _cookieStore.set(name, value);
    },
    delete: (name: string) => {
      _cookieStore.delete(name);
    },
  }),
}));

import { GET } from '@/app/api/auth/ws-token/route';
import { makeRequest } from './helpers';

async function signSessionCookie(userId: string, username: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET || 'test-secret-32-bytes-aaaaaaaaaaaaaaaa');
  return new SignJWT({ userId, username, role: 'user' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

async function callWsToken(cookie?: string): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = `session=${cookie}`;
  const req = makeRequest('http://localhost/api/auth/ws-token', { headers });
  const res = await GET(req as any);
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

describe('/api/auth/ws-token', () => {
  beforeEach(() => {
    _cookieStore.clear();
  });

  it('未登录 → 401', async () => {
    const { status, data } = await callWsToken();
    expect(status).toBe(401);
    expect(data.ok).toBe(false);
  });

  it('已登录 → 200，返回的 token 等于 session Cookie', async () => {
    const jwt = await signSessionCookie('user-1', 'alice');
    _cookieStore.set('session', jwt);

    const { status, data } = await callWsToken(jwt);
    expect(status).toBe(200);
    expect(data.ok).toBe(true);
    expect(typeof data.data.token).toBe('string');
    expect(data.data.token.length).toBeGreaterThan(20);
    expect(data.data.token).toBe(jwt);

    // 拿到的 token 必须能用同一个 SESSION_SECRET 验签
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET || 'test-secret-32-bytes-aaaaaaaaaaaaaaaa');
    const { payload } = await jwtVerify(data.data.token, secret);
    expect(payload.userId).toBe('user-1');
    expect(payload.username).toBe('alice');
  });
});