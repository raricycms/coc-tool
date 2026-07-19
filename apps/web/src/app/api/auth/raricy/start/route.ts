/**
 * raricy OAuth - 发起授权
 *
 * v0.1：只暴露骨架，不做单元测试。
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { fail, handleError } from '@/lib/api';
import { cookieSecure } from '@/lib/auth';

export async function GET(_req: NextRequest) {
  try {
    const clientId = process.env.RARICY_OAUTH_CLIENT_ID;
    const redirectUri = process.env.RARICY_OAUTH_REDIRECT_URI;
    const authorizeUrl = process.env.RARICY_OAUTH_AUTHORIZE_URL;

    if (!clientId || !redirectUri || !authorizeUrl) {
      return fail(503, 'oauth_not_configured', 'OAuth 未配置');
    }

    const state = randomBytes(24).toString('hex');
    const cookieStore = await cookies();
    cookieStore.set('oauth_state', state, {
      httpOnly: true,
      secure: cookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });

    const url = new URL(authorizeUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', 'profile');
    url.searchParams.set('state', state);

    return NextResponse.redirect(url.toString(), 302);
  } catch (e) {
    return handleError(e);
  }
}