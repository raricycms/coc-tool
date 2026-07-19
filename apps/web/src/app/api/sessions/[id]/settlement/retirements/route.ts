import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { RetirementSchema } from '@coc-tools/shared';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const s = await prisma.session.findUnique({ where: { id } });
    if (!s) return fail(404, 'not_found');
    if (s.kpId !== user.id) return fail(403, 'forbidden');
    if (s.status !== 'SETTLING') return fail(400, 'not_settling');

    const body = RetirementSchema.parse(await req.json());

    await prisma.$transaction(async (tx) => {
      for (const r of body.retirements) {
        await tx.character.update({
          where: { id: r.characterId },
          data: {
            status: 'RETIRED',
            retiredReason: r.reason,
            retiredAt: new Date(),
          },
        });
        await tx.logEntry.create({
          data: {
            sessionId: id,
            type: 'SYSTEM',
            characterId: r.characterId,
            payload: JSON.stringify({ event: 'character_retired', reason: r.reason, note: r.note }),
          },
        });
      }
      await tx.settlement.update({
        where: { sessionId: id },
        data: {
          retirements: JSON.stringify(body.retirements),
          step: 'SKILL_GROWTH',
        },
      });
    });

    return ok({ step: 'SKILL_GROWTH' });
  } catch (e) {
    return handleError(e);
  }
}