/**
 * 图形验证码（极简实现）。
 *
 * v0.1：进程内 Map 存储答案。生产环境应换 Redis。
 */

import { randomBytes } from 'crypto';

interface CaptchaEntry {
  answer: string;
  expiresAt: number;
}

const store = new Map<string, CaptchaEntry>();

// 周期性清理过期
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expiresAt < now) store.delete(k);
  }
}, 60_000).unref();

function randDigits(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10).toString();
  return s;
}

/** 生成 4 位数加法（题目） */
function makeArithmetic(): { text: string; answer: string } {
  const a = Math.floor(Math.random() * 50) + 1;
  const b = Math.floor(Math.random() * 50) + 1;
  return { text: `${a} + ${b} = ?`, answer: String(a + b) };
}

/** 生成 5 位字母数字（区分大小写） */
function makeChars(): { text: string; answer: string } {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let text = '';
  for (let i = 0; i < 5; i++) text += chars[Math.floor(Math.random() * chars.length)];
  return { text, answer: text };
}

export function createCaptcha(): { token: string; text: string; type: 'math' | 'chars'; answer: string } {
  const useMath = Math.random() < 0.5;
  const c = useMath ? makeArithmetic() : makeChars();
  const token = randomBytes(16).toString('hex');
  store.set(token, { answer: c.answer.toLowerCase(), expiresAt: Date.now() + 5 * 60_000 });
  return { token, text: c.text, type: useMath ? 'math' : 'chars', answer: c.answer };
}

export function verifyCaptcha(token: string, answer: string): boolean {
  const entry = store.get(token);
  if (!entry) return false;
  store.delete(token);  // 一次性
  if (entry.expiresAt < Date.now()) return false;
  return entry.answer === answer.trim().toLowerCase();
}

// 占位导出，兼容旧 API
export { createCaptcha as createCaptchaLegacy };