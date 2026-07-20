import { z } from 'zod';

export const RegisterSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_-]+$/, '用户名仅允许字母数字下划线短横线'),
  email: z.string().email().max(100).optional(),
  password: z.string().min(10).max(100),
  captchaToken: z.string().min(1),
  captchaAnswer: z.string().min(1).max(20),
  remember: z.boolean().optional().default(false),
});

export const LoginSchema = z.object({
  username: z.string().min(1).max(20),
  password: z.string().min(1).max(100),
  captchaToken: z.string().min(1),
  captchaAnswer: z.string().min(1).max(20),
  remember: z.boolean().optional().default(false),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;