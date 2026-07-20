/**
 * Session 工具：JWT in HttpOnly cookie。
 */

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@coc-tools/db';

/**
 * 与 realtime 共享的 JWT 签名密钥。
 *
 * 启动期硬校验：必须存在且不能是仓库自带的 dev 占位串。占位串意味着
 * 「忘了 set -a; source .env; set +a」，会导致 web 签的 JWT 在 realtime
 * 端校验失败 → 浏览器「连接已断开」死循环。测试环境（vitest 注入
 * SESSION_SECRET）跳过。
 */
const PLACEHOLDER_SECRET = 'dev-secret-please-replace-this-32-bytes';
(function assertSessionSecret() {
  const s = process.env.SESSION_SECRET;
  if (s && s !== PLACEHOLDER_SECRET) return;
  if (process.env.NODE_ENV === 'test') return;
  // 在 module 顶层用 console.error 抛错，让 Next.js dev 启动时的编译错
  // 提示直接露在终端里。
  // eslint-disable-next-line no-console
  console.error(
    '\n' +
    '┌──────────────────────────────────────────────────────────────────┐\n' +
    '│ web: SESSION_SECRET 未设置或仍是仓库占位串                        │\n' +
    '│                                                                  │\n' +
    '│ 这会导致 realtime 校验 JWT 失败、浏览器「连接已断开」死循环。     │\n' +
    '│ 启动前请执行：                                                   │\n' +
    '│     set -a && source .env && set +a && npm run dev:web           │\n' +
    '│                                                                  │\n' +
    '│ 或者在 systemd 单元里加：                                         │\n' +
    '│     EnvironmentFile=/opt/coc-tools/.env                          │\n' +
    '└──────────────────────────────────────────────────────────────────┘\n',
  );
  throw new Error('SESSION_SECRET missing or placeholder; see console error above.');
})();

const SECRET = () => new TextEncoder().encode(process.env.SESSION_SECRET!);
const COOKIE_NAME = 'session';
const COOKIE_MAX_AGE = 7 * 24 * 3600;

/**
 * 只有站点确实以 HTTPS 对外提供服务时，才给 Cookie 加 Secure 标记。
 * 浏览器会「静默丢弃」通过明文 HTTP 收到的 Secure Cookie，
 * 因此用 NODE_ENV 判断会导致「生产 + HTTP」部署无法保存登录状态。
 * 以 WEB_ORIGIN 的协议为准更准确：https 才 Secure，http 则不加。
 * 导出以便其它路由（如 OAuth state）复用，保持 Cookie 策略一致。
 */
export function cookieSecure(): boolean {
  return (process.env.WEB_ORIGIN ?? '').startsWith('https://');
}

export interface SessionPayload {
  userId: string;
  username: string;
  role: string;
}

export async function issueSession(userId: string, username: string, role: string = 'user') {
  const jwt = await new SignJWT({ userId, username, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET());
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const c = cookieStore.get(COOKIE_NAME)?.value;
    if (!c) return null;
    const { payload } = await jwtVerify(c, SECRET());
    return {
      userId: payload.userId as string,
      username: payload.username as string,
      role: (payload.role as string) ?? 'user',
    };
  } catch {
    return null;
  }
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** 在 server route 中获取完整 user 对象 */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== 'ACTIVE') return null;
  return user;
}

/** 通用鉴权：throw if no session */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const err = new Error('Unauthorized');
    (err as any).statusCode = 401;
    throw err;
  }
  return user;
}