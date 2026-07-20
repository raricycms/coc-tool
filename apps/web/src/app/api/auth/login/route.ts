import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { LoginSchema } from '@coc-tools/shared';
import { ok, fail, handleError } from '@/lib/api';
import { verifyCaptcha } from '@/lib/captcha';
import { issueSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { verifyPassword } from '@/lib/password';

export async function POST(req: NextRequest) {
  let rawBody: unknown = null;
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local';
    const rl = rateLimit(`auth:login:${ip}`, 10, 60_000);
    if (!rl.ok) return fail(429, 'rate_limited', '请求过于频繁');

    rawBody = await req.json();
    const body = LoginSchema.parse(rawBody);

    if (!verifyCaptcha(body.captchaToken, body.captchaAnswer)) {
      return fail(400, 'captcha_invalid', '验证码错误或已过期');
    }

    const user = await prisma.user.findUnique({ where: { username: body.username } });
    if (!user || !user.passwordHash || user.provider !== 'LOCAL') {
      return fail(401, 'invalid_credentials', '用户名或密码错误');
    }
    if (user.status !== 'ACTIVE') {
      return fail(401, 'user_banned', '账号已被封禁');
    }

    const ok2 = await verifyPassword(body.password, user.passwordHash);
    if (!ok2) return fail(401, 'invalid_credentials', '用户名或密码错误');

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await issueSession(user.id, user.username, 'user', body.remember);

    return ok({ userId: user.id, username: user.username });
  } catch (e) {
    return handleError(e, { root: rawBody ?? undefined });
  }
}