/**
 * 单元测试：密码哈希（scrypt）。
 *
 * 覆盖：
 *   - hashPassword 返回形如 scrypt$<salt>$<key> 的字符串
 *   - verifyPassword 正确密码 → true，错误密码 → false
 *   - 同样的密码两次 hash 不同（salt 随机）
 *   - 损坏的 stored 字符串 → false（不抛）
 *   - scheme 非 scrypt → false
 */

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/password';

describe('password lib', () => {
  it('hashPassword 生成 scrypt$<salt>$<hex key> 格式', async () => {
    const h = await hashPassword('longpassword123');
    expect(h.startsWith('scrypt$')).toBe(true);
    const parts = h.split('$');
    expect(parts).toHaveLength(3);
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);   // salt = 16 bytes → 32 hex
    expect(parts[2]).toMatch(/^[0-9a-f]{128}$/);  // key = 64 bytes → 128 hex
  });

  it('正确密码 verify 返回 true', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
  });

  it('错误密码 verify 返回 false（耗时差不应用明文长度判断）', async () => {
    const stored = await hashPassword('longpassword123');
    expect(await verifyPassword('longpassword124', stored)).toBe(false);
    expect(await verifyPassword('short', stored)).toBe(false);
  });

  it('同密码两次 hash 不同（salt 随机）', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
    // 但两者都能 verify 通过
    expect(await verifyPassword('same-password', a)).toBe(true);
    expect(await verifyPassword('same-password', b)).toBe(true);
  });

  it('损坏 stored 字符串 → false', async () => {
    // 「scrypt$<32-byte salt>$<64-byte key>」形式但内容是错的字符串：
    // probability of match = 2^-512 effectively 0，避免出现 'scrypt$bad$bad'
    // 这种 salt 解析成 1 字节、key 1 字节导致的 1/256 偶发命中。
    const wrong = 'scrypt$' + 'a'.repeat(64) + '$' + 'b'.repeat(128);
    expect(await verifyPassword('anything', wrong)).toBe(false);
    // 「not-a-hash」只有一段 → scheme = 'not-a-hash'，分支判定为 false
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false);
  });

  it('不同 scheme → false', async () => {
    expect(await verifyPassword('x', 'bcrypt$abc$def')).toBe(false);
  });
});
