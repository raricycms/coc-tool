/**
 * 单元测试：进程内限频 rateLimit()。
 *
 * 注意：模块单例 store 在多次测试间会累积；用唯一 key 隔离。
 */

import { describe, it, expect } from 'vitest';
import { rateLimit } from '@/lib/rate-limit';

function uniqueKey(label: string): string {
  return `${label}-${Date.now()}-${Math.random()}`;
}

describe('rateLimit', () => {
  it('限额内连续 ok=true，且 remaining 单调下降', () => {
    const key = uniqueKey('a');
    for (let i = 0; i < 5; i++) {
      const r = rateLimit(key, 5, 60_000);
      expect(r.ok).toBe(true);
      expect(r.remaining).toBe(5 - (i + 1));
    }
  });

  it('超 limit 后返回 ok=false', () => {
    const key = uniqueKey('b');
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    }
    const r = rateLimit(key, 3, 60_000);
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it('不同 key 互不干扰', () => {
    const a = uniqueKey('c1');
    const b = uniqueKey('c2');
    expect(rateLimit(a, 1, 60_000).ok).toBe(true);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false);
    expect(rateLimit(b, 1, 60_000).ok).toBe(true);
  });

  it('resetAt 等于一个时间窗口起点', () => {
    const key = uniqueKey('d');
    const before = Date.now();
    const r = rateLimit(key, 1, 5_000);
    const after = Date.now();
    expect(r.resetAt).toBeGreaterThanOrEqual(before + 5_000);
    expect(r.resetAt).toBeLessThanOrEqual(after + 5_000);
  });
});
