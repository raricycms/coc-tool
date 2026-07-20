/**
 * 跑团大厅 Socket.IO 事件处理。
 */

import type { Server, Socket } from 'socket.io';
import { prisma } from '@coc-tools/db';
import {
  OOCSendSchema,
  ICSendSchema,
  JudgmentCreateSchema,
  JudgmentRollSchema,
  ClockControlSchema,
  SOCKET_EVENTS,
  formatZodError,
  type OOCMessage,
  type ICMessage,
  type JudgmentCreatedEvent,
  type JudgmentResultEvent,
  type ClockStateEvent,
  type LogEntryPayload,
} from '@coc-tools/shared';
import { ZodError } from 'zod';
import {
  judge as runJudgment,
  calculateSanLoss,
  SUCCESS_LABELS,
} from '@coc-tools/coc-rules';
import {
  initRuntime,
  startClock,
  pauseClock,
  setRate,
  setTime,
  addTime,
  getCurrentClock,
  setClockUpdateHandler,
} from './state.js';
import { attachAndBroadcast, detachAndBroadcast, detachOneSessionAndBroadcast } from './presence.js';
import type { AuthedSocket } from './auth.js';

/** 把抛出的错误翻译成中文消息，Zod 错误走专用格式化。 */
function formatErrorMessage(err: unknown): string {
  if (err instanceof ZodError) return formatZodError(err);
  return err instanceof Error ? err.message : String(err);
}

