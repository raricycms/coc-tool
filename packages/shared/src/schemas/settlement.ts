import { z } from 'zod';

export const SanRecoverySchema = z.object({
  sanRecoveries: z.array(z.object({
    characterId: z.string(),
    // 恢复只能 >= 0（扣减走 SAN check / 神话扣减，不应从这一步走）
    amount: z.number().int().min(0).max(99),
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

// ── Settlement 行 JSON 列读出 schema ──
// 服务端 Settlement 表的 sanRecoveries / knowledgeGains / retirements / skillGrowths
// 列都是 String（存 JSON）。读出时用这些 schema 安全校验，避免旧版本字段缺失
// 或迁移遗留数据导致 UI 拿到 undefined 崩。校验失败的项 UI 用空值兜底。

export const SanRecoveryItemSchema = z.object({
  characterId: z.string().min(1),
  amount: z.number().int().min(0).max(99),
});
export const KnowledgeGainItemSchema = z.object({
  characterId: z.string().min(1),
  amount: z.number().int().min(0).max(20),
});
export const RetirementItemSchema = z.object({
  characterId: z.string().min(1),
  reason: z.enum(['dead', 'asylum', 'user_request']),
  note: z.string().max(500).optional(),
});
export const SkillGrowthItemSchema = z.object({
  characterId: z.string().min(1),
  skillName: z.string().min(1).max(40),
  oldValue: z.number().int().optional(),
  newValue: z.number().int().optional(),
  dice: z.number().int().optional(),
  succeeded: z.boolean().optional(),
  growth: z.number().int().optional(),
});

/**
 * 解析 Settlement JSON 列；解析失败 / 不是数组 / 单条校验失败都返回空数组。
 * 不抛错，让前端继续渲染（兜底用全 0 / 全空）。
 */
export function parseSettlementJson<T>(
  raw: string | null | undefined,
  itemSchema: z.ZodType<T>,
): T[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: T[] = [];
  for (const item of parsed) {
    const r = itemSchema.safeParse(item);
    if (r.success) out.push(r.data);
  }
  return out;
}

export type SanRecovery = z.infer<typeof SanRecoverySchema>;
export type KnowledgeGain = z.infer<typeof KnowledgeGainSchema>;
export type Retirement = z.infer<typeof RetirementSchema>;
export type SkillGrowthRequest = z.infer<typeof SkillGrowthRequestSchema>;
export type SanRecoveryItem = z.infer<typeof SanRecoveryItemSchema>;
export type KnowledgeGainItem = z.infer<typeof KnowledgeGainItemSchema>;
export type RetirementItem = z.infer<typeof RetirementItemSchema>;
export type SkillGrowthItem = z.infer<typeof SkillGrowthItemSchema>;