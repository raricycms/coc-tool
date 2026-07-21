import { z } from 'zod';

/**
 * log:history 请求：拉取某 session 的历史日志。
 * `types` 可选；不传=全部，按类型过滤走 `@@index([sessionId, type])`。
 * `before` 是 cursor（createdAt ISO），用于分页；目前 take 硬上限 100。
 * `requestId` 让客户端把多个并发请求的响应分发到对应的调用方，
 *   典型场景：进入跑团页同时拉 chat / non-chat 两份历史，加上后续翻页，
 *   没有 requestId 的话 listener 收到响应时无法区分该交给谁。
 */
export const LogHistoryRequestSchema = z.object({
  sessionId: z.string().min(1),
  before: z.string().datetime().optional(),
  types: z.array(z.string()).optional(),
  requestId: z.string().optional(),
});

export type LogHistoryRequest = z.infer<typeof LogHistoryRequestSchema>;

/**
 * log:history:res 响应：原样回传 requestId（如果请求里带了），便于客户端按 id 分发。
 * entries 永远按 createdAt 升序（最旧→最新），这是 server 端 entries.reverse() 后的结果。
 */
export const LogHistoryResponseSchema = z.object({
  entries: z.array(z.any()), // LogEntry payload 形状由 consumer 解析；这里只校验存在
  requestId: z.string().optional(),
  before: z.string().optional(),
});

export type LogHistoryResponse = z.infer<typeof LogHistoryResponseSchema>;