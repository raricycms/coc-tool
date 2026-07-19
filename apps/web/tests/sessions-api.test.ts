/**
 * 集成测试：GET /api/sessions/[id] 详情。
 *
 * 其他 Session / Settlement 流程已被 settlement.test.ts 覆盖。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@coc-tools/db';
import { callRoute, resetCookies, loginAs } from './helpers';
import { createCaptcha } from '@/lib/captcha';

import * as registerRoute from '@/app/api/auth/register/route';
import * as sessionRoute from '@/app/api/sessions/[id]/settlement/route';

async function register(username: string): Promise<{ id: string; username: string }> {
  const c = createCaptcha();
  await callRoute(registerRoute.POST, {
    url: 'http://localhost/api/auth/register', method: 'POST',
    body: { username, password: 'longpassword123', captchaToken: c.token, captchaAnswer: c.answer },
  });
  const u = await prisma.user.findUnique({ where: { username } });
  return { id: u!.id, username: u!.username };
}

describe('sessions API', () => {
  beforeEach(() => {
    resetCookies();
  });

  it('GET session 详情：404 / 403 / 200', async () => {
    const kp = await register('kp-session');
    const other = await register('kp-session-other');
    const s = await prisma.session.create({
      data: {
        kpId: kp.id, title: '团', status: 'RUNNING',
        inGameTime: '10:00', inGameDate: '1/1', clockRunning: false, clockRate: 1,
      },
    });
    await prisma.sessionMember.create({
      data: { sessionId: s.id, userId: kp.id, role: 'KP' },
    });

    // 不存在
    const r1 = await callRoute(sessionRoute.GET, {
      url: 'http://localhost/api/sessions/no-such/settlement',
    });
    expect(r1.status).toBe(404);

    // 非 KP
    await loginAs(other.id, other.username);
    const r2 = await callRoute(sessionRoute.GET, {
      url: `http://localhost/api/sessions/${s.id}/settlement`,
    });
    expect(r2.status).toBe(403);

    // KP 自己
    await loginAs(kp.id, kp.username);
    const r3 = await callRoute(sessionRoute.GET, {
      url: `http://localhost/api/sessions/${s.id}/settlement`,
    });
    expect(r3.status).toBe(200);
    expect(r3.data.data.id).toBe(s.id);
    expect(r3.data.data.status).toBe('RUNNING');
  });

  it('POST 进入结算：FINISHED → 400 already_finished', async () => {
    const kp = await register('kp-finished');
    const s = await prisma.session.create({
      data: {
        kpId: kp.id, title: '完结团', status: 'FINISHED',
        inGameTime: '10:00', inGameDate: '1/1', clockRunning: false, clockRate: 1,
      },
    });
    await loginAs(kp.id, kp.username);
    const res = await callRoute(sessionRoute.POST, {
      url: `http://localhost/api/sessions/${s.id}/settlement`, method: 'POST',
    });
    expect(res.status).toBe(400);
    expect(res.data.error.code).toBe('already_finished');
  });

  it('POST 进入结算：RUNNING → SETTLING 并 create Settlement', async () => {
    const kp = await register('kp-settling');
    const s = await prisma.session.create({
      data: {
        kpId: kp.id, title: '团', status: 'RUNNING',
        inGameTime: '10:00', inGameDate: '1/1', clockRunning: false, clockRate: 1,
      },
    });
    await loginAs(kp.id, kp.username);
    const res = await callRoute(sessionRoute.POST, {
      url: `http://localhost/api/sessions/${s.id}/settlement`, method: 'POST',
    });
    expect(res.status).toBe(200);
    expect(res.data.data.step).toBe('SAN_RECOVERY');

    const after = await prisma.session.findUnique({ where: { id: s.id } });
    expect(after?.status).toBe('SETTLING');
    const settle = await prisma.settlement.findUnique({ where: { sessionId: s.id } });
    expect(settle?.step).toBe('SAN_RECOVERY');
  });

  it('POST 进入结算：非 KP → 403', async () => {
    const kp = await register('kp-settle-kp');
    const other = await register('kp-settle-other');
    const s = await prisma.session.create({
      data: {
        kpId: kp.id, title: '团', status: 'RUNNING',
        inGameTime: '10:00', inGameDate: '1/1', clockRunning: false, clockRate: 1,
      },
    });
    await loginAs(other.id, other.username);
    const res = await callRoute(sessionRoute.POST, {
      url: `http://localhost/api/sessions/${s.id}/settlement`, method: 'POST',
    });
    expect(res.status).toBe(403);
  });
});
