/**
 * 放弃结算：把 Session 从 SETTLING 拉回 RUNNING，删除对应 Settlement 行。
 *
 * 适用场景：KP 误点「→ 结算」进入结算页，或想在结算中途"再跑一段"。
 * 仅 KP 可调；status 必须为 SETTLING；不允许从 FINISHED 回退。
 *
 * 已知限制：settlement.* 四个 JSON 数组里已经写入的数据会丢失。
 * 如需保留草稿，应在「修改前先确认」对话里提示 KP。
 */

import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const s = await prisma.session.findUnique({ where: { id } });
    if (!s) return fail(404, 'not_found');
    if (s.kpId !== user.id) return fail(403, 'forbidden');
    if (s.status !== 'SETTLING') return fail(400, 'not_settling', '当前不在结算中');

    await prisma.$transaction([
      prisma.session.update({
        where: { id },
        data: { status: 'RUNNING' },
      }),
      prisma.settlement.delete({ where: { sessionId: id } }),
    ]);
    return ok({ sessionId: id, status: 'RUNNING' });
  } catch (e) {
    return handleError(e);
  }
}