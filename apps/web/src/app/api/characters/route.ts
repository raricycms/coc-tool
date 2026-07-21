import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { CharacterCreateSchema } from '@coc-tools/shared';
import { derive, type PrimaryStats } from '@coc-tools/coc-rules';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { dedupeByName } from '@/lib/dedupe';

export async function GET(_req: NextRequest) {
  let rawBody: unknown = null;
  try {
    const user = await requireUser();
    const list = await prisma.character.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: { skills: true, weapons: true, equipment: true },
    });
    return ok(list);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  let rawBody: unknown = null;
  try {
    const user = await requireUser();
    rawBody = await req.json();
    const body = CharacterCreateSchema.parse(rawBody);

    const age = body.age ?? 25;
    const derived = derive(body.primary as PrimaryStats, age);

    // 显式检测同名技能：直接返回 400 避免静默丢数据。
    // 客户端应在提交前去重，服务端这里兜底。
    const skillNames = new Set<string>();
    const dupSkills: string[] = [];
    for (const s of body.skills) {
      if (skillNames.has(s.name)) dupSkills.push(s.name);
      skillNames.add(s.name);
    }
    if (dupSkills.length > 0) {
      return fail(400, 'duplicate_skill', `技能名重复：${Array.from(new Set(dupSkills)).join('、')}`);
    }
    // 武器 / 装备没有唯一约束，仍走 dedupeByName 防 id 冲突
    const weapons = dedupeByName(body.weapons);
    const equipment = dedupeByName(body.equipment);
    const skills = body.skills;

    const character = await prisma.character.create({
      data: {
        ownerId: user.id,
        name: body.name,
        gender: body.gender ?? null,
        age,
        birthplace: body.birthplace ?? null,
        residence: body.residence ?? null,
        nationality: body.nationality ?? null,
        occupation: body.occupation ?? null,
        era: body.era,
        str: body.primary.str,
        con: body.primary.con,
        siz: body.primary.siz,
        dex: body.primary.dex,
        app: body.primary.app,
        int: body.primary.int,
        pow: body.primary.pow,
        edu: body.primary.edu,
        luck: body.primary.luck,
        hpMax: derived.hpMax,
        mpMax: derived.mpMax,
        sanMax: derived.sanMax,
        mov: derived.mov,
        build: derived.build,
        damageBonus: derived.damageBonus,
        hpCurrent: derived.hpMax,
        mpCurrent: derived.mpMax,
        sanCurrent: derived.sanMax,
        luckCurrent: body.primary.luck,
        background: body.background ?? null,
        notes: body.notes ?? null,
        skills: {
          create: skills.map((s) => ({
            name: s.name,
            value: s.value,
            isMythos: s.isMythos ?? false,
            note: s.note ?? null,
          })),
        },
        weapons: {
          create: weapons.map((w) => ({
            name: w.name,
            skill: w.skill,
            damage: w.damage,
            range: w.range ?? null,
            ammo: w.ammo ?? null,
            note: w.note ?? null,
          })),
        },
        equipment: {
          create: equipment.map((e) => ({
            name: e.name,
            quantity: e.quantity,
            note: e.note ?? null,
          })),
        },
      },
      include: { skills: true, weapons: true, equipment: true },
    });
    return ok(character);
  } catch (e) {
    return handleError(e, { root: rawBody ?? undefined });
  }
}