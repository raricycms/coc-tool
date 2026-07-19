'use client';

/**
 * 输入框错误高亮：
 *   - 输入框自动加 .input-error（红边）
 *   - 下方显示具体错误描述
 *
 * 用法：
 *   <FieldError error={get('name')}>
 *     <input ... />
 *   </FieldError>
 *
 * 不传 error 时透传 children，不影响原有样式。
 */
import type { ReactNode } from 'react';

export function FieldError({
  error,
  children,
}: {
  error?: string;
  children: ReactNode;
}) {
  if (!error) return <>{children}</>;

  // 给 input/select/textarea 套上红边。直接克隆 children 简单粗暴，
  // 但要注意：传进来的必须是一个能接收 className 的元素。
  // 这里用 className 注入 + 下方小字的双层结构。
  return (
    <div className="space-y-1">
      <div className="[&_input]:!border-red-500 [&_input]:focus:!ring-red-500 [&_select]:!border-red-500 [&_textarea]:!border-red-500">
        {children}
      </div>
      <p className="error-text">{error}</p>
    </div>
  );
}