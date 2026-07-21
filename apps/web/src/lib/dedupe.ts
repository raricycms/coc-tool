/**
 * 按 name 字段去重，保留第一条出现的项。
 *
 * 用于角色创建/编辑 API：在写入前防御性去重 skills / weapons / equipment，
 * 避免 Skill 表的 `@@unique([characterId, name])` 触发 P2002。
 * 表单层也应有同名校验，但服务端仍然要兜底，防止客户端绕开校验。
 */
export function dedupeByName<T extends { name: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.name)) continue;
    seen.add(item.name);
    out.push(item);
  }
  return out;
}