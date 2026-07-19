/**
 * API 路由的通用响应助手。
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  buildFieldErrors,
  formatZodError,
  type FieldError,
  type FormatCtx,
} from './zodError';

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(
  status: number,
  code: string,
  message?: string,
  fields?: FieldError[],
) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(fields?.length ? { fields } : {}) } },
    { status },
  );
}

/**
 * 统一把抛出的错误转成 API 响应。ZodError 时附带 fields 列表，
 * ctx.root 传入原始请求体时可在 label 里用条目真名替代「第 N 项」。
 */
export function handleError(err: unknown, ctx?: FormatCtx) {
  console.error(err);
  if (err instanceof ZodError) {
    const fields = buildFieldErrors(err, ctx);
    return fail(400, 'invalid_input', formatZodError(err, ctx), fields);
  }
  const e = err as any;
  if (e?.statusCode) return fail(e.statusCode, e.code || 'error', e.message);
  return fail(500, 'internal_error', 'Internal server error');
}