export async function registerHandlers(io: Server) {
  // 时钟 tick 推送给所有客户端
  setClockUpdateHandler(async (r) => {
    const clock = getCurrentClock(r.sessionId);
    if (!clock) return;
    io.to(`session:${r.sessionId}`).emit(SOCKET_EVENTS.CLOCK_STATE, {
      sessionId: r.sessionId,
      ...clock,
    } satisfies ClockStateEvent);
  });

  io.on('connection', async (socket: Socket) => {
    const s = socket as AuthedSocket;
    const user = s.data.user;
    if (!user) {
      s.disconnect(true);
      return;
    }

    // ── joinRoom ──
    s.on(SOCKET_EVENTS.JOIN_SESSION, async ({ sessionId }: { sessionId: string }) => {
      try {
        await joinRoom(io, s, sessionId);
      } catch (err) {
        s.emit(SOCKET_EVENTS.ERROR, { message: formatErrorMessage(err) });
      }
    });

    // ── leaveRoom ──
    // SPA 内部从 /sessions/[id] 跳到别处时让客户端主动发：socket 不断，
    // 但从这一 session 的 presence 下线，并且从 socket.io 的 room 里也退出，
    // 避免之后别的事件扩散过来。disconnect 时由 disconnect 处理器兜底。
    s.on(SOCKET_EVENTS.LEAVE_SESSION, async ({ sessionId }: { sessionId: string }) => {
      try {
        await detachOneSessionAndBroadcast(io, s, sessionId);
      } catch (err) {
        s.emit(SOCKET_EVENTS.ERROR, { message: formatErrorMessage(err) });
      }
    });

    // ── log history ──
    s.on(SOCKET_EVENTS.LOG_HISTORY, async ({ sessionId, before }: { sessionId: string; before?: string }) => {
      try {
        const where: any = { sessionId };
        if (before) where.createdAt = { lt: new Date(before) };
        const entries = await prisma.logEntry.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
        s.emit(SOCKET_EVENTS.LOG_HISTORY_RES, { entries: entries.reverse() });
      } catch (err) {
        s.emit(SOCKET_EVENTS.ERROR, { message: formatErrorMessage(err) });
      }
    });

    // ── OOC send ──
    s.on(SOCKET_EVENTS.OOC_SEND, async ({ sessionId, content }: { sessionId: string; content: string }) => {
      try {
        const data = OOCSendSchema.parse({ content });
        const member = await ensureMember(sessionId, user.userId);
        const entry = await prisma.logEntry.create({
          data: {
            sessionId,
            type: 'CHAT_OOC',
            authorId: user.userId,
            payload: JSON.stringify({ content: data.content }),
          },
        });
        const msg: OOCMessage = {
          id: entry.id,
          sessionId,
          authorId: user.userId,
          authorUsername: user.username,
          authorAvatar: null,
          content: data.content,
          realTime: entry.realTime.toISOString(),
        };
        io.to(`session:${sessionId}`).emit(SOCKET_EVENTS.OOC_MESSAGE, msg);
        io.to(`session:${sessionId}`).emit(SOCKET_EVENTS.LOG_ENTRY, toLogEntry(entry));
      } catch (err) {
        s.emit(SOCKET_EVENTS.ERROR, { message: formatErrorMessage(err) });
      }
    });

    // ── IC send ──
    s.on(SOCKET_EVENTS.IC_SEND, async (payload: { sessionId: string; kind: 'desc' | 'dialogue'; content: string; characterId?: string }) => {
      try {
        const data = ICSendSchema.parse(payload);
        const member = await ensureMember(payload.sessionId, user.userId);
        if (data.kind === 'desc' && member.role !== 'KP') {
          throw new Error('只有 KP 可以发描述');
        }
        // 取当前游戏时间
        const clock = getCurrentClock(payload.sessionId);
        const entry = await prisma.logEntry.create({
          data: {
            sessionId: payload.sessionId,
            type: 'CHAT_IC',
            authorId: user.userId,
            characterId: data.characterId,
            payload: JSON.stringify({
              kind: data.kind,
              content: data.content,
              characterId: data.characterId,
            }),
            inGameTime: clock?.inGameTime,
          },
        });
        let characterName: string | undefined;
        if (data.characterId) {
          const c = await prisma.character.findUnique({ where: { id: data.characterId } });
          characterName = c?.name;
        }
        const msg: ICMessage = {
          id: entry.id,
          sessionId: payload.sessionId,
          kind: data.kind,
          authorId: user.userId,
          authorUsername: user.username,
          characterId: data.characterId,
          characterName,
          content: data.content,
          inGameTime: clock?.inGameTime ?? '08:00',
          inGameDate: clock?.inGameDate ?? '1/1',
        };
        io.to(`session:${payload.sessionId}`).emit(SOCKET_EVENTS.IC_MESSAGE, msg);
        io.to(`session:${payload.sessionId}`).emit(SOCKET_EVENTS.LOG_ENTRY, toLogEntry(entry));
      } catch (err) {
        s.emit(SOCKET_EVENTS.ERROR, { message: formatErrorMessage(err) });
      }
    });

    // ── judgment create ──
    s.on(SOCKET_EVENTS.JUDGMENT_CREATE, async (payload: { sessionId: string } & any) => {
      try {
        const member = await ensureMember(payload.sessionId, user.userId);
        if (member.role !== 'KP') throw new Error('只有 KP 可以发布判定');

        const data = JudgmentCreateSchema.parse(payload);

        // 取该 PC 当前技能快照
        const char = await prisma.character.findUnique({
          where: { id: data.targetCharacterId },
          include: { skills: true },
        });
        if (!char) throw new Error('角色不存在');

        let skillValue: number;
        if (data.skillName === 'SAN') skillValue = char.sanCurrent;
        else if (data.skillName === '幸运' || data.skillName === 'LUCK') skillValue = char.luckCurrent;
        else {
          const skill = char.skills.find((s) => s.name === data.skillName);
          if (!skill) throw new Error(`角色没有技能：${data.skillName}`);
          skillValue = skill.value;
        }

        const judgment = await prisma.judgment.create({
          data: {
            sessionId: payload.sessionId,
            characterId: data.targetCharacterId,
            skillName: data.skillName,
            difficulty: data.difficulty,
            bonusDice: data.bonusDice,
            scMin: data.scMin,
            scMax: data.scMax,
            note: data.note,
            status: 'PENDING',
            targetSnapshot: JSON.stringify({ skillName: data.skillName, value: skillValue, hp: char.hpCurrent, san: char.sanCurrent }),
          },
        });

        const evt: JudgmentCreatedEvent = {
          id: judgment.id,
          characterId: data.targetCharacterId,
          characterName: char.name,
          skillName: data.skillName,
          difficulty: data.difficulty,
          bonusDice: data.bonusDice,
          scMin: data.scMin,
          scMax: data.scMax,
          note: data.note ?? undefined,
          createdAt: judgment.createdAt.toISOString(),
        };
        io.to(`session:${payload.sessionId}`).emit(SOCKET_EVENTS.JUDGMENT_CREATED, evt);
      } catch (err) {
        s.emit(SOCKET_EVENTS.ERROR, { message: formatErrorMessage(err) });
      }
    });

    // ── judgment roll ──
    s.on(SOCKET_EVENTS.JUDGMENT_ROLL, async (payload: { sessionId: string; judgmentId: string }) => {
      try {
        const data = JudgmentRollSchema.parse(payload);
        const member = await ensureMember(payload.sessionId, user.userId);

        const judgment = await prisma.judgment.findUnique({
          where: { id: data.judgmentId },
          include: { character: { select: { ownerId: true } } },
        });
        if (!judgment) throw new Error('判定不存在');
        if (judgment.status !== 'PENDING') throw new Error('该判定已结算');
        if (judgment.character.ownerId !== user.userId && member.role !== 'KP') {
          throw new Error('只有被判定角色的所有者或 KP 可以投骰');
        }

        // 取目标快照
        const snapshot = JSON.parse(judgment.targetSnapshot ?? '{}');
        const skillValue: number = snapshot.value;

        // 判定
        const result = runJudgment({
          skillValue,
          difficulty: (judgment.difficulty as any) ?? 'regular',
          bonusDice: judgment.bonusDice,
        });

        let scLoss: number | null = null;
        if (judgment.skillName === 'SAN' && judgment.scMin != null && judgment.scMax != null) {
          scLoss = calculateSanLoss(
            result.successLevel,
            judgment.scMin,
            judgment.scMax,
            snapshot.san ?? 99,
          );
        }

        // 更新
        const updated = await prisma.judgment.update({
          where: { id: judgment.id },
          data: {
            status: 'RESOLVED',
            diceRolls: JSON.stringify(result.rawRolls),
            tens: result.tens,
            unit: result.unit,
            successLevel: result.successLevel,
            scLoss,
            rolledById: user.userId,
            rolledAt: new Date(),
          },
        });

        // 写日志（判定）
        const clock = getCurrentClock(payload.sessionId);
        const logEntry = await prisma.logEntry.create({
          data: {
            sessionId: payload.sessionId,
            type: 'JUDGMENT',
            judgmentId: judgment.id,
            characterId: judgment.characterId,
            payload: JSON.stringify({
              skillName: judgment.skillName,
              difficulty: judgment.difficulty,
              bonusDice: judgment.bonusDice,
              rawRolls: result.rawRolls,
              tens: result.tens,
              unit: result.unit,
              final: result.final,
              successLevel: result.successLevel,
              successLabel: SUCCESS_LABELS[result.successLevel],
              scLoss,
              targetSnapshot: snapshot,
            }),
            inGameTime: clock?.inGameTime,
          },
        });

        // 关联 judgment.log
        await prisma.judgment.update({
          where: { id: judgment.id },
          data: { log: { connect: { id: logEntry.id } } },
        });

        // 若有 SAN 损失，更新角色并写 SAN_CHANGE 日志
        if (scLoss && scLoss > 0) {
          const char = await prisma.character.findUnique({ where: { id: judgment.characterId } });
          if (char) {
            await prisma.character.update({
              where: { id: char.id },
              data: { sanCurrent: Math.max(0, char.sanCurrent - scLoss) },
            });
            await prisma.logEntry.create({
              data: {
                sessionId: payload.sessionId,
                type: 'SAN_CHANGE',
                characterId: char.id,
                payload: JSON.stringify({
                  delta: -scLoss,
                  sanAfter: Math.max(0, char.sanCurrent - scLoss),
                  reason: `SAN check 失败（${SUCCESS_LABELS[result.successLevel]}）`,
                }),
                inGameTime: clock?.inGameTime,
              },
            });
          }
        }

        const resultEvt: JudgmentResultEvent = {
          id: judgment.id,
          characterId: judgment.characterId,
          rawRolls: result.rawRolls,
          tens: result.tens,
          unit: result.unit,
          final: result.final,
          successLevel: result.successLevel,
          scLoss: scLoss ?? undefined,
          rolledById: user.userId,
          rolledAt: updated.rolledAt!.toISOString(),
        };
        io.to(`session:${payload.sessionId}`).emit(SOCKET_EVENTS.JUDGMENT_RESULT, resultEvt);
        io.to(`session:${payload.sessionId}`).emit(SOCKET_EVENTS.LOG_ENTRY, toLogEntry(logEntry));
      } catch (err) {
        s.emit(SOCKET_EVENTS.ERROR, { message: formatErrorMessage(err) });
      }
    });

    // ── judgment cancel ──
    s.on(SOCKET_EVENTS.JUDGMENT_CANCEL, async ({ sessionId, judgmentId }: { sessionId: string; judgmentId: string }) => {
      try {
        const member = await ensureMember(sessionId, user.userId);
        if (member.role !== 'KP') throw new Error('只有 KP 可以取消判定');
        await prisma.judgment.update({
          where: { id: judgmentId },
          data: { status: 'CANCELLED' },
        });
        io.to(`session:${sessionId}`).emit(SOCKET_EVENTS.JUDGMENT_CANCELLED, { id: judgmentId });
      } catch (err) {
        s.emit(SOCKET_EVENTS.ERROR, { message: formatErrorMessage(err) });
      }
    });

    // ── clock control ──
    s.on(SOCKET_EVENTS.CLOCK_CONTROL, async (payload: { sessionId: string } & any) => {
      try {
        const member = await ensureMember(payload.sessionId, user.userId);
        if (member.role !== 'KP') throw new Error('只有 KP 可以控制时钟');

        await initRuntime(payload.sessionId);
        const { sessionId, ...actionData } = payload;
        const data = ClockControlSchema.parse(actionData);

        switch (data.action) {
          case 'start':   startClock(sessionId); break;
          case 'pause':   pauseClock(sessionId); break;
          case 'setRate': setRate(sessionId, data.rate); break;
          case 'setTime': setTime(sessionId, data.inGameTime, data.inGameDate); break;
          case 'addTime': addTime(sessionId, data.deltaMinutes); break;
        }

        const clock = getCurrentClock(sessionId);
        if (clock) {
          io.to(`session:${sessionId}`).emit(SOCKET_EVENTS.CLOCK_STATE, {
            sessionId,
            ...clock,
          });
          // 写 CLOCK 日志
          await prisma.logEntry.create({
            data: {
              sessionId,
              type: 'CLOCK',
              payload: JSON.stringify({ action: data, ...clock }),
            },
          });
        }
      } catch (err) {
        s.emit(SOCKET_EVENTS.ERROR, { message: formatErrorMessage(err) });
      }
    });

    // ── HP change (KP only) ──
    s.on(SOCKET_EVENTS.HP_CHANGE, async ({ sessionId, characterId, delta, reason }: any) => {
      try {
        const member = await ensureMember(sessionId, user.userId);
        if (member.role !== 'KP') throw new Error('只有 KP 可以修改 HP');
        const char = await prisma.character.findUnique({ where: { id: characterId } });
        if (!char) throw new Error('角色不存在');
        const hpAfter = Math.max(0, Math.min(char.hpMax, char.hpCurrent + delta));
        await prisma.character.update({
          where: { id: characterId },
          data: { hpCurrent: hpAfter },
        });
        const clock = getCurrentClock(sessionId);
        const entry = await prisma.logEntry.create({
          data: {
            sessionId,
            type: 'HP_CHANGE',
            characterId,
            payload: JSON.stringify({ delta, hpAfter, reason }),
            inGameTime: clock?.inGameTime,
          },
        });
        io.to(`session:${sessionId}`).emit(SOCKET_EVENTS.HP_CHANGED, { characterId, hpAfter });
        io.to(`session:${sessionId}`).emit(SOCKET_EVENTS.LOG_ENTRY, toLogEntry(entry));
      } catch (err) {
        s.emit(SOCKET_EVENTS.ERROR, { message: formatErrorMessage(err) });
      }
    });

    // ── disconnect ──
    s.on('disconnect', () => {
      // 清理 presence 索引；并为「该用户从此在该 session 全离线」的 session 广播一次完整 presence。
      // leaveAt 仍由业务层显式调用（不再扩展这里，避免误把「网络抖动」当成「退出 session」）。
      detachAndBroadcast(io, s.id).catch((err) => {
        console.error('[realtime] detachAndBroadcast failed:', err);
      });
    });
  });
}

