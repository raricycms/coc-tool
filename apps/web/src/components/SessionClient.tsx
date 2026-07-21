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
import { DiceRoller } from './session/DiceRoller';
import { CharacterCardsPanel } from './session/CharacterCardsPanel';
import { CharacterDetailModal, type CharacterDetail } from './session/CharacterDetailModal';

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
    background?: string | null;
    skills: Array<{ name: string; value: number; isMythos: boolean }>;
    weapons: Array<{ id: string; name: string; skill: string; damage: string; range?: string | null; ammo?: number | null; note?: string | null }>;
    equipment: Array<{ id: string; name: string; quantity: number; note?: string | null }>;
  };
}

interface Props {
  sessionId: string;
  role: 'KP' | 'PL' | 'SPECTATOR';
  currentUserId: string;
  initialClock: { inGameTime: string; inGameDate: string; running: boolean; rate: number };
  initialMembers: Member[];
}

/**
 * 历史拉取通道。
 *
 * 历史通道按「realtime 一次请求的 types」划分，而不是按渲染面板划分：
 *  - 'chat'  一次请求 types=CHAT_LOG_TYPES，返回的 entry 既要灌给 OOCPanel
 *           也要灌给 ICPanel（listner 内按 type 分流，避免重复请求）。
 *  - 'logs'  一次请求 types=NON_CHAT_LOG_TYPES，只给 LogPanel。
 *
 * 每个通道独立维护：hasMore / loading / error / cursor / prependSignal。
 */
type HistoryChannel = 'chat' | 'logs';

interface ChannelState {
  /** false：还没收到首屏响应；用于在面板顶部渲染「正在加载历史…」状态。 */
  initialized: boolean;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  /** 已加载的最早一条的 createdAt；下次翻页 cursor。 */
  cursor: string | null;
  /** 父组件递增 → useStickyScroll 收到信号 → 下次 messages 变化时按 prepend 处理。 */
  prependSignal: number;
}

const HISTORY_PAGE_LIMIT = 100; // 必须与 realtime 端 take: 100 保持一致

function newChannelState(): ChannelState {
  return {
    initialized: false,
    hasMore: true,
    loading: false,
    error: null,
    cursor: null,
    prependSignal: 0,
  };
}

