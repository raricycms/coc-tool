/**
 * 单元测试：cookieSecure() 根据 WEB_ORIGIN 协议决定 Secure 标记。
 *
 * 没有 env var → false；
 * WEB_ORIGIN=http... → false；
 * WEB_ORIGIN=https... → true。
 *
 * 通过临时改 process.env.WEB_ORIGIN 然后 vi.resetModules() 强制重 import。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('cookieSecure()', () => {
  const ORIGINAL = process.env.WEB_ORIGIN;

  beforeEach(() => {
    delete process.env.WEB_ORIGIN;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.WEB_ORIGIN;
    else process.env.WEB_ORIGIN = ORIGINAL;
  });

  it('未设置 WEB_ORIGIN → false', async () => {
    const { cookieSecure } = await import('@/lib/auth');
    expect(cookieSecure()).toBe(false);
  });

  it('WEB_ORIGIN 以 http 开头 → false', async () => {
    process.env.WEB_ORIGIN = 'http://example.com';
    const { cookieSecure } = await import('@/lib/auth');
    expect(cookieSecure()).toBe(false);
  });

  it('WEB_ORIGIN 以 https 开头 → true', async () => {
    process.env.WEB_ORIGIN = 'https://example.com';
    const { cookieSecure } = await import('@/lib/auth');
    expect(cookieSecure()).toBe(true);
  });
});
