import { describe, it, expect } from 'vitest';
import {
  applyBonusDice,
  calculateSuccessLevel,
  calculateSanLoss,
  judge,
  rollForJudgment,
  type Difficulty,
} from '../src/judgment.js';

/**
 * 注入一个受控的随机数序列，让 1d10 严格按顺序返回。
 * next 调用 i 次会返回 idx[i]。
 */
function makeRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    // 把 [0, 1) 映射到 d10：[1, 10]
    // 直接当作 d10 值（1-10）
    return (v - 1) / 10;  // 让 rollD10 输出 v
  };
}

describe('judgment', () => {
  describe('rollForJudgment', () => {
    it('produces 1 d10 for bonusDice=0', () => {
      const r = rollForJudgment(0, makeRng([3]));
      expect(r).toEqual([3]);
    });
    it('produces 1+|bonusDice| d10 for non-zero', () => {
      const r = rollForJudgment(2, makeRng([1, 5, 7]));
      expect(r).toEqual([1, 5, 7]);
    });
    it('clamps bonusDice to [-5, 5]', () => {
      const r = rollForJudgment(99, makeRng([1, 2, 3, 4, 5, 6]));
      expect(r).toHaveLength(6);
    });
  });

  describe('applyBonusDice', () => {
    it('bonusDice=0: first roll', () => {
      expect(applyBonusDice([42], 0)).toEqual({ tens: 4, unit: 2 });
    });
    it('bonusDice>0: min', () => {
      expect(applyBonusDice([50, 30, 70], 2)).toEqual({ tens: 3, unit: 0 });
    });
    it('bonusDice<0: max', () => {
      expect(applyBonusDice([10, 50, 30], -2)).toEqual({ tens: 5, unit: 0 });
    });
    it('treats single digit correctly', () => {
      expect(applyBonusDice([5], 0)).toEqual({ tens: 0, unit: 5 });
    });
  });

  describe('calculateSuccessLevel', () => {
    const cases: Array<{ final: number; skill: number; difficulty: Difficulty; expected: string }> = [
      // 大失败
      { final: 100, skill: 50, difficulty: 'regular', expected: 'fumble' },

      // 大成功 (final=0, skill>=1)
      { final: 0, skill: 50, difficulty: 'regular', expected: 'critical' },

      // 极难成功 (final <= skill/5)
      { final: 5, skill: 50, difficulty: 'regular', expected: 'extreme' },
      { final: 10, skill: 50, difficulty: 'regular', expected: 'extreme' },

      // 困难成功 (final <= skill/2)
      { final: 11, skill: 50, difficulty: 'regular', expected: 'hard' },
      { final: 25, skill: 50, difficulty: 'regular', expected: 'hard' },

      // 常规成功
      { final: 26, skill: 50, difficulty: 'regular', expected: 'success' },
      { final: 50, skill: 50, difficulty: 'regular', expected: 'success' },

      // 失败
      { final: 51, skill: 50, difficulty: 'regular', expected: 'fail' },
      { final: 99, skill: 50, difficulty: 'regular', expected: 'fail' },

      // 难度极端时自动升 extreme
      { final: 25, skill: 50, difficulty: 'extreme', expected: 'extreme' },

      // 难度 hard 时维持 hard
      { final: 25, skill: 50, difficulty: 'hard', expected: 'hard' },
    ];

    for (const c of cases) {
      it(`final=${c.final} skill=${c.skill} diff=${c.difficulty} → ${c.expected}`, () => {
        expect(calculateSuccessLevel(c.final, c.skill, c.difficulty)).toBe(c.expected);
      });
    }
  });

  describe('judge (end-to-end with injected RNG)', () => {
    it('full success path with bonus dice picking min', () => {
      // bonusDice=1：基础 1d10 + 1 个奖励骰 = 2 个 d10
      // 投出 [5, 2]，取最小 2
      const r = judge({ skillValue: 50, difficulty: 'regular', bonusDice: 1, random: makeRng([5, 2]) });
      expect(r.rawRolls).toEqual([5, 2]);
      expect(r.tens).toBe(0);
      expect(r.unit).toBe(2);
      expect(r.final).toBe(2);
      expect(r.successLevel).toBe('extreme');   // 2 <= 50/5 = 10
    });

    it('penalty dice picks max', () => {
      // 投出 1, 9, 4；bonusDice=-2 时取 max = 9
      const r = judge({ skillValue: 50, difficulty: 'regular', bonusDice: -2, random: makeRng([1, 9, 4]) });
      expect(r.rawRolls).toEqual([1, 9, 4]);
      expect(r.final).toBe(9);
      expect(r.successLevel).toBe('extreme');   // 9 <= 10
    });

    it('fumble path', () => {
      // 投出 100
      const r = judge({ skillValue: 50, difficulty: 'regular', bonusDice: 0, random: makeRng([100]) });
      expect(r.final).toBe(100);
      expect(r.successLevel).toBe('fumble');
    });

    it('rejects invalid skillValue', () => {
      expect(() => judge({ skillValue: 200, difficulty: 'regular', bonusDice: 0 })).toThrow();
    });
  });

  describe('calculateSanLoss', () => {
    it('success returns scMin', () => {
      expect(calculateSanLoss('success', 1, 6, 50)).toBe(1);
    });
    it('extreme returns scMin', () => {
      expect(calculateSanLoss('extreme', 0, 5, 50)).toBe(0);
    });
    it('fumble returns scMax', () => {
      expect(calculateSanLoss('fumble', 1, 6, 50)).toBe(6);
    });
    it('fail random in [scMin, scMax]', () => {
      for (let i = 0; i < 20; i++) {
        const loss = calculateSanLoss('fail', 2, 5, 50);
        expect(loss).toBeGreaterThanOrEqual(2);
        expect(loss).toBeLessThanOrEqual(5);
      }
    });
    it('clamps to currentSan', () => {
      expect(calculateSanLoss('fumble', 1, 99, 5)).toBe(5);
    });
  });
});