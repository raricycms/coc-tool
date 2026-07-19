import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { ok, fail, handleError } from '@/lib/api';
import { getSession } from '@/lib/auth';

/**
 * 给 Socket.IO 客户端用的「会话令牌」端点。
 *
 * 背景：浏览器的 `session` Cookie 设了 `sameSite=lax`，跨源（不同端口）的
 * socket.io handshake 不会被附带；realtime 服务的 authMiddleware 拿不到
 * token，连接直接被拒绝（`unauthorized: no token`），前端就一直显示
 * 「连接已断开，正在重连…」。
 *
 * 这里的解决方案是「同源换令牌」：浏览器先以同源请求本端点（cookie 会自动
 * 附带且有效），拿到一份同样的 JWT 字符串，再通过 socket.io 的 `auth.token`
 * 字段跨源传给 realtime。同源 Cookie 不受影响，HttpOnly 也保留。
 *
 * 注意：返回的就是 session Cookie 里的同一份 JWT，因此不需要单独的签名。
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return fail(401, 'unauthorized', '请先登录');

    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) return fail(401, 'unauthorized', '会话已失效');

    return ok({ token });
  } catch (e) {
    return handleError(e);
  }
}