/**
 * Session 工具：JWT in HttpOnly cookie。
 */

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@coc-tools/db';

const SECRET = () => new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-secret-please-replace-this-32-bytes');
const COOKIE_NAME = 'session';
const COOKIE_MAX_AGE = 7 * 24 * 3600;

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
    secure: process.env.NODE_ENV === 'production',
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