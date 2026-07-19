import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { RegisterSchema } from '@coc-tools/shared';
import { ok, fail, handleError } from '@/lib/api';
import { verifyCaptcha } from '@/lib/captcha';
import { issueSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { hashPassword } from '@/lib/password';

function passwordFingerprint(password: string, username: string, email?: string): boolean {
  // 禁止密码与用户名 / 邮箱近似
  const lower = password.toLowerCase();
  return (
    lower.includes(username.toLowerCase()) ||
    (email ? lower.includes(email.toLowerCase().split('@')[0]) : false)
  );
}

export async function POST(req: NextRequest) {
  try {
    // 限频
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local';
    const rl = rateLimit(`auth:register:${ip}`, 5, 60_000);
    if (!rl.ok) return fail(429, 'rate_limited', '请求过于频繁');

    const body = RegisterSchema.parse(await req.json());

    if (!verifyCaptcha(body.captchaToken, body.captchaAnswer)) {
      return fail(400, 'captcha_invalid', '验证码错误或已过期');
    }

    if (body.password.length < 10) {
      return fail(400, 'weak_password', '密码至少 10 位');
    }
    if (passwordFingerprint(body.password, body.username, body.email)) {
      return fail(400, 'weak_password', '密码不能包含用户名或邮箱');
    }

    const exists = await prisma.user.findFirst({
      where: {
        OR: [
          { username: body.username },
          ...(body.email ? [{ email: body.email }] : []),
        ],
      },
    });
    if (exists) return fail(409, 'user_exists', '用户名或邮箱已被占用');

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        username: body.username,
        email: body.email ?? null,
        passwordHash,
        provider: 'LOCAL',
        status: 'ACTIVE',
      },
    });

    await issueSession(user.id, user.username);

    return ok({ userId: user.id, username: user.username });
  } catch (e) {
    return handleError(e);
  }
}
