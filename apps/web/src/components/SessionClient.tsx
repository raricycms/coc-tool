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
        s.emit(SOCKET_EVENTS.LOG_HISTORY, { sessionId, types: Array.from(CHAT_LOG_TYPES) });
        s.emit(SOCKET_EVENTS.LOG_HISTORY, { sessionId, types: NON_CHAT_LOG_TYPES as unknown as string[] });
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
              inGameTime: e.inGameTime ?? '08:00',
              inGameDate: '',
            };
            setIcMessages((prev) => prev.some((m) => m.id === ic.id) ? prev : [...prev, ic]);
          }
          return;
        }
        setLogs((prev) => [...prev, e].slice(-500));
      });

      s.on(SOCKET_EVENTS.LOG_HISTORY_RES, ({ entries }: { entries: any[] }) => {
        const parsed: LogEntryPayload[] = entries.map((e) => ({
          ...e,
          payload: typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload,
          realTime: e.realTime,
          createdAt: e.createdAt,
        }));
        const findUsername = (uid?: string) => membersRef.current.find((m) => m.userId === uid)?.username ?? '';
        const findCharacterName = (cid?: string) => membersRef.current.find((m) => m.character?.id === cid)?.character?.name;

        const oocHist: OOCMessage[] = [];
        const icHist: ICMessage[] = [];
        const logHist: LogEntryPayload[] = [];

        for (const e of parsed) {
          if (e.type === 'CHAT_OOC') {
            const m: OOCMessage = {
              id: e.id, sessionId,
              authorId: e.authorId ?? '',
              authorUsername: findUsername(e.authorId),
              authorAvatar: null,
              content: String((e.payload as any).content ?? ''),
              realTime: e.realTime,
            };
            if (!oocHist.some((x) => x.id === e.id)) oocHist.push(m);
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
              inGameDate: '',
            };
            icHist.push(m);
          } else {
            logHist.push(e);
          }
        }

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
          />
        </div>

        <div className="flex min-h-[20rem] flex-col lg:min-h-0">
          <OOCPanel
            messages={oocMessages}
            onSend={sendOOC}
            canSend={true}
            currentUsername={me?.username ?? ''}
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
          <LogPanel logs={logs} members={members} />
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