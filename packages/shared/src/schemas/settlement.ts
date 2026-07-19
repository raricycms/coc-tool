import { z } from 'zod';

export const SanRecoverySchema = z.object({
  sanRecoveries: z.array(z.object({
    characterId: z.string(),
    amount: z.number().int().min(-99).max(99),
  })),
});

export const KnowledgeGainSchema = z.object({
  knowledgeGains: z.array(z.object({
    characterId: z.string(),
    amount: z.number().int().min(0).max(20),
  })),
});

export const RetirementSchema = z.object({
  retirements: z.array(z.object({
    characterId: z.string(),
    reason: z.enum(['dead', 'asylum', 'user_request']),
    note: z.string().max(500).optional(),
  })),
});

export const SkillGrowthRequestSchema = z.object({
  growths: z.array(z.object({
    characterId: z.string(),
    skillName: z.string().min(1).max(40),
  })),
});

export type SanRecovery = z.infer<typeof SanRecoverySchema>;
export type KnowledgeGain = z.infer<typeof KnowledgeGainSchema>;
export type Retirement = z.infer<typeof RetirementSchema>;
export type SkillGrowthRequest = z.infer<typeof SkillGrowthRequestSchema>;