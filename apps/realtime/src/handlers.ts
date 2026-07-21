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
  HpDiceRollSchema,
  DiceRollCreateSchema,
  WeaponUpsertSchema,
  WeaponDeleteSchema,
  EquipmentUpsertSchema,
  EquipmentDeleteSchema,
  ClockControlSchema,
  LogHistoryRequestSchema,
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
  calculateSanLossFromExpr,
  resolvePrimaryStatKey,
  SUCCESS_LABELS,
  rollExpressionDetailed,
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
    s.on(SOCKET_EVENTS.LOG_HISTORY, async (raw: unknown) => {
      try {
        const { sessionId, before, types, requestId } = LogHistoryRequestSchema.parse(raw);
        // 必须是 session 成员才能拉历史
        await ensureMember(sessionId, user.userId);
        const where: any = { sessionId };
        if (before) where.createdAt = { lt: new Date(before) };
        if (types?.length) where.type = { in: types };
        const entries = await prisma.logEntry.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
        // 回传 requestId / before，让客户端把多个并发请求的响应分发到对应的调用方
        s.emit(SOCKET_EVENTS.LOG_HISTORY_RES, {
          entries: entries.reverse(),
          ...(requestId ? { requestId } : {}),
          ...(before ? { before } : {}),
        });
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
    s.on(SOCKET_EVENTS.IC_SEND, async (payload: { sessionId: string; kind: 'desc' | 'dialogue'; content: string; characterId?: string; characterName?: string }) => {
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
              characterName: data.characterName,
              // 把日期也写进 payload，避免翻历史时只剩时间
              inGameTime: clock?.inGameTime,
              inGameDate: clock?.inGameDate,
            }),
            inGameTime: clock?.inGameTime,
          },
        });
        let characterName: string | undefined = data.characterName;
        if (!characterName && data.characterId) {
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

        // 单目标 vs 群发：二选一
        let targetIds: string[];
        if (data.targetCharacterIds && data.targetCharacterIds.length > 0) {
          targetIds = data.targetCharacterIds;
        } else if (data.targetCharacterId) {
          targetIds = [data.targetCharacterId];
        } else {
          throw new Error('需要指定 targetCharacterId 或 targetCharacterIds');
        }
        // 去重 + 保持顺序
        targetIds = Array.from(new Set(targetIds));

        // SAN check 必须至少带一个骰子表达式
        if (data.skillName === 'SAN' && !data.scSuccessExpr && !data.scFailureExpr) {
          throw new Error('SAN check 必须指定成功/失败时的损失骰表达式（如 1d3 / 1d6）');
        }

        // 群发：每个角色各自取自己的技能值生成独立 Judgment
        // 一次性批量查所有目标 + 各自技能，避免 N+1
        const chars = await prisma.character.findMany({
          where: { id: { in: targetIds } },
          include: { skills: true },
        });
        if (chars.length !== targetIds.length) {
          const found = new Set(chars.map((c) => c.id));
          const missing = targetIds.filter((id) => !found.has(id));
          throw new Error(`角色不存在：${missing.join(', ')}`);
        }

        const created: JudgmentCreatedEvent[] = [];
        for (const char of chars) {
          let skillValue: number;
          if (data.skillName === 'SAN') {
            skillValue = char.sanCurrent;
          } else if (data.skillName === '幸运' || data.skillName === 'LUCK') {
            skillValue = char.luckCurrent;
          } else {
            // 优先尝试 9 个基础属性（STR/CON/SIZ/DEX/APP/INT/POW/EDU）
            const statKey = resolvePrimaryStatKey(data.skillName);
            if (statKey) {
              skillValue = (char as any)[statKey] as number;
            } else {
              const skill = char.skills.find((s) => s.name === data.skillName);
              if (!skill) throw new Error(`${char.name} 没有技能/属性：${data.skillName}`);
              skillValue = skill.value;
            }
          }

          const judgment = await prisma.judgment.create({
            data: {
              sessionId: payload.sessionId,
              characterId: char.id,
              skillName: data.skillName,
              difficulty: data.difficulty,
              bonusDice: data.bonusDice,
              scMin: null,
              scMax: null,
              scSuccessExpr: data.scSuccessExpr ?? null,
              scFailureExpr: data.scFailureExpr ?? null,
              note: data.note,
              status: 'PENDING',
              targetSnapshot: JSON.stringify({
                skillName: data.skillName,
                value: skillValue,
                hp: char.hpCurrent,
                hpMax: char.hpMax,
                san: char.sanCurrent,
                sanMax: char.sanMax,
              }),
            },
          });

          created.push({
            id: judgment.id,
            characterId: char.id,
            characterName: char.name,
            skillName: data.skillName,
            difficulty: data.difficulty,
            bonusDice: data.bonusDice,
            scSuccessExpr: data.scSuccessExpr,
            scFailureExpr: data.scFailureExpr,
            note: data.note ?? undefined,
            createdAt: judgment.createdAt.toISOString(),
          });
        }

        // 每个 Judgment 单独 emit，方便前端分别入队
        for (const evt of created) {
          io.to(`session:${payload.sessionId}`).emit(SOCKET_EVENTS.JUDGMENT_CREATED, evt);
        }
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

        // SAN check：1d100 vs currentSAN，按 KP 设的骰子表达式扣 SAN
        let scLoss: number | null = null;
        let sanPassed: boolean | null = null;
        let sanLossExpr: string | null = null;
        let sanLossRolls: number[] | null = null;
        if (judgment.skillName === 'SAN') {
          const sanResult = calculateSanLossFromExpr(
            result.final,
            snapshot.san ?? 99,
            judgment.scSuccessExpr ?? '',
            judgment.scFailureExpr ?? '',
          );
          scLoss = sanResult.loss;
          sanPassed = sanResult.passed;
          sanLossExpr = sanResult.expr;
          sanLossRolls = sanResult.rolls;
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
            sanPassed,
            sanLossExpr,
            sanLossRolls: sanLossRolls ? JSON.stringify(sanLossRolls) : null,
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
              sanPassed,
              sanLossExpr,
              sanLossRolls,
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
          // 用 Prisma decrement 在 SQL 层做"减去 scLoss，但不低于 0"，避免并发两次 SAN 扣血
          // 互相覆盖（每个 handler 都读到旧 sanCurrent → 都算出同一个 sanAfter）。
          await prisma.$executeRaw`
            UPDATE Character
            SET sanCurrent = MAX(0, sanCurrent - ${scLoss})
            WHERE id = ${judgment.characterId}
          `;
          const charAfter = await prisma.character.findUnique({
            where: { id: judgment.characterId },
          });
          if (charAfter) {
            const sanAfter = charAfter.sanCurrent;
            const lossDesc = sanLossExpr && sanLossRolls
              ? `${sanLossExpr}（投出 ${sanLossRolls.join('+')}）`
              : `${scLoss}`;
            await prisma.logEntry.create({
              data: {
                sessionId: payload.sessionId,
                type: 'SAN_CHANGE',
                characterId: charAfter.id,
                payload: JSON.stringify({
                  delta: -scLoss,
                  sanAfter,
                  sanMax: charAfter.sanMax,
                  reason: `SAN check ${sanPassed ? '成功' : '失败'}（${SUCCESS_LABELS[result.successLevel]} · ${lossDesc}）`,
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
          sanPassed: sanPassed ?? undefined,
          sanLossExpr: sanLossExpr ?? undefined,
          sanLossRolls: sanLossRolls ?? undefined,
          scLoss: scLoss ?? undefined,
          rolledById: user.userId,
          rolledAt: updated.rolledAt!.toISOString(),
        };
        io.to(`session:${payload.sessionId}`).emit(SOCKET_EVENTS.JUDGMENT_RESULT, resultEvt);
        io.to(`session:${payload.sessionId}`).emit(SOCKET_EVENTS.LOG_ENTRY, toLogEntry(logEntry));
        // SAN 扣完后同步刷新角色快照给所有人
        if (scLoss && scLoss > 0) {
          await broadcastCharacter(io, payload.sessionId, judgment.characterId);
        }
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
          const clockEntry = await prisma.logEntry.create({
            data: {
              sessionId,
              type: 'CLOCK',
              payload: JSON.stringify({ action: data, ...clock }),
            },
          });
          io.to(`session:${sessionId}`).emit(SOCKET_EVENTS.LOG_ENTRY, toLogEntry(clockEntry));
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
            payload: JSON.stringify({ delta, hpAfter, hpMax: char.hpMax, reason }),
            inGameTime: clock?.inGameTime,
          },
        });
        io.to(`session:${sessionId}`).emit(SOCKET_EVENTS.HP_CHANGED, { characterId, hpAfter });
        io.to(`session:${sessionId}`).emit(SOCKET_EVENTS.LOG_ENTRY, toLogEntry(entry));
        // 同步刷新弹窗里的 HP/SAN/MP 等
        await broadcastCharacter(io, sessionId, characterId);
      } catch (err) {
        s.emit(SOCKET_EVENTS.ERROR, { message: formatErrorMessage(err) });
      }
    });

    // ── HP dice roll (KP only) ──
    // KP 给 PL 一个 1dN（任意 N）扣 HP 骰子：服务端掷骰，把结果作为负 delta 应用。
    s.on(SOCKET_EVENTS.HP_DICE_ROLL, async (raw: { sessionId: string } & any) => {
      try {
        const member = await ensureMember(raw.sessionId, user.userId);
        if (member.role !== 'KP') throw new Error('只有 KP 可以掷扣 HP 骰子');
        const data = HpDiceRollSchema.parse(raw);
        const char = await prisma.character.findUnique({ where: { id: data.characterId } });
        if (!char) throw new Error('角色不存在');

        const roll = rollExpressionDetailed(data.diceExpr);
        // 扣血按表达式总和取负；表达式可以是治疗（恒为正），但一般 1dN 是扣血。
        const delta = -Math.abs(roll.total);
        const hpAfter = Math.max(0, Math.min(char.hpMax, char.hpCurrent + delta));
        await prisma.character.update({
          where: { id: char.id },
          data: { hpCurrent: hpAfter },
        });
        const clock = getCurrentClock(raw.sessionId);
        const entry = await prisma.logEntry.create({
          data: {
            sessionId: raw.sessionId,
            type: 'HP_CHANGE',
            characterId: char.id,
            payload: JSON.stringify({
              delta,
              hpAfter,
              hpMax: char.hpMax,
              reason: data.reason,
              // 新增：让日志显示「1d6=6」之类的明细
              diceExpr: roll.expr,
              diceRolls: roll.rolls,
              diceTotal: roll.total,
            }),
            inGameTime: clock?.inGameTime,
          },
        });
        io.to(`session:${raw.sessionId}`).emit(SOCKET_EVENTS.HP_CHANGED, { characterId: char.id, hpAfter });
        io.to(`session:${raw.sessionId}`).emit(SOCKET_EVENTS.HP_DICED, {
          characterId: char.id,
          diceExpr: roll.expr,
          diceRolls: roll.rolls,
          diceTotal: roll.total,
          hpAfter,
          reason: data.reason,
        });
        io.to(`session:${raw.sessionId}`).emit(SOCKET_EVENTS.LOG_ENTRY, toLogEntry(entry));
        // 同步刷新弹窗里 HP/SAN/MP 等
        await broadcastCharacter(io, raw.sessionId, char.id);
      } catch (err) {
        s.emit(SOCKET_EVENTS.ERROR, { message: formatErrorMessage(err) });
      }
    });

    // ── 公开掷骰 (KP only) ──
    // KP 投一个骰子，结果以 DICE_ROLL 日志推给全员；不做任何角色状态变更。
    s.on(SOCKET_EVENTS.DICE_ROLL, async (raw: { sessionId: string } & any) => {
      try {
        const member = await ensureMember(raw.sessionId, user.userId);
        if (member.role !== 'KP') throw new Error('只有 KP 可以公开掷骰');
        const data = DiceRollCreateSchema.parse(raw);

        const roll = rollExpressionDetailed(data.diceExpr);
        const clock = getCurrentClock(raw.sessionId);
        const entry = await prisma.logEntry.create({
          data: {
            sessionId: raw.sessionId,
            type: 'DICE_ROLL',
            authorId: user.userId,
            payload: JSON.stringify({
              title: data.title,
              description: data.description ?? null,
              diceExpr: roll.expr,
              diceRolls: roll.rolls,
              diceTotal: roll.total,
              rolledByUsername: user.username,
            }),
            inGameTime: clock?.inGameTime,
          },
        });
        io.to(`session:${raw.sessionId}`).emit(SOCKET_EVENTS.LOG_ENTRY, toLogEntry(entry));
      } catch (err) {
        s.emit(SOCKET_EVENTS.ERROR, { message: formatErrorMessage(err) });
      }
    });

    // ── 武器 upsert / delete (KP only) ──
    // KP 即时编辑 PL 的武器库：增 / 改 / 删；成功后广播 CHARACTER_UPDATED 给全员，
    // 附带刷新后的完整角色数据，让所有人（KP + 所有 PL）能立刻在车卡弹窗里看到新数据。
    s.on(SOCKET_EVENTS.WEAPON_UPSERT, async (raw: { sessionId: string } & any) => {
      try {
        const member = await ensureMember(raw.sessionId, user.userId);
        if (member.role !== 'KP') throw new Error('只有 KP 可以编辑武器');
        const data = WeaponUpsertSchema.parse(raw);

        // 校验 data.id 真的属于 data.characterId：避免 KP 拿别团武器 id 改别人武器
        if (data.id) {
          const existing = await prisma.weapon.findUnique({ where: { id: data.id } });
          if (!existing || existing.characterId !== data.characterId) {
            throw new Error('武器不存在或不属于该角色');
          }
          await prisma.weapon.update({
            where: { id: data.id },
            data: {
              name: data.name,
              skill: data.skill,
              damage: data.damage,
              range: data.range ?? null,
              ammo: data.ammo ?? null,
              note: data.note ?? null,
            },
          });
        } else {
          await prisma.weapon.create({
            data: {
              characterId: data.characterId,
              name: data.name,
              skill: data.skill,
              damage: data.damage,
              range: data.range ?? null,
              ammo: data.ammo ?? null,
              note: data.note ?? null,
            },
          });
        }
        await broadcastCharacter(io, raw.sessionId, data.characterId);
      } catch (err) {
        s.emit(SOCKET_EVENTS.ERROR, { message: formatErrorMessage(err) });
      }
    });

    s.on(SOCKET_EVENTS.WEAPON_DELETE, async (raw: { sessionId: string } & any) => {
      try {
        const member = await ensureMember(raw.sessionId, user.userId);
        if (member.role !== 'KP') throw new Error('只有 KP 可以删除武器');
        const data = WeaponDeleteSchema.parse(raw);
        // 校验武器归属，避免用别人武器 id 删错
        const existing = await prisma.weapon.findUnique({ where: { id: data.id } });
        if (!existing || existing.characterId !== data.characterId) {
          throw new Error('武器不存在或不属于该角色');
        }
        await prisma.weapon.delete({ where: { id: data.id } });
        await broadcastCharacter(io, raw.sessionId, data.characterId);
      } catch (err) {
        s.emit(SOCKET_EVENTS.ERROR, { message: formatErrorMessage(err) });
      }
    });

    // ── 物品 upsert / delete (KP only) ──
    s.on(SOCKET_EVENTS.EQUIPMENT_UPSERT, async (raw: { sessionId: string } & any) => {
      try {
        const member = await ensureMember(raw.sessionId, user.userId);
        if (member.role !== 'KP') throw new Error('只有 KP 可以编辑物品');
        const data = EquipmentUpsertSchema.parse(raw);

        if (data.id) {
          const existing = await prisma.equipment.findUnique({ where: { id: data.id } });
          if (!existing || existing.characterId !== data.characterId) {
            throw new Error('物品不存在或不属于该角色');
          }
          await prisma.equipment.update({
            where: { id: data.id },
            data: {
              name: data.name,
              quantity: data.quantity ?? 1,
              note: data.note ?? null,
            },
          });
        } else {
          await prisma.equipment.create({
            data: {
              characterId: data.characterId,
              name: data.name,
              quantity: data.quantity ?? 1,
              note: data.note ?? null,
            },
          });
        }
        await broadcastCharacter(io, raw.sessionId, data.characterId);
      } catch (err) {
        s.emit(SOCKET_EVENTS.ERROR, { message: formatErrorMessage(err) });
      }
    });

    s.on(SOCKET_EVENTS.EQUIPMENT_DELETE, async (raw: { sessionId: string } & any) => {
      try {
        const member = await ensureMember(raw.sessionId, user.userId);
        if (member.role !== 'KP') throw new Error('只有 KP 可以删除物品');
        const data = EquipmentDeleteSchema.parse(raw);
        const existing = await prisma.equipment.findUnique({ where: { id: data.id } });
        if (!existing || existing.characterId !== data.characterId) {
          throw new Error('物品不存在或不属于该角色');
        }
        await prisma.equipment.delete({ where: { id: data.id } });
        await broadcastCharacter(io, raw.sessionId, data.characterId);
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

  // 回灌该 session 仍未结算的判定，避免「刷新页面 / 断线重连后看不到既有判定」。
  // 注意：realtime 端只 push 给刚加入的 socket，不广播给其他成员。
  // 前端对 JUDGMENT_CREATED 做按 id 去重，所以每次重连不会重复入队。
  const pendingJudgments = await prisma.judgment.findMany({
    where: { sessionId, status: 'PENDING' },
    include: { character: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  for (const j of pendingJudgments) {
    s.emit(SOCKET_EVENTS.JUDGMENT_CREATED, {
      id: j.id,
      characterId: j.characterId,
      characterName: j.character.name,
      skillName: j.skillName,
      difficulty: j.difficulty as 'regular' | 'hard' | 'extreme',
      bonusDice: j.bonusDice,
      scSuccessExpr: j.scSuccessExpr ?? undefined,
      scFailureExpr: j.scFailureExpr ?? undefined,
      note: j.note ?? undefined,
      createdAt: j.createdAt.toISOString(),
    });
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

/**
 * 推送某个角色的最新快照到整个 session 房间；前端拿到 CHARACTER_UPDATED 后
 * 用 payload.character 直接覆盖本地缓存的 member.character，避免重复 fetch。
 */
async function broadcastCharacter(io: Server, sessionId: string, characterId: string) {
  const c = await prisma.character.findUnique({
    where: { id: characterId },
    include: { skills: true, weapons: true, equipment: true },
  });
  if (!c) return;
  io.to(`session:${sessionId}`).emit(SOCKET_EVENTS.CHARACTER_UPDATED, {
    characterId,
    character: {
      id: c.id,
      name: c.name,
      str: c.str, con: c.con, siz: c.siz, dex: c.dex,
      app: c.app, int: c.int, pow: c.pow, edu: c.edu,
      hp: c.hpCurrent, hpMax: c.hpMax,
      san: c.sanCurrent, sanMax: c.sanMax,
      mp: c.mpCurrent, mpMax: c.mpMax,
      luck: c.luckCurrent,
      damageBonus: c.damageBonus,
      background: c.background,
      skills: c.skills.map((s) => ({ name: s.name, value: s.value, isMythos: s.isMythos })),
      weapons: c.weapons.map((w) => ({
        id: w.id, name: w.name, skill: w.skill, damage: w.damage,
        range: w.range, ammo: w.ammo, note: w.note,
      })),
      equipment: c.equipment.map((e) => ({
        id: e.id, name: e.name, quantity: e.quantity, note: e.note,
      })),
    },
  });
}