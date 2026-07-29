/**
 * 一次性清理：把 e2e 跑出来的 RUNNING/PAUSED 团强制结算到 FINISHED。
 *
 * 背景：
 *   - apps/web/tests/e2e/*.mjs 每次跑会创建新的 Session（title 是 `spec-test-...`
 *     或 `e2e-judgment-...`），但旧版不清理，session 停在 RUNNING 状态污染 dashboard。
 *   - 新版 e2e 末尾已加 settle() 清理步骤，这条脚本是给已污染的存量数据用。
 *
 * 行为：
 *   - 默认 dry-run：只列出会受影响的团，不修改
 *   - 加 --apply 真正执行：开 settlement（如果有）→ 标 FINISHED → 给成员打 leftAt
 *   - 幂等：再次跑 0 行受影响
 *   - 仅命中 title 匹配 e2e 命名模式的 session（`spec-test-%` 与 `e2e-judgment-%`），
 *     不会误伤真实用户创建的团
 *
 * 用法：
 *   # 预演
 *   node packages/db/scripts/settle-e2e-sessions.mjs
 *
 *   # 真正执行
 *   node packages/db/scripts/settle-e2e-sessions.mjs --apply
 *
 * 注意：在哪个 DATABASE_URL 上跑，会清理哪个库的 e2e 残留。
 *   本地:  root .env 里的 SQLite dev.db
 *   远程:  部署机的 .env / 环境变量
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = resolve(__dirname, '../../..');
const ENV_FILE = resolve(MONOREPO_ROOT, '.env');

// 简单解析 .env，不引入 dotenv（与 run-with-env.mjs 保持一致）
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

const { prisma } = await import('@coc-tools/db');

try {
  // 一次查完：title 匹配 e2e 命名模式（`spec-test-%` 或 `e2e-judgment-%`）
  // 且状态还在 RUNNING/PAUSED/SETTLING。Prisma supports `OR` 在同字段 startsWith。
  const targets = await prisma.session.findMany({
    where: {
      status: { in: ['RUNNING', 'PAUSED', 'SETTLING'] },
      OR: [
        { title: { startsWith: 'spec-test-' } },
        { title: { startsWith: 'e2e-judgment-' } },
      ],
    },
    select: { id: true, title: true, status: true, kpId: true, createdAt: true },
  });

  console.log('');
  const totalE2ESessions = await prisma.session.count();
  console.log(`📊 当前 Session 总数: ${totalE2ESessions}`);
  console.log(`📊 未结算 + 命中 e2e 命名模式的团: ${targets.length}`);
  console.log('');

  if (targets.length === 0) {
    console.log('✅ 没有需要清理的 e2e 残留，退出。');
    process.exit(0);
  }

  console.log('📋 计划清理的 sessions:');
  for (const t of targets) {
    console.log(`   - ${t.id}  status=${t.status}  title="${t.title}"  createdAt=${t.createdAt.toISOString()}`);
  }

  if (!apply) {
    console.log('');
    console.log('🔍 DRY-RUN：以上 sessions 会被强制 FINISHED，但未实际跑。');
    console.log('   确认要执行？加上 --apply 再跑一次：');
    console.log('   node packages/db/scripts/settle-e2e-sessions.mjs --apply');
    process.exit(0);
  }

  console.log('');
  console.log('🚀 执行清理...');
  const now = new Date();

  let finishedCount = 0;
  for (const t of targets) {
    await prisma.$transaction(async (tx) => {
      // 直接标 FINISHED，不走中间 SETTLING 步骤——e2e 残留没有 KP 在跑流程
      await tx.session.update({
        where: { id: t.id },
        data: { status: 'FINISHED', finishedAt: now },
      });
      // 给所有还在场的成员打 leftAt
      await tx.sessionMember.updateMany({
        where: { sessionId: t.id, leftAt: null },
        data: { leftAt: now },
      });
      // 销掉任何半截的 Settlement（不强求存在）
      await tx.settlement.updateMany({
        where: { sessionId: t.id },
        data: { step: 'DONE', completedAt: now },
      });
    });
    finishedCount++;
    console.log(`   ✓ ${t.id} → FINISHED`);
  }

  console.log('');
  console.log(`✅ 共清理 ${finishedCount} 个 e2e 残留 session`);

  // 二次校验
  const remaining = await prisma.session.count({
    where: {
      status: { in: ['RUNNING', 'PAUSED', 'SETTLING'] },
      OR: [
        { title: { startsWith: 'spec-test-' } },
        { title: { startsWith: 'e2e-judgment-' } },
      ],
    },
  });
  if (remaining > 0) {
    console.error(`⚠️ 清理后仍有 ${remaining} 个残留 session，请人工排查`);
    process.exit(2);
  }
  console.log('✅ 校验通过：已无 e2e 模式 RUNNING/PAUSED/SETTLING 残留');
} catch (e) {
  console.error('❌ 清理失败:', e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
