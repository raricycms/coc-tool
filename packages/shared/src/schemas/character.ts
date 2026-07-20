import { z } from 'zod';

export const PrimaryStatsSchema = z.object({
  str: z.number().int().min(1).max(999),
  con: z.number().int().min(1).max(999),
  siz: z.number().int().min(1).max(999),
  dex: z.number().int().min(1).max(999),
  app: z.number().int().min(1).max(999),
  int: z.number().int().min(1).max(999),
  pow: z.number().int().min(1).max(999),
  edu: z.number().int().min(1).max(999),
  luck: z.number().int().min(1).max(999).default(50),
});

export const SkillSchema = z.object({
  name: z.string().min(1).max(40),
  value: z.number().int().min(0).max(999),
  isMythos: z.boolean().default(false),
  note: z.string().max(200).optional(),
});

export const WeaponSchema = z.object({
  name: z.string().min(1).max(40),
  skill: z.string().min(1).max(40),
  damage: z.string().max(20),
  range: z.string().max(20).optional(),
  ammo: z.number().int().min(0).max(9999).optional(),
  note: z.string().max(200).optional(),
});

export const EquipmentSchema = z.object({
  name: z.string().min(1).max(60),
  quantity: z.number().int().min(1).max(9999),
  note: z.string().max(200).optional(),
});

export const CharacterCreateSchema = z.object({
  name: z.string().min(1).max(30),
  gender: z.enum(['male', 'female', 'other']).optional(),
  age: z.number().int().min(15).max(90).optional(),
  birthplace: z.string().max(60).optional(),
  residence: z.string().max(60).optional(),
  nationality: z.string().max(40).optional(),
  occupation: z.string().max(40).optional(),
  era: z.enum(['modern', '1920s', 'victorian', 'ancient', 'future']).default('modern'),
  primary: PrimaryStatsSchema,
  skills: z.array(SkillSchema).max(200),
  weapons: z.array(WeaponSchema).max(50).default([]),
  equipment: z.array(EquipmentSchema).max(100).default([]),
  background: z.string().max(10_000).optional(),
  notes: z.string().max(10_000).optional(),
});

export const CharacterUpdateSchema = CharacterCreateSchema.partial().extend({
  primary: PrimaryStatsSchema.optional(),
  skills: z.array(SkillSchema).max(200).optional(),
  weapons: z.array(WeaponSchema).max(50).optional(),
  equipment: z.array(EquipmentSchema).max(100).optional(),
});

export type CharacterCreate = z.infer<typeof CharacterCreateSchema>;
export type CharacterUpdate = z.infer<typeof CharacterUpdateSchema>;
export type PrimaryStats = z.infer<typeof PrimaryStatsSchema>;
export type SkillInput = z.infer<typeof SkillSchema>;
export type WeaponInput = z.infer<typeof WeaponSchema>;
export type EquipmentInput = z.infer<typeof EquipmentSchema>;