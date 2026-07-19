/**
 * Re-export for convenience: web 路由可以直接 `import { formatZodError } from '@/lib/zodError'`。
 * 真实实现位于 @coc-tools/shared，方便 realtime 服务复用同一份。
 */
export {
  formatZodIssue,
  formatZodError,
  buildFieldErrors,
  type FieldError,
  type FormatCtx,
} from '@coc-tools/shared';