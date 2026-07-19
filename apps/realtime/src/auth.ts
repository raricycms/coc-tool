import { jwtVerify } from 'jose';
import type { Socket } from 'socket.io';

const SECRET = () => new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-secret-please-replace-this-32-bytes');

export interface SessionUser {
  userId: string;
  username: string;
  role?: string;
}

export interface AuthedSocket extends Socket {
  data: {
    user: SessionUser;
  };
}

/**
 * Socket.IO 中间件：从 cookie 或 auth.token 解析 JWT。
 * 调用方式：io.use(authMiddleware)
 */
export async function authMiddleware(socket: Socket, next: (err?: Error) => void) {
  // 1) cookie
  const cookieHeader = socket.handshake.headers.cookie ?? '';
  const cookieMatch = cookieHeader.match(/session=([^;]+)/);
  let token = cookieMatch?.[1];

  // 2) auth.token（如果客户端没有 cookie）
  if (!token && socket.handshake.auth?.token) {
    token = socket.handshake.auth.token as string;
  }

  if (!token) {
    return next(new Error('unauthorized: no token'));
  }

  try {
    const { payload } = await jwtVerify(token, SECRET());
    socket.data.user = {
      userId: payload.userId as string,
      username: payload.username as string,
      role: (payload.role as string) ?? 'user',
    };
    next();
  } catch (err) {
    next(new Error('unauthorized: invalid token'));
  }
}