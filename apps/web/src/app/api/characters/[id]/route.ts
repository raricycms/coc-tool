import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { CharacterUpdateSchema } from '@coc-tools/shared';
import { derive, type PrimaryStats } from '@coc-tools/coc-rules';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let rawBody: unknown = null;
  try {
    const user = await requireUser();
    const { id } = await params;
    const character = await prisma.character.findUnique({
      where: { id },
      include: { skills: true, weapons: true, equipment: true },
    });
    if (!character) return fail(404, 'not_found');
    if (character.ownerId !== user.id) return fail(403, 'forbidden');
    return ok(character);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let rawBody: unknown = null;
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await prisma.character.findUnique({
      where: { id },
      include: { skills: true },
    });
    if (!existing) return fail(404, 'not_found');
    if (existing.ownerId !== user.id) return fail(403, 'forbidden');

    rawBody = await req.json();
    const body = CharacterUpdateSchema.parse(rawBody);

    // 检查是否在跑团中（避免修改）
    const activeSession = await prisma.sessionMember.findFirst({
      where: {
        characterId: id,
        session: { status: { in: ['RUNNING', 'PAUSED'] } },
      },
    });
    const locked = !!activeSession;

    const updateData: any = {};
    if (!locked) {
      if (body.name !== undefined) updateData.name = body.name;
      if (body.gender !== undefined) updateData.gender = body.gender;
      if (body.age !== undefined) updateData.age = body.age;
      if (body.birthplace !== undefined) updateData.birthplace = body.birthplace;
      if (body.residence !== undefined) updateData.residence = body.residence;
      if (body.nationality !== undefined) updateData.nationality = body.nationality;
      if (body.occupation !== undefined) updateData.occupation = body.occupation;
      if (body.era !== undefined) updateData.era = body.era;
      if (body.background !== undefined) updateData.background = body.background;
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (body.primary !== undefined) {
        Object.assign(updateData, body.primary);
        const age = body.age ?? existing.age ?? 25;
        const d = derive(body.primary as PrimaryStats, age);
        updateData.hpMax = d.hpMax;
        updateData.mpMax = d.mpMax;
        updateData.sanMax = d.sanMax;
        updateData.mov = d.mov;
        updateData.build = d.build;
        updateData.damageBonus = d.damageBonus;
        // 重置 current 到 max（基础数据变动）
        updateData.hpCurrent = d.hpMax;
        updateData.mpCurrent = d.mpMax;
        updateData.sanCurrent = d.sanMax;
      }
      if (body.skills !== undefined) {
        updateData.version = { increment: 1 };
        updateData.skills = {
          deleteMany: {},
          create: body.skills.map((s) => ({
            name: s.name,
            value: s.value,
            isMythos: s.isMythos ?? false,
            note: s.note ?? null,
          })),
        };
      }
      if (body.weapons !== undefined) {
        updateData.weapons = {
          deleteMany: {},
          create: body.weapons.map((w) => ({
            name: w.name,
            skill: w.skill,
            damage: w.damage,
            range: w.range ?? null,
            ammo: w.ammo ?? null,
            note: w.note ?? null,
          })),
        };
      }
      if (body.equipment !== undefined) {
        updateData.equipment = {
          deleteMany: {},
          create: body.equipment.map((e) => ({
            name: e.name,
            quantity: e.quantity,
            note: e.note ?? null,
          })),
        };
      }
    }

    const character = await prisma.character.update({
      where: { id },
      data: updateData,
      include: { skills: true, weapons: true, equipment: true },
    });
    return ok(character);
  } catch (e) {
    return handleError(e, { root: rawBody ?? undefined });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let rawBody: unknown = null;
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await prisma.character.findUnique({ where: { id } });
    if (!existing) return fail(404, 'not_found');
    if (existing.ownerId !== user.id) return fail(403, 'forbidden');

    // 软删
    await prisma.character.update({
      where: { id },
      data: { status: 'RETIRED', retiredReason: 'user_request', retiredAt: new Date() },
    });
    return ok({ id });
  } catch (e) {
    return handleError(e);
  }
}