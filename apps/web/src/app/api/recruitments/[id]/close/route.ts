/**
 * 关闭招募：把 status 置 CLOSED。
 *
 * 与 DELETE 的区别：
 *   - DELETE = 真删（仅 DRAFT/CLOSED 可删，且无对应 Session）
 *   - POST /close = 软关（任何 OPEN 状态都可关，CLOSED/已开团 → 拒绝）
 */

import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const r = await prisma.recruitment.findUnique({ where: { id } });
    if (!r) return fail(404, 'not_found');
    if (r.kpId !== user.id) return fail(403, 'forbidden');
    if (r.status === 'FINISHED') {
      return fail(400, 'already_started', '已开团，不能关闭');
    }
    if (r.status === 'CLOSED') {
      return ok({ id, status: 'CLOSED', alreadyClosed: true });
    }
    await prisma.recruitment.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
    return ok({ id, status: 'CLOSED' });
  } catch (e) {
    return handleError(e);
  }
}