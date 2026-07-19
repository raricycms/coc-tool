'use client';

import { useCallback, useState } from 'react';
import type { FieldError } from '@coc-tools/shared';

/**
 * 表单字段级错误的状态管理。
 *
 * 用法：
 *   const { errors, apply, clear, clearAll, get } = useFieldErrors();
 *   // 提交失败：
 *   apply(j.error?.fields ?? []);
 *   // 取值：
 *   const nameErr = get('name');
 *   // 用户修改时清掉某字段：
 *   onChange={() => { setName(v); clear('name'); }}
 *   // 切换步骤前清掉所有：
 *   clearAll();
 */
export function useFieldErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * 把后端 fields 列表灌进 state。同 key 保留最新一条。
   * remap 是可选的 (path) => string，用于把服务器返回的数组下标路径
   * （如 sanRecoveries.0.amount）转换为客户端使用的 key（如 amount:{characterId}）。
   */
  const apply = useCallback(
    (fields: FieldError[] | undefined, remap?: (path: (string | number)[]) => string) => {
      if (!fields || fields.length === 0) {
        setErrors({});
        return;
      }
      const next: Record<string, string> = {};
      for (const f of fields) {
        const key = remap ? remap(f.path) : f.key;
        next[key] = f.message;
      }
      setErrors(next);
    },
    [],
  );

  const clear = useCallback((key: string) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const { [key]: _omit, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearAll = useCallback(() => setErrors({}), []);

  const get = useCallback((key: string) => errors[key], [errors]);

  return { errors, apply, clear, clearAll, get };
}

/**
 * 给 SettlementWizard 这类用 characterId 当 key 的场景：
 * 把 path 里 `<array>.<idx>.<sub>` 替换成 `<sub>:<characterId from body[idx]>`。
 */
export function pathToCharacterKey(body: any): (path: (string | number)[]) => string {
  return (path) => {
    if (path.length !== 3) return path.map(String).join('.');
    const [arrayKey, idx, subKey] = path;
    if (typeof arrayKey !== 'string' || typeof idx !== 'number' || typeof subKey !== 'string') {
      return path.map(String).join('.');
    }
    const item = body?.[arrayKey]?.[idx];
    if (!item || typeof item.characterId !== 'string') return path.map(String).join('.');
    return `${subKey}:${item.characterId}`;
  };
}