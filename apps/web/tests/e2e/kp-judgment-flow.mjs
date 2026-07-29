/**
 * E2E 复现：KP 完整跑通「发布判定」流程
 *
 * 完整流程：
 *   1) 注册两个新账号（KP + PL）
 *   2) KP 创建角色 + PL 创建角色
 *   3) KP 创建招募，发布
 *   4) PL 申请加入（提交角色 ID）
 *   5) KP 通过申请
 *   6) KP 启动 session
 *   7) KP 浏览器风格连 socket.io
 *   8) KP 发 JUDGMENT_CREATE
 *   9) 看是否会收到 JUDGMENT_CREATED 或 ERROR
 *
 * 这条路径覆盖了「KP 发布判定」的全链路。前端按钮按下等价于 emit JUDGMENT_CREATE，
 * 如果后端链路是通的，前端会收到 JUDGMENT_CREATED。
 */

import { io } from 'socket.io-client';

const WEB = process.env.WEB_ORIGIN || 'http://raricy.com:7766';
const REALTIME = process.env.NEXT_PUBLIC_WS_URL || 'http://raricy.com:4000';

function makeCookieJar() {
  const cookieJar = new Map();
  function applySetCookies(headers) {
    const list = typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : (headers.get('set-cookie') ? [headers.get('set-cookie')] : []);
    for (const raw of list) {
      const first = raw.split(';')[0].trim();
      const eq = first.indexOf('=');
      if (eq > 0) cookieJar.set(first.slice(0, eq), first.slice(eq + 1));
    }
  }
  return { cookieJar, applySetCookies };
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
  const r = await jreq('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username, password,
      captchaToken: cap.token, captchaAnswer: solveCaptcha(cap),
    }),
  });
  return r;
}

async function login(jreq, username, password) {
  const cap = await getCaptcha(jreq);
  const r = await jreq('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username, password,
      captchaToken: cap.token, captchaAnswer: solveCaptcha(cap),
    }),
  });
  return r;
}

async function createCharacter(jreq, name) {
  return jreq('/api/characters', {
    method: 'POST',
    body: JSON.stringify({
      name, era: 'modern',
      primary: {
        str: 60, con: 70, siz: 50, dex: 60, app: 50, int: 65, pow: 50, edu: 70, luck: 50,
      },
      skills: [
        { name: '侦察', value: 50 },
        { name: '图书馆', value: 40 },
      ],
      weapons: [],
      equipment: [],
    }),
  });
}

async function publishRecruitment(jreq, title) {
  const cap = await getCaptcha(jreq);
  const r = await jreq('/api/recruitments', {
    method: 'POST',
    body: JSON.stringify({
      title,
      summary: 'e2e test',
      scenario: 'e2e',
      maxPlayers: 4,
      minPlayers: 1,
      captchaToken: cap.token, captchaAnswer: solveCaptcha(cap),
    }),
  });
  return r;
}

async function publish(jreq, recruitmentId) {
  return jreq(`/api/recruitments/${recruitmentId}/publish`, { method: 'POST' });
}

async function apply(jreq, recruitmentId, characterId) {
  return jreq(`/api/recruitments/${recruitmentId}/applications`, {
    method: 'POST',
    body: JSON.stringify({ characterId }),
  });
}

async function reviewApplication(jreq, recruitmentId, appId, action) {
  return jreq(`/api/recruitments/${recruitmentId}/applications/${appId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
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
  const kpUser = 'kp_' + ts;
  const plUser = 'pl_' + ts;
  const password = 'longpassword123';

  // ─── KP 注册 ───
  const kpJar = makeCookieJar();
  const kpReq = makeClient(kpJar);
  const kpReg = await register(kpReq, kpUser, password);
  console.log('[1] KP register:', kpReg.status, kpReg.body?.ok ? 'OK' : kpReg.body);
  if (kpReg.status !== 200) process.exit(1);

  // ─── PL 注册 ───
  const plJar = makeCookieJar();
  const plReq = makeClient(plJar);
  const plReg = await register(plReq, plUser, password);
  console.log('[2] PL register:', plReg.status, plReg.body?.ok ? 'OK' : plReg.body);
  if (plReg.status !== 200) process.exit(1);

  // ─── KP 创建角色 ───
  const kpChar = await createCharacter(kpReq, 'KP-PC');
  console.log('[3] KP create char:', kpChar.status, kpChar.body?.ok ? 'OK' : kpChar.body);
  if (kpChar.status !== 200) process.exit(1);
  const kpCharacterId = kpChar.body.data.id;

  // ─── PL 创建角色 ───
  const plChar = await createCharacter(plReq, 'PL-PC');
  console.log('[4] PL create char:', plChar.status, plChar.body?.ok ? 'OK' : plChar.body);
  if (plChar.status !== 200) process.exit(1);
  const plCharacterId = plChar.body.data.id;

  // ─── KP 创建招募 + 发布 ───
  const rec = await publishRecruitment(kpReq, 'e2e-judgment-' + ts);
  console.log('[5] KP create recruitment:', rec.status, rec.body?.ok ? 'OK' : rec.body);
  if (rec.status !== 200) process.exit(1);
  const recruitmentId = rec.body.data.id;
  // 创建后默认是 OPEN（asDraft=false），不需要再调 publish
  console.log('    recruitment status (默认 OPEN)，跳过 publish');

  // ─── PL 申请加入 ───
  const app = await apply(plReq, recruitmentId, plCharacterId);
  console.log('[6] PL apply:', app.status, app.body?.ok ? 'OK' : app.body);
  if (app.status !== 200) process.exit(1);
  const applicationId = app.body.data.id;

  // ─── KP 通过申请 ───
  const review = await reviewApplication(kpReq, recruitmentId, applicationId, 'approve');
  console.log('[7] KP approve:', review.status, review.body?.ok ? 'OK' : review.body);
  if (review.status !== 200) process.exit(1);

  // ─── KP 启动 session ───
  const startRes = await start(kpReq, recruitmentId);
  console.log('[8] KP start:', startRes.status, startRes.body?.ok ? 'OK' : startRes.body);
  if (startRes.status !== 200) process.exit(1);
  const sessionId = startRes.body.data.id;
  console.log('    sessionId:', sessionId);

  // ─── KP 连 socket.io + 加入 session ───
  console.log('[9] KP connecting socket.io...');
  const sock = await connectSocket(kpReq);
  console.log('    connected, id=', sock.id);
  await new Promise((resolve) => {
    sock.emit('session:join', { sessionId });
    setTimeout(resolve, 300);
  });
  console.log('    joined session');

  // ─── 收集所有事件 ───
  const events = [];
  ['error', 'judgment:created', 'judgment:result', 'judgment:cancelled', 'presence:update', 'session:joined'].forEach((evt) => {
    sock.on(evt, (e) => events.push({ event: evt, payload: e, at: Date.now() }));
  });

  // 打印完整 error
  sock.on('error', (e) => console.log('    [ERROR]', JSON.stringify(e, null, 2).slice(0, 1500)));

  // ─── 发 JUDGMENT_CREATE（skill tab）───
  console.log('[10] KP emitting JUDGMENT_CREATE (skill)...');
  sock.emit('judgment:create', {
    sessionId,
    type: 'skill',
    skillName: '侦察',
    difficulty: 'regular',
    bonusDice: 0,
    note: undefined,
    targetCharacterId: plCharacterId,
  });

  await new Promise((r) => setTimeout(r, 1500));
  console.log('    events after skill:');
  events.forEach((e) => console.log('     ', e.event, JSON.stringify(e.payload).slice(0, 200)));

  // ─── 发 SAN check ───
  console.log('[11] KP emitting JUDGMENT_CREATE (SAN)...');
  sock.emit('judgment:create', {
    sessionId,
    type: 'san',
    skillName: 'SAN',
    difficulty: 'regular',
    bonusDice: 0,
    scSuccessExpr: '1d3',
    scFailureExpr: '1d6',
    note: undefined,
    targetCharacterId: plCharacterId,
  });
  await new Promise((r) => setTimeout(r, 1500));
  console.log('    events after san:');
  events.forEach((e) => console.log('     ', e.event, JSON.stringify(e.payload).slice(0, 200)));

  // ─── 发属性 (STR) ───
  console.log('[12] KP emitting JUDGMENT_CREATE (STR)...');
  sock.emit('judgment:create', {
    sessionId,
    type: 'skill',
    skillName: 'STR',
    difficulty: 'regular',
    bonusDice: 0,
    note: undefined,
    targetCharacterId: plCharacterId,
  });
  await new Promise((r) => setTimeout(r, 1500));
  console.log('    events after STR:');
  events.forEach((e) => console.log('     ', e.event, JSON.stringify(e.payload).slice(0, 200)));

  sock.disconnect();

  const created = events.filter((e) => e.event === 'judgment:created');
  const errs = events.filter((e) => e.event === 'error');
  console.log('\n=== summary ===');
  console.log('  judgment:created:', created.length);
  console.log('  error:', errs.length);
  if (errs.length > 0) {
    console.log('\n✗ 后端报错');
    process.exit(2);
  }
  if (created.length !== 3) {
    console.log(`\n✗ 期望 3 个 judgment:created，实际 ${created.length}`);
    process.exit(3);
  }
  console.log('\n✅ 完整链路 OK');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });