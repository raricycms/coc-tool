/**
 * 旁观者主动退出观战。
 *
 * 之前 joinRoom 任何非成员会自动建 SessionMember(SPECTATOR, leftAt=null)，
 * 但前端没有任何「退出观战」入口，唯一清空 leftAt 的时机是 session 完结。
 * 这条端点让 SPECTATOR 用户能把自己的行打上 leftAt，从 dashboard 列表里消失。
 *
 * KP / PL 不能用这条退出（应该走 settlement 完结或被踢的语义）。
 */

import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const member = await prisma.sessionMember.findUnique({
      where: { sessionId_userId: { sessionId: id, userId: user.id } },
    });
    if (!member) return ok({ left: false });
    if (member.leftAt) return ok({ left: true, alreadyLeft: true });
    if (member.role !== 'SPECTATOR') {
      return fail(400, 'cannot_leave_active_role', 'KP / PL 不能通过此端点退出，需要走结算流程');
    }

    await prisma.sessionMember.update({
      where: { id: member.id },
      data: { leftAt: new Date() },
    });
    return ok({ left: true });
  } catch (e) {
    return handleError(e);
  }
}