/** 按 id 去重并把 newItems prepend 到 prev 之前；newItems 必须按 createdAt 升序。 */
function prependUnique<T extends { id: string }>(prev: T[], newItems: T[]): T[] {
  const seen = new Set(prev.map((m) => m.id));
  const filtered = newItems.filter((m) => !seen.has(m.id));
  return [...filtered, ...prev];
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
  const [inspectingCharacterId, setInspectingCharacterId] = useState<string | null>(null);
  const socketRef = useRef<Awaited<ReturnType<typeof getSocket>> | null>(null);

  const me = members.find((m) => m.userId === currentUserId);

  const membersRef = useRef<Member[]>(members);
  useEffect(() => { membersRef.current = members; }, [members]);

  // 各通道历史状态。重新挂载 / 切 session 时整体重置。
  const [history, setHistory] = useState<Record<HistoryChannel, ChannelState>>(() => ({
    chat: newChannelState(),
    logs: newChannelState(),
  }));

  // requestId → 通道；server 端会把 requestId 原样回带，listener 据此分发。
  // 不放在 state：高频更新不应触发 re-render。
  const pendingHistoryRef = useRef<Map<string, HistoryChannel>>(new Map());

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
        // 首屏拉取：chat / logs 各发一份（每份最多 100 条，server take 硬上限）。
        fetchHistory(s, 'chat');
        fetchHistory(s, 'logs');
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

      s.on(SOCKET_EVENTS.OOC_MESSAGE, (m: OOCMessage) => setOocMessages((prev) => [...prev, m]));
      s.on(SOCKET_EVENTS.IC_MESSAGE, (m: ICMessage) => setIcMessages((prev) => [...prev, m]));

      s.on(SOCKET_EVENTS.LOG_ENTRY, (e: LogEntryPayload) => {
        if (isChatLog(e.type)) {
          if (e.type === 'CHAT_OOC') {
            const ooc: OOCMessage = {
              id: e.id, sessionId,
              authorId: e.authorId ?? '',
              authorUsername: '',
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
              inGameTime: (e.payload as any)?.inGameTime ?? e.inGameTime ?? '08:00',
              inGameDate: (e.payload as any)?.inGameDate ?? '1/1',
            };
            setIcMessages((prev) => prev.some((m) => m.id === ic.id) ? prev : [...prev, ic]);
          }
          return;
        }
        setLogs((prev) => [...prev, e].slice(-500));
      });

      s.on(SOCKET_EVENTS.LOG_HISTORY_RES, (res: { entries: any[]; requestId?: string }) => {
        const parsed: LogEntryPayload[] = (res.entries ?? []).map((e) => ({
          ...e,
          payload: typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload,
          realTime: e.realTime,
          createdAt: e.createdAt,
        }));

        // 优先按 requestId 分发到对应通道（首屏 + 翻页都走这里）。
        const channel = res.requestId ? pendingHistoryRef.current.get(res.requestId) : undefined;
        if (channel) {
          pendingHistoryRef.current.delete(res.requestId!);
          ingestHistoryPage(channel, parsed);
          return;
        }

        // 兜底：没有 requestId（极少见，理论上不应发生，因为现在所有请求都带 requestId）。
        // 行为对齐旧版：把 chat 类灌到 OOC/IC，其余灌到 logs，按首次初始化。
        const oocHist: OOCMessage[] = [];
        const icHist: ICMessage[] = [];
        const logHist: LogEntryPayload[] = [];
        const findUsername = (uid?: string) => membersRef.current.find((m) => m.userId === uid)?.username ?? '';
        const findCharacterName = (cid?: string) => membersRef.current.find((m) => m.character?.id === cid)?.character?.name;
        for (const e of parsed) {
          if (e.type === 'CHAT_OOC') {
            oocHist.push({
              id: e.id, sessionId,
              authorId: e.authorId ?? '',
              authorUsername: findUsername(e.authorId),
              authorAvatar: null,
              content: String((e.payload as any).content ?? ''),
              realTime: e.realTime,
            });
          } else if (e.type === 'CHAT_IC') {
            const p = e.payload as any;
            icHist.push({
              id: e.id, sessionId,
              kind: (p.kind ?? 'dialogue') as 'desc' | 'dialogue',
              authorId: e.authorId ?? '',
              authorUsername: findUsername(e.authorId),
              characterId: e.characterId,
              characterName: findCharacterName(e.characterId),
              content: String(p.content ?? ''),
              inGameTime: e.inGameTime ?? '08:00',
              inGameDate: '',
            });
          } else {
            logHist.push(e);
          }
        }
        setOocMessages((prev) => [...prev, ...oocHist]);
        setIcMessages((prev) => [...prev, ...icHist]);
        setLogs((prev) => [...logHist, ...prev].slice(-500));
      });

      s.on(SOCKET_EVENTS.JUDGMENT_CREATED, (j: JudgmentCreatedEvent) => {
        // realtime 在 session 加入时会把 DB 里所有 PENDING judgments 回灌一次，
        // 用 id 去重避免重连/刷新页面后重复入队。
        setPendingJudgments((prev) => prev.some((p) => p.id === j.id) ? prev : [...prev, j]);
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

      s.on(SOCKET_EVENTS.CHARACTER_UPDATED, ({ characterId, character }: { characterId: string; character?: any }) => {
        if (!character) return;
        setMembers((prev) => prev.map((m) => (
          m.character?.id === characterId ? { ...m, character } : m
        )));
      });
    });

    return () => {
      cancelled = true;
      pendingHistoryRef.current.clear();
      // 把两个通道的 loading 重置，避免断线时遗留 spinner。
      setHistory((h) => ({
        chat: { ...h.chat, loading: false },
        logs: { ...h.logs, loading: false },
      }));
      if (!socket) return;
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
      socket.off(SOCKET_EVENTS.CHARACTER_UPDATED);
    };
  }, [sessionId]);

  /**
   * 发起一次历史拉取。channels 各自 register 一个 requestId，server 回带后分发。
   * 必须先 append 到 pendingHistoryRef 再 emit；emit 同步进入 server queue，
   * server 端 handler 完成后 emit 回 res，listener 解出 channel → ingest。
   */
  function fetchHistory(socket: Awaited<ReturnType<typeof getSocket>>, channel: HistoryChannel, before?: string) {
    const types = channel === 'chat' ? Array.from(CHAT_LOG_TYPES) : (NON_CHAT_LOG_TYPES as unknown as string[]);
    const requestId = `${channel}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pendingHistoryRef.current.set(requestId, channel);
    setHistory((h) => ({
      ...h,
      [channel]: { ...h[channel], loading: true, error: null },
    }));
    socket.emit(SOCKET_EVENTS.LOG_HISTORY, { sessionId, types, before, requestId });
  }

  /**
   * 处理一次历史响应：分流到对应通道的状态 + 渲染数据。
   * 每次响应后递增 prependSignal，panel 内的 useStickyScroll 据此保持 scrollTop。
   */
  function ingestHistoryPage(channel: HistoryChannel, parsed: LogEntryPayload[]) {
    const findUsername = (uid?: string) => membersRef.current.find((m) => m.userId === uid)?.username ?? '';
    const findCharacterName = (cid?: string) => membersRef.current.find((m) => m.character?.id === cid)?.character?.name;

    if (channel === 'chat') {
      const oocNew: OOCMessage[] = [];
      const icNew: ICMessage[] = [];
      for (const e of parsed) {
        if (e.type === 'CHAT_OOC') {
          oocNew.push({
            id: e.id, sessionId,
            authorId: e.authorId ?? '',
            authorUsername: findUsername(e.authorId),
            authorAvatar: null,
            content: String((e.payload as any).content ?? ''),
            realTime: e.realTime,
          });
        } else if (e.type === 'CHAT_IC') {
          const p = e.payload as any;
          icNew.push({
            id: e.id, sessionId,
            kind: (p.kind ?? 'dialogue') as 'desc' | 'dialogue',
            authorId: e.authorId ?? '',
            authorUsername: findUsername(e.authorId),
            characterId: e.characterId,
            characterName: findCharacterName(e.characterId),
            content: String(p.content ?? ''),
            inGameTime: p.inGameTime ?? e.inGameTime ?? '08:00',
            inGameDate: p.inGameDate ?? '1/1',
          });
        }
      }
      setOocMessages((prev) => prependUnique(prev, oocNew));
      setIcMessages((prev) => prependUnique(prev, icNew));
    } else {
      setLogs((prev) => prependUnique(prev, parsed).slice(-500));
    }

    // 更新通道状态：cursor / hasMore / prependSignal
    const oldest = parsed[0]?.createdAt;
    setHistory((h) => {
      const cur = h[channel];
      return {
        ...h,
        [channel]: {
          ...cur,
          initialized: true,
          loading: false,
          error: null,
          // 返回条数 < take 上限 → 已是最后一页。
          hasMore: parsed.length >= HISTORY_PAGE_LIMIT,
          cursor: oldest ?? cur.cursor,
          prependSignal: cur.prependSignal + 1,
        },
      };
    });
  }

  const loadMoreOOC = useCallback(() => {
    const s = socketRef.current;
    if (!s) return;
    const cur = history.chat;
    if (cur.loading || !cur.hasMore || !cur.initialized) return;
    fetchHistory(s, 'chat', cur.cursor ?? undefined);
  }, [history.chat]);

  const loadMoreLogs = useCallback(() => {
    const s = socketRef.current;
    if (!s) return;
    const cur = history.logs;
    if (cur.loading || !cur.hasMore || !cur.initialized) return;
    fetchHistory(s, 'logs', cur.cursor ?? undefined);
  }, [history.logs]);

  // IC 与 OOC 共用 'chat' 通道（一次请求按 type 分流给两侧）。
  const loadMoreIC = loadMoreOOC;

  const sendOOC = useCallback((content: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.OOC_SEND, { sessionId, content });
  }, [sessionId]);

  const sendIC = useCallback((kind: 'desc' | 'dialogue', content: string, characterId?: string, characterName?: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.IC_SEND, { sessionId, kind, content, characterId, characterName });
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

  const rollDice = useCallback((title: string, description: string | undefined, diceExpr: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.DICE_ROLL, { sessionId, title, description, diceExpr });
  }, [sessionId]);

  const weaponUpsert = useCallback((payload: {
    characterId: string; id?: string; name: string; skill: string;
    damage: string; range?: string; ammo?: number; note?: string;
  }) => {
    socketRef.current?.emit(SOCKET_EVENTS.WEAPON_UPSERT, { sessionId, ...payload });
  }, [sessionId]);

  const weaponDelete = useCallback((characterId: string, id: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.WEAPON_DELETE, { sessionId, characterId, id });
  }, [sessionId]);

  const equipmentUpsert = useCallback((payload: {
    characterId: string; id?: string; name: string; quantity: number; note?: string;
  }) => {
    socketRef.current?.emit(SOCKET_EVENTS.EQUIPMENT_UPSERT, { sessionId, ...payload });
  }, [sessionId]);

  const equipmentDelete = useCallback((characterId: string, id: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.EQUIPMENT_DELETE, { sessionId, characterId, id });
  }, [sessionId]);

  const inspected = inspectingCharacterId
    ? members.find((m) => m.character?.id === inspectingCharacterId)?.character ?? null
    : null;
  const inspectedOwner = inspectingCharacterId
    ? members.find((m) => m.character?.id === inspectingCharacterId)
    : null;

  useEffect(() => {
    if (!inspectingCharacterId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInspectingCharacterId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspectingCharacterId]);

  const oocHistoryProps = {
    initialized: history.chat.initialized,
    hasMore: history.chat.hasMore,
    loading: history.chat.loading,
    error: history.chat.error,
    onLoadMore: loadMoreOOC,
  };
  const icHistoryProps = {
    initialized: history.chat.initialized,
    hasMore: history.chat.hasMore,
    loading: history.chat.loading,
    error: history.chat.error,
    onLoadMore: loadMoreIC,
  };
  const logsHistoryProps = {
    initialized: history.logs.initialized,
    hasMore: history.logs.hasMore,
    loading: history.logs.loading,
    error: history.logs.error,
    onLoadMore: loadMoreLogs,
  };

  return (
    <div className="flex flex-1 flex-col">
      {!connected && (
        <div className="border-b border-warn bg-warn/15 px-4 py-2 text-center text-sm text-warn">
          {connectError ?? '连接已断开，正在重连…'}
        </div>
      )}

      <div className="mx-auto grid w-full max-w-7xl min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-[1fr_1fr_22rem]">
        <div className="flex min-h-[20rem] flex-col lg:min-h-0">
          <ICPanel
            messages={icMessages}
            onSend={sendIC}
            role={role}
            myCharacterId={me?.characterId}
            myCharacterName={me?.character?.name}
            history={icHistoryProps}
            prependSignal={history.chat.prependSignal}
          />
        </div>

        <div className="flex min-h-[20rem] flex-col lg:min-h-0">
          <OOCPanel
            messages={oocMessages}
            onSend={sendOOC}
            canSend={true}
            currentUsername={me?.username ?? ''}
            history={oocHistoryProps}
            prependSignal={history.chat.prependSignal}
          />
        </div>

        <div className="flex min-h-[20rem] flex-col gap-3 overflow-hidden lg:min-h-0">
          <ClockPanel clock={clock} role={role} onControl={controlClock} />
          {role === 'KP' && (
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
                  id: c.id, name: c.name,
                  str: c.str, con: c.con, siz: c.siz, dex: c.dex,
                  app: c.app, int: c.int, pow: c.pow, edu: c.edu,
                  skills: c.skills, sanCurrent: c.san, luck: c.luck,
                };
              })}
              plCharacters={members.filter((m) => m.role === 'PL' && m.character).map((m) => {
                const c = m.character!;
                return {
                  id: c.id, name: c.name,
                  str: c.str, con: c.con, siz: c.siz, dex: c.dex,
                  app: c.app, int: c.int, pow: c.pow, edu: c.edu,
                  skills: c.skills, sanCurrent: c.san, luck: c.luck,
                };
              })}
              allCharacters={members.filter((m) => m.character).map((m) => {
                const c = m.character!;
                return {
                  id: c.id, name: c.name,
                  str: c.str, con: c.con, siz: c.siz, dex: c.dex,
                  app: c.app, int: c.int, pow: c.pow, edu: c.edu,
                  skills: c.skills, sanCurrent: c.san, luck: c.luck,
                };
              })}
              onCreate={createJudgment}
            />
          )}
          {role === 'KP' && <DiceRoller onRoll={rollDice} />}
          <JudgmentQueue
            judgments={pendingJudgments}
            role={role}
            currentUserId={currentUserId}
            members={members}
            onRoll={rollJudgment}
            onCancel={cancelJudgment}
          />
          <LogPanel
            logs={logs}
            members={members}
            history={logsHistoryProps}
            prependSignal={history.logs.prependSignal}
          />
        </div>
      </div>

      <CharacterCardsPanel
        members={members}
        onSelectCharacter={(id) => setInspectingCharacterId(id)}
      />

      <PresenceBar members={members} />

      <CharacterDetailModal
        character={inspected as CharacterDetail | null}
        ownerUsername={inspectedOwner?.username}
        isKp={role === 'KP'}
        onClose={() => setInspectingCharacterId(null)}
        onWeaponUpsert={weaponUpsert}
        onWeaponDelete={weaponDelete}
        onEquipmentUpsert={equipmentUpsert}
        onEquipmentDelete={equipmentDelete}
      />
    </div>
  );
}