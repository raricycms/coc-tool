# 04 · 认证：raricy OAuth + 本地账号 + 图形验证码

> 支持两种注册 / 登录路径，并共享同一套 session 体系。

---

## 1. 整体设计

```
                  ┌─────────────────────────────┐
                  │   session（JWT in cookie）  │
                  │   HttpOnly · Secure · Lax   │
                  │   { userId, role, exp }     │
                  └─────────────────────────────┘
                          ▲                ▲
       ┌──────────────────┘                └──────────────────┐
       │                                                       │
  raricy.com OAuth 流程                              本地账号流程
  (authorization_code)                       (email + password + captcha)
```

两种路径最终都收敛到：**写 User 表 + 发 session cookie**。前端判断用户是否登录统一读 cookie；realtime 服务用同一套 JWT 校验。

---

## 2. raricy.com OAuth 流程

> 详见 `docs/oauth.md`，本节描述在 Coc-tools 这边的落地。

### 2.1 应用注册（一次性）

在 raricy.com 站长后台创建应用，得到：

- `client_id`
- `client_secret`
- 配置 `redirect_uri = https://coc.tools/api/auth/raricy/callback`

写入 `apps/web/.env.local`：

```
RARICY_OAUTH_CLIENT_ID=xxx
RARICY_OAUTH_CLIENT_SECRET=xxx
RARICY_OAUTH_REDIRECT_URI=https://coc.tools/api/auth/raricy/callback
```

### 2.2 端点设计

| 路径 | 方法 | 作用 |
|---|---|---|
| `/api/auth/raricy/start` | GET | 生成 `state`，写临时 cookie，重定向到 raricy `/oauth/authorize` |
| `/api/auth/raricy/callback` | GET | 校验 `state`，拿 `code` 换 token，调 userinfo，upsert User，发 session cookie |

### 2.3 关键代码骨架

```ts
// apps/web/src/app/api/auth/raricy/start/route.ts
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

export async function GET() {
  const state = randomBytes(24).toString('hex');
  cookies().set('oauth_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax',
    path: '/', maxAge: 600,
  });

  const url = new URL(process.env.RARICY_OAUTH_AUTHORIZE_URL!);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', process.env.RARICY_OAUTH_CLIENT_ID!);
  url.searchParams.set('redirect_uri', process.env.RARICY_OAUTH_REDIRECT_URI!);
  url.searchParams.set('scope', 'profile');
  url.searchParams.set('state', state);

  return Response.redirect(url.toString(), 302);
}
```

```ts
// apps/web/src/app/api/auth/raricy/callback/route.ts
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { exchangeCode, fetchUserInfo } from '@/lib/auth/raricy';
import { issueSession } from '@/lib/auth/session';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = cookies().get('oauth_state')?.value;
  cookies().delete('oauth_state');
  if (!code || !state || state !== expected) {
    return Response.redirect(new URL('/login?error=oauth_state', req.url), 302);
  }

  const token = await exchangeCode(code);            // { access_token, expires_in, scope }
  const info  = await fetchUserInfo(token.access_token);  // { sub, username, avatar_url }
  const tokenHash = sha256(token.access_token);

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.upsert({
      where: { provider_providerSub: { provider: 'RARICY', providerSub: info.sub } },
      update: { username: info.username, avatarUrl: info.avatar_url, lastLoginAt: new Date() },
      create: {
        provider: 'RARICY', providerSub: info.sub,
        username: info.username, avatarUrl: info.avatar_url,
      },
    });
    await tx.oAuthToken.upsert({
      where: { tokenHash },
      update: { expiresAt: new Date(Date.now() + token.expires_in * 1000) },
      create: {
        userId: u.id, tokenHash, scope: token.scope,
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
      },
    });
    return u;
  });

  await issueSession(user.id);
  return Response.redirect(new URL('/dashboard', req.url), 302);
}
```

### 2.4 错误处理

| 错误 | 处理 |
|---|---|
| `state` 不一致 / 缺失 | 跳 `/login?error=oauth_state` |
| raricy 5xx | 跳 `/login?error=oauth_upstream` |
| `userinfo` 返回 `invalid_token` | 跳 `/login?error=token_invalid`（raricy 封号或撤销） |
| `sub` 已绑定到另一本地账号 | **禁止合并**：提示用户「该 raricy 账号已绑定其他用户」 |

### 2.5 注销（raricy 一侧）

```ts
await fetch(process.env.RARICY_OAUTH_REVOKE_URL!, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({ token: accessToken }),
});
```

我们保留 `OAuthToken` 表是为了能本地吊销而不必再访问 raricy（raricy 端吊销走用户主动操作）。

---

## 3. 本地账号：注册 / 登录

### 3.1 图形验证码

#### 3.1.1 端点

| 路径 | 方法 | 作用 |
|---|---|---|
| `/api/captcha` | GET | 生成 svg + token（HttpOnly cookie），返回 svg data URL 与 token |
| `/api/captcha/verify` | POST | 校验用户输入的答案，标记通过 |

#### 3.1.2 流程

