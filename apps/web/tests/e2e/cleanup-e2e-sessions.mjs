/**
 * curl 风格的 e2e 残留清理：抓 dashboard 找 RUNNING 的 e2e 团，
 * 拿 KP username，用 e2e 统一密码登录后调 settlement API 强制 FINISHED。
 *
 * 适用场景：部署机不方便登 / 跑 prisma 脚本，agent 这边手头没有 DATABASE_URL。
 * 通过 dashboard 这个公开可见的视图 + 测试 KP 的固定密码 `longpassword123`
 * 实现"用 curl 清理"。
 *
 * 流程：
 *   1) 注册一个临时用户（仅需能看 dashboard）
 *   2) GET /dashboard，从 HTML 里抓 "spec-test-..." / "e2e-judgment-..."
 *      开头的 session 标题，连同 KP @username 和 sessionId 一起抓
 *   3) 对每个 session：以那个 KP 的身份登录（密码 longpassword123），
 *      POST /api/sessions/[id]/settlement → POST /api/sessions/[id]/settlement/complete
 *   4) 全部结束（或已 FINISHED）后 process.exit
 *
 * 注意：
 *   - 抓取用 regex 简单做，没用 cheerio；只匹配 dashboard 那一段固定结构
 *   - 假定 KPs 都没改密码（e2e 脚本里写死 longpassword123）
 *   - 若 KP 用了别的密码，会 login 失败，跳过那条；不会误改 DB
 *
 * 用法：
 *   WEB_ORIGIN=http://raricy.com:7766 node apps/web/tests/e2e/cleanup-e2e-sessions.mjs
 */

const WEB = process.env.WEB_ORIGIN || 'http://raricy.com:7766';

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
  return jreq('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username, password,
      captchaToken: cap.token, captchaAnswer: solveCaptcha(cap),
    }),
  });
}

async function login(jreq, username, password) {
  const cap = await getCaptcha(jreq);
  return jreq('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username, password,
      captchaToken: cap.token, captchaAnswer: solveCaptcha(cap),
    }),
  });
}

async function settle(jreq, sessionId) {
  const begin = await jreq(`/api/sessions/${sessionId}/settlement`, { method: 'POST' });
  if (begin.status !== 200) {
    return { ok: false, where: 'begin', status: begin.status, body: begin.body };
  }
  const done = await jreq(`/api/sessions/${sessionId}/settlement/complete`, { method: 'POST' });
  if (done.status !== 200) {
    return { ok: false, where: 'complete', status: done.status, body: done.body };
  }
  return { ok: true };
}

/**
 * 从 dashboard HTML 抓 e2e 模式的 session。
 * Dashboard 渲染的链接结构（React 渲染时会在文本节点之间插 `<!-- -->` 注释）：
 *   <a href="/sessions/${id}">
 *     <div ...><div ...>${title}</div><div ...>KP @<!-- -->${kpUsername}<!-- --> · 成员 <!-- -->${count}</div></div>
 *     <span ...>→ 进入观战</span>
 *   </a>
 *
 * 解析策略：每条 `/sessions/<id>` 截 700 字符上下文，清掉所有 `<!-- -->` 注释，
 * 再用宽松 regex 抓 title 和 KP username。这样不依赖React 渲染的精确属性顺序。
 */
function parseDashboardE2ESessions(html) {
  const out = [];
  const seen = new Set();
  const linkRe = /href="\/sessions\/([a-z0-9]+)"/g;
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const idx = m.index;
    const slice = html.slice(idx, idx + 700);
    // 删掉 React 的 `<!-- -->` 节点分隔符
    const cleaned = slice.replace(/<!--\s*-->/g, '');
    // title 在 `<div class="truncate text-sm font-semibold text-ink">XXX</div>` 里
    const titleM = cleaned.match(/<div[^>]*truncate[^>]*>\s*([^<]+?)\s*<\/div>/);
    if (!titleM) continue;
    const title = titleM[1].trim();
    if (!(title.startsWith('spec-test-') || title.startsWith('e2e-judgment-'))) continue;
    // KP @username 在 `KP @xxx · 成员`（注释清掉后）
    const kpM = cleaned.match(/KP\s+@(\S+?)\s*·/);
    if (!kpM) continue;
    out.push({ id, title, kpUsername: kpM[1] });
  }
  return out;
}

async function main() {
  const ts = Date.now();
  // 临时账户：仅用来抓 dashboard。这是个普通用户，不影响其他。
  // 用户名带 cuid 化前缀避免撞名。
  const observerUser = 'cl_' + ts;

  // ─── 1. 注册临时用户 ───
  const obsJ = makeCookieJar();
  const obsReq = makeClient(obsJ);
  const reg = await register(obsReq, observerUser, 'longpassword123');
  console.log('[1] observer register:', reg.status, reg.body?.ok ? 'OK' : reg.body);
  if (reg.status !== 200) process.exit(1);

  // ─── 2. 抓 dashboard ───
  const dash = await obsReq('/dashboard');
  console.log('[2] GET /dashboard:', dash.status, `body ${typeof dash.body === 'string' ? dash.body.length : '?'} chars`);
  if (dash.status !== 200 || typeof dash.body !== 'string') {
    console.log('    body sample:', String(dash.body).slice(0, 200));
    process.exit(1);
  }

  const targets = parseDashboardE2ESessions(dash.body);
  console.log(`[3] e2e 残留 sessions 发现: ${targets.length}`);
  for (const t of targets) {
    console.log(`    - ${t.id}  "${t.title}"  KP=@${t.kpUsername}`);
  }
  if (targets.length === 0) {
    console.log('✓ 没有可清理的 session，退出。');
    process.exit(0);
  }

  // ─── 3. 逐个以 KP 身份登录 → 结算 ───
  console.log('[4] 逐个以 KP 身份登录 + 结算...');
  const fixedPwd = 'longpassword123';
  let ok = 0, failed = 0, skipped = 0;
  for (const t of targets) {
    const kpJ = makeCookieJar();
    const kpReq = makeClient(kpJ);
    const lg = await login(kpReq, t.kpUsername, fixedPwd);
    if (lg.status !== 200) {
      console.log(`    ✗ ${t.id} login as @${t.kpUsername} 失败：${lg.status} ${JSON.stringify(lg.body)}`);
      skipped++;
      continue;
    }
    const res = await settle(kpReq, t.id);
    if (res.ok) {
      console.log(`    ✓ ${t.id}  → FINISHED`);
      ok++;
    } else {
      console.log(`    ✗ ${t.id}  settle ${res.where} ${res.status} ${JSON.stringify(res.body)}`);
      failed++;
    }
  }

  console.log('');
  console.log(`=== summary ===`);
  console.log(`  cleaned: ${ok}`);
  console.log(`  failed:  ${failed}`);
  console.log(`  skipped (login failed): ${skipped}`);

  process.exit(failed > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(99);
});
