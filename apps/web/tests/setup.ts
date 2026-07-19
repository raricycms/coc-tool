/**
 * Test setup: 准备环境变量 + 干净的 DB。
 */

import { beforeAll, beforeEach, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

// 用 web 目录下的 test.db（用 process.cwd 因为 vitest 会改 import.meta.url）
const APP_ROOT = process.cwd();
const MONOREPO_ROOT = resolve(APP_ROOT, '../..');
const TEST_DB_PATH = resolve(APP_ROOT, 'test.db');
const TEST_DB_URL = `file:${TEST_DB_PATH}`;
const SCHEMA_PATH = resolve(MONOREPO_ROOT, 'packages/db/prisma/schema.prisma');
const PRISMA_BIN = resolve(MONOREPO_ROOT, 'node_modules/.bin/prisma');

// 必须先于其它模块加载：导入时设置 env
process.env.DATABASE_URL = TEST_DB_URL;
process.env.SESSION_SECRET = 'test-secret-32-bytes-aaaaaaaaaaaaaaaa';
process.env.NODE_ENV = 'test';

// 推 schema（用 spawnSync 而非 execSync，更可控）
function pushSchema() {
  const result = spawnSync(PRISMA_BIN, [
    'db', 'push', '--skip-generate', '--accept-data-loss', `--schema=${SCHEMA_PATH}`,
  ], {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL, PATH: process.env.PATH ?? '' },
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    console.error('prisma db push failed:');
    console.error('STDOUT:', result.stdout);
    console.error('STDERR:', result.stderr);
    console.error('signal:', result.signal);
    console.error('error:', result.error);
    throw new Error(`prisma db push failed: ${result.stderr || result.error?.message || 'unknown'}`);
  }
}

beforeAll(async () => {
  // 先断开可能存在的连接
  try {
    const { prisma } = await import('@coc-tools/db');
    await prisma.$disconnect();
  } catch {}

  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
  pushSchema();
});

beforeEach(async () => {
  // 每次重 import 模块以避免连接缓存
  const mod = await import('@coc-tools/db');
  const prisma = mod.prisma;
  await prisma.$disconnect();
  // 重新连接以避免缓存
  await prisma.$connect();
  // 清空数据（按 FK 顺序）
  await prisma.logEntry.deleteMany();
  await prisma.judgment.deleteMany();
  await prisma.sessionMember.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.session.deleteMany();
  await prisma.application.deleteMany();
  await prisma.recruitment.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.weapon.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.character.deleteMany();
  await prisma.oAuthToken.deleteMany();
  await prisma.captchaVerify.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  const { prisma } = await import('@coc-tools/db');
  await prisma.$disconnect();
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
});