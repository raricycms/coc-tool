import { z } from 'zod';

/** 骰子表达式：纯数字（0/3/...）、单骰（1d6）、多骰或带常数（2d6+1 / 1d4+2 / 1d3+1d4 等） */
const DiceExpr = z.string().regex(/^(\d+d\d+|\d+)([+-](\d+d\d+|\d+))*$/).max(30);

export const JudgmentCreateSchema = z.object({
  /**
   * 单目标判定：直接给一个角色 id。
   * 与 `targetCharacterIds` 二选一；都不填时 422。
   */
  targetCharacterId: z.string().min(1).optional(),
  /**
   * 群发判定：一次创建多个 Judgment，每个角色一个。
   * 通常由 KP 选「群发：所有 PL」时填入所有 PL 的角色 id。
   */
  targetCharacterIds: z.array(z.string().min(1)).min(1).max(20).optional(),
  type: z.enum(['skill', 'san', 'luck', 'combat', 'opposed']),
  skillName: z.string().min(1).max(40),
  difficulty: z.enum(['regular', 'hard', 'extreme']).default('regular'),
  bonusDice: z.number().int().min(-5).max(5).default(0),
  // 旧字段（scMin/scMax）：保留做向后兼容，san check 改用下面两个表达式字段
  scMin: z.number().int().min(0).max(100).optional(),
  scMax: z.number().int().min(0).max(100).optional(),
  // 新字段：san check 成功/失败时的损失骰表达式；空串/不传视为不扣
  scSuccessExpr: DiceExpr.optional(),
  scFailureExpr: DiceExpr.optional(),
  note: z.string().max(500).optional(),
});

export const JudgmentRollSchema = z.object({
  judgmentId: z.string().min(1),
});

/** KP 用骰子表达式扣 HP：例如 1d6 / 2d6+1 / 1d4+1d3 */
export const HpDiceRollSchema = z.object({
  characterId: z.string().min(1),
  diceExpr: DiceExpr,
  reason: z.string().min(1).max(200),
});

export type JudgmentCreate = z.infer<typeof JudgmentCreateSchema>;
export type JudgmentRoll = z.infer<typeof JudgmentRollSchema>;
export type HpDiceRoll = z.infer<typeof HpDiceRollSchema>;