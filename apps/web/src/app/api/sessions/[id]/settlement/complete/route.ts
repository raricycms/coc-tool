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
    if (s.status !== 'SETTLING') return fail(400, 'not_settling');

    await prisma.$transaction([
      prisma.session.update({
        where: { id },
        data: { status: 'FINISHED', finishedAt: new Date() },
      }),
      prisma.settlement.update({
        where: { sessionId: id },
        data: { step: 'DONE', completedAt: new Date() },
      }),
      prisma.sessionMember.updateMany({
        where: { sessionId: id, leftAt: null },
        data: { leftAt: new Date() },
      }),
      prisma.logEntry.create({
        data: {
          sessionId: id,
          type: 'SYSTEM',
          payload: JSON.stringify({ event: 'session_finished' }),
        },
      }),
    ]);

    return ok({ finished: true });
  } catch (e) {
    return handleError(e);
  }
}