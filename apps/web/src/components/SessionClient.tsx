'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from '@/lib/ws-client';
import { SOCKET_EVENTS, CHAT_LOG_TYPES, NON_CHAT_LOG_TYPES, isChatLog } from '@coc-tools/shared';
import type {
  OOCMessage, ICMessage, JudgmentCreatedEvent, JudgmentResultEvent,
  ClockStateEvent, PresenceUpdate, LogEntryPayload,
} from '@coc-tools/shared';
import { OOCPanel } from './session/OOCPanel';
import { ICPanel } from './session/ICPanel';
import { LogPanel } from './session/LogPanel';
import { ClockPanel } from './session/ClockPanel';
import { PresenceBar } from './session/PresenceBar';
import { JudgmentCreator } from './session/JudgmentCreator';
import { JudgmentQueue } from './session/JudgmentQueue';
import { HpChangePanel } from './session/HpChangePanel';
import { CharacterCardsPanel } from './session/CharacterCardsPanel';

interface Member {
  userId: string;
  username: string;
  avatar: string | null;
  role: 'KP' | 'PL' | 'SPECTATOR';
  online: boolean;
  characterId?: string;
  character?: {
    id: string; name: string;
    hp: number; hpMax: number;
    san: number; sanMax: number;
    mp: number; mpMax: number;
    luck: number;
    damageBonus: string;
    str: number; con: number; siz: number; dex: number;
    app: number; int: number; pow: number; edu: number;
    skills: Array<{ name: string; value: number; isMythos: boolean }>;
  };
}

interface Props {
  sessionId: string;
  role: 'KP' | 'PL' | 'SPECTATOR';
  currentUserId: string;
  initialClock: { inGameTime: string; inGameDate: string; running: boolean; rate: number };
  initialMembers: Member[];
}