```
GET /api/captcha           → { svg: 'data:image/svg+xml;...', token: 'xxx' }
                            → Set-Cookie: captcha_token=xxx; HttpOnly

POST /api/captcha/verify   body: { token, answer }
   校验答案 → 写 CaptchaVerify(verified=true, scene, ip)
   → { ok: true }   （cookie 中的 token 标记 consumed）

POST /api/auth/register    body: { username, email, password, captchaToken }
   校验 CaptchaVerify.consumedAt == null && verified && 5min 内
```

#### 3.1.3 关键实现

```ts
// apps/web/src/app/api/captcha/route.ts
import { createCaptcha } from '@/lib/auth/captcha';
import { cookies } from 'next/headers';

export async function GET() {
  const c = createCaptcha({ size: 5, noise: 2, color: true, math: false });
  cookies().set('captcha_token', c.token, {
    httpOnly: true, secure: true, sameSite: 'lax',
    path: '/api/captcha/verify', maxAge: 300,
  });
  return Response.json({ svg: 'data:image/svg+xml;base64,' + Buffer.from(c.svg).toString('base64') });
}
```

```ts
// apps/web/src/lib/auth/captcha.ts
import svgCaptcha from 'svg-captcha';
import { randomBytes } from 'crypto';

// token = random nonce; answer 存内存 Map (token → answer)
const store = new Map<string, { answer: string; createdAt: number }>();

export function createCaptcha(opts: any) {
  const c = svgCaptcha.create(opts);
  const token = randomBytes(16).toString('hex');
  store.set(token, { answer: c.text.toLowerCase(), createdAt: Date.now() });
  // 过期清理
  for (const [k, v] of store) if (Date.now() - v.createdAt > 5 * 60_000) store.delete(k);
  return { svg: c.data, token };
}

export function verifyCaptcha(token: string, answer: string) {
  const r = store.get(token);
  if (!r) return false;
  store.delete(token);                        // 一次性
  return r.answer === answer.trim().toLowerCase();
}
```

> v0.1 进程内 Map 即可（重启会清空，验证码全部失效）。生产环境换 Redis（接口签名不变）。

#### 3.1.4 限频

| Key | 限制 |
|---|---|
| `captcha:get:${ip}` | 30 / 分钟 |
| `captcha:verify:${ip}` | 10 / 分钟 |
| `auth:login:${ip}` | 10 / 分钟 |
| `auth:register:${ip}` | 5 / 分钟 |

---

### 3.2 注册

```ts
// apps/web/src/app/api/auth/register/route.ts
export async function POST(req: Request) {
  const body = registerSchema.parse(await req.json());
  // 1. 校验验证码
  if (!verifyCaptcha(body.captchaToken, body.captchaAnswer)) {
    return Response.json({ error: 'captcha_invalid' }, { status: 400 });
  }
  // 2. 用户名 / 邮箱唯一
  const exists = await prisma.user.findFirst({
    where: { OR: [{ username: body.username }, { email: body.email ?? '_' }] },
  });
  if (exists) return Response.json({ error: 'user_exists' }, { status: 409 });
  // 3. 密码强度
  if (!isStrongPassword(body.password)) {
    return Response.json({ error: 'weak_password' }, { status: 400 });
  }
  // 4. 写库
  const passwordHash = await argon2.hash(body.password, { type: argon2.argon2id });
  const user = await prisma.user.create({
    data: {
      username: body.username, email: body.email,
      passwordHash, provider: 'LOCAL',
    },
  });
  await issueSession(user.id);
  return Response.json({ ok: true });
}
```

**密码强度规则**（v0.1）：
- 长度 ≥ 10
- 至少含字母 + 数字
- 禁止与用户名 / 邮箱近似

> 后续可接 HaveIBeenPwned API。

### 3.3 登录

```ts
// apps/web/src/app/api/auth/login/route.ts
export async function POST(req: Request) {
  const body = loginSchema.parse(await req.json());
  if (!verifyCaptcha(body.captchaToken, body.captchaAnswer)) {
    return Response.json({ error: 'captcha_invalid' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username: body.username } });
  if (!user || !user.passwordHash || user.status !== 'ACTIVE') {
    // 故意统一返回，防枚举
    return Response.json({ error: 'invalid_credentials' }, { status: 401 });
  }
  const ok = await argon2.verify(user.passwordHash, body.password);
  if (!ok) return Response.json({ error: 'invalid_credentials' }, { status: 401 });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await issueSession(user.id);
  return Response.json({ ok: true });
}
```

---

## 4. Session

### 4.1 形态

```ts
// apps/web/src/lib/auth/session.ts
import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!);

export interface SessionPayload {
  userId: string;
  username: string;
  role: 'user' | 'admin';
}

export async function issueSession(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('user not found');

  const jwt = await new SignJWT({
    userId: user.id, username: user.username, role: 'user',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);

  cookies().set('session', jwt, {
    httpOnly: true, secure: true, sameSite: 'lax',
    path: '/', maxAge: 7 * 24 * 3600,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const c = cookies().get('session')?.value;
  if (!c) return null;
  try {
    const { payload } = await jwtVerify(c, SECRET);
    return payload as unknown as SessionPayload;
  } catch { return null; }
}

export function clearSession() {
  cookies().delete('session');
}
```

