import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { SkillGrowthRequestSchema } from '@coc-tools/shared';
import { judgeSkillGrowth } from '@coc-tools/coc-rules';
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
    const body = SkillGrowthRequestSchema.parse(rawBody);

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
          // 不再硬 cap 100：与 SkillSchema.max(999) 对齐，结算结果不被截断
          data: { value: Math.min(999, skill.value + result.growth) },
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

    // 把新 results 合并到现有 skillGrowths：按 (characterId+skillName) 去重，
    // 同 key 的新条目覆盖旧的（避免 KP 双击重发产生重复日志 / 旧 results）。
    // 同时复用 Settlement 上其他字段不变。
    const existing = await prisma.settlement.findUnique({ where: { sessionId: id } });
    const existingArr: any[] = (() => {
      if (!existing?.skillGrowths) return [];
      try {
        const v = JSON.parse(existing.skillGrowths);
        return Array.isArray(v) ? v : [];
      } catch {
        return [];
      }
    })();
    const keyOf = (r: any) => `${r.characterId}::${r.skillName}`;
    const seen = new Set(results.map(keyOf));
    const merged = [...results, ...existingArr.filter((r) => !seen.has(keyOf(r)))];

    await prisma.settlement.update({
      where: { sessionId: id },
      data: { skillGrowths: JSON.stringify(merged) },
    });

    return ok({ results, merged });
  } catch (e) {
    return handleError(e, { root: rawBody ?? undefined });
  }
}