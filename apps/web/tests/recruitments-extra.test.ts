/**
 * 集成测试：招募详情 / 列表筛选 / PATCH / DELETE。
 *
 * 基础流程已被 recruitment.test.ts 覆盖；这里补齐：
 *   - GET 列表：按 status 过滤、按 mine 过滤
 *   - GET 详情：404
 *   - PATCH：KP 修改、PL 修改被拒
 *   - PATCH：maxPlayers < minPlayers 被拒
 *   - DELETE：仅 DRAFT/CLOSED 真删；OPEN 状态拒绝 → 走 POST /close
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@coc-tools/db';
import { callRoute, resetCookies, loginAs } from './helpers';
import { createCaptcha } from '@/lib/captcha';

import * as registerRoute from '@/app/api/auth/register/route';
import * as listRoute from '@/app/api/recruitments/route';
import * as detailRoute from '@/app/api/recruitments/[id]/route';
import * as postRoute from '@/app/api/recruitments/route';
import * as closeRoute from '@/app/api/recruitments/[id]/close/route';

async function register(username: string): Promise<{ id: string; username: string }> {
  const c = createCaptcha();
  await callRoute(registerRoute.POST, {
    url: 'http://localhost/api/auth/register', method: 'POST',
    body: { username, password: 'longpassword123', captchaToken: c.token, captchaAnswer: c.answer },
  });
  const u = await prisma.user.findUnique({ where: { username } });
  return { id: u!.id, username: u!.username };
}

async function makeRec(kpId: string, title: string, status = 'OPEN') {
  return prisma.recruitment.create({
    data: {
      kpId, title, summary: '测试', minPlayers: 2, maxPlayers: 4, status,
    },
  });
}

describe('recruitments extra', () => {
  beforeEach(() => {
    resetCookies();
  });

  it('GET 列表按 status 过滤', async () => {
    const kp = await register('kp-filter');
    await makeRec(kp.id, 'OPEN 团');
    await makeRec(kp.id, 'CLOSED 团', 'CLOSED');

    await loginAs(kp.id, kp.username);
    const res = await callRoute(listRoute.GET, {
      url: 'http://localhost/api/recruitments?status=OPEN',
    });
    expect(res.status).toBe(200);
    expect(res.data.data).toHaveLength(1);
    expect(res.data.data[0].title).toBe('OPEN 团');
  });

  it('GET 列表 ?mine=true 限定 KP 名下', async () => {
    const kp1 = await register('kp-mine-1');
    const kp2 = await register('kp-mine-2');
    await makeRec(kp1.id, '团 1');
    await makeRec(kp2.id, '团 2');

    await loginAs(kp1.id, kp1.username);
    const res = await callRoute(listRoute.GET, {
      url: 'http://localhost/api/recruitments?mine=true',
    });
    expect(res.status).toBe(200);
    expect(res.data.data).toHaveLength(1);
    expect(res.data.data[0].title).toBe('团 1');
  });

  it('GET 详情不存在 → 404', async () => {
    const u = await register('kp-404');
    await loginAs(u.id, u.username);
    const res = await callRoute(detailRoute.GET, {
      url: 'http://localhost/api/recruitments/missing',
    });
    expect(res.status).toBe(404);
  });

  it('PATCH：KP 可改', async () => {
    const kp = await register('kp-patch');
    const r = await makeRec(kp.id, '改前');
    await loginAs(kp.id, kp.username);

    const res = await callRoute(detailRoute.PATCH, {
      url: `http://localhost/api/recruitments/${r.id}`, method: 'PATCH',
      body: { title: '改后', maxPlayers: 6 },
    });
    expect(res.status).toBe(200);
    expect(res.data.data.title).toBe('改后');
    expect(res.data.data.maxPlayers).toBe(6);
  });

  it('PATCH：非 KP → 403', async () => {
    const kp = await register('kp-patch-owner');
    const other = await register('kp-patch-other');
    const r = await makeRec(kp.id, '团');
    await loginAs(other.id, other.username);
    const res = await callRoute(detailRoute.PATCH, {
      url: `http://localhost/api/recruitments/${r.id}`, method: 'PATCH',
      body: { title: 'hijack' },
    });
    expect(res.status).toBe(403);
  });

  it('PATCH：maxPlayers < minPlayers → 400', async () => {
    const kp = await register('kp-patch-min');
    const r = await makeRec(kp.id, '团');
    await loginAs(kp.id, kp.username);
    const res = await callRoute(detailRoute.PATCH, {
      url: `http://localhost/api/recruitments/${r.id}`, method: 'PATCH',
      body: { minPlayers: 5, maxPlayers: 2 },
    });
    expect(res.status).toBe(400);
    expect(res.data.error.code).toBe('invalid_input');
  });

  it('POST /close：KP 把 OPEN 招募置 CLOSED', async () => {
    const kp = await register('kp-close');
    const r = await makeRec(kp.id, '关闭');
    await loginAs(kp.id, kp.username);

    const res = await callRoute(closeRoute.POST, {
      url: `http://localhost/api/recruitments/${r.id}/close`, method: 'POST',
    });
    expect(res.status).toBe(200);

    const after = await prisma.recruitment.findUnique({ where: { id: r.id } });
    expect(after?.status).toBe('CLOSED');
  });

  it('DELETE OPEN 状态被拒（须先 POST /close）', async () => {
    const kp = await register('kp-del-open');
    const r = await makeRec(kp.id, 'open招募');
    await loginAs(kp.id, kp.username);

    const res = await callRoute(detailRoute.DELETE, {
      url: `http://localhost/api/recruitments/${r.id}`, method: 'DELETE',
    });
    expect(res.status).toBe(400);
    expect(res.data.error.code).toBe('cannot_delete_open');

    const after = await prisma.recruitment.findUnique({ where: { id: r.id } });
    expect(after).not.toBeNull(); // 仍存在
  });

  it('DELETE CLOSED 状态真删', async () => {
    const kp = await register('kp-del-closed');
    const r = await makeRec(kp.id, 'closed招募');
    // 直接造 CLOSED 状态
    await prisma.recruitment.update({ where: { id: r.id }, data: { status: 'CLOSED' } });
    await loginAs(kp.id, kp.username);

    const res = await callRoute(detailRoute.DELETE, {
      url: `http://localhost/api/recruitments/${r.id}`, method: 'DELETE',
    });
    expect(res.status).toBe(200);

    const after = await prisma.recruitment.findUnique({ where: { id: r.id } });
    expect(after).toBeNull();
  });

  it('POST：maxPlayers 校验在 refine 上失败 → 400 + 中文 message', async () => {
    const kp = await register('kp-create-bad');
    await loginAs(kp.id, kp.username);
    const res = await callRoute(postRoute.POST, {
      url: 'http://localhost/api/recruitments', method: 'POST',
      body: { title: '坏团', summary: 'x', minPlayers: 5, maxPlayers: 2 },
    });
    expect(res.status).toBe(400);
    expect(res.data.error.code).toBe('invalid_input');
    // fields 里应包含 maxPlayers 这一项，message 是中文（由 formatZodIssue 决定）
    expect(res.data.error.fields.some((f: any) => f.key === 'maxPlayers')).toBe(true);
  });
});
