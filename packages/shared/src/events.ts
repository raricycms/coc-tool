/**
 * Socket.IO 事件常量 + payload 类型。
 * 前后端共享。
 */

import type { z } from 'zod';
import type {
  OOCSendSchema,
  ICSendSchema,
  JudgmentCreateSchema,
  JudgmentRollSchema,
  HpDiceRollSchema,
  ClockControlSchema,
  LogHistoryRequestSchema,
} from './schemas';

export const SOCKET_EVENTS = {
  // 客户端 → 服务端
  OOC_SEND: 'ooc:send',
  IC_SEND: 'ic:send',
  JUDGMENT_CREATE: 'judgment:create',
  JUDGMENT_ROLL: 'judgment:roll',
  JUDGMENT_CANCEL: 'judgment:cancel',
  CLOCK_CONTROL: 'clock:control',
  HP_CHANGE: 'hp:change',
  HP_DICE_ROLL: 'hp:dice:roll',
  JOIN_SESSION: 'session:join',
  LEAVE_SESSION: 'session:leave',
  LOG_HISTORY: 'log:history',

  // 服务端 → 客户端
  OOC_MESSAGE: 'ooc:message',
  IC_MESSAGE: 'ic:message',
  JUDGMENT_CREATED: 'judgment:created',
  JUDGMENT_RESULT: 'judgment:result',
  JUDGMENT_CANCELLED: 'judgment:cancelled',
  CLOCK_STATE: 'clock:state',
  HP_CHANGED: 'hp:changed',
  HP_DICED: 'hp:diced',
  PRESENCE_UPDATE: 'presence:update',
  LOG_ENTRY: 'log:entry',
  LOG_HISTORY_RES: 'log:history:res',
  ERROR: 'error',
} as const;

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

// 事件 payload 类型（直接由 zod 推导）
export type OOCSendPayload = z.infer<typeof OOCSendSchema>;
export type ICSendPayload = z.infer<typeof ICSendSchema>;
export type JudgmentCreatePayload = z.infer<typeof JudgmentCreateSchema>;
export type JudgmentRollPayload = z.infer<typeof JudgmentRollSchema>;
export type ClockControlPayload = z.infer<typeof ClockControlSchema>;
export type LogHistoryRequestPayload = z.infer<typeof LogHistoryRequestSchema>;
export type HpDiceRollPayload = z.infer<typeof HpDiceRollSchema>;

// ── 推送给客户端的消息 ──

export interface OOCMessage {
  id: string;
  sessionId: string;
  authorId: string;
  authorUsername: string;
  authorAvatar: string | null;
  content: string;
  realTime: string;
}

export interface ICMessage {
  id: string;
  sessionId: string;
  kind: 'desc' | 'dialogue';
  authorId: string;
  authorUsername: string;
  characterId?: string;
  characterName?: string;
  content: string;
  inGameTime: string;
  inGameDate: string;
}

export interface JudgmentCreatedEvent {
  id: string;
  characterId: string;
  characterName: string;
  skillName: string;
  difficulty: string;
  bonusDice: number;
  /** @deprecated 旧字段，san check 已改用 scSuccessExpr/scFailureExpr */
  scMin?: number;
  /** @deprecated 旧字段，san check 已改用 scSuccessExpr/scFailureExpr */
  scMax?: number;
  /** SAN check 成功时的损失骰表达式（如 "1d3"） */
  scSuccessExpr?: string;
  /** SAN check 失败时的损失骰表达式（如 "1d6"） */
  scFailureExpr?: string;
  note?: string;
  createdAt: string;
}

export interface JudgmentResultEvent {
  id: string;
  characterId: string;
  rawRolls: number[];
  tens: number;
  unit: number;
  final: number;
  successLevel: 'critical' | 'extreme' | 'hard' | 'success' | 'fail' | 'fumble';
  /** SAN check：是否通过 */
  sanPassed?: boolean;
  /** SAN check：实际损失骰表达式（成功/失败对应的那个） */
  sanLossExpr?: string;
  /** SAN check：实际投出的骰子值列表 */
  sanLossRolls?: number[];
  scLoss?: number;
  rolledById: string;
  rolledAt: string;
}

export interface ClockStateEvent {
  sessionId: string;
  inGameTime: string;
  inGameDate: string;
  running: boolean;
  rate: number;
}

export interface PresenceUpdate {
  sessionId: string;
  members: Array<{
    userId: string;
    username: string;
    avatar: string | null;
    role: 'KP' | 'PL' | 'SPECTATOR';
    characterId?: string;
    characterName?: string;
    /**
     * 该用户是否当前至少有一个 socket 落在这个 session 房间内。
     * UI 用它决定绿/灰圆点；服务端保证在线集合与 DB membership 的并集里
     * 每一位都标注正确。
     */
    online: boolean;
  }>;
}

export type LogEntryType =
  | 'CHAT_OOC' | 'CHAT_IC' | 'JUDGMENT' | 'HP_CHANGE' | 'SAN_CHANGE'
  | 'MP_CHANGE' | 'SKILL_CHANGE' | 'CLOCK' | 'SYSTEM' | 'CUSTOM';

/** 聊天类日志：交给 OOC/IC 聊天面板展示 */
export const CHAT_LOG_TYPES: ReadonlySet<LogEntryType> = new Set(['CHAT_OOC', 'CHAT_IC']);

/** 非聊天类日志：日志面板（掷骰/状态变更/系统消息） */
export const NON_CHAT_LOG_TYPES: ReadonlyArray<LogEntryType> = [
  'JUDGMENT', 'HP_CHANGE', 'SAN_CHANGE', 'MP_CHANGE',
  'SKILL_CHANGE', 'CLOCK', 'SYSTEM', 'CUSTOM',
];

export function isChatLog(type: LogEntryType): boolean {
  return CHAT_LOG_TYPES.has(type);
}

export interface LogEntryPayload {
  id: string;
  type: LogEntryType;
  authorId?: string;
  characterId?: string;
  judgmentId?: string;
  payload: Record<string, unknown>;
  realTime: string;
  inGameTime?: string;
  createdAt: string;
}