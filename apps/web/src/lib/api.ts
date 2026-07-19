/**
 * API 路由的通用响应助手。
 */

import { NextResponse } from 'next/server';

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(status: number, code: string, message?: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export function handleError(err: unknown) {
  console.error(err);
  const e = err as any;
  if (e.statusCode) return fail(e.statusCode, e.code || 'error', e.message);
  if (e.name === 'ZodError') return fail(400, 'invalid_input', e.issues?.[0]?.message);
  return fail(500, 'internal_error', 'Internal server error');
}