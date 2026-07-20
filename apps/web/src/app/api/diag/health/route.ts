/**
 * 内部诊断端点（不要对外暴露）。
 *
 * 返回 SESSION_SECRET 的 sha256 前 12 位指纹，让 apps/web/tests/e2e/ws-flow.mjs
 * 能对账 web 和 realtime 是否用同一份密钥——不一致就是「unauthorized:
 * invalid token」的死循环根因。
 *
 * 注意：暴露的是 hash 而不是原值；命中是误判的概率可忽略，但仍然建议
 * 在反代上限制只允许内网访问（部署文档已写）。
 */
import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    ts: Date.now(),
    secretFp: createHash('sha256').update(process.env.SESSION_SECRET || '').digest('hex').slice(0, 12),
  });
}