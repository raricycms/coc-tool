/**
 * CoC 判定系统。
 *
 * 成功等级：
 *   - fumble    ：骰出 100（即 rawRolls 全部 ≥ 96，tens×10+unit >= 100）
 *   - critical  ：骰出 01（个位 = 0，十位 = 0），且 1 ≤ skillValue
 *   - extreme   ：final ≤ skillValue / 5
 *   - hard      ：final ≤ skillValue / 2
 *   - success   ：final ≤ skillValue
 *   - fail      ：其余
 *
 * 注意：
 *   - 5e/6e 的规则略有差异。本实现按 CoC 7e 占位，TODO(规则书) 校准。
 */

import { rollD10, type RandomFn } from './dice';

export type SuccessLevel = 'critical' | 'extreme' | 'hard' | 'success' | 'fail' | 'fumble';

export type Difficulty = 'regular' | 'hard' | 'extreme';

export interface JudgmentInput {
  /** 当前技能 / 属性值 */
  skillValue: number;
  /** 难度：regular（默认）/ hard（自动升级）/ extreme（自动极难） */
  difficulty: Difficulty;
  /** 奖励/惩罚骰数：正数=奖励（取多个 d10 的最小），负数=惩罚（取最大） */
  bonusDice: number;
  /** 随机源（注入以便测试） */
  random?: RandomFn;
}

export interface JudgmentResult {
  /** 所有原始骰值（含奖励/惩罚） */
  rawRolls: number[];
  /** 十位（用于计算） */
  tens: number;
  /** 个位 */
  unit: number;
  /** final = tens * 10 + unit */
  final: number;
  /** 成功等级 */
  successLevel: SuccessLevel;
  /** KP 设定的难度（便于 UI 显示） */
  difficulty: Difficulty;
  /** 投骰所用技能值（用于 sanity check） */
  skillValue: number;
  /** 成功等级（中文标签） */
  label: string;
}

/**
 * 应用奖励/惩罚骰，返回 tens / unit。
 *
 *   bonusDice > 0：取所有 d10 中的最小（奖励）
 *   bonusDice < 0：取最大（惩罚）
 *   bonusDice = 0：单 d10
 */
export function applyBonusDice(rolls: number[], bonusDice: number): { tens: number; unit: number } {
  if (rolls.length === 0) throw new Error('rolls must not be empty');
  const bd = Math.max(-5, Math.min(5, Math.trunc(bonusDice)));
  let chosen: number;
  if (bd > 0) chosen = Math.min(...rolls);
  else if (bd < 0) chosen = Math.max(...rolls);
  else chosen = rolls[0];
  const tens = Math.floor(chosen / 10);
  const unit = chosen % 10;
  return { tens, unit };
}

/**
 * 投一组 d10 用于判定：
 *   - 1 个基础 d10
 *   - |bonusDice| 个额外 d10
 */
export function rollForJudgment(bonusDice: number, random: RandomFn = Math.random): number[] {
  const bd = Math.max(-5, Math.min(5, Math.trunc(bonusDice)));
  const count = 1 + Math.abs(bd);
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) rolls.push(rollD10(random));
  return rolls;
}

/**
 * 计算成功等级。
 *
 * 规则：
 *   - 若 final >= 100  → fumble
 *   - 若 unit = 0 且 tens = 0  → critical
 *   - 若 final <= skillValue/5 → extreme
 *   - 若 final <= skillValue/2 → hard（若 difficulty != extreme）
 *                            → extreme（若 difficulty == extreme）
 *   - 若 final <= skillValue → success
 *   - 否则 fail
 */
export function calculateSuccessLevel(
  final: number,
  skillValue: number,
  difficulty: Difficulty,
): SuccessLevel {
  // 100 必然 fumble
  if (final >= 100) return 'fumble';

  // 01 = critical（仅当 skillValue >= 1）
  if (final === 0 && skillValue >= 1) return 'critical';

  // 极难成功：final ≤ skillValue / 5
  if (final <= Math.floor(skillValue / 5)) return 'extreme';

  // 困难成功：final ≤ skillValue / 2
  if (final <= Math.floor(skillValue / 2)) {
    if (difficulty === 'extreme') return 'extreme';
    return 'hard';
  }

  // 常规成功：final ≤ skillValue
  if (final <= skillValue) return 'success';

  return 'fail';
}

export const SUCCESS_LABELS: Record<SuccessLevel, string> = {
  critical: '大成功',
  extreme: '极难成功',
  hard: '困难成功',
  success: '成功',
  fail: '失败',
  fumble: '大失败',
};

/**
 * 一站式判定函数（投骰 + 计算成功等级）。
 */
export function judge(input: JudgmentInput): JudgmentResult {
  const { skillValue, difficulty, bonusDice, random } = input;
  if (!Number.isFinite(skillValue) || skillValue < 0 || skillValue > 100) {
    throw new Error('skillValue must be in [0, 100]');
  }

  const rawRolls = rollForJudgment(bonusDice, random);
  const { tens, unit } = applyBonusDice(rawRolls, bonusDice);
  const final = tens * 10 + unit;
  const successLevel = calculateSuccessLevel(final, skillValue, difficulty);
  return {
    rawRolls,
    tens,
    unit,
    final,
    successLevel,
    difficulty,
    skillValue,
    label: SUCCESS_LABELS[successLevel],
  };
}

/**
 * SAN check：根据判定结果计算 SAN 损失。
 *
 *   - critical / extreme / success → scMin
 *   - fail                         → randomInt(scMin, scMax)
 *   - fumble                       → max(scMax, sanity * 5)
 *
 * 注：占位实现，TODO(规则书) 校准。
 */
export function calculateSanLoss(
  successLevel: SuccessLevel,
  scMin: number,
  scMax: number,
  currentSan: number,
  random: RandomFn = Math.random,
): number {
  if (successLevel === 'critical' || successLevel === 'extreme' || successLevel === 'hard' || successLevel === 'success') {
    return Math.max(0, Math.min(scMin, currentSan));
  }
  if (successLevel === 'fumble') {
    return Math.max(0, Math.min(scMax, currentSan));
  }
  // fail
  if (scMax < scMin) return Math.max(0, scMin);
  const loss = Math.floor(random() * (scMax - scMin + 1)) + scMin;
  return Math.max(0, Math.min(loss, currentSan));
}