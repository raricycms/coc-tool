/**
 * 单元测试：@coc-tools/shared 各 zod schema 的边界条件。
 *
 * 已有 zodError.test.ts 测过 formatZodIssue 的中文格式化逻辑；这里聚焦
 * 「schema 本身该拒绝什么 / 该接受什么」。
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  RegisterSchema,
  LoginSchema,
  PrimaryStatsSchema,
  SkillSchema,
  WeaponSchema,
  EquipmentSchema,
  CharacterCreateSchema,
  CharacterUpdateSchema,
  RecruitmentCreateSchema,
  ApplicationCreateSchema,
  ApplicationReviewSchema,
  JudgmentCreateSchema,
  SanRecoverySchema,
  KnowledgeGainSchema,
  RetirementSchema,
  SkillGrowthRequestSchema,
  ClockControlSchema,
  OOCSendSchema,
  ICSendSchema,
  CharacterUpdateHPRequestSchema,
} from '@coc-tools/shared';

const VALID_PRIMARY = {
  str: 60, con: 70, siz: 50, dex: 60,
  app: 50, int: 65, pow: 50, edu: 70, luck: 50,
};

describe('auth schemas', () => {
  it('RegisterSchema: 合法输入通过', () => {
    expect(RegisterSchema.safeParse({
      username: 'alice',
      email: 'a@b.com',
      password: 'longpassword123',
      captchaToken: 'tk',
      captchaAnswer: '42',
    }).success).toBe(true);
  });

  it('RegisterSchema: 用户名 < 3 拒', () => {
    const r = RegisterSchema.safeParse({ username: 'ab', password: 'longpassword123', captchaToken: 't', captchaAnswer: 'a' });
    expect(r.success).toBe(false);
  });

  it('RegisterSchema: 用户名含非法字符拒', () => {
    const r = RegisterSchema.safeParse({ username: 'a b', password: 'longpassword123', captchaToken: 't', captchaAnswer: 'a' });
    expect(r.success).toBe(false);
  });

  it('RegisterSchema: 密码 < 10 拒', () => {
    const r = RegisterSchema.safeParse({ username: 'alice', password: 'short', captchaToken: 't', captchaAnswer: 'a' });
    expect(r.success).toBe(false);
  });

  it('RegisterSchema: 邮箱可选，不合法时被拒', () => {
    expect(RegisterSchema.safeParse({ username: 'valid', password: 'longpassword123', email: 'not-an-email', captchaToken: 't', captchaAnswer: 'a' }).success).toBe(false);
    expect(RegisterSchema.safeParse({ username: 'valid', password: 'longpassword123', captchaToken: 't', captchaAnswer: 'a' }).success).toBe(true);
  });

  it('LoginSchema: 用户名/密码非空', () => {
    expect(LoginSchema.safeParse({ username: 'a', password: 'longpassword123', captchaToken: 't', captchaAnswer: 'a' }).success).toBe(true);
    expect(LoginSchema.safeParse({ username: '', password: 'longpassword123', captchaToken: 't', captchaAnswer: 'a' }).success).toBe(false);
  });
});

describe('character schemas', () => {
  it('PrimaryStatsSchema: 八维均在 [1,999]', () => {
    expect(PrimaryStatsSchema.safeParse(VALID_PRIMARY).success).toBe(true);
    expect(PrimaryStatsSchema.safeParse({ ...VALID_PRIMARY, str: 0 }).success).toBe(false);
    expect(PrimaryStatsSchema.safeParse({ ...VALID_PRIMARY, str: 1000 }).success).toBe(false);
    expect(PrimaryStatsSchema.safeParse({ ...VALID_PRIMARY, str: 12.5 }).success).toBe(false);
  });

  it('PrimaryStatsSchema: 允许 >100 的高阶成长', () => {
    expect(PrimaryStatsSchema.safeParse({ ...VALID_PRIMARY, edu: 200 }).success).toBe(true);
    expect(PrimaryStatsSchema.safeParse({ ...VALID_PRIMARY, str: 999 }).success).toBe(true);
  });

  it('PrimaryStatsSchema: luck 默认 50', () => {
    const { luck, ...rest } = VALID_PRIMARY;
    const r = PrimaryStatsSchema.parse(rest);
    expect(r.luck).toBe(50);
  });

  it('SkillSchema: value 必须在 [0,999]', () => {
    expect(SkillSchema.safeParse({ name: '聆听', value: 0 }).success).toBe(true);
    expect(SkillSchema.safeParse({ name: '聆听', value: 200 }).success).toBe(true);
    expect(SkillSchema.safeParse({ name: '聆听', value: -1 }).success).toBe(false);
    expect(SkillSchema.safeParse({ name: '聆听', value: 1000 }).success).toBe(false);
  });

  it('SkillSchema: name 必填且 <= 40', () => {
    expect(SkillSchema.safeParse({ name: '', value: 10 }).success).toBe(false);
    expect(SkillSchema.safeParse({ name: 'x'.repeat(41), value: 10 }).success).toBe(false);
  });

  it('WeaponSchema: range/ammo 可选', () => {
    expect(WeaponSchema.safeParse({ name: '撬棍', skill: '格斗', damage: '1d6' }).success).toBe(true);
    expect(WeaponSchema.safeParse({ name: '撬棍', skill: '格斗', damage: '1d6', range: '近', ammo: 0 }).success).toBe(true);
  });

  it('EquipmentSchema: quantity 至少 1', () => {
    expect(EquipmentSchema.safeParse({ name: '手电', quantity: 1 }).success).toBe(true);
    expect(EquipmentSchema.safeParse({ name: '手电', quantity: 0 }).success).toBe(false);
  });

  it('CharacterCreateSchema: 完整有效输入通过', () => {
    const r = CharacterCreateSchema.safeParse({
      name: '林远',
      age: 30,
      era: '1920s',
      primary: VALID_PRIMARY,
      skills: [{ name: '侦察', value: 60 }],
    });
    expect(r.success).toBe(true);
  });

  it('CharacterCreateSchema: name 必填且 <= 30', () => {
    const r = CharacterCreateSchema.safeParse({
      name: '',
      primary: VALID_PRIMARY,
      skills: [],
    });
    expect(r.success).toBe(false);
  });

  it('CharacterCreateSchema: weapons/equipment 有默认 []', () => {
    const r = CharacterCreateSchema.parse({
      name: '林远',
      primary: VALID_PRIMARY,
      skills: [],
    });
    expect(r.weapons).toEqual([]);
    expect(r.equipment).toEqual([]);
  });

  it('CharacterCreateSchema: era 默认 modern', () => {
    const r = CharacterCreateSchema.parse({
      name: '林远',
      primary: VALID_PRIMARY,
      skills: [],
    });
    expect(r.era).toBe('modern');
  });

  it('CharacterCreateSchema: era 非法值被拒', () => {
    const r = CharacterCreateSchema.safeParse({
      name: '林远', era: 'futuristic',
      primary: VALID_PRIMARY,
      skills: [],
    });
    expect(r.success).toBe(false);
  });

  it('CharacterCreateSchema: 武器数量 > 50 拒', () => {
    const r = CharacterCreateSchema.safeParse({
      name: '林远',
      primary: VALID_PRIMARY,
      skills: [],
      weapons: Array.from({ length: 51 }, (_, i) => ({ name: `w${i}`, skill: 's', damage: '1' })),
    });
    expect(r.success).toBe(false);
  });

  it('CharacterUpdateSchema: 部分字段允许', () => {
    expect(CharacterUpdateSchema.safeParse({ name: '新名' }).success).toBe(true);
    expect(CharacterUpdateSchema.safeParse({ age: 40 }).success).toBe(true);
    expect(CharacterUpdateSchema.safeParse({ era: 'victorian' }).success).toBe(true);
  });
});

describe('recruitment schemas', () => {
  const base = {
    title: '《克苏鲁》',
    summary: '招募',
    minPlayers: 2,
    maxPlayers: 5,
  };

  it('RecruitmentCreateSchema: 合法通过', () => {
    expect(RecruitmentCreateSchema.safeParse(base).success).toBe(true);
  });

  it('RecruitmentCreateSchema: maxPlayers < minPlayers 被 refine 拒', () => {
    const r = RecruitmentCreateSchema.safeParse({ ...base, minPlayers: 5, maxPlayers: 2 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === 'maxPlayers')).toBe(true);
    }
  });

  it('RecruitmentCreateSchema: visibility 默认 public', () => {
    const r = RecruitmentCreateSchema.parse(base);
    expect(r.visibility).toBe('public');
  });

  it('ApplicationCreateSchema: characterId 必填，message 可选', () => {
    expect(ApplicationCreateSchema.safeParse({ characterId: 'abc', message: '想玩' }).success).toBe(true);
    expect(ApplicationCreateSchema.safeParse({ characterId: 'abc' }).success).toBe(true);
    expect(ApplicationCreateSchema.safeParse({ characterId: '' }).success).toBe(false);
  });

  it('ApplicationReviewSchema: action 仅 approve/reject', () => {
    expect(ApplicationReviewSchema.safeParse({ action: 'approve' }).success).toBe(true);
    expect(ApplicationReviewSchema.safeParse({ action: 'reject', reviewNote: '忙' }).success).toBe(true);
    expect(ApplicationReviewSchema.safeParse({ action: 'maybe' }).success).toBe(false);
  });
});

describe('judgment schema', () => {
  it('JudgmentCreateSchema: bonusDice 默认 0，difficulty 默认 regular', () => {
    const r = JudgmentCreateSchema.parse({
      targetCharacterId: 'c1',
      type: 'skill',
      skillName: '侦察',
    });
    expect(r.bonusDice).toBe(0);
    expect(r.difficulty).toBe('regular');
  });

  it('JudgmentCreateSchema: bonusDice [-5,5]，溢出拒', () => {
    expect(JudgmentCreateSchema.safeParse({ targetCharacterId: 'c', type: 'skill', skillName: 's', bonusDice: -5 }).success).toBe(true);
    expect(JudgmentCreateSchema.safeParse({ targetCharacterId: 'c', type: 'skill', skillName: 's', bonusDice: 5 }).success).toBe(true);
    expect(JudgmentCreateSchema.safeParse({ targetCharacterId: 'c', type: 'skill', skillName: 's', bonusDice: -6 }).success).toBe(false);
    expect(JudgmentCreateSchema.safeParse({ targetCharacterId: 'c', type: 'skill', skillName: 's', bonusDice: 6 }).success).toBe(false);
  });

  it('JudgmentCreateSchema: type 仅限枚举值', () => {
    expect(JudgmentCreateSchema.safeParse({ targetCharacterId: 'c', type: 'san', skillName: 's' }).success).toBe(true);
    expect(JudgmentCreateSchema.safeParse({ targetCharacterId: 'c', type: 'unknown', skillName: 's' }).success).toBe(false);
  });
});

describe('settlement schemas', () => {
  it('SanRecoverySchema: amount [0, 99]', () => {
    // SAN 恢复不应传负值：扣减走 SAN check / 神话扣减，不应从这一步走。
    expect(SanRecoverySchema.safeParse({ sanRecoveries: [{ characterId: 'c', amount: 99 }] }).success).toBe(true);
    expect(SanRecoverySchema.safeParse({ sanRecoveries: [{ characterId: 'c', amount: 0 }] }).success).toBe(true);
    expect(SanRecoverySchema.safeParse({ sanRecoveries: [{ characterId: 'c', amount: -50 }] }).success).toBe(false);
    expect(SanRecoverySchema.safeParse({ sanRecoveries: [{ characterId: 'c', amount: 100 }] }).success).toBe(false);
  });

  it('KnowledgeGainSchema: amount [0, 20]', () => {
    expect(KnowledgeGainSchema.safeParse({ knowledgeGains: [{ characterId: 'c', amount: 20 }] }).success).toBe(true);
    expect(KnowledgeGainSchema.safeParse({ knowledgeGains: [{ characterId: 'c', amount: -1 }] }).success).toBe(false);
  });

  it('RetirementSchema: reason 仅枚举', () => {
    expect(RetirementSchema.safeParse({ retirements: [{ characterId: 'c', reason: 'dead' }] }).success).toBe(true);
    expect(RetirementSchema.safeParse({ retirements: [{ characterId: 'c', reason: 'asylum', note: '精神崩溃' }] }).success).toBe(true);
    expect(RetirementSchema.safeParse({ retirements: [{ characterId: 'c', reason: 'unknown' }] }).success).toBe(false);
  });

  it('SkillGrowthRequestSchema: skillName 必填且 <= 40', () => {
    expect(SkillGrowthRequestSchema.safeParse({ growths: [{ characterId: 'c', skillName: '侦察' }] }).success).toBe(true);
    expect(SkillGrowthRequestSchema.safeParse({ growths: [{ characterId: 'c', skillName: '' }] }).success).toBe(false);
    expect(SkillGrowthRequestSchema.safeParse({ growths: [{ characterId: 'c', skillName: 'x'.repeat(41) }] }).success).toBe(false);
  });
});

describe('clock & chat schemas', () => {
  it('ClockControlSchema: discriminatedUnion 接受 5 种动作', () => {
    expect(ClockControlSchema.safeParse({ action: 'start' }).success).toBe(true);
    expect(ClockControlSchema.safeParse({ action: 'pause' }).success).toBe(true);
    expect(ClockControlSchema.safeParse({ action: 'setRate', rate: 2 }).success).toBe(true);
    expect(ClockControlSchema.safeParse({ action: 'setTime', inGameTime: '09:30', inGameDate: '1/1' }).success).toBe(true);
    expect(ClockControlSchema.safeParse({ action: 'addTime', deltaMinutes: 30 }).success).toBe(true);
    // setRate 的 rate 范围 [0.1, 100]
    expect(ClockControlSchema.safeParse({ action: 'setRate', rate: 0 }).success).toBe(false);
    expect(ClockControlSchema.safeParse({ action: 'setRate', rate: 101 }).success).toBe(false);
    // setTime 时间格式
    expect(ClockControlSchema.safeParse({ action: 'setTime', inGameTime: '25:00', inGameDate: '1/1' }).success).toBe(false);
    // addTime 范围 [-1440, 1440]
    expect(ClockControlSchema.safeParse({ action: 'addTime', deltaMinutes: 1441 }).success).toBe(false);
  });

  it('OOCSendSchema: content 1-2000', () => {
    expect(OOCSendSchema.safeParse({ content: 'hi' }).success).toBe(true);
    expect(OOCSendSchema.safeParse({ content: '' }).success).toBe(false);
    expect(OOCSendSchema.safeParse({ content: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('ICSendSchema: kind 仅 desc/dialogue', () => {
    expect(ICSendSchema.safeParse({ kind: 'dialogue', content: '你好' }).success).toBe(true);
    expect(ICSendSchema.safeParse({ kind: 'unknown', content: '你好' }).success).toBe(false);
  });

  it('CharacterUpdateHPRequestSchema: delta 范围 [-9999, 9999]', () => {
    expect(CharacterUpdateHPRequestSchema.safeParse({ characterId: 'c', delta: 5, reason: 'test' }).success).toBe(true);
    expect(CharacterUpdateHPRequestSchema.safeParse({ characterId: 'c', delta: -5, reason: 'test' }).success).toBe(true);
    expect(CharacterUpdateHPRequestSchema.safeParse({ characterId: 'c', delta: 10000, reason: 'test' }).success).toBe(false);
  });
});
