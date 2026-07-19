import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { SkillGrowthRequestSchema } from '@coc-tools/shared';
import { judgeSkillGrowth } from '@coc-tools/coc-rules';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const s = await prisma.session.findUnique({ where: { id } });
    if (!s) return fail(404, 'not_found');
    if (s.status !== 'SETTLING') return fail(400, 'not_settling');

    const body = SkillGrowthRequestSchema.parse(await req.json());

    const results: any[] = [];
    for (const g of body.growths) {
      const char = await prisma.character.findUnique({
        where: { id: g.characterId },
        include: { skills: true },
      });
      if (!char) continue;

      // 权限：PL 只能给自己投，KP 可以代投
      if (char.ownerId !== user.id && s.kpId !== user.id) {
        throw new Error(`无权修改角色 ${char.name}`);
      }

      const skill = char.skills.find((sk) => sk.name === g.skillName);
      if (!skill) continue;

      const result = judgeSkillGrowth({ skillValue: skill.value });

      if (result.succeeded) {
        await prisma.skill.update({
          where: { id: skill.id },
          data: { value: Math.min(100, skill.value + result.growth) },
        });
      }

      await prisma.logEntry.create({
        data: {
          sessionId: id,
          type: 'SKILL_CHANGE',
          characterId: char.id,
          payload: JSON.stringify({
            skillName: g.skillName,
            oldValue: skill.value,
            newValue: result.newSkillValue,
            dice: result.dice,
            succeeded: result.succeeded,
            growth: result.growth,
          }),
        },
      });

      results.push({
        characterId: char.id,
        skillName: g.skillName,
        oldValue: skill.value,
        newValue: result.newSkillValue,
        dice: result.dice,
        succeeded: result.succeeded,
        growth: result.growth,
      });
    }

    await prisma.settlement.update({
      where: { sessionId: id },
      data: {
        skillGrowths: JSON.stringify(results),
      },
    });

    return ok({ results });
  } catch (e) {
    return handleError(e);
  }
}