import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { SanRecoverySchema } from '@coc-tools/shared';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let rawBody: unknown = null;
  try {
    const user = await requireUser();
    const { id } = await params;
    const s = await prisma.session.findUnique({ where: { id } });
    if (!s) return fail(404, 'not_found');
    if (s.kpId !== user.id) return fail(403, 'forbidden');
    if (s.status !== 'SETTLING') return fail(400, 'not_settling');

    rawBody = await req.json();
    const body = SanRecoverySchema.parse(rawBody);

    await prisma.$transaction(async (tx) => {
      for (const r of body.sanRecoveries) {
        const c = await tx.character.findUnique({ where: { id: r.characterId } });
        if (!c) continue;
        const newSan = Math.max(0, Math.min(c.sanMax, c.sanCurrent + r.amount));
        await tx.character.update({
          where: { id: c.id },
          data: { sanCurrent: newSan },
        });
        await tx.logEntry.create({
          data: {
            sessionId: id,
            type: 'SAN_CHANGE',
            characterId: c.id,
            payload: JSON.stringify({
              delta: r.amount,
              sanAfter: newSan,
              reason: '结算：SAN 恢复',
            }),
          },
        });
      }
      await tx.settlement.update({
        where: { sessionId: id },
        data: {
          sanRecoveries: JSON.stringify(body.sanRecoveries),
          step: 'KNOWLEDGE_GAIN',
        },
      });
    });

    return ok({ step: 'KNOWLEDGE_GAIN' });
  } catch (e) {
    return handleError(e, { root: rawBody ?? undefined });
  }
}