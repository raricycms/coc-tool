'use client';

/**
 * Socket.IO 客户端封装。
 *
 * 跨源认证：浏览器的 session Cookie 是 `sameSite=lax`，跨端口/域的 socket.io
 * 握手不会带上，所以 realtime 的 authMiddleware 拿不到 token 会拒绝连接。
 * 这里改成「先同源拉一份 ws-token，再通过 `auth.token` 传给 realtime」，
 * 同源 Cookie 仍然受 HttpOnly 保护，跨源只暴露一个短期等价的 token 副本。
 *
 * 401 / unauthorized：会话失效时主动断开并清空 token，触发下一轮重连前
 * 再去拉一次新 token（用户重新登录后会刷新 Cookie）。
 */

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let cachedToken: string | null = null;
let inflightToken: Promise<string | null> | null = null;

async function fetchWsToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/ws-token', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data?.token ?? null;
  } catch {
    return null;
  }
}

/**
 * 单飞拉 token：并发调用只发一个请求。
 */
function getWsToken(): Promise<string | null> {
  if (cachedToken) return Promise.resolve(cachedToken);
  if (inflightToken) return inflightToken;
  inflightToken = fetchWsToken()
    .then((t) => {
      cachedToken = t;
      return t;
    })
    .finally(() => {
      inflightToken = null;
    });
  return inflightToken;
}

/**
 * 把 session 过期的 token 清掉，强制下一轮 `connect` 前重新拉。
 */
function invalidateToken() {
  cachedToken = null;
}

export async function getSocket(): Promise<Socket> {
  if (socket && socket.connected) return socket;
  if (socket) socket.disconnect();

  const url = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';
  const token = await getWsToken();

  socket = io(url, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    autoConnect: true,
    auth: token ? { token } : {},
  });

  // 401/unauthorized → 清 token，下次重连前再拉一次
  socket.on('connect_error', (err) => {
    if (/unauthorized|invalid token/i.test(err.message)) {
      invalidateToken();
    }
  });

  // 重连时刷新 token（用户可能中途重新登录）
  socket.io.on('reconnect_attempt', () => {
    if (!cachedToken) {
      getWsToken().then((t) => {
        if (t && socket) socket.auth = { token: t };
      });
    }
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  invalidateToken();
}