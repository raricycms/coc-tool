import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { KnowledgeGainSchema } from '@coc-tools/shared';
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

    const body = KnowledgeGainSchema.parse(await req.json());

    await prisma.$transaction(async (tx) => {
      for (const g of body.knowledgeGains) {
        const c = await tx.character.findUnique({
          where: { id: g.characterId },
          include: { skills: true },
        });
        if (!c) continue;

        // 更新 Cthulhu Mythos
        const mythos = c.skills.find((s) => s.name === 'Cthulhu Mythos');
        if (mythos) {
          await tx.skill.update({
            where: { id: mythos.id },
            data: { value: Math.min(100, mythos.value + g.amount), isMythos: true },
          });
        } else {
          await tx.skill.create({
            data: {
              characterId: c.id,
              name: 'Cthulhu Mythos',
              value: g.amount,
              isMythos: true,
            },
          });
        }

        // 扣 SAN（每个 Mythos 点扣 1 SAN — TODO(规则书) 校准）
        const newSan = Math.max(0, c.sanCurrent - g.amount);
        await tx.character.update({
          where: { id: c.id },
          data: { sanCurrent: newSan },
        });

        await tx.logEntry.create({
          data: {
            sessionId: id,
            type: 'SKILL_CHANGE',
            characterId: c.id,
            payload: JSON.stringify({
              skillName: 'Cthulhu Mythos',
              delta: g.amount,
              reason: '结算：神话知识增长',
            }),
          },
        });
        await tx.logEntry.create({
          data: {
            sessionId: id,
            type: 'SAN_CHANGE',
            characterId: c.id,
            payload: JSON.stringify({
              delta: -g.amount,
              sanAfter: newSan,
              reason: '神话知识增长导致的 SAN 损失',
            }),
          },
        });
      }

      await tx.settlement.update({
        where: { sessionId: id },
        data: {
          knowledgeGains: JSON.stringify(body.knowledgeGains),
          step: 'RETIREMENT',
        },
      });
    });

    return ok({ step: 'RETIREMENT' });
  } catch (e) {
    return handleError(e);
  }
}