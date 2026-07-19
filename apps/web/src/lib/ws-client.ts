'use client';

/**
 * Socket.IO 客户端封装。
 * 自动从 cookie 带 session JWT。
 */

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) socket.disconnect();

  const url = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';
  socket = io(url, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    autoConnect: true,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}