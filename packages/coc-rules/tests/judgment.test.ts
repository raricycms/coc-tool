import { describe, it, expect } from 'vitest';
import {
  applyBonusDice,
  calculateSuccessLevel,
  calculateSanLoss,
  calculateSanLossFromExpr,
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

  /**
   * calculateSanLossFromExpr：CoC 7e SAN check 路径
   *   - PL 投 1d100 → 与 sanValue 比对
   *   - 成功 → 掷 successExpr；失败 → 掷 failureExpr
   *   - 100 = fumble 自动失败；1 = critical 自动成功（仅 san>=1 时）
   *
   * makeRng 帮助函数：返回 (v-1)/10，让 rollD10 输出 v。
   * 注意：同样的 rng 用于不同面数骰时会得到不同结果：
   *   - rollD10 = floor(rng * 10) + 1
   *   - rollD6  = floor(rng *  6) + 1
   *   - rollD3  = floor(rng *  3) + 1
   */
  describe('calculateSanLossFromExpr', () => {
    it('passes when final <= sanValue and rolls success expr', () => {
      // final=35 san=50 → pass；成功 1d3 + makeRng([1])=0 → floor(0*3)+1 = 1
      const r = calculateSanLossFromExpr(35, 50, '1d3', '1d6', makeRng([1]));
      expect(r.passed).toBe(true);
      expect(r.loss).toBe(1);
      expect(r.rolls).toEqual([1]);
      expect(r.expr).toBe('1d3');
    });

    it('fails when final > sanValue and rolls failure expr', () => {
      // final=55 san=50 → fail；失败 1d6 + makeRng([4])=0.3 → floor(0.3*6)+1 = 2
      const r = calculateSanLossFromExpr(55, 50, '1d3', '1d6', makeRng([4]));
      expect(r.passed).toBe(false);
      expect(r.loss).toBe(2);
      expect(r.rolls).toEqual([2]);
      expect(r.expr).toBe('1d6');
    });

    it('final=100 is fumble → always fail', () => {
      // final=100 san=99 → 自动失败；1d6 + makeRng([5])=0.4 → floor(0.4*6)+1 = 3
      const r = calculateSanLossFromExpr(100, 99, '1d3', '1d6', makeRng([5]));
      expect(r.passed).toBe(false);
      expect(r.loss).toBe(3);
      expect(r.expr).toBe('1d6');
    });

    it('final=1 is critical → always pass (when san>=1)', () => {
      // final=1 san=30 → 自动成功；1d3 + makeRng([2])=0.1 → floor(0.1*3)+1 = 1
      const r = calculateSanLossFromExpr(1, 30, '1d3', '1d6', makeRng([2]));
      expect(r.passed).toBe(true);
      expect(r.loss).toBe(1);
      expect(r.expr).toBe('1d3');
    });

    it('clamps loss to sanValue', () => {
      // sanValue=3 太低，无论骰出几都 clamp 到 3
      const r = calculateSanLossFromExpr(99, 3, '1d3', '1d6', makeRng([6]));
      expect(r.passed).toBe(false);
      expect(r.loss).toBe(3);
    });

    it('supports composite expr (1d6+2)', () => {
      // 失败 1d6+2 + makeRng([4])=0.3 → 1d6 投出 2, +2 = 4
      const r = calculateSanLossFromExpr(80, 50, '0', '1d6+2', makeRng([4]));
      expect(r.passed).toBe(false);
      expect(r.loss).toBe(4);
      expect(r.rolls).toEqual([2, 2]);
    });

    it('empty expression → loss 0 (no error)', () => {
      const r = calculateSanLossFromExpr(35, 50, '', '1d6', makeRng([5]));
      expect(r.passed).toBe(true);
      expect(r.loss).toBe(0);
      expect(r.rolls).toEqual([]);
    });

    it('zero constant expr → loss 0', () => {
      const r = calculateSanLossFromExpr(80, 50, '0', '0', makeRng([1]));
      expect(r.passed).toBe(false);
      expect(r.loss).toBe(0);
    });

    it('bad expr → loss 0 (no throw)', () => {
      const r = calculateSanLossFromExpr(35, 50, 'abc', '1d6', makeRng([3]));
      expect(r.passed).toBe(true);
      expect(r.loss).toBe(0);
    });
  });
});