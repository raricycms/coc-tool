import { z } from 'zod';

export const JudgmentCreateSchema = z.object({
  targetCharacterId: z.string().min(1),
  type: z.enum(['skill', 'san', 'luck', 'combat', 'opposed']),
  skillName: z.string().min(1).max(40),
  difficulty: z.enum(['regular', 'hard', 'extreme']).default('regular'),
  bonusDice: z.number().int().min(-5).max(5).default(0),
  scMin: z.number().int().min(0).max(100).optional(),
  scMax: z.number().int().min(0).max(100).optional(),
  note: z.string().max(500).optional(),
});

export const JudgmentRollSchema = z.object({
  judgmentId: z.string().min(1),
});

export type JudgmentCreate = z.infer<typeof JudgmentCreateSchema>;
export type JudgmentRoll = z.infer<typeof JudgmentRollSchema>;