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
      hpMax: 12, mpMax: 10, sanMax: 50, mov: 8, build: 110, damageBonus: '0',
      hpCurrent: 12, mpCurrent: 10, sanCurrent: 0, luckCurrent: 50,
      skills: { create: [{ name: '侦察', value: 50 }, { name: '克苏鲁知识', value: 5, isMythos: true }] },
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
    expect(char?.sanCurrent).toBe(5);  // 0 + 5 = 5, sanMax=50, 未截断

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
    const mythos = char?.skills.find((s) => s.name === '克苏鲁知识');
    expect(mythos?.value).toBe(8);
    expect(char?.sanCurrent).toBe(2);  // 5 - 3 = 2 (Mythos 自动扣 SAN)

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
      body: { growths: [{ characterId: charId, skillName: '侦察' }] },
    });
    expect(skill.status).toBe(200);
    expect(Array.isArray(skill.data.data.results)).toBe(true);

    char = await prisma.character.findUnique({
      where: { id: charId },
      include: { skills: true },
    });
    const detect = char?.skills.find((s) => s.name === '侦察');
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
    // 起始 SAN=100，sanMax=50，立刻就会被截断。先证未截断路径：把 sanCurrent 调到 0
    await prisma.character.update({ where: { id: charId }, data: { sanCurrent: 0 } });
    const res = await callRoute(settleSanRoute.POST, {
      url: `http://localhost/api/sessions/${sessionId}/settlement/san-recovery`, method: 'POST',
      body: { sanRecoveries: [{ characterId: charId, amount: 40 }] },
    });
    expect(res.status).toBe(200);
    // 0 + 40 = 40，sanMax=50，未截断
    let char = await prisma.character.findUnique({ where: { id: charId } });
    expect(char?.sanCurrent).toBe(40);

    // 直接 SQL 把 sanCurrent 设到接近 max，再调一次看 clamp
    await prisma.character.update({ where: { id: charId }, data: { sanCurrent: 45 } });
    await prisma.settlement.update({
      where: { sessionId }, data: { step: 'SAN_RECOVERY', sanRecoveries: null },
    });
    const res2 = await callRoute(settleSanRoute.POST, {
      url: `http://localhost/api/sessions/${sessionId}/settlement/san-recovery`, method: 'POST',
      body: { sanRecoveries: [{ characterId: charId, amount: 20 }] },
    });
    expect(res2.status).toBe(200);
    char = await prisma.character.findUnique({ where: { id: charId } });
    expect(char?.sanCurrent).toBe(50);  // 45 + 20 = 65 → clamp 到 sanMax=50
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

  // 回归 fix：KP 在跑团页点「→ 结算」链接直接落到 wizard 页。
  // 旧版 wizard 没主动调开始结算接口，第一步 SAN 恢复就会被 `not_settling` 拒掉，
  // 用户看到一句没有任何上下文的「SAN 恢复失败」。现在 wizard 的页面入口在
  // 服务端把 Session 切到 SETTLING 并补上 Settlement 行；这里用事务来镜像
  // 那个行为，验证前置条件满足后 san-recovery 接口能正常跑通。
  it('KP 直接从 RUNNING 进入结算页 → SAN 恢复接口直接可用', async () => {
    const kp = await register('kp_direct_enter');
    const pl = await register('pl_direct_enter');
    const { sessionId, charId } = await makeSession(kp.id, pl.id);

    // 模拟 wizard 页面入口的副作用：把 RUNNING → SETTLING + upsert Settlement。
    // 注意：keepTransactions=false 时 settlement.update 会跑在另一个连接上，
    // 落库时间戳会被刷新，但 path 是一致的（crud 都不需要按时间排序）。
    await prisma.$transaction([
      prisma.session.update({ where: { id: sessionId }, data: { status: 'SETTLING' } }),
      prisma.settlement.upsert({
        where: { sessionId },
        create: { sessionId, step: 'SAN_RECOVERY' },
        update: {},
      }),
    ]);

    let session = await prisma.session.findUnique({ where: { id: sessionId } });
    expect(session?.status).toBe('SETTLING');
    let settle = await prisma.settlement.findUnique({ where: { sessionId } });
    expect(settle?.step).toBe('SAN_RECOVERY');

    await loginAs(kp.id, kp.username);
    const res = await callRoute(settleSanRoute.POST, {
      url: `http://localhost/api/sessions/${sessionId}/settlement/san-recovery`, method: 'POST',
      body: { sanRecoveries: [{ characterId: charId, amount: 5 }] },
    });
    expect(res.status).toBe(200);
    expect(res.data.data.step).toBe('KNOWLEDGE_GAIN');

    const char = await prisma.character.findUnique({ where: { id: charId } });
    expect(char?.sanCurrent).toBe(5);
  });

  // 反向证明：不走自动过渡、直接把 SAN 恢复请求丢给仍在 RUNNING 的 session
  // 会被接口按设计要求拒，给 wizard 一个明确的 `not_settling`。这能锁住
  // 「接口层不允许拿一个非结算态去动 SAN」这条约定不被后续 refactor 偷偷放宽。
  it('未进入结算态时 SAN 恢复必须被拒（not_settling）', async () => {
    const kp = await register('kp_no_entrance');
    const pl = await register('pl_no_entrance');
    const { sessionId, charId } = await makeSession(kp.id, pl.id);
    // 注意：makeSession 默认是 RUNNING，没有任何前向过渡。

    await loginAs(kp.id, kp.username);
    const res = await callRoute(settleSanRoute.POST, {
      url: `http://localhost/api/sessions/${sessionId}/settlement/san-recovery`, method: 'POST',
      body: { sanRecoveries: [{ characterId: charId, amount: 5 }] },
    });
    expect(res.status).toBe(400);
    expect(res.data.error.code).toBe('not_settling');
  });
});