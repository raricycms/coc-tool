/**
 * 发布招募：把 status 从 DRAFT 切到 OPEN。
 * 仅 KP 可调；必须当前是 DRAFT 状态。
 * 校验：minPlayers/maxPlayers 合法、summary 非空（OPEN 状态要求）。
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
    if (r.status !== 'DRAFT') return fail(400, 'not_draft', '只有 DRAFT 状态可以发布');

    if (r.maxPlayers < r.minPlayers) {
      return fail(400, 'invalid_input', 'maxPlayers 必须 >= minPlayers');
    }
    if (!r.title.trim() || !r.summary.trim()) {
      return fail(400, 'incomplete', '标题和简介不能为空');
    }

    const updated = await prisma.recruitment.update({
      where: { id },
      data: { status: 'OPEN' },
    });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}