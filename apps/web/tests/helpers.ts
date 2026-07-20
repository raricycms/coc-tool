/**
 * 测试辅助：通过直调 Route Handler 避免启 HTTP server。
 */

import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';

// 必须先 require registerHandler 模块，因为 Route Handler 内部 import 了
// Next.js 的 cookies() 等 server-only 模块，需要在测试中手动 mock。

let _nextCookies = new Map<string, string>();
let _asUserId: string | null = null;
let _asUsername: string | null = null;

// Mock next/headers
import { vi } from 'vitest';
let _cookieOpts = new Map<string, any>();
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) => {
      const v = _nextCookies.get(name);
      return v ? { value: v } : undefined;
    },
    set: (name: string, value: string, opts: any) => {
      _nextCookies.set(name, value);
      _cookieOpts.set(name, opts);
    },
    delete: (name: string) => {
      _nextCookies.delete(name);
      _cookieOpts.delete(name);
    },
  }),
}));

export function resetCookies() {
  _nextCookies = new Map();
  _cookieOpts = new Map();
  _asUserId = null;
  _asUsername = null;
}

export function setCookie(name: string, value: string) {
  _nextCookies.set(name, value);
}

export function getCookie(name: string): string | undefined {
  return _nextCookies.get(name);
}

/** 取 cookie 写入时的 options（含 maxAge） */
export function getCookieOptions(name: string): any | undefined {
  return _cookieOpts.get(name);
}

/** 模拟当前用户身份（仅对 requireUser() 起作用） */
export async function loginAs(userId: string, username: string) {
  _asUserId = userId;
  _asUsername = username;
  // 签一个 JWT cookie，让 requireUser() 校验通过
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET || 'test-secret-32-bytes-aaaaaaaaaaaaaaaa');
  const jwt = await new SignJWT({ userId, username, role: 'user' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
  _nextCookies.set('session', jwt);
}

// 给每次测试唯一 IP，避开限频桶
let _ipCounter = 0;
function nextIp(): string {
  _ipCounter += 1;
  return `10.0.0.${_ipCounter}`;
}

export function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new Request(url, init));
}

export async function callRoute<T = any>(
  handler: (req: NextRequest, ctx?: any) => Promise<Response>,
  options: { url: string; method?: string; body?: any; params?: any } = { url: 'http://localhost/api/test' },
): Promise<{ status: number; data: any }> {
  const ip = nextIp();
  const req = makeRequest(options.url, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      'x-forwarded-for': ip,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  // 从 URL 推断 params
  // URL 形式：http://localhost/api/<res>/<id>[/<sub>/<subId>]
  // split('/') 后：['http:', '', 'localhost', 'api', res, id, ...]
  const segments = options.url.split('?')[0].split('/');
  const paramsObj: any = {};
  // id 在 segment[5]（api/<res> 后）
  if (segments.length >= 6) paramsObj.id = segments[5];
  // /applications/<appId>
  if (segments.length >= 8) paramsObj.appId = segments[7];
  const ctx = { params: options.params ?? Promise.resolve(paramsObj) };
  const res = await handler(req as any, ctx);
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}