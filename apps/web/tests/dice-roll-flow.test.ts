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
import {
  DiceRollCreateSchema,
  HpDiceRollSchema,
  WeaponUpsertSchema,
  WeaponDeleteSchema,
  EquipmentUpsertSchema,
  EquipmentDeleteSchema,
} from '@coc-tools/shared';
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

  it('WeaponUpsertSchema: 新增（无 id）', () => {
    const r = WeaponUpsertSchema.parse({
      characterId: 'char_1',
      name: '小刀',
      skill: '斗殴',
      damage: '1d4',
      range: '近战',
      ammo: 0,
    });
    expect(r.id).toBeUndefined();
    expect(r.name).toBe('小刀');
  });

  it('WeaponUpsertSchema: 编辑（带 id）', () => {
    const r = WeaponUpsertSchema.parse({
      characterId: 'char_1', id: 'w_existing',
      name: '小刀+1', skill: '斗殴', damage: '1d4+1',
    });
    expect(r.id).toBe('w_existing');
    expect(r.damage).toBe('1d4+1');
  });

  it('WeaponUpsertSchema: 拒绝空 name / skill / damage', () => {
    expect(() => WeaponUpsertSchema.parse({ characterId: 'c', name: '', skill: 'x', damage: '1d4' })).toThrow();
    expect(() => WeaponUpsertSchema.parse({ characterId: 'c', name: 'x', skill: '', damage: '1d4' })).toThrow();
    expect(() => WeaponUpsertSchema.parse({ characterId: 'c', name: 'x', skill: 'y', damage: '' })).toThrow();
  });

  it('WeaponDeleteSchema', () => {
    const r = WeaponDeleteSchema.parse({ characterId: 'char_1', id: 'w_existing' });
    expect(r.id).toBe('w_existing');
  });

  it('EquipmentUpsertSchema: 新增（默认 quantity=1）', () => {
    const r = EquipmentUpsertSchema.parse({ characterId: 'char_1', name: '手电筒' });
    expect(r.quantity).toBe(1);
  });

  it('EquipmentUpsertSchema: 编辑（带 id + quantity）', () => {
    const r = EquipmentUpsertSchema.parse({ characterId: 'c', id: 'e1', name: '火柴', quantity: 12 });
    expect(r.id).toBe('e1');
    expect(r.quantity).toBe(12);
  });

  it('EquipmentUpsertSchema: 拒绝 quantity<1', () => {
    expect(() => EquipmentUpsertSchema.parse({ characterId: 'c', name: 'x', quantity: 0 })).toThrow();
  });

  it('EquipmentDeleteSchema', () => {
    const r = EquipmentDeleteSchema.parse({ characterId: 'char_1', id: 'e_existing' });
    expect(r.id).toBe('e_existing');
  });

  it('DB 端到端：创建角色 → upsert → delete 武器', async () => {
    const user = await prisma.user.create({
      data: { username: 'kp_weap', provider: 'LOCAL', passwordHash: 'x' },
    });
    const char = await prisma.character.create({
      data: {
        ownerId: user.id, name: '调查员', era: 'modern',
        str: 60, con: 70, siz: 50, dex: 60, app: 50, int: 65, pow: 50, edu: 70, luck: 50,
        hpMax: 12, mpMax: 10, sanMax: 50, mov: 8, build: 110, damageBonus: '0',
        hpCurrent: 12, mpCurrent: 10, sanCurrent: 50, luckCurrent: 50,
      },
    });

    const upserted = WeaponUpsertSchema.parse({
      characterId: char.id,
      name: '左轮', skill: '手枪', damage: '1d10',
      range: '15m', ammo: 6,
    });
    const w = await prisma.weapon.create({
      data: {
        characterId: upserted.characterId,
        name: upserted.name, skill: upserted.skill, damage: upserted.damage,
        range: upserted.range ?? null, ammo: upserted.ammo ?? null,
      },
    });
    expect(w.name).toBe('左轮');

    // 模拟编辑
    await prisma.weapon.update({
      where: { id: w.id },
      data: { ammo: 12 },
    });
    const got = await prisma.weapon.findUnique({ where: { id: w.id } });
    expect(got?.ammo).toBe(12);

    // 模拟删除
    const del = WeaponDeleteSchema.parse({ characterId: char.id, id: w.id });
    await prisma.weapon.delete({ where: { id: del.id } });
    const after = await prisma.weapon.findUnique({ where: { id: w.id } });
    expect(after).toBeNull();
  });
});