export function SessionClient({ sessionId, role, currentUserId, initialClock, initialMembers }: Props) {
  const [connected, setConnected] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [clock, setClock] = useState(initialClock);
  const [logs, setLogs] = useState<LogEntryPayload[]>([]);
  const [oocMessages, setOocMessages] = useState<OOCMessage[]>([]);
  const [icMessages, setIcMessages] = useState<ICMessage[]>([]);
  const [pendingJudgments, setPendingJudgments] = useState<JudgmentCreatedEvent[]>([]);
  const socketRef = useRef<Awaited<ReturnType<typeof getSocket>> | null>(null);

  const me = members.find((m) => m.userId === currentUserId);

  // 让 WS 回调能读到最新的 members（用于历史回放时按 authorId 查用户名）
  const membersRef = useRef<Member[]>(members);
  useEffect(() => { membersRef.current = members; }, [members]);

  // 连接 WS
  useEffect(() => {
    let cancelled = false;
    let socket: Awaited<ReturnType<typeof getSocket>> | null = null;
    let onConnect: (() => void) | null = null;
    let onDisconnect: ((reason: string) => void) | null = null;
    let onConnectError: ((err: Error) => void) | null = null;

    getSocket().then((s) => {
      if (cancelled) {
        s.disconnect();
        return;
      }
      socket = s;
      socketRef.current = s;

      onConnect = () => {
        setConnected(true);
        setConnectError(null);
        s.emit(SOCKET_EVENTS.JOIN_SESSION, { sessionId });
        // 拉两类历史：聊天类填 OOC/IC 面板；非聊天类填日志面板
        s.emit(SOCKET_EVENTS.LOG_HISTORY, {
          sessionId,
          types: Array.from(CHAT_LOG_TYPES),
        });
        s.emit(SOCKET_EVENTS.LOG_HISTORY, {
          sessionId,
          types: NON_CHAT_LOG_TYPES as unknown as string[],
        });
      };
      onDisconnect = (reason: string) => {
        setConnected(false);
        setConnectError(`连接已断开（${reason}）`);
      };
      onConnectError = (err: Error) => {
        setConnected(false);
        setConnectError(`连接失败：${err.message}`);
        console.error('[SessionClient] connect_error:', err.message, err);
      };

      s.on('connect', onConnect);
      s.on('disconnect', onDisconnect);
      s.on('connect_error', onConnectError);
      if (s.connected) onConnect();

      s.on(SOCKET_EVENTS.OOC_MESSAGE, (m: OOCMessage) => {
        setOocMessages((prev) => [...prev, m]);
      });
      s.on(SOCKET_EVENTS.IC_MESSAGE, (m: ICMessage) => {
        setIcMessages((prev) => [...prev, m]);
      });

      // 聊天类 LOG_ENTRY 单独拆出去；非聊天类才进 logs。
      // 注：聊天面板本身已经由 OOC_MESSAGE/IC_MESSAGE 实时更新；
      // 这里是为了让历史回放时补齐缺失。
      s.on(SOCKET_EVENTS.LOG_ENTRY, (e: LogEntryPayload) => {
        if (isChatLog(e.type)) {
          if (e.type === 'CHAT_OOC') {
            const ooc: OOCMessage = {
              id: e.id, sessionId,
              authorId: e.authorId ?? '',
              authorUsername: '', // 实时事件已带 authorUsername，此处不影响
              authorAvatar: null,
              content: String((e.payload as any)?.content ?? ''),
              realTime: e.realTime,
            };
            setOocMessages((prev) => prev.some((m) => m.id === ooc.id) ? prev : [...prev, ooc]);
          } else if (e.type === 'CHAT_IC') {
            const ic: ICMessage = {
              id: e.id, sessionId,
              kind: ((e.payload as any)?.kind ?? 'dialogue') as 'desc' | 'dialogue',
              authorId: e.authorId ?? '',
              authorUsername: '',
              characterId: e.characterId,
              characterName: (e.payload as any)?.characterName,
              content: String((e.payload as any)?.content ?? ''),
              inGameTime: e.inGameTime ?? '08:00',
              inGameDate: '',
            };
            setIcMessages((prev) => prev.some((m) => m.id === ic.id) ? prev : [...prev, ic]);
          }
          return;
        }
        setLogs((prev) => [...prev, e].slice(-500));
      });

      // 历史回放：把 entries 按 type 分流
      s.on(SOCKET_EVENTS.LOG_HISTORY_RES, ({ entries }: { entries: any[] }) => {
        const parsed: LogEntryPayload[] = entries.map((e) => ({
          ...e,
          payload: typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload,
          realTime: e.realTime,
          createdAt: e.createdAt,
        }));

        // 获取当前 members 快照（基于回调里的引用）
        // 用 ref 解 timing 问题，详见下方 mapper
        const findUsername = (uid?: string) =>
          membersRef.current.find((m) => m.userId === uid)?.username ?? '';
        const findCharacterName = (cid?: string) =>
          membersRef.current.find((m) => m.character?.id === cid)?.character?.name;

        const oocHist: OOCMessage[] = [];
        const icHist: ICMessage[] = [];
        const logHist: LogEntryPayload[] = [];

        for (const e of parsed) {
          if (e.type === 'CHAT_OOC') {
            const already = (prev: OOCMessage[]) => prev.some((m) => m.id === e.id);
            const m: OOCMessage = {
              id: e.id, sessionId,
              authorId: e.authorId ?? '',
              authorUsername: findUsername(e.authorId),
              authorAvatar: null,
              content: String((e.payload as any).content ?? ''),
              realTime: e.realTime,
            };
            if (!already(oocHist)) oocHist.push(m);
          } else if (e.type === 'CHAT_IC') {
            const p = e.payload as any;
            const m: ICMessage = {
              id: e.id, sessionId,
              kind: (p.kind ?? 'dialogue') as 'desc' | 'dialogue',
              authorId: e.authorId ?? '',
              authorUsername: findUsername(e.authorId),
              characterId: e.characterId,
              characterName: findCharacterName(e.characterId),
              content: String(p.content ?? ''),
              inGameTime: e.inGameTime ?? '08:00',
              inGameDate: '', // 历史回放没有直接 inGameDate 字段，UI 一般不需要
            };
            icHist.push(m);
          } else {
            logHist.push(e);
          }
        }

        // 合并而非替换，避免 live 事件之后到达时被覆盖
        setOocMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...oocHist.filter((m) => !seen.has(m.id))];
        });
        setIcMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...icHist.filter((m) => !seen.has(m.id))];
        });
        setLogs((prev) => {
          const seen = new Set(prev.map((l) => l.id));
          return [...logHist.filter((l) => !seen.has(l.id)), ...prev].slice(-500);
        });
      });
      s.on(SOCKET_EVENTS.JUDGMENT_CREATED, (j: JudgmentCreatedEvent) => {
        setPendingJudgments((prev) => [...prev, j]);
      });
      s.on(SOCKET_EVENTS.JUDGMENT_RESULT, (j: JudgmentResultEvent) => {
        setPendingJudgments((prev) => prev.filter((p) => p.id !== j.id));
      });
      s.on(SOCKET_EVENTS.JUDGMENT_CANCELLED, ({ id }: { id: string }) => {
        setPendingJudgments((prev) => prev.filter((p) => p.id !== id));
      });
      s.on(SOCKET_EVENTS.CLOCK_STATE, (c: ClockStateEvent) => {
        setClock({ inGameTime: c.inGameTime, inGameDate: c.inGameDate, running: c.running, rate: c.rate });
      });
      s.on(SOCKET_EVENTS.PRESENCE_UPDATE, (p: PresenceUpdate) => {
        // 服务端是 online 状态的唯一来源；这里直接覆盖，character 用本地缓存填补。
        setMembers((prev) => p.members.map((m) => {
          const old = prev.find((x) => x.userId === m.userId);
          return {
            userId: m.userId,
            username: m.username,
            avatar: m.avatar,
            role: m.role,
            online: m.online,
            characterId: m.characterId,
            character: old?.character,
          };
        }));
      });
    });

    return () => {
      cancelled = true;
      if (!socket) return;
      // 离开当前 session 页面（SPA 内部路由切换 / 组件卸载）时，主动告诉服务端下线。
      // 这样会清掉自身 presence 索引并在 room 里广播；socket 不关，可供后续其它 session 复用。
      // 若是 socket 已断开/正在重连，emit 会被 socket.io 内部丢弃，无需额外兜底。
      if (socket.connected) {
        socket.emit(SOCKET_EVENTS.LEAVE_SESSION, { sessionId });
      }
      if (onConnect) socket.off('connect', onConnect);
      if (onDisconnect) socket.off('disconnect', onDisconnect as any);
      if (onConnectError) socket.off('connect_error', onConnectError);
      socket.off(SOCKET_EVENTS.OOC_MESSAGE);
      socket.off(SOCKET_EVENTS.IC_MESSAGE);
      socket.off(SOCKET_EVENTS.LOG_ENTRY);
      socket.off(SOCKET_EVENTS.LOG_HISTORY_RES);
      socket.off(SOCKET_EVENTS.JUDGMENT_CREATED);
      socket.off(SOCKET_EVENTS.JUDGMENT_RESULT);
      socket.off(SOCKET_EVENTS.JUDGMENT_CANCELLED);
      socket.off(SOCKET_EVENTS.CLOCK_STATE);
      socket.off(SOCKET_EVENTS.PRESENCE_UPDATE);
    };
  }, [sessionId]);

  const sendOOC = useCallback((content: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.OOC_SEND, { sessionId, content });
  }, [sessionId]);

  const sendIC = useCallback((kind: 'desc' | 'dialogue', content: string, characterId?: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.IC_SEND, { sessionId, kind, content, characterId });
  }, [sessionId]);

  const createJudgment = useCallback((payload: any) => {
    socketRef.current?.emit(SOCKET_EVENTS.JUDGMENT_CREATE, { sessionId, ...payload });
  }, [sessionId]);

  const rollJudgment = useCallback((judgmentId: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.JUDGMENT_ROLL, { sessionId, judgmentId });
  }, [sessionId]);

  const cancelJudgment = useCallback((judgmentId: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.JUDGMENT_CANCEL, { sessionId, judgmentId });
  }, [sessionId]);

  const controlClock = useCallback((data: any) => {
    socketRef.current?.emit(SOCKET_EVENTS.CLOCK_CONTROL, { sessionId, ...data });
  }, [sessionId]);

  const changeHp = useCallback((characterId: string, delta: number, reason: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.HP_CHANGE, { sessionId, characterId, delta, reason });
  }, [sessionId]);

  const rollHpDice = useCallback((characterId: string, diceExpr: string, reason: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.HP_DICE_ROLL, { sessionId, characterId, diceExpr, reason });
  }, [sessionId]);

  return (
    <div className="flex-1 flex flex-col">
      {!connected && (
        <div className="bg-red-500/20 border-b border-red-500 text-center text-sm py-1">
          {connectError ?? '连接已断开，正在重连…'}
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_1fr_320px] gap-2 p-2 min-h-0">
        <div className="min-h-[300px] lg:min-h-0 flex flex-col">
          <OOCPanel
            messages={oocMessages}
            onSend={sendOOC}
            canSend={true}
            currentUsername={me?.username ?? ''}
          />
        </div>

        <div className="min-h-[300px] lg:min-h-0 flex flex-col">
          <ICPanel
            messages={icMessages}
            onSend={sendIC}
            role={role}
            myCharacterId={me?.characterId}
            myCharacterName={me?.character?.name}
          />
        </div>

        <div className="flex flex-col gap-2 min-h-0">
          <ClockPanel clock={clock} role={role} onControl={controlClock} />
          {role === 'KP' && me?.character && (
            <HpChangePanel
              characters={members.filter((m) => m.character).map((m) => ({
                id: m.character!.id, name: m.character!.name,
                hp: m.character!.hp, hpMax: m.character!.hpMax,
              }))}
              onChange={changeHp}
              onDice={rollHpDice}
            />
          )}
          {role === 'KP' && (
            <JudgmentCreator
              characters={members.filter((m) => m.character).map((m) => {
                const c = m.character!;
                return {
                  id: c.id,
                  name: c.name,
                  str: c.str, con: c.con, siz: c.siz, dex: c.dex,
                  app: c.app, int: c.int, pow: c.pow, edu: c.edu,
                  skills: c.skills,
                  sanCurrent: c.san,
                  luck: c.luck,
                };
              })}
              plCharacters={members.filter((m) => m.role === 'PL' && m.character).map((m) => {
                const c = m.character!;
                return {
                  id: c.id,
                  name: c.name,
                  str: c.str, con: c.con, siz: c.siz, dex: c.dex,
                  app: c.app, int: c.int, pow: c.pow, edu: c.edu,
                  skills: c.skills,
                  sanCurrent: c.san,
                  luck: c.luck,
                };
              })}
              onCreate={createJudgment}
            />
          )}
          <JudgmentQueue
            judgments={pendingJudgments}
            role={role}
            currentUserId={currentUserId}
            members={members}
            onRoll={rollJudgment}
            onCancel={cancelJudgment}
          />
          <LogPanel logs={logs} members={members} />
        </div>
      </div>

      <CharacterCardsPanel members={members} />

      <PresenceBar members={members} />
    </div>
  );
}