import { z } from 'zod';

/**
 * log:history 请求：拉取某 session 的历史日志。
 * `types` 可选；不传=全部，按类型过滤走 `@@index([sessionId, type])`。
 * `before` 是 cursor（createdAt ISO），用于分页；目前 take 硬上限 100。
 */
export const LogHistoryRequestSchema = z.object({
  sessionId: z.string().min(1),
  before: z.string().datetime().optional(),
  types: z.array(z.string()).optional(),
});

export type LogHistoryRequest = z.infer<typeof LogHistoryRequestSchema>;