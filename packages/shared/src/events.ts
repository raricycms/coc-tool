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
  ClockControlSchema,
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
  JOIN_SESSION: 'session:join',
  LOG_HISTORY: 'log:history',

  // 服务端 → 客户端
  OOC_MESSAGE: 'ooc:message',
  IC_MESSAGE: 'ic:message',
  JUDGMENT_CREATED: 'judgment:created',
  JUDGMENT_RESULT: 'judgment:result',
  JUDGMENT_CANCELLED: 'judgment:cancelled',
  CLOCK_STATE: 'clock:state',
  HP_CHANGED: 'hp:changed',
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
  scMin?: number;
  scMax?: number;
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
  }>;
}

export interface LogEntryPayload {
  id: string;
  type: 'CHAT_OOC' | 'CHAT_IC' | 'JUDGMENT' | 'HP_CHANGE' | 'SAN_CHANGE' | 'MP_CHANGE' | 'SKILL_CHANGE' | 'CLOCK' | 'SYSTEM' | 'CUSTOM';
  authorId?: string;
  characterId?: string;
  judgmentId?: string;
  payload: Record<string, unknown>;
  realTime: string;
  inGameTime?: string;
  createdAt: string;
}