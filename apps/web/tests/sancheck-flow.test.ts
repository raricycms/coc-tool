/**
 * 端到端业务测试：SAN check 走双骰表达式 + 按基础属性判定
 *
 * 这是 issue 2 + 3 的回归测试。
 *
 * 流程：
 *  1. 用 prisma 直接写一个新 SAN check 判定，带 scSuccessExpr/scFailureExpr
 *  2. 调 calculateSanLossFromExpr 模拟投骰
 *  3. 验证 scLoss 写入数据库
 *  4. 验证 LogEntry 写入正确
 *  5. 对应 STR/DEX 等基础属性走「resolvePrimaryStatKey 分发」
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@coc-tools/db';
import {
  calculateSanLossFromExpr,
  resolvePrimaryStatKey,
  judge as runJudgment,
  SUCCESS_LABELS,
} from '@coc-tools/coc-rules';

describe('SAN check 双骰表达式流程', () => {
  beforeEach(async () => {
    await prisma.logEntry.deleteMany();
    await prisma.judgment.deleteMany();
    await prisma.character.deleteMany();
    await prisma.sessionMember.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  it('SAN check pass: 投 1d100=30 ≤ san=50，按 success 骰扣 SAN', async () => {
    const user = await prisma.user.create({
      data: { username: 'kp1', provider: 'LOCAL', passwordHash: 'x' },
    });
    const char = await prisma.character.create({
      data: {
        ownerId: user.id, name: '调查员A', era: 'modern',
        str: 60, con: 70, siz: 50, dex: 60, app: 50, int: 65, pow: 50, edu: 70, luck: 50,
        hpMax: 12, mpMax: 10, sanMax: 50, mov: 8, build: 110, damageBonus: '0',
        hpCurrent: 12, mpCurrent: 10, sanCurrent: 50, luckCurrent: 50,
      },
    });
    const session = await prisma.session.create({
      data: { kpId: user.id, title: 't', status: 'RUNNING', inGameTime: '10:00', inGameDate: '1/1', clockRunning: false, clockRate: 1 },
    });
    await prisma.sessionMember.create({
      data: { sessionId: session.id, userId: user.id, characterId: char.id, role: 'KP' },
    });

    // 1) 写入 SAN check 判定（新字段格式）
    const j = await prisma.judgment.create({
      data: {
        sessionId: session.id,
        characterId: char.id,
        skillName: 'SAN',
        difficulty: 'regular',
        bonusDice: 0,
        scSuccessExpr: '1d3',
        scFailureExpr: '1d6',
        status: 'PENDING',
        targetSnapshot: JSON.stringify({
          skillName: 'SAN', value: char.sanCurrent, hp: char.hpCurrent, san: char.sanCurrent,
        }),
      },
    });
    expect(j.scSuccessExpr).toBe('1d3');
    expect(j.scFailureExpr).toBe('1d6');

    // 2) 模拟 PL 投骰 30 vs san=50 → 通过 → successExpr=1d3 → rng 给 1
    const sanResult = calculateSanLossFromExpr(
      30, char.sanCurrent, '1d3', '1d6',
      () => 0, // 1d3 → 1
    );
    expect(sanResult.passed).toBe(true);
    expect(sanResult.expr).toBe('1d3');
    expect(sanResult.rolls).toEqual([1]);
    expect(sanResult.loss).toBe(1);

    // 3) 更新 judgment 记录结果（含新字段）
    const updated = await prisma.judgment.update({
      where: { id: j.id },
      data: {
        status: 'RESOLVED',
        diceRolls: JSON.stringify([30]),
        tens: 3, unit: 0,
        successLevel: 'success',
        scLoss: sanResult.loss,
        sanPassed: sanResult.passed,
        sanLossExpr: sanResult.expr,
        sanLossRolls: JSON.stringify(sanResult.rolls),
        rolledAt: new Date(),
      },
    });
    expect(updated.sanPassed).toBe(true);
    expect(updated.sanLossExpr).toBe('1d3');
    expect(JSON.parse(updated.sanLossRolls!)).toEqual([1]);

    // 4) 写日志（带新字段）
    const log = await prisma.logEntry.create({
      data: {
        sessionId: session.id,
        type: 'JUDGMENT',
        judgmentId: j.id,
        characterId: char.id,
        payload: JSON.stringify({
          skillName: 'SAN', difficulty: 'regular', bonusDice: 0,
          rawRolls: [30], final: 30, successLevel: 'success',
          sanPassed: true, sanLossExpr: '1d3', sanLossRolls: [1],
          scLoss: 1,
        }),
      },
    });
    const parsed = JSON.parse(log.payload);
    expect(parsed.sanPassed).toBe(true);
    expect(parsed.sanLossRolls).toEqual([1]);
  });

  it('SAN check fail: 投 1d100=80 > san=50，按 failure 骰扣 SAN', async () => {
    const user = await prisma.user.create({
      data: { username: 'kp2', provider: 'LOCAL', passwordHash: 'x' },
    });
    const char = await prisma.character.create({
      data: {
        ownerId: user.id, name: '调查员B', era: 'modern',
        str: 60, con: 70, siz: 50, dex: 60, app: 50, int: 65, pow: 50, edu: 70, luck: 50,
        hpMax: 12, mpMax: 10, sanMax: 50, mov: 8, build: 110, damageBonus: '0',
        hpCurrent: 12, mpCurrent: 10, sanCurrent: 30, luckCurrent: 50,
      },
    });
    const session = await prisma.session.create({
      data: { kpId: user.id, title: 't', status: 'RUNNING', inGameTime: '10:00', inGameDate: '1/1', clockRunning: false, clockRate: 1 },
    });

    // 失败分支：1d6 → rng=0.5 → 投出 4
    const r = calculateSanLossFromExpr(
      80, char.sanCurrent, '1d3', '1d6',
      () => 0.5,
    );
    expect(r.passed).toBe(false);
    expect(r.expr).toBe('1d6');
    expect(r.rolls).toEqual([4]);
    expect(r.loss).toBe(4);

    // 角色 SAN 从 30 降到 26
    await prisma.character.update({
      where: { id: char.id },
      data: { sanCurrent: char.sanCurrent - r.loss },
    });
    const after = await prisma.character.findUnique({ where: { id: char.id } });
    expect(after?.sanCurrent).toBe(26);
  });

  it('SAN check fumble (100): 即便 SAN=99 也按失败扣', async () => {
    // fumble: final=100 → 必失败，failureExpr='1d6'
    const r = calculateSanLossFromExpr(
      100, 99, '1d3', '1d6',
      () => 0, // 1d6 → 1
    );
    expect(r.passed).toBe(false);
    expect(r.loss).toBe(1);
  });

  it('SAN check critical (1): 即便 SAN 低也按成功扣', async () => {
    const r = calculateSanLossFromExpr(
      1, 30, '1d3', '1d6',
      () => 0.5, // 1d3 → floor(0.5*3)+1 = 2
    );
    expect(r.passed).toBe(true);
    expect(r.expr).toBe('1d3');
    expect(r.rolls).toEqual([2]);
    expect(r.loss).toBe(2);
  });

  it('SAN check clamped: san=3, 失败投出 6 → clamp 到 3', async () => {
    const r = calculateSanLossFromExpr(
      80, 3, '1d3', '1d6',
      () => 0.9, // 1d6 → 6
    );
    expect(r.passed).toBe(false);
    expect(r.rolls).toEqual([6]);
    expect(r.loss).toBe(3);
  });

  it('SAN check empty expr: 视为不扣', async () => {
    const r = calculateSanLossFromExpr(80, 50, '', '', () => 0.5);
    expect(r.passed).toBe(false);
    expect(r.loss).toBe(0);
    expect(r.rolls).toEqual([]);
  });

  it('SAN check bad expr: 不抛错，损失 0', async () => {
    const r = calculateSanLossFromExpr(35, 50, 'abc', '1d6', () => 0.5);
    expect(r.passed).toBe(true);
    expect(r.loss).toBe(0);
  });
});

describe('基础属性判定分发', () => {
  it('resolvePrimaryStatKey 命中大小写不敏感', () => {
    expect(resolvePrimaryStatKey('STR')).toBe('str');
    expect(resolvePrimaryStatKey('CON')).toBe('con');
    expect(resolvePrimaryStatKey('POW')).toBe('pow');
    expect(resolvePrimaryStatKey('EDU')).toBe('edu');
    expect(resolvePrimaryStatKey('dex')).toBe('dex');
    expect(resolvePrimaryStatKey('app')).toBe('app');
  });

  it('resolvePrimaryStatKey 拒绝非基础属性', () => {
    expect(resolvePrimaryStatKey('侦察')).toBe(null);
    expect(resolvePrimaryStatKey('SAN')).toBe(null);
    expect(resolvePrimaryStatKey('LUCK')).toBe(null);
    expect(resolvePrimaryStatKey('INTEL')).toBe(null);  // 太长，不像 INT
  });

  it('属性判定：1d100 vs str=60 应有合理成功等级', async () => {
    const user = await prisma.user.create({
      data: { username: 'kp3', provider: 'LOCAL', passwordHash: 'x' },
    });
    const char = await prisma.character.create({
      data: {
        ownerId: user.id, name: '调查员C', era: 'modern',
        str: 60, con: 70, siz: 50, dex: 60, app: 50, int: 65, pow: 50, edu: 70, luck: 50,
        hpMax: 12, mpMax: 10, sanMax: 50, mov: 8, build: 110, damageBonus: '0',
        hpCurrent: 12, mpCurrent: 10, sanCurrent: 50, luckCurrent: 50,
      },
    });

    // KP 发布「STR」判定
    const statKey = resolvePrimaryStatKey('STR');
    expect(statKey).toBe('str');
    const skillValue = (char as any)[statKey!] as number;
    expect(skillValue).toBe(60);

    // 模拟投出 30
    // CoC 成功等级规则：final <= skill/5 极难 / <= skill/2 困难 / <= skill 成功
    //   skill=60 → extreme≤12, hard≤30, success≤60
    //   final=30 → 落在 hard
    const result = runJudgment({
      skillValue,
      difficulty: 'regular',
      bonusDice: 0,
      random: () => (30 - 0.5) / 10,  // d10 → 30
    });
    expect(result.final).toBe(30);
    expect(result.successLevel).toBe('hard');  // 30 <= 60/2
    expect(SUCCESS_LABELS[result.successLevel]).toBe('困难成功');
  });

  it('属性判定极难成功：1d100=10 vs STR=60', () => {
    const r = runJudgment({
      skillValue: 60,
      difficulty: 'regular',
      bonusDice: 0,
      random: () => (10 - 0.5) / 10,
    });
    expect(r.final).toBe(10);
    expect(r.successLevel).toBe('extreme');  // 10 <= 60/5=12
  });
});
