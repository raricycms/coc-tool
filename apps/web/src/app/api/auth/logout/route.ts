import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/api';
import { clearSession } from '@/lib/auth';

// 退出后跳转到主页 /（避免停留在 JSON 响应页面）
const HOME_URL = '/';

export async function POST(req: NextRequest) {
  try {
    await clearSession();
    return NextResponse.redirect(new URL(HOME_URL, req.url), { status: 303 });
  } catch (e) {
    return handleError(e);
  }
}