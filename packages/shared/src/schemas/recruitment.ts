import { z } from 'zod';

/**
 * 招募状态机：
 *   DRAFT    → 保存但未发布（创建即 OPEN 之前的工作流；当前默认仍直接创建为 OPEN）
 *   OPEN     → 招募中，可接受报名
 *   CLOSED   → KP 主动关闭或拒绝完所有报名
 *   FINISHED → 已开团，对应 Session 已创建
 *
 * 与 Session.status 不同（Session 用 RUNNING/PAUSED/SETTLING/FINISHED/ABANDONED）。
 */
export const RECRUITMENT_STATUS = ['DRAFT', 'OPEN', 'CLOSED', 'FINISHED'] as const;
export type RecruitmentStatus = (typeof RECRUITMENT_STATUS)[number];

/** 招募状态显示名（中文） */
export const RECRUITMENT_STATUS_LABEL: Record<RecruitmentStatus, string> = {
  DRAFT: '草稿',
  OPEN: '招募中',
  CLOSED: '已关闭',
  FINISHED: '已开团',
};

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