/**
 * 在线状态（presence）反向索引。
 *
 * 之前只有 DB 的 SessionMember 表，UI 看到的「绿色圆点」实际上永远不会灭。
 * 这里在内存里维护「现在至少有一个 socket 落在这个 session 的用户」集合，
 * 用它给 PresenceUpdate 标注每一位是否真正在线。
 *
 * 数据结构：
 *   bySession: sessionId → userId → Set<socketId>
 *     同一用户在同一 session 开多 tab 会合并到同一个集合；
 *     任何一个 socket 关闭只要集合不空就算「在线」，避免抖动。
 *   bySocket: socketId → Set<sessionId>
 *     disconnect 时反查该 socket 加入过哪些 session，再清理 bySession。
 *
 * 注意：这是 in-memory 状态。realtime 重启会丢，但用户重连后会自然 rebuild；
 * 这是可接受的，因为 disconnect 事件我们也立刻发，再有用户 join 也会刷新。
 */

import type { Server } from 'socket.io';
import { prisma } from '@coc-tools/db';
import { SOCKET_EVENTS, type PresenceUpdate } from '@coc-tools/shared';
import type { AuthedSocket } from './auth.js';

const bySession = new Map<string, Map<string, Set<string>>>();
const bySocket = new Map<string, Set<string>>();

function addSocket(sessionId: string, userId: string, socketId: string) {
  let byUser = bySession.get(sessionId);
  if (!byUser) {
    byUser = new Map();
    bySession.set(sessionId, byUser);
  }
  let sockets = byUser.get(userId);
  if (!sockets) {
    sockets = new Set();
    byUser.set(userId, sockets);
  }
  sockets.add(socketId);

  let rooms = bySocket.get(socketId);
  if (!rooms) {
    rooms = new Set();
    bySocket.set(socketId, rooms);
  }
  rooms.add(sessionId);
}

/**
 * 把 socket 从所有 session 索引中拆除，返回「因为这次拆除让整个用户从此离线」的 (session, user) 对。
 * 同 session 内同一用户的其它 socket 仍在线的情况不会出现在结果里，避免频繁广播。
 */
function removeSocket(socketId: string): Array<{ sessionId: string; userId: string }> {
  const rooms = bySocket.get(socketId);
  if (!rooms) return [];
  const out: Array<{ sessionId: string; userId: string }> = [];
  for (const sessionId of rooms) {
    const byUser = bySession.get(sessionId);
    if (!byUser) continue;
    for (const [userId, sockets] of byUser) {
      if (!sockets.has(socketId)) continue;
      sockets.delete(socketId);
      if (sockets.size === 0) {
        byUser.delete(userId);
        out.push({ sessionId, userId });
      }
    }
    if (byUser.size === 0) bySession.delete(sessionId);
  }
  bySocket.delete(socketId);
  return out;
}

/**
 * 把某个 socket 从单个 session 中拆除（不改其它 session 也不改 bySocket 全量）。
 * 用于 client 主动 session:leave（仍在 socket 内，只是想从这个 session 的 presence 中下线）。
 * 返回「该用户在该 session 是否从此再无 socket」，true 才会广播一次刷新后的 presence。
 */
function removeSocketFromSession(socketId: string, sessionId: string): { dropped: boolean; userId: string } | null {
  const byUser = bySession.get(sessionId);
  if (!byUser) return null;
  const rooms = bySocket.get(socketId);
  if (!rooms || !rooms.has(sessionId)) return null;
  for (const [userId, sockets] of byUser) {
    if (!sockets.has(socketId)) continue;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      byUser.delete(userId);
      rooms.delete(sessionId);
      if (rooms.size === 0) bySocket.delete(socketId);
      if (byUser.size === 0) bySession.delete(sessionId);
      return { dropped: true, userId };
    }
    return { dropped: false, userId };
  }
  return null;
}

export function isOnline(sessionId: string, userId: string): boolean {
  return (bySession.get(sessionId)?.get(userId)?.size ?? 0) > 0;
}

export async function buildPresence(sessionId: string): Promise<PresenceUpdate> {
  const members = await prisma.sessionMember.findMany({
    where: { sessionId, leftAt: null },
    include: { user: true, character: true },
  });
  return {
    sessionId,
    members: members.map((m) => ({
      userId: m.userId,
      username: m.user.username,
      avatar: m.user.avatarUrl,
      role: m.role as any,
      characterId: m.characterId ?? undefined,
      characterName: m.character?.name,
      online: isOnline(sessionId, m.userId),
    })),
  };
}

/** joinRoom 后调用：把 socket 计入索引，并广播一次完整 presence 给所有人。 */
export async function attachAndBroadcast(
  io: Server,
  socket: AuthedSocket,
  sessionId: string,
): Promise<PresenceUpdate> {
  addSocket(sessionId, socket.data.user.userId, socket.id);
  const presence = await buildPresence(sessionId);
  io.to(`session:${sessionId}`).emit(SOCKET_EVENTS.PRESENCE_UPDATE, presence);
  return presence;
}

/** disconnect 时调用：清理索引，并为「该用户从此在该 session 全离线」的 session 各广播一次。 */
export async function detachAndBroadcast(io: Server, socketId: string): Promise<void> {
  const dropped = removeSocket(socketId);
  if (dropped.length === 0) return;
  // 同 socket 在多个 session 的情况少见，但稳妥起见还是 dedupe 后并发改 DB。
  const sessionIds = Array.from(new Set(dropped.map((d) => d.sessionId)));
  await Promise.all(
    sessionIds.map(async (sessionId) => {
      const presence = await buildPresence(sessionId);
      io.to(`session:${sessionId}`).emit(SOCKET_EVENTS.PRESENCE_UPDATE, presence);
    }),
  );
}

/**
 * SPA 内部从 /sessions/[id] 切走时调用：socket 不断，只是从这一个 session 的 presence 下线。
 * 并把 socket.io 的房间也退了，避免后续事件扩散到无关 session。
 */
export async function detachOneSessionAndBroadcast(
  io: Server,
  socket: AuthedSocket,
  sessionId: string,
): Promise<void> {
  const res = removeSocketFromSession(socket.id, sessionId);
  // socket.io 的房间也得退，否则同一个 socket 仍会收到该 room 的事件
  await socket.leave(`session:${sessionId}`);
  if (!res || !res.dropped) return;
  const presence = await buildPresence(sessionId);
  io.to(`session:${sessionId}`).emit(SOCKET_EVENTS.PRESENCE_UPDATE, presence);
}

/** 测试或 graceful shutdown 用：清空全部索引。 */
export function _resetForTests() {
  bySession.clear();
  bySocket.clear();
}
