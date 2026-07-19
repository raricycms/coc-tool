import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { ApplicationReviewSchema } from '@coc-tools/shared';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; appId: string }> }) {
  try {
    const user = await requireUser();
    const { id, appId } = await params;
    const r = await prisma.recruitment.findUnique({ where: { id } });
    if (!r) return fail(404, 'not_found');
    if (r.kpId !== user.id) return fail(403, 'forbidden');

    const body = ApplicationReviewSchema.parse(await req.json());
    const updated = await prisma.application.update({
      where: { id: appId },
      data: {
        status: body.action === 'approve' ? 'APPROVED' : 'REJECTED',
        reviewedAt: new Date(),
        reviewNote: body.reviewNote ?? null,
      },
    });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}