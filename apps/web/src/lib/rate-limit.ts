/**
 * 进程内限频器（v0.1 简化版）。
 * 生产环境可换 Redis。
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let bucket = store.get(key);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + windowMs };
    store.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }
  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

// 清理
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.resetAt < now) store.delete(k);
  }
}, 60_000).unref();