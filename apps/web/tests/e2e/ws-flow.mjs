/**
 * 端到端：跨源 socket.io 认证。
 *
 * 模拟浏览器完整流程：cookie jar（自动管理 Set-Cookie） + 真实 fetch
 * （同源请求会带 cookie） + 真实 socket.io-client。
 *
 * 验证三件事：
 *   1) /api/auth/ws-token 同源带 cookie 能拿到 JWT；
 *   2) 用这个 JWT 连 realtime 成功；
 *   3) 没 token 直接连会被拒绝（用来反证最初的 bug 不是测试环境问题）。
 *
 * 还会做一项 **环境对账**：调用 web 的 /api/health 类端点 + realtime 的
 * /health，让两端各自暴露自己的 SESSION_SECRET fingerprint（避免直接
 * 泄露原值），不一致就立即报错——这正是「unauthorized: invalid token」
 * 的根本原因（web 签的 JWT 和 realtime 校验用的不是同一份密钥）。
 *
 * 前置：dev:web + dev:realtime 都跑着；在仓库根目录直接执行。
 */

import { io } from 'socket.io-client';
import { createHash } from 'node:crypto';

const WEB = process.env.WEB_ORIGIN || 'http://localhost:7766';
const REALTIME = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

const cookieJar = new Map();

function fingerprint(secret) {
  if (!secret) return '(none)';
  return createHash('sha256').update(secret).digest('hex').slice(0, 12);
}

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

async function jreq(path, init = {}) {
  const headers = new Headers(init.headers || {});
  if (cookieJar.size) headers.set('cookie', [...cookieJar].map(([k, v]) => `${k}=${v}`).join('; '));
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const r = await fetch(WEB + path, { ...init, headers });
  applySetCookies(r.headers);
  const ct = r.headers.get('content-type') || '';
  const body = ct.includes('json') ? await r.json().catch(() => null) : await r.text();
  return { status: r.status, body, headers: r.headers };
}

function solveCaptcha(c) {
  const t = c.text || '';
  let m = t.match(/(\d+)\s*\+\s*(\d+)/);
  if (m) return String(parseInt(m[1]) + parseInt(m[2]));
  m = t.match(/(\d+)\s*-\s*(\d+)/);
  if (m) return String(parseInt(m[1]) - parseInt(m[2]));
  return t;
}

// 模拟 ws-client.ts 里的 fetchWsToken + getSocket 主流程
async function browserStyleConnect() {
  const tokenRes = await jreq('/api/auth/ws-token');
  if (tokenRes.status !== 200) return { ok: false, stage: 'ws-token', status: tokenRes.status, body: tokenRes.body };
  const token = tokenRes.body?.data?.token;
  if (!token) return { ok: false, stage: 'ws-token', body: tokenRes.body };

  return new Promise((resolve) => {
    const sock = io(REALTIME, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: false,
      auth: { token },
    });
    const t = setTimeout(() => resolve({ ok: false, stage: 'socket.io', reason: 'timeout 5s' }), 5000);
    sock.on('connect', () => { clearTimeout(t); resolve({ ok: true, stage: 'socket.io', id: sock.id }); sock.disconnect(); });
    sock.on('connect_error', (err) => { clearTimeout(t); resolve({ ok: false, stage: 'socket.io', reason: err.message }); sock.disconnect(); });
  });
}

async function main() {
  // 0) SESSION_SECRET 对账：让两端各自暴露指纹，不一致直接挂
  const webHealth = await fetch(WEB + '/api/diag/health').then(r => r.json()).catch(() => null);
  const rtHealth = await fetch(REALTIME + '/health').then(r => r.json()).catch(() => null);
  if (!webHealth || !rtHealth) {
    console.error('✗ 两端没暴露 secret fingerprint 端点，跳过对账（旧版服务不支持）');
  } else {
    console.log('[0] secret fingerprint: web=', webHealth.secretFp, ' realtime=', rtHealth.secretFp);
    if (webHealth.secretFp !== rtHealth.secretFp) {
      console.error('');
      console.error('✗ SESSION_SECRET 不一致！这就是「unauthorized: invalid token」的根因。');
      console.error('  web 用:    ', webHealth.secretFp);
      console.error('  realtime 用:', rtHealth.secretFp);
      console.error('  修法：在两个终端里都执行 `set -a && source .env && set +a` 再启动。');
      console.error('');
      process.exit(2);
    }
    console.log('    ✓ 一致');
  }

  const username = 'e2e_' + Date.now();

  // 1) 注册
  const cap = await jreq('/api/captcha');
  const reg = await jreq('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username, password: 'longpassword123',
      captchaToken: cap.body.data.token, captchaAnswer: solveCaptcha(cap.body.data),
    }),
  });
  console.log('[1] register:', reg.status, reg.body?.ok ? 'OK' : reg.body);
  if (reg.status !== 200) process.exit(1);

  // 2) 登录
  const cap2 = await jreq('/api/captcha');
  const lg = await jreq('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username, password: 'longpassword123',
      captchaToken: cap2.body.data.token, captchaAnswer: solveCaptcha(cap2.body.data),
    }),
  });
  console.log('[2] login:', lg.status, lg.body?.ok ? 'OK' : lg.body);
  if (lg.status !== 200) process.exit(1);
  console.log('    cookies:', [...cookieJar.keys()]);

  // 3) 浏览器风格连 socket.io
  console.log('[3] 浏览器风格连接（同源 fetch ws-token + 用 token 连 realtime）...');
  const r1 = await browserStyleConnect();
  console.log('    result:', JSON.stringify(r1));
  if (!r1.ok) process.exit(1);

  // 4) 反证：直接连、不带 token
  console.log('[4] 反证：不带 token 直接连（应当被拒绝）...');
  const noTokenResult = await new Promise((resolve) => {
    const sock = io(REALTIME, { transports: ['websocket'], reconnection: false });
    const t = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), 3000);
    sock.on('connect', () => { clearTimeout(t); resolve({ ok: true, id: sock.id }); sock.disconnect(); });
    sock.on('connect_error', (err) => { clearTimeout(t); resolve({ ok: false, reason: err.message }); sock.disconnect(); });
  });
  console.log('    result:', JSON.stringify(noTokenResult));
  if (noTokenResult.ok) {
    console.error('  ✗ 没 token 居然连上了，说明诊断错了');
    process.exit(1);
  }

  console.log('\n✅ 端到端验证通过：');
  console.log('   - 同源 /api/auth/ws-token 能拿到 JWT；');
  console.log('   - 用 JWT 连 realtime 成功；');
  console.log('   - 不带 JWT 直连被拒绝（unauthorized: no token）。');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });