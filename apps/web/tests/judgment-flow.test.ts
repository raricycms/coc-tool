/**
 * 业务逻辑测试：判定流程（不通过 WebSocket，直接调 service 函数）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@coc-tools/db';
import {
  judge as runJudgment,
  calculateSanLoss,
  judgeSkillGrowth,
} from '@coc-tools/coc-rules';

describe('judgment business logic', () => {
  beforeEach(async () => {
    await prisma.logEntry.deleteMany();
    await prisma.judgment.deleteMany();
    await prisma.character.deleteMany();
    await prisma.user.deleteMany();
  });

  it('full judgment + SAN loss + char update flow', async () => {
    const user = await prisma.user.create({
      data: { username: 'tester', provider: 'LOCAL', passwordHash: 'x' },
    });
    const char = await prisma.character.create({
      data: {
        ownerId: user.id, name: 'PC', era: 'modern',
        str: 60, con: 70, siz: 50, dex: 60, app: 50, int: 65, pow: 50, edu: 70, luck: 50,
        hpMax: 12, mpMax: 10, sanMax: 250, mov: 8, build: 110, damageBonus: '0',
        hpCurrent: 12, mpCurrent: 10, sanCurrent: 50, luckCurrent: 50,
        skills: { create: [{ name: '侦察', value: 50 }] },
      },
    });
    const session = await prisma.session.create({
      data: { kpId: user.id, title: 'test', status: 'RUNNING', inGameTime: '10:00', inGameDate: '1/1', clockRunning: false, clockRate: 1 },
    });
    await prisma.sessionMember.create({
      data: { sessionId: session.id, userId: user.id, characterId: char.id, role: 'KP' },
    });

    // 1) KP 创建 SAN 判定
    const skill = await prisma.skill.findFirst({ where: { characterId: char.id, name: '侦察' } });
    const j = await prisma.judgment.create({
      data: {
        sessionId: session.id,
        characterId: char.id,
        skillName: '侦察',
        difficulty: 'hard',
        bonusDice: 0,
        scMin: null,
        scMax: null,
        status: 'PENDING',
        targetSnapshot: JSON.stringify({ skillName: '侦察', value: skill!.value, hp: char.hpCurrent, san: char.sanCurrent }),
      },
    });
    expect(j.status).toBe('PENDING');

    // 2) 用注入 RNG 让骰出 25（应得困难成功）
    const result = runJudgment({
      skillValue: skill!.value,
      difficulty: 'hard',
      bonusDice: 0,
      random: () => (25 - 0.5) / 10,  // d10 → 25
    });
    expect(result.rawRolls).toEqual([25]);
    expect(result.final).toBe(25);
    expect(result.successLevel).toBe('hard');  // 25 <= 50/2

    // 3) 更新 judgment + 写日志
    await prisma.judgment.update({
      where: { id: j.id },
      data: {
        status: 'RESOLVED',
        diceRolls: JSON.stringify(result.rawRolls),
        tens: result.tens, unit: result.unit,
        successLevel: result.successLevel,
        rolledAt: new Date(),
      },
    });
    await prisma.logEntry.create({
      data: {
        sessionId: session.id, type: 'JUDGMENT', judgmentId: j.id,
        characterId: char.id,
        payload: JSON.stringify({
          skillName: '侦察', difficulty: 'hard', bonusDice: 0,
          rawRolls: result.rawRolls, final: result.final,
          successLevel: result.successLevel,
        }),
      },
    });

    const updated = await prisma.judgment.findUnique({ where: { id: j.id } });
    expect(updated?.status).toBe('RESOLVED');
    expect(updated?.successLevel).toBe('hard');

    const logs = await prisma.logEntry.findMany({ where: { sessionId: session.id, type: 'JUDGMENT' } });
    expect(logs).toHaveLength(1);
    const payload = JSON.parse(logs[0].payload);
    expect(payload.successLevel).toBe('hard');
  });

  it('SAN judgment deducts SAN on fail', () => {
    const sanLoss = calculateSanLoss('fail', 1, 6, 50);
    expect(sanLoss).toBeGreaterThanOrEqual(1);
    expect(sanLoss).toBeLessThanOrEqual(6);
  });

  it('SAN judgment deducts scMin on success', () => {
    const sanLoss = calculateSanLoss('success', 1, 6, 50);
    expect(sanLoss).toBe(1);
  });

  it('SAN clamped to currentSan', () => {
    const sanLoss = calculateSanLoss('fumble', 1, 6, 3);
    expect(sanLoss).toBe(3);
  });

  it('skill growth boundary: 95 = auto fail', () => {
    const r = judgeSkillGrowth({ skillValue: 95 });
    expect(r.succeeded).toBe(false);
  });
});