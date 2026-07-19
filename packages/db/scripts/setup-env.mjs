/**
 * 确保 monorepo 根目录有 .env 文件。
 *
 * Prisma 5 在加载 .env 时会查找所有父目录。如果同时存在根 .env
 * 和 schema 目录附近的 .env，prisma 会报冲突错误。
 *
 * 约定：
 *   - 只在 monorepo 根放一份 .env
 *   - 不要在 packages/db/ 或 packages/db/prisma/ 放 .env
 */

import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = resolve(__dirname, '../../..');
const PACKAGE_ROOT = resolve(__dirname, '..');
const SCHEMA_DIR = resolve(PACKAGE_ROOT, 'prisma');

const ENV_EXAMPLE = resolve(MONOREPO_ROOT, '.env.example');
const ROOT_ENV = resolve(MONOREPO_ROOT, '.env');

// 把可能误生成的 .env 清理掉（避免 prisma 加载冲突）
for (const stale of [
  resolve(PACKAGE_ROOT, '.env'),
  resolve(SCHEMA_DIR, '.env'),
]) {
  if (existsSync(stale)) {
    console.log(`🧹 删除旧 .env: ${stale}`);
    (await import('node:fs')).unlinkSync(stale);
  }
}

if (!existsSync(ENV_EXAMPLE)) {
  console.error('❌ .env.example 不存在');
  process.exit(1);
}

if (!existsSync(ROOT_ENV)) {
  copyFileSync(ENV_EXAMPLE, ROOT_ENV);
  console.log('✅ 已创建 root .env（从 .env.example 复制）');
}

// 替换占位符 SESSION_SECRET
let content = readFileSync(ROOT_ENV, 'utf8');
if (/SESSION_SECRET\s*=\s*"?change-me[^"\n]*"?/m.test(content)) {
  const secret = randomBytes(32).toString('hex');
  content = content.replace(/SESSION_SECRET=.*$/m, `SESSION_SECRET="${secret}"`);
  writeFileSync(ROOT_ENV, content);
  console.log('✅ 已生成 SESSION_SECRET');
}
