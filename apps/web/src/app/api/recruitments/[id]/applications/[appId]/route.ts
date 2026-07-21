import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { ApplicationReviewSchema } from '@coc-tools/shared';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; appId: string }> }) {
  let rawBody: unknown = null;
  try {
    const user = await requireUser();
    const { id, appId } = await params;
    const r = await prisma.recruitment.findUnique({ where: { id } });
    if (!r) return fail(404, 'not_found');
    if (r.kpId !== user.id) return fail(403, 'forbidden');

    rawBody = await req.json();
    const body = ApplicationReviewSchema.parse(rawBody);

    // 校验 application 确实属于本次招募：appId 单独用 PATCH 时可能被传成任意 application id
    const app = await prisma.application.findUnique({ where: { id: appId } });
    if (!app || app.recruitmentId !== id) {
      return fail(404, 'not_found');
    }

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
    return handleError(e, { root: rawBody ?? undefined });
  }
}

/**
 * 申请人撤回自己的报名（仅本人、PENDING 状态可撤）。
 * 软撤：status → WITHDRAWN，保留记录方便审计。
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; appId: string }> }) {
  try {
    const user = await requireUser();
    const { id, appId } = await params;
    const app = await prisma.application.findUnique({ where: { id: appId } });
    if (!app || app.recruitmentId !== id) return fail(404, 'not_found');
    if (app.applicantId !== user.id) return fail(403, 'not_your_application');
    if (app.status !== 'PENDING') {
      return fail(400, 'not_pending', `当前状态 ${app.status} 不能撤回`);
    }
    const updated = await prisma.application.update({
      where: { id: appId },
      data: { status: 'WITHDRAWN' },
    });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}