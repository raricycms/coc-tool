/**
 * 技能成长判定（结算时 PL 投）。
 *
 * 规则（占位，TODO(规则书) 校准）：
 *   - 投 1d100
 *   - 若 dice <= skillValue → 成功（+1d10）
 *   - 若 dice > skillValue  → 失败
 *   - 若 skillValue >= 95 自动失败（部分版本）
 */

import { rollDie, type RandomFn } from './dice';

export interface SkillGrowthInput {
  /** 当前技能值 */
  skillValue: number;
  /** 注入随机源 */
  random?: RandomFn;
  /** 技能值上限（>= 此值自动失败） */
  hardCap?: number;
}

export interface SkillGrowthResult {
  dice: number;
  succeeded: boolean;
  /** +1d10 的最终增量（成功才有意义） */
  growth: number;
  /** 成功后的技能值 */
  newSkillValue: number;
}

export function judgeSkillGrowth(input: SkillGrowthInput): SkillGrowthResult {
  const { skillValue, random = Math.random, hardCap = 95 } = input;
  if (skillValue < 0 || skillValue > 100) throw new Error('skillValue must be in [0, 100]');

  // 自动失败
  if (skillValue >= hardCap) {
    return { dice: 100, succeeded: false, growth: 0, newSkillValue: skillValue };
  }

  const dice = rollDie(100, random);
  if (dice <= skillValue) {
    const growth = rollDie(10, random);
    return { dice, succeeded: true, growth, newSkillValue: skillValue + growth };
  }
  return { dice, succeeded: false, growth: 0, newSkillValue: skillValue };
}