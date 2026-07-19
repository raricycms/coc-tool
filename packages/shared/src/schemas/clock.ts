import { z } from 'zod';

export const ClockControlSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start') }),
  z.object({ action: z.literal('pause') }),
  z.object({ action: z.literal('setRate'), rate: z.number().min(0.1).max(100) }),
  z.object({
    action: z.literal('setTime'),
    inGameTime: z.string().regex(/^([0-9]|[0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'HH:mm 格式'),
    inGameDate: z.string().min(1).max(20),
  }),
  z.object({
    action: z.literal('addTime'),
    deltaMinutes: z.number().int().min(-1440).max(1440),
  }),
]);

export type ClockControl = z.infer<typeof ClockControlSchema>;