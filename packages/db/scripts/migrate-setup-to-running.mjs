/**
 * 一次性数据迁移：把 Session.status = 'SETUP' 的行改成 'RUNNING'。
 *
 * 背景：
 *   - schema.prisma 移除 SETUP 状态，新建 Session 默认值改为 'RUNNING'
 *   - 但 dev.db / 生产库里已有 status='SETUP' 的旧行不会自动变
 *   - 这些行在 UI 上会显示原始字符串 'SETUP'，且 dashboard「可观战」列表
 *     不会列出它们（只看 RUNNING/PAUSED）
 *
 * 行为：
 *   - 默认 dry-run：只统计会受影响的行，不修改
 *   - 加 --apply 才真正执行 updateMany
 *   - 幂等：再次执行 0 行受影响
 *   - 自动加载 monorepo 根目录的 .env（沿用 run-with-env.mjs 的逻辑），
 *     因此在生产环境只要 .env 里有 DATABASE_URL 即可
 *
 * 用法：
 *   # 预演（默认）
 *   node packages/db/scripts/migrate-setup-to-running.mjs
 *
 *   # 真正执行
 *   node packages/db/scripts/migrate-setup-to-running.mjs --apply
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = resolve(__dirname, '../../..');
const ENV_FILE = resolve(MONOREPO_ROOT, '.env');

// 简单解析 .env（不引入 dotenv 依赖，与 run-with-env.mjs 保持一致）
if (existsSync(ENV_FILE)) {
  const text = readFileSync(ENV_FILE, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
    if (!m || m[1].startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
  console.log(`📦 Loaded env from ${ENV_FILE}`);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 未设置（检查 .env）');
  process.exit(1);
}

const apply = process.argv.includes('--apply');

// 动态 import @coc-tools/db（避免在 DATABASE_URL 检查之前就加载）
const { prisma } = await import('@coc-tools/db');

try {
  const setupCount = await prisma.session.count({ where: { status: 'SETUP' } });
  const totalCount = await prisma.session.count();

  console.log('');
  console.log(`📊 当前 Session 总数: ${totalCount}`);
  console.log(`📊 status='SETUP' 行数: ${setupCount}`);
  console.log('');

  if (setupCount === 0) {
    console.log('✅ 没有需要迁移的行，退出。');
    process.exit(0);
  }

  if (!apply) {
    console.log('🔍 DRY-RUN：以下语句会被执行，但未实际跑：');
    console.log('');
    console.log('   UPDATE Session');
    console.log('     SET status = \'RUNNING\'');
    console.log('     WHERE status = \'SETUP\';');
    console.log('');
    console.log(`   预计影响行数: ${setupCount}`);
    console.log('');
    console.log('确认要执行？加上 --apply 再跑一次：');
    console.log('   node packages/db/scripts/migrate-setup-to-running.mjs --apply');
    process.exit(0);
  }

  console.log('🚀 执行迁移...');
  const result = await prisma.session.updateMany({
    where: { status: 'SETUP' },
    data: { status: 'RUNNING' },
  });
  console.log(`✅ 已更新 ${result.count} 行 SETUP → RUNNING`);

  // 二次校验
  const remaining = await prisma.session.count({ where: { status: 'SETUP' } });
  if (remaining > 0) {
    console.error(`⚠️ 迁移后仍有 ${remaining} 行 SETUP，请人工排查`);
    process.exit(2);
  }
  console.log('✅ 校验通过：已无 SETUP 行');
} catch (e) {
  console.error('❌ 迁移失败:', e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}