// ──── 辅助函数 ────

async function joinRoom(io: Server, s: AuthedSocket, sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      members: { include: { user: true, character: true } },
    },
  });
  if (!session) throw new Error('Session 不存在');

  let member = session.members.find((m) => m.userId === s.data.user.userId);
  if (!member) {
    // 自动成为 SPECTATOR
    member = await prisma.sessionMember.create({
      data: {
        sessionId,
        userId: s.data.user.userId,
        role: 'SPECTATOR',
      },
      include: { user: true, character: true },
    });
  }

  await initRuntime(sessionId);
  s.join(`session:${sessionId}`);

  // 注册到 presence 索引并广播一次完整在线名单（带 online 字段）
  await attachAndBroadcast(io, s, sessionId);

  // 推送当前时钟
  const clock = getCurrentClock(sessionId);
  if (clock) {
    s.emit(SOCKET_EVENTS.CLOCK_STATE, { sessionId, ...clock });
  }
}

async function ensureMember(sessionId: string, userId: string) {
  const m = await prisma.sessionMember.findUnique({ where: { sessionId_userId: { sessionId, userId } } });
  if (!m) throw new Error('你不在此 Session 中');
  if (m.leftAt) throw new Error('你已离开此 Session');
  return m;
}

function toLogEntry(entry: any): LogEntryPayload {
  return {
    id: entry.id,
    type: entry.type,
    authorId: entry.authorId ?? undefined,
    characterId: entry.characterId ?? undefined,
    judgmentId: entry.judgmentId ?? undefined,
    payload: safeParseJson(entry.payload),
    realTime: entry.realTime.toISOString(),
    inGameTime: entry.inGameTime ?? undefined,
    createdAt: entry.createdAt.toISOString(),
  };
}

function safeParseJson(s: any): Record<string, unknown> {
  if (typeof s !== 'string') return s as any;
  try { return JSON.parse(s); } catch { return {}; }
}