### 4.2 中间件

```ts
// apps/web/src/middleware.ts
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC = [/^\/login/, /^\/register/, /^\/api\/auth/, /^\/api\/captcha/, /^\/oauth/];

export async function middleware(req: Request) {
  const url = new URL(req.url);
  if (PUBLIC.some(re => re.test(url.pathname))) return NextResponse.next();

  const token = req.headers.get('cookie')?.match(/session=([^;]+)/)?.[1];
  if (!token) return NextResponse.redirect(new URL('/login?next=' + url.pathname, req.url));

  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET!));
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login?next=' + url.pathname, req.url));
  }
}

export const config = { matcher: ['/((?!_next|favicon.ico).*)'] };
```

### 4.3 注销

```ts
export async function POST() {
  clearSession();
  return Response.json({ ok: true });
}
```

---

## 5. WS 鉴权（realtime 服务）

realtime 服务在 Socket.IO 握手阶段校验同一份 JWT：

```ts
// apps/realtime/src/auth.ts
import { Server, Socket } from 'socket.io';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!);

export function attachAuth(io: Server) {
  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth?.token
      ?? socket.handshake.headers.cookie?.match(/session=([^;]+)/)?.[1];
    if (!token) return next(new Error('unauthorized'));
    try {
      const { payload } = await jwtVerify(token, SECRET);
      (socket.data as any).user = payload;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });
}
```

前端封装：

```ts
// apps/web/src/lib/ws-client.ts
import { io } from 'socket.io-client';

export function connectSocket() {
  return io(process.env.NEXT_PUBLIC_WS_URL!, {
    auth: () => {
      // 用 cookie 字符串带上（BFF 已配置好，浏览器自动发）
      return {}; // socket.io-client 默认会发 cookie
    },
    transports: ['websocket'],
    reconnection: true,
  });
}
```

---

## 6. 用户角色

v0.1 仅两种：

| role | 说明 |
|---|---|
| `user` | 普通用户，能开团 / 跑团 / 观战 |
| `admin` | 管理员（手动改库标记） |

普通用户的资源访问校验统一用 zod + prisma `where: { ownerId: session.userId }`。

---

## 7. UI 流程

### 7.1 登录页 `/login`

```
┌────────────────────────────────┐
│   Coc-tools 登录              │
│                                │
│  [   使用 raricy.com 登录   ]  │ ← 一键跳转 OAuth
│                                │
│  ──────── 或 ────────          │
│                                │
│  用户名 [____________]         │
│  密码   [____________]         │
│  验证码 [svg] [______]         │
│                                │
│  [   登 录   ]    [注册]       │
└────────────────────────────────┘
```

### 7.2 注册页 `/register`

```
┌────────────────────────────────┐
│   创建账号                     │
│                                │
│  [  使用 raricy.com 一键注册 ] │
│                                │
│  ──── 或 ────                  │
│                                │
│  用户名 [____________]         │
│  邮箱   [____________]         │
│  密码   [____________]         │
│  验证码 [svg] [______]         │
│                                │
│  [   注 册   ]                │
└────────────────────────────────┘
```

raricy 一键注册走的是同一 OAuth 流程：回调里如果没有匹配 user 就直接 `create`。

---

## 8. 安全检查清单

- [x] 密码 argon2id，禁用 MD5/SHA1/bcrypt
- [x] 验证码一次性 + 5min TTL
- [x] OAuth `state` 服务端校验
- [x] OAuth `redirect_uri` 与预登记严格一致
- [x] session cookie HttpOnly + Secure + SameSite=Lax
- [x] 登录 / 注册失败不区分「用户不存在」与「密码错」（防枚举）
- [x] 限频（IP 维度）
- [x] 错误信息不回显内部细节
- [x] 注销同时清 cookie（前端 + 后端）
- [x] WS 握手鉴权
- [ ] (v0.2) 双因素（TOTP）
- [ ] (v0.2) 异地登录提醒

---

## 9. 数据流时序

### 注册
```
Browser → GET /api/captcha → svg + cookie
Browser → POST /register { username, email, password, captchaToken }
        → 校验 captcha
        → 校验密码强度
        → 写 User
        → issueSession
        → 200
Browser → Set-Cookie: session=... → 跳 /dashboard
```

### OAuth 登录
```
Browser → 点击「raricy 登录」
        → GET /api/auth/raricy/start
        → 302 raricy.com/oauth/authorize?...
raricy.com → 用户授权 → 302 回 /api/auth/raricy/callback?code=...&state=...
        → 服务端 POST /api/oauth/token → access_token
        → GET /api/oauth/userinfo → { sub, username, avatar_url }
        → upsert User
        → issueSession
        → 302 回 /dashboard
```

---

## 10. 待校准

- 是否需要邮箱验证（v0.1 暂不做强制）
- 是否需要"找回密码"（v0.1 暂不做；v0.2 加）
- raricy OAuth 是否未来加 scope（目前仅 profile，足够拿头像 + 用户名）