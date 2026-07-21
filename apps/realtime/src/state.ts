/**
 * 全局单例：每个 Session 一个时钟 tick 循环。
 * tick 每秒执行一次，按 rate 累积 inGameTime。
 */

import { prisma } from '@coc-tools/db';

interface ClockRuntime {
  sessionId: string;
  inGameMs: number;        // 累计的 inGame 毫秒
  baseRealMs: number;      // 上次 start 的真实时间戳
  rate: number;
  running: boolean;
  inGameTime: string;
  inGameDate: string;
  timer: NodeJS.Timeout | null;
  lastPersistedAt: number; // 上次落库的真实毫秒时间戳；用于"距上次落库 ≥5s 才写"
}

const runtime = new Map<string, ClockRuntime>();

function parseTime(time: string, date: string): number {
  // date: "1/1" or "10/15"
  const [m, d] = date.split('/').map((x) => parseInt(x, 10));
  const [hh, mm] = time.split(':').map((x) => parseInt(x, 10));
  // 用相对时间，不考虑月份
  return (((m - 1) * 30 + (d - 1)) * 24 + hh) * 3600_000 + mm * 60_000;
}

function formatTime(ms: number): { time: string; date: string } {
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / (24 * 60));
  const minsInDay = totalMin - days * 24 * 60;
  const hh = Math.floor(minsInDay / 60);
  const mm = minsInDay % 60;
  const month = Math.floor(days / 30) + 1;
  const day = (days % 30) + 1;
  return {
    time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
    date: `${month}/${day}`,
  };
}

export async function initRuntime(sessionId: string) {
  if (runtime.has(sessionId)) return runtime.get(sessionId)!;
  const s = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!s) throw new Error('session not found');
  const ms = parseTime(s.inGameTime ?? '08:00', s.inGameDate ?? '1/1');
  const r: ClockRuntime = {
    sessionId,
    inGameMs: ms,
    baseRealMs: Date.now(),
    rate: s.clockRate,
    running: false,
    inGameTime: s.inGameTime ?? '08:00',
    inGameDate: s.inGameDate ?? '1/1',
    timer: null,
    lastPersistedAt: 0,
  };
  runtime.set(sessionId, r);
  return r;
}

function tick(r: ClockRuntime) {
  if (!r.running) return;
  const elapsedReal = Date.now() - r.baseRealMs;
  const elapsedInGame = elapsedReal * r.rate;
  const totalMs = r.inGameMs + elapsedInGame;
  const { time, date } = formatTime(totalMs);
  r.inGameTime = time;
  r.inGameDate = date;
  // 每秒 tick，但落库按"距上次落库 ≥ 5s"节流，避免每秒都写 DB。
  const now = Date.now();
  if (now - r.lastPersistedAt >= 5_000) {
    r.lastPersistedAt = now;
    prisma.session.update({
      where: { id: r.sessionId },
      data: { inGameTime: time, inGameDate: date },
    }).catch(() => {});
  }
  // 通知所有监听者（通过回调，不直接 emit）
  onClockUpdate?.(r);
}

let onClockUpdate: ((r: ClockRuntime) => void) | null = null;

export function setClockUpdateHandler(fn: (r: ClockRuntime) => void) {
  onClockUpdate = fn;
}

export function startClock(sessionId: string) {
  const r = runtime.get(sessionId);
  if (!r) return;
  r.baseRealMs = Date.now();
  r.running = true;
  if (!r.timer) r.timer = setInterval(() => tick(r), 1000);
  prisma.session.update({
    where: { id: sessionId },
    data: { clockRunning: true },
  }).catch(() => {});
}

export function pauseClock(sessionId: string) {
  const r = runtime.get(sessionId);
  if (!r || !r.running) return;
  // 把当前 elapsed 累加到 inGameMs
  const elapsedInGame = (Date.now() - r.baseRealMs) * r.rate;
  r.inGameMs += elapsedInGame;
  r.running = false;
  // 落库
  const { time, date } = formatTime(r.inGameMs);
  r.inGameTime = time;
  r.inGameDate = date;
  r.lastPersistedAt = Date.now();
  prisma.session.update({
    where: { id: sessionId },
    data: { clockRunning: false, inGameTime: time, inGameDate: date },
  }).catch(() => {});
  if (r.timer) {
    clearInterval(r.timer);
    r.timer = null;
  }
}

export function setRate(sessionId: string, rate: number) {
  const r = runtime.get(sessionId);
  if (!r) return;
  if (r.running) {
    // 把已累加的真实时间按旧 rate 写入 inGameMs
    const elapsedInGame = (Date.now() - r.baseRealMs) * r.rate;
    r.inGameMs += elapsedInGame;
    r.baseRealMs = Date.now();
  }
  r.rate = rate;
  prisma.session.update({
    where: { id: sessionId },
    data: { clockRate: rate },
  }).catch(() => {});
}

export function setTime(sessionId: string, inGameTime: string, inGameDate: string) {
  const r = runtime.get(sessionId);
  if (!r) return;
  r.inGameMs = parseTime(inGameTime, inGameDate);
  r.inGameTime = inGameTime;
  r.inGameDate = inGameDate;
  r.lastPersistedAt = Date.now();
  if (r.running) r.baseRealMs = Date.now();
  prisma.session.update({
    where: { id: sessionId },
    data: { inGameTime, inGameDate },
  }).catch(() => {});
}

export function addTime(sessionId: string, deltaMinutes: number) {
  const r = runtime.get(sessionId);
  if (!r) return;
  r.inGameMs += deltaMinutes * 60_000;
  const { time, date } = formatTime(r.inGameMs);
  r.inGameTime = time;
  r.inGameDate = date;
  r.lastPersistedAt = Date.now();
  if (r.running) r.baseRealMs = Date.now();
  prisma.session.update({
    where: { id: sessionId },
    data: { inGameTime: time, inGameDate: date },
  }).catch(() => {});
}

export function getRuntime(sessionId: string): ClockRuntime | undefined {
  return runtime.get(sessionId);
}

export function getCurrentClock(sessionId: string) {
  const r = runtime.get(sessionId);
  if (!r) return null;
  if (r.running) {
    const elapsedInGame = (Date.now() - r.baseRealMs) * r.rate;
    const { time, date } = formatTime(r.inGameMs + elapsedInGame);
    return { inGameTime: time, inGameDate: date, running: true, rate: r.rate };
  }
  return { inGameTime: r.inGameTime, inGameDate: r.inGameDate, running: false, rate: r.rate };
}

export function shutdownRuntime(sessionId: string) {
  const r = runtime.get(sessionId);
  if (!r) return;
  if (r.timer) clearInterval(r.timer);
  runtime.delete(sessionId);
}