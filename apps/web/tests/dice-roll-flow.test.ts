/**
 * 端到端业务测试：KP 公开掷骰流程
 *
 * 流程：
 *  1. schema 解析：DiceRollCreateSchema 接受 { title, description?, diceExpr }
 *  2. coc-rules：rollExpressionDetailed 出 total + 展开 rolls
 *  3. 写日志：type='DICE_ROLL' 的 LogEntry 写入 + 读回 payload 字段对齐
 *  4. 表达式边界：异常表达式应该被 schema 拒绝
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@coc-tools/db';
import { DiceRollCreateSchema, HpDiceRollSchema } from '@coc-tools/shared';
import { rollExpressionDetailed } from '@coc-tools/coc-rules';

describe('KP 公开掷骰', () => {
  beforeEach(async () => {
    await prisma.logEntry.deleteMany();
    await prisma.judgment.deleteMany();
    await prisma.character.deleteMany();
    await prisma.sessionMember.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  it('schema 接受 { title, description?, diceExpr }', () => {
    const r = DiceRollCreateSchema.parse({
      title: '决定先攻顺序',
      description: '掷高者先动',
      diceExpr: '1d100',
    });
    expect(r.title).toBe('决定先攻顺序');
    expect(r.description).toBe('掷高者先动');
    expect(r.diceExpr).toBe('1d100');
  });

  it('schema description 可省略', () => {
    const r = DiceRollCreateSchema.parse({ title: '天气', diceExpr: '1d6' });
    expect(r.description).toBeUndefined();
  });

  it('schema 拒绝空标题', () => {
    expect(() => DiceRollCreateSchema.parse({ title: '', diceExpr: '1d6' })).toThrow();
  });

  it('schema 拒绝非法骰子表达式', () => {
    expect(() => DiceRollCreateSchema.parse({ title: 'x', diceExpr: 'abc' })).toThrow();
    expect(() => DiceRollCreateSchema.parse({ title: 'x', diceExpr: '1d' })).toThrow();
  });

  it('rollExpressionDetailed 出 total + 展开 rolls', () => {
    const r = rollExpressionDetailed('1d100', () => 0.42); // floor(0.42*100)+1 = 43
    expect(r.total).toBe(43);
    expect(r.rolls).toEqual([43]);
    expect(r.expr).toBe('1d100');
  });

  it('完整流程：写 DICE_ROLL LogEntry 并读回 payload', async () => {
    const user = await prisma.user.create({
      data: { username: 'kp_pub', provider: 'LOCAL', passwordHash: 'x' },
    });
    const session = await prisma.session.create({
      data: { kpId: user.id, title: 'pub roll test', status: 'RUNNING', inGameTime: '10:00', inGameDate: '1/1', clockRunning: false, clockRate: 1 },
    });

    const parsed = DiceRollCreateSchema.parse({
      title: '天气',
      description: '本小时内的天气',
      diceExpr: '1d6',
    });
    const roll = rollExpressionDetailed(parsed.diceExpr, () => 0); // 1d6 → 1
    expect(roll.total).toBe(1);

    const entry = await prisma.logEntry.create({
      data: {
        sessionId: session.id,
        type: 'DICE_ROLL',
        authorId: user.id,
        payload: JSON.stringify({
          title: parsed.title,
          description: parsed.description,
          diceExpr: roll.expr,
          diceRolls: roll.rolls,
          diceTotal: roll.total,
          rolledByUsername: user.username,
        }),
        inGameTime: '10:30',
      },
    });

    const got = await prisma.logEntry.findUnique({ where: { id: entry.id } });
    expect(got?.type).toBe('DICE_ROLL');
    const payload = JSON.parse(got!.payload);
    expect(payload.title).toBe('天气');
    expect(payload.description).toBe('本小时内的天气');
    expect(payload.diceExpr).toBe('1d6');
    expect(payload.diceRolls).toEqual([1]);
    expect(payload.diceTotal).toBe(1);
    expect(payload.rolledByUsername).toBe('kp_pub');
    expect(got?.inGameTime).toBe('10:30');
  });

  it('HpDiceRollSchema 与 DiceRollCreateSchema 互不干扰', () => {
    // 两个 schema 字段不同：HpDiceRoll 要 characterId，公开掷骰要 title
    const hp = HpDiceRollSchema.parse({ characterId: 'abc', diceExpr: '1d6', reason: '测试' });
    expect(hp.characterId).toBe('abc');
    const pub = DiceRollCreateSchema.parse({ title: '天气', diceExpr: '1d6' });
    expect(pub.title).toBe('天气');
  });
});
