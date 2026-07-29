/**
 * E2E 复现：旁观者首屏「你不在此 Session 中」race
 *
 * 背景：
 *   SessionClient 在 socket connect 后同步 emit `session:join` + `log:history`。
 *   Socket.IO 不保证这两个 handler 的执行先后——第一次进 session 的旁观者，
 *   joinRoom 还没插入 SPECTATOR 行，log:history 就先命中 ensureMember 抛错。
 *
 * 本脚本模拟客户端那一行：
 *   s.emit('session:join', { sessionId });
 *   s.emit('log:history', { sessionId, types: [...], requestId });
 *
 * 修复后两条都应该正常：
 *   - log:history:res 至少收到 1 条
 *   - 不应收到 message 含「你不在此 Session 中」的 error
 *
 * 前置：realtime + web 跑着（用默认端口）。
 */

import { io } from 'socket.io-client';

const WEB = process.env.WEB_ORIGIN || 'http://raricy.com:7766';
const REALTIME = process.env.NEXT_PUBLIC_WS_URL || 'http://raricy.com:4000';

function makeCookieJar() {
  const jar = new Map();
  function applySetCookies(headers) {
    const list = typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : (headers.get('set-cookie') ? [headers.get('set-cookie')] : []);
    for (const raw of list) {
      const first = raw.split(';')[0].trim();
      const eq = first.indexOf('=');
      if (eq > 0) jar.set(first.slice(0, eq), first.slice(eq + 1));
    }
  }
  return { cookieJar: jar, applySetCookies };
}

function makeClient(jar) {
  return async function jreq(path, init = {}) {
    const headers = new Headers(init.headers || {});
    if (jar.cookieJar.size) headers.set('cookie', [...jar.cookieJar].map(([k, v]) => `${k}=${v}`).join('; '));
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
    const r = await fetch(WEB + path, { ...init, headers });
    jar.applySetCookies(r.headers);
    const ct = r.headers.get('content-type') || '';
    const body = ct.includes('json') ? await r.json().catch(() => null) : await r.text();
    return { status: r.status, body };
  };
}

function solveCaptcha(data) {
  if (data.type === 'math') {
    const m = data.text.match(/(\d+)\s*\+\s*(\d+)/);
    return m ? String(parseInt(m[1]) + parseInt(m[2])) : '';
  }
  return data.text;
}

async function getCaptcha(jreq) {
  const cap = await jreq('/api/captcha');
  return cap.body.data;
}

async function register(jreq, username, password) {
  const cap = await getCaptcha(jreq);
  return jreq('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username, password,
      captchaToken: cap.token, captchaAnswer: solveCaptcha(cap),
    }),
  });
}

async function createCharacter(jreq, name) {
  return jreq('/api/characters', {
    method: 'POST',
    body: JSON.stringify({
      name, era: 'modern',
      primary: { str: 50, con: 50, siz: 50, dex: 50, app: 50, int: 50, pow: 50, edu: 50, luck: 50 },
      skills: [{ name: '侦察', value: 50 }],
      weapons: [], equipment: [],
    }),
  });
}

async function publishRecruitment(jreq, title) {
  const cap = await getCaptcha(jreq);
  return jreq('/api/recruitments', {
    method: 'POST',
    body: JSON.stringify({
      title, summary: 'spectator e2e', scenario: 'e2e',
      maxPlayers: 4, minPlayers: 1,
      captchaToken: cap.token, captchaAnswer: solveCaptcha(cap),
    }),
  });
}

async function start(jreq, recruitmentId) {
  return jreq(`/api/recruitments/${recruitmentId}/start`, { method: 'POST' });
}

async function connectSocket(jreq) {
  const tokenRes = await jreq('/api/auth/ws-token');
  if (tokenRes.status !== 200) throw new Error(`ws-token ${tokenRes.status}`);
  const token = tokenRes.body?.data?.token;
  if (!token) throw new Error('no token');

  return await new Promise((resolve, reject) => {
    const sock = io(REALTIME, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: false,
      auth: { token },
    });
    const t = setTimeout(() => reject(new Error('socket.io connect timeout 5s')), 5000);
    sock.on('connect', () => { clearTimeout(t); resolve(sock); });
    sock.on('connect_error', (err) => { clearTimeout(t); reject(err); });
  });
}

async function main() {
  const ts = Date.now();
  const kpUser = 'kp_spec_' + ts;
  const specUser = 'spec_' + ts;
  const password = 'longpassword123';

  // ─── KP 注册 + 启动 session ───
  const kpJar = makeCookieJar();
  const kpReq = makeClient(kpJar);
  const kpReg = await register(kpReq, kpUser, password);
  console.log('[1] KP register:', kpReg.status, kpReg.body?.ok ? 'OK' : kpReg.body);
  if (kpReg.status !== 200) process.exit(1);

  const kpChar = await createCharacter(kpReq, 'KP-PC');
  console.log('[2] KP create char:', kpChar.status, kpChar.body?.ok ? 'OK' : kpChar.body);
  if (kpChar.status !== 200) process.exit(1);

  const rec = await publishRecruitment(kpReq, 'spec-test-' + ts);
  console.log('[3] KP create recruitment:', rec.status, rec.body?.ok ? 'OK' : rec.body);
  if (rec.status !== 200) process.exit(1);
  const recruitmentId = rec.body.data.id;

  const startRes = await start(kpReq, recruitmentId);
  console.log('[4] KP start:', startRes.status, startRes.body?.ok ? 'OK' : startRes.body);
  if (startRes.status !== 200) process.exit(1);
  const sessionId = startRes.body.data.id;
  console.log('    sessionId:', sessionId);

  // ─── 旁观者注册 ───
  const specJar = makeCookieJar();
  const specReq = makeClient(specJar);
  const specReg = await register(specReq, specUser, password);
  console.log('[5] spectator register:', specReg.status, specReg.body?.ok ? 'OK' : specReg.body);
  if (specReg.status !== 200) process.exit(1);

  // ─── 旁观者连 socket + 立刻同步 emit session:join + log:history ───
  console.log('[6] spectator connecting socket.io...');
  const sock = await connectSocket(specReq);
  console.log('    connected, id=', sock.id);

  // 收集所有事件。这里关键是按真实顺序：
  // SessionClient.tsx:149-152 emit JOIN_SESSION + fetchHistory('chat') + fetchHistory('logs')
  const events = [];
  ['error', 'presence:update', 'log:history:res', 'log:entry', 'session:joined'].forEach((evt) => {
    sock.on(evt, (payload) => events.push({ event: evt, payload, at: Date.now() }));
  });

  // 关键：三个 emit 同步排进队列，模拟 onConnect 的真实行为。
  sock.emit('session:join', { sessionId });
  sock.emit('log:history', {
    sessionId,
    types: ['CHAT_OOC', 'CHAT_IC'],
    requestId: 'chat-' + ts,
  });
  sock.emit('log:history', {
    sessionId,
    types: ['JUDGMENT', 'HP_CHANGE', 'SAN_CHANGE', 'MP_CHANGE', 'SKILL_CHANGE', 'CLOCK', 'SYSTEM', 'CUSTOM', 'DICE_ROLL'],
    requestId: 'logs-' + ts,
  });

  // 等 join + 两份 history 全部回灌。1s 应该够，但留 1.5s 给 realtime 跑 joinRoom 的 Prisma。
  await new Promise((r) => setTimeout(r, 1500));

  sock.disconnect();

  const errors = events.filter((e) => e.event === 'error');
  const histRes = events.filter((e) => e.event === 'log:history:res');
  const presence = events.filter((e) => e.event === 'presence:update');

  console.log('\n[summary]');
  console.log('  log:history:res:', histRes.length);
  console.log('  presence:update:', presence.length);
  console.log('  error:', errors.length);
  errors.forEach((e) => console.log('    [ERROR]', JSON.stringify(e.payload).slice(0, 300)));

  // 关键断言：不得收到 "你不在此 Session 中"。这条 ERROR 在修复前必现。
  const raceError = errors.find((e) => typeof e.payload?.message === 'string' && e.payload.message.includes('你不在此 Session 中'));
  if (raceError) {
    console.log('\n✗ 旁观者首屏 race 仍在：');
    console.log('  ', JSON.stringify(raceError.payload));
    process.exit(2);
  }

  // 至少应有一份 history 回灌（说明 ensureMember 走通了）
  if (histRes.length < 1) {
    console.log('\n✗ 没有收到 log:history:res；realtime 链路可能没接通');
    process.exit(3);
  }

  // 顺带：不应有意外 ERROR（joinRoom 失败、别的鉴权错等）
  if (errors.length > 0) {
    console.log('\n✗ 收到非预期的 ERROR：');
    errors.forEach((e) => console.log('  ', JSON.stringify(e.payload)));
    process.exit(4);
  }

  console.log('\n✓ 旁观者首屏未触发 race；log:history:res 正常回灌');
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(99);
});
