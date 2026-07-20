'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from '@/lib/ws-client';
import { SOCKET_EVENTS } from '@coc-tools/shared';
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
        s.emit(SOCKET_EVENTS.LOG_HISTORY, { sessionId });
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
      s.on(SOCKET_EVENTS.LOG_ENTRY, (e: LogEntryPayload) => {
        setLogs((prev) => [...prev, e].slice(-500));
      });
      s.on(SOCKET_EVENTS.LOG_HISTORY_RES, ({ entries }: { entries: any[] }) => {
        const parsed = entries.map((e) => ({
          ...e,
          payload: typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload,
          realTime: e.realTime,
          createdAt: e.createdAt,
        }));
        setLogs(parsed);
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
            />
          )}
          {role === 'KP' && (
            <JudgmentCreator
              characters={members.filter((m) => m.character).map((m) => ({
                id: m.character!.id,
                name: m.character!.name,
                skills: m.character!.skills,
                sanCurrent: m.character!.san,
                luck: m.character!.luck,
              }))}
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

      <PresenceBar members={members} />
    </div>
  );
}