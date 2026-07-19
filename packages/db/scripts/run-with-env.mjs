/**
 * 在执行 prisma 前从 monorepo 根目录加载 .env，确保 DATABASE_URL 等变量可用。
 *
 * 用法：node scripts/run-with-env.mjs <prisma-args...>
 */

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = resolve(__dirname, '../../..');
const ENV_FILE = resolve(MONOREPO_ROOT, '.env');
const SCHEMA = resolve(MONOREPO_ROOT, 'packages/db/prisma/schema.prisma');

// 简单解析 .env（不引入 dotenv 依赖）
if (existsSync(ENV_FILE)) {
  const { readFileSync } = await import('node:fs');
  const text = readFileSync(ENV_FILE, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    if (m[1].startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
  console.log(`📦 Loaded env from ${ENV_FILE}`);
}

const prismaBin = resolve(MONOREPO_ROOT, 'node_modules/.bin/prisma');
const args = process.argv.slice(2);

// 把 --schema 加进去（prisma 否则会找不到 schema）
if (!args.includes('--schema')) {
  args.push(`--schema=${SCHEMA}`);
}

const { spawnSync } = await import('node:child_process');
const r = spawnSync(prismaBin, args, {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? 'file:./dev.db' },
});
process.exit(r.status ?? 1);
