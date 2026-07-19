import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const s = await prisma.session.findUnique({
      where: { id },
      include: { settlement: true, members: { include: { character: true } } },
    });
    if (!s) return fail(404, 'not_found');
    if (s.kpId !== user.id) return fail(403, 'forbidden');
    return ok(s);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const s = await prisma.session.findUnique({ where: { id } });
    if (!s) return fail(404, 'not_found');
    if (s.kpId !== user.id) return fail(403, 'forbidden');
    if (s.status === 'FINISHED') return fail(400, 'already_finished');

    await prisma.$transaction([
      prisma.session.update({
        where: { id },
        data: { status: 'SETTLING' },
      }),
      prisma.settlement.upsert({
        where: { sessionId: id },
        create: { sessionId: id, step: 'SAN_RECOVERY' },
        update: { step: 'SAN_RECOVERY' },
      }),
    ]);

    return ok({ sessionId: id, step: 'SAN_RECOVERY' });
  } catch (e) {
    return handleError(e);
  }
}