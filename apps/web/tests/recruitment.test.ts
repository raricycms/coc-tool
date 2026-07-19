/**
 * 集成测试：招募 + 报名 + 审核 + 启动 Session
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@coc-tools/db';
import { callRoute, resetCookies, loginAs } from './helpers';
import { createCaptcha } from '@/lib/captcha';

import * as registerRoute from '@/app/api/auth/register/route';
import * as recruitmentsRoute from '@/app/api/recruitments/route';
import * as recruitmentByIdRoute from '@/app/api/recruitments/[id]/route';
import * as applicationsRoute from '@/app/api/recruitments/[id]/applications/route';
import * as reviewRoute from '@/app/api/recruitments/[id]/applications/[appId]/route';
import * as startRoute from '@/app/api/recruitments/[id]/start/route';

const VALID_PRIMARY = {
  str: 60, con: 70, siz: 50, dex: 60,
  app: 50, int: 65, pow: 50, edu: 70, luck: 50,
};

async function register(username: string): Promise<{ id: string; username: string }> {
  const c = createCaptcha();
  await callRoute(registerRoute.POST, {
    url: 'http://localhost/api/auth/register', method: 'POST',
    body: { username, password: 'longpassword123', captchaToken: c.token, captchaAnswer: c.answer },
  });
  const u = await prisma.user.findUnique({ where: { username } });
  return { id: u!.id, username: u!.username };
}

async function createCharacter(userId: string, name: string): Promise<string> {
  const c = await prisma.character.create({
    data: {
      ownerId: userId, name, era: 'modern',
      ...VALID_PRIMARY,
      hpMax: 12, mpMax: 10, sanMax: 250, mov: 8, build: 110, damageBonus: '0',
      hpCurrent: 12, mpCurrent: 10, sanCurrent: 250, luckCurrent: 50,
    },
  });
  return c.id;
}

describe('recruitment flow', () => {
  beforeEach(() => {
    resetCookies();
  });

  it('KP publishes recruitment → PL applies → KP approves → start session', async () => {
    const kp = await register('kp1');
    const pl1 = await register('pl1');
    const pl2 = await register('pl2');
    const char1 = await createCharacter(pl1.id, 'Alice 卡');
    const char2 = await createCharacter(pl2.id, 'Bob 卡');

    // 1) KP 登录
    await loginAs(kp.id, kp.username);

    // 2) KP 发布招募
    const rec = await callRoute(recruitmentsRoute.POST, {
      url: 'http://localhost/api/recruitments', method: 'POST',
      body: {
        title: '《克苏鲁的呼唤》',
        summary: '一个测试招募',
        minPlayers: 1,
        maxPlayers: 3,
      },
    });
    expect(rec.status).toBe(200);
    const recId = rec.data.data.id;
    expect(rec.data.data.status).toBe('OPEN');

    // 3) PL1 登录并报名
    await loginAs(pl1.id, pl1.username);
    const app1 = await callRoute(applicationsRoute.POST, {
      url: `http://localhost/api/recruitments/${recId}/applications`, method: 'POST',
      body: { characterId: char1, message: '我想玩' },
    });
    expect(app1.status).toBe(200);
    const app1Id = app1.data.data.id;

    // 4) PL2 登录并报名
    await loginAs(pl2.id, pl2.username);
    const app2 = await callRoute(applicationsRoute.POST, {
      url: `http://localhost/api/recruitments/${recId}/applications`, method: 'POST',
      body: { characterId: char2 },
    });
    expect(app2.status).toBe(200);

    // 5) 重复报名应失败（用 PL1 登录）
    await loginAs(pl1.id, pl1.username);
    const dup = await callRoute(applicationsRoute.POST, {
      url: `http://localhost/api/recruitments/${recId}/applications`, method: 'POST',
      body: { characterId: char1 },
    });
    expect(dup.status).toBe(409);
    expect(dup.data.error.code).toBe('already_applied');

    // 6) KP 通过 PL1
    await loginAs(kp.id, kp.username);
    const approve = await callRoute(reviewRoute.PATCH, {
      url: `http://localhost/api/recruitments/${recId}/applications/${app1Id}`, method: 'PATCH',
      body: { action: 'approve' },
    });
    expect(approve.status).toBe(200);
    expect(approve.data.data.status).toBe('APPROVED');

    // 7) 启动团
    const start = await callRoute(startRoute.POST, {
      url: `http://localhost/api/recruitments/${recId}/start`, method: 'POST',
    });
    expect(start.status).toBe(200);
    const sessionId = start.data.data.id;

    // 8) 校验 Session 状态
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { members: { include: { character: true } } },
    });
    expect(session?.status).toBe('SETUP');
    expect(session?.members).toHaveLength(2);
    expect(session?.members.find((m) => m.role === 'KP')?.userId).toBe(kp.id);
    expect(session?.members.find((m) => m.role === 'PL')?.userId).toBe(pl1.id);

    // 9) 招募状态变成 FINISHED
    const finalRec = await prisma.recruitment.findUnique({ where: { id: recId } });
    expect(finalRec?.status).toBe('FINISHED');
  });

  it('cannot start session without approved applicants', async () => {
    const kp = await register('kp2');
    await loginAs(kp.id, kp.username);
    const rec = await callRoute(recruitmentsRoute.POST, {
      url: 'http://localhost/api/recruitments', method: 'POST',
      body: { title: '空团', summary: '没人报名', minPlayers: 1, maxPlayers: 3 },
    });
    const recId = rec.data.data.id;

    const start = await callRoute(startRoute.POST, {
      url: `http://localhost/api/recruitments/${recId}/start`, method: 'POST',
    });
    expect(start.status).toBe(400);
    expect(start.data.error.code).toBe('no_approved_applicants');
  });

  it('rejects application from retired character', async () => {
    const kp = await register('kp3');
    const pl = await register('pl3');
    const charId = await createCharacter(pl.id, 'Dead');
    await prisma.character.update({
      where: { id: charId },
      data: { status: 'RETIRED', retiredReason: 'asylum' },
    });

    // KP 发招募
    await loginAs(kp.id, kp.username);
    const rec = await callRoute(recruitmentsRoute.POST, {
      url: 'http://localhost/api/recruitments', method: 'POST',
      body: { title: '招募', summary: '测试', minPlayers: 1, maxPlayers: 3 },
    });
    const recId = rec.data.data.id;

    // PL 尝试用撕卡的车卡报名
    await loginAs(pl.id, pl.username);
    const app = await callRoute(applicationsRoute.POST, {
      url: `http://localhost/api/recruitments/${recId}/applications`, method: 'POST',
      body: { characterId: charId },
    });
    expect(app.status).toBe(400);
    expect(app.data.error.code).toBe('character_retired');
  });
});