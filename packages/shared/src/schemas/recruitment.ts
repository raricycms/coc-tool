import { z } from 'zod';

const RecruitmentBaseSchema = z.object({
  title: z.string().min(1).max(60),
  summary: z.string().min(1).max(20_000),
  scenario: z.string().max(100).optional(),
  minPlayers: z.number().int().min(1).max(20),
  maxPlayers: z.number().int().min(1).max(20),
  expectedHours: z.number().int().min(1).max(100).optional(),
  startAt: z.coerce.date().optional(),
  visibility: z.enum(['public', 'link']).default('public'),
});

export const RecruitmentCreateSchema = RecruitmentBaseSchema.refine((data) => data.maxPlayers >= data.minPlayers, {
  message: 'maxPlayers 必须 >= minPlayers',
  path: ['maxPlayers'],
});

export const RecruitmentUpdateSchema = RecruitmentBaseSchema.partial();

export const ApplicationCreateSchema = z.object({
  characterId: z.string().min(1),
  message: z.string().max(2_000).optional(),
});

export const ApplicationReviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reviewNote: z.string().max(2_000).optional(),
});

export type RecruitmentCreate = z.infer<typeof RecruitmentCreateSchema>;
export type ApplicationCreate = z.infer<typeof ApplicationCreateSchema>;
export type ApplicationReview = z.infer<typeof ApplicationReviewSchema>;