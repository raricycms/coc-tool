/**
 * 集成测试：跑团结算
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@coc-tools/db';
import { callRoute, resetCookies, loginAs } from './helpers';
import { createCaptcha } from '@/lib/captcha';

import * as registerRoute from '@/app/api/auth/register/route';
import * as settleStartRoute from '@/app/api/sessions/[id]/settlement/route';
import * as settleSanRoute from '@/app/api/sessions/[id]/settlement/san-recovery/route';
import * as settleKnowledgeRoute from '@/app/api/sessions/[id]/settlement/knowledge/route';
import * as settleRetireRoute from '@/app/api/sessions/[id]/settlement/retirements/route';
import * as settleSkillRoute from '@/app/api/sessions/[id]/settlement/skill-growth/route';
import * as settleCompleteRoute from '@/app/api/sessions/[id]/settlement/complete/route';

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

async function makeSession(kpId: string, plId: string): Promise<{ sessionId: string; charId: string }> {
  // 直建 session，跳过招募流程
  const session = await prisma.session.create({
    data: {
      kpId, title: '测试团', status: 'RUNNING', scenario: 'test',
      inGameTime: '10:00', inGameDate: '1/1', clockRunning: false, clockRate: 1,
    },
  });
  const char = await prisma.character.create({
    data: {
      ownerId: plId, name: 'PL 卡', era: 'modern',
      ...VALID_PRIMARY,
      hpMax: 12, mpMax: 10, sanMax: 250, mov: 8, build: 110, damageBonus: '0',
      hpCurrent: 12, mpCurrent: 10, sanCurrent: 100, luckCurrent: 50,
      skills: { create: [{ name: '侦查', value: 50 }, { name: 'Cthulhu Mythos', value: 5, isMythos: true }] },
    },
  });
  await prisma.sessionMember.create({
    data: { sessionId: session.id, userId: kpId, role: 'KP' },
  });
  await prisma.sessionMember.create({
    data: { sessionId: session.id, userId: plId, characterId: char.id, role: 'PL' },
  });
  return { sessionId: session.id, charId: char.id };
}

describe('settlement flow', () => {
  beforeEach(() => {
    resetCookies();
  });

  it('full settlement flow: SAN → Mythos → retire → skill growth → complete', async () => {
    const kp = await register('kp_settle');
    const pl = await register('pl_settle');
    const { sessionId, charId } = await makeSession(kp.id, pl.id);

    // KP 身份进入结算
    await loginAs(kp.id, kp.username);

    // 1) 进入结算
    const start = await callRoute(settleStartRoute.POST, {
      url: `http://localhost/api/sessions/${sessionId}/settlement`, method: 'POST',
    });
    expect(start.status).toBe(200);
    expect(start.data.data.step).toBe('SAN_RECOVERY');

    let session = await prisma.session.findUnique({ where: { id: sessionId } });
    expect(session?.status).toBe('SETTLING');

    // 2) SAN 恢复 +5
    const san = await callRoute(settleSanRoute.POST, {
      url: `http://localhost/api/sessions/${sessionId}/settlement/san-recovery`, method: 'POST',
      body: { sanRecoveries: [{ characterId: charId, amount: 5 }] },
    });
    expect(san.status).toBe(200);
    expect(san.data.data.step).toBe('KNOWLEDGE_GAIN');

    let char = await prisma.character.findUnique({ where: { id: charId } });
    expect(char?.sanCurrent).toBe(105);

    // 3) Mythos +3（自动 -3 SAN）
    const know = await callRoute(settleKnowledgeRoute.POST, {
      url: `http://localhost/api/sessions/${sessionId}/settlement/knowledge`, method: 'POST',
      body: { knowledgeGains: [{ characterId: charId, amount: 3 }] },
    });
    expect(know.status).toBe(200);
    expect(know.data.data.step).toBe('RETIREMENT');

    char = await prisma.character.findUnique({
      where: { id: charId },
      include: { skills: true },
    });
    const mythos = char?.skills.find((s) => s.name === 'Cthulhu Mythos');
    expect(mythos?.value).toBe(8);
    expect(char?.sanCurrent).toBe(102);

    // 4) 撕卡
    const retire = await callRoute(settleRetireRoute.POST, {
      url: `http://localhost/api/sessions/${sessionId}/settlement/retirements`, method: 'POST',
      body: { retirements: [{ characterId: charId, reason: 'asylum' }] },
    });
    expect(retire.status).toBe(200);
    expect(retire.data.data.step).toBe('SKILL_GROWTH');

    char = await prisma.character.findUnique({ where: { id: charId } });
    expect(char?.status).toBe('RETIRED');

    // 5) 技能成长（PL 自己投）
    await loginAs(pl.id, pl.username);
    const skill = await callRoute(settleSkillRoute.POST, {
      url: `http://localhost/api/sessions/${sessionId}/settlement/skill-growth`, method: 'POST',
      body: { growths: [{ characterId: charId, skillName: '侦查' }] },
    });
    expect(skill.status).toBe(200);
    expect(Array.isArray(skill.data.data.results)).toBe(true);

    char = await prisma.character.findUnique({
      where: { id: charId },
      include: { skills: true },
    });
    const detect = char?.skills.find((s) => s.name === '侦查');
    expect(detect?.value).toBeGreaterThanOrEqual(50);

    // 6) 完结（KP）
    await loginAs(kp.id, kp.username);
    const complete = await callRoute(settleCompleteRoute.POST, {
      url: `http://localhost/api/sessions/${sessionId}/settlement/complete`, method: 'POST',
    });
    expect(complete.status).toBe(200);

    session = await prisma.session.findUnique({ where: { id: sessionId } });
    expect(session?.status).toBe('FINISHED');
  });

  it('san recovery is clamped to sanMax', async () => {
    const kp = await register('kp_clamp');
    const pl = await register('pl_clamp');
    const { sessionId, charId } = await makeSession(kp.id, pl.id);
    await prisma.session.update({ where: { id: sessionId }, data: { status: 'SETTLING' } });
    await prisma.settlement.create({ data: { sessionId, step: 'SAN_RECOVERY' } });

    await loginAs(kp.id, kp.username);
    // 起始 SAN=100，+99 后 =199 < 250 不截断；为验证 clamp 我们手工先回滚测试
    // 直接把 amount 调到 schema 上限 99，能验证 clamp 路径（虽然不会真触发）
    const res = await callRoute(settleSanRoute.POST, {
      url: `http://localhost/api/sessions/${sessionId}/settlement/san-recovery`, method: 'POST',
      body: { sanRecoveries: [{ characterId: charId, amount: 99 }] },
    });
    expect(res.status).toBe(200);
    // 100 + 99 = 199，sanMax=250，未截断
    let char = await prisma.character.findUnique({ where: { id: charId } });
    expect(char?.sanCurrent).toBe(199);

    // 直接 SQL 把 sanCurrent 设到接近 max，再调一次看 clamp
    await prisma.character.update({ where: { id: charId }, data: { sanCurrent: 240 } });
    await prisma.settlement.update({
      where: { sessionId }, data: { step: 'SAN_RECOVERY', sanRecoveries: null },
    });
    const res2 = await callRoute(settleSanRoute.POST, {
      url: `http://localhost/api/sessions/${sessionId}/settlement/san-recovery`, method: 'POST',
      body: { sanRecoveries: [{ characterId: charId, amount: 50 }] },
    });
    expect(res2.status).toBe(200);
    char = await prisma.character.findUnique({ where: { id: charId } });
    expect(char?.sanCurrent).toBe(250);  // 240 + 50 = 290 → clamp 到 250
  });

  it('cannot complete a non-settling session', async () => {
    const kp = await register('kp_no_set');
    const pl = await register('pl_no_set');
    const { sessionId } = await makeSession(kp.id, pl.id);

    await loginAs(kp.id, kp.username);
    const res = await callRoute(settleCompleteRoute.POST, {
      url: `http://localhost/api/sessions/${sessionId}/settlement/complete`, method: 'POST',
    });
    expect(res.status).toBe(400);
  });
});