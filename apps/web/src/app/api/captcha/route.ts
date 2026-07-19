import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/api';
import { createCaptcha } from '@/lib/captcha';

export async function GET(_req: NextRequest) {
  try {
    const c = createCaptcha();
    // 把 token 也直接返回，客户端塞进 form；服务端验证时比对答案
    return ok({ token: c.token, text: c.text, type: c.type });
  } catch (e) {
    return handleError(e);
  }
}