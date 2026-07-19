/**
 * 启动 Session：把已批准的 Application 转为 SessionMember。
 */

import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const r = await prisma.recruitment.findUnique({
      where: { id },
      include: { applications: true },
    });
    if (!r) return fail(404, 'not_found');
    if (r.kpId !== user.id) return fail(403, 'forbidden');
    if (r.status === 'FINISHED') return fail(400, 'already_started');
    if (r.status !== 'OPEN' && r.status !== 'CLOSED') return fail(400, 'not_startable');

    const approved = r.applications.filter((a) => a.status === 'APPROVED');
    if (approved.length === 0) return fail(400, 'no_approved_applicants');

    const session = await prisma.$transaction(async (tx) => {
      // 关闭招募
      await tx.recruitment.update({
        where: { id },
        data: { status: 'FINISHED', finishedAt: new Date() },
      });
      // 创建 Session
      const s = await tx.session.create({
        data: {
          recruitmentId: id,
          kpId: r.kpId,
          title: r.title,
          scenario: r.scenario,
          status: 'SETUP',
          inGameTime: '08:00',
          inGameDate: '1/1',
          clockRunning: false,
          clockRate: 1,
        },
      });
      // KP 自身
      await tx.sessionMember.create({
        data: { sessionId: s.id, userId: r.kpId, role: 'KP' },
      });
      // PL
      for (const a of approved) {
        await tx.sessionMember.create({
          data: { sessionId: s.id, userId: a.applicantId, characterId: a.characterId, role: 'PL' },
        });
      }
      return s;
    });
    return ok(session);
  } catch (e) {
    return handleError(e);
  }
}