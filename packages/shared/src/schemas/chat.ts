import { z } from 'zod';

export const OOCSendSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const ICSendSchema = z.object({
  kind: z.enum(['desc', 'dialogue']),
  content: z.string().min(1).max(2000),
  characterId: z.string().optional(),
  // KP 在「角色发言」模式下可指定任意角色名（用于旁白 NPC）。
  // PL 不传，服务端会用绑定角色的名字。
  characterName: z.string().max(40).optional(),
});

export const CharacterUpdateHPRequestSchema = z.object({
  characterId: z.string(),
  delta: z.number().int().min(-9999).max(9999),
  reason: z.string().max(200),
});

export type OOCSend = z.infer<typeof OOCSendSchema>;
export type ICSend = z.infer<typeof ICSendSchema>;
export type CharacterUpdateHPRequest = z.infer<typeof CharacterUpdateHPRequestSchema>;