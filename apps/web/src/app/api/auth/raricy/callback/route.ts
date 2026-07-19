/**
 * raricy OAuth - 回调
 *
 * v0.1：只暴露骨架，不做单元测试。
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createHash } from 'crypto';
import { prisma } from '@coc-tools/db';
import { issueSession } from '@/lib/auth';
import { fail, handleError } from '@/lib/api';

async function exchangeCode(code: string): Promise<{ access_token: string; expires_in: number; scope: string }> {
  const tokenUrl = process.env.RARICY_OAUTH_TOKEN_URL!;
  const clientId = process.env.RARICY_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.RARICY_OAUTH_CLIENT_SECRET!;
  const redirectUri = process.env.RARICY_OAUTH_REDIRECT_URI!;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });
  if (!res.ok) throw new Error(`oauth token failed: ${res.status}`);
  return res.json() as any;
}

async function fetchUserInfo(accessToken: string): Promise<{ sub: string; username: string; avatar_url: string | null }> {
  const userinfoUrl = process.env.RARICY_OAUTH_USERINFO_URL!;
  const res = await fetch(userinfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`oauth userinfo failed: ${res.status}`);
  return res.json() as any;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const cookieStore = await cookies();
    const expectedState = cookieStore.get('oauth_state')?.value;
    cookieStore.delete('oauth_state');

    if (!code || !state || state !== expectedState) {
      return NextResponse.redirect(new URL('/login?error=oauth_state', req.url), 302);
    }

    const token = await exchangeCode(code);
    const info = await fetchUserInfo(token.access_token);
    const tokenHash = createHash('sha256').update(token.access_token).digest('hex');

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.upsert({
        where: {
          provider_providerSub: { provider: 'RARICY', providerSub: info.sub },
        },
        update: {
          username: info.username,
          avatarUrl: info.avatar_url,
          lastLoginAt: new Date(),
        },
        create: {
          provider: 'RARICY',
          providerSub: info.sub,
          username: info.username,
          avatarUrl: info.avatar_url,
          status: 'ACTIVE',
        },
      });
      await tx.oAuthToken.upsert({
        where: { tokenHash },
        update: { expiresAt: new Date(Date.now() + token.expires_in * 1000) },
        create: {
          userId: u.id,
          tokenHash,
          scope: token.scope,
          expiresAt: new Date(Date.now() + token.expires_in * 1000),
        },
      });
      return u;
    });

    await issueSession(user.id, user.username);
    return NextResponse.redirect(new URL('/dashboard', req.url), 302);
  } catch (e) {
    console.error('raricy callback error', e);
    const url = new URL(req.url);
    return NextResponse.redirect(new URL('/login?error=oauth_callback', url.origin), 302);
  }
}