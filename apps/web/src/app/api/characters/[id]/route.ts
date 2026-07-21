import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { CharacterUpdateSchema } from '@coc-tools/shared';
import { derive, type PrimaryStats } from '@coc-tools/coc-rules';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { dedupeByName } from '@/lib/dedupe';

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

    // 乐观锁：客户端应回带 version；不匹配 → 409 防止覆盖别人提交
    if (body.version !== undefined && body.version !== existing.version) {
      return fail(409, 'version_mismatch', `版本冲突：服务器 ${existing.version}，你 ${body.version}`);
    }

    // 检查是否在跑团中（避免修改）
    const activeSession = await prisma.sessionMember.findFirst({
      where: {
        characterId: id,
        session: { status: { in: ['RUNNING', 'PAUSED'] } },
      },
    });
    const locked = !!activeSession;

    const updateData: any = {};
    let skillOps: { deleteMany: any; upsert?: any[] } | undefined;
    let weaponOps: { deleteMany: any; create: any[] } | undefined;
    let equipmentOps: { deleteMany: any; create: any[] } | undefined;

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

        // 关键修复：max 变化时只 clamp current，不"自动满血"。
        // max 缩小 → current 截到新 max；max 放大 → current 保持原值（不治疗）。
        // 没变 → 完全不动。
        if (d.hpMax < existing.hpMax) updateData.hpCurrent = Math.min(existing.hpCurrent, d.hpMax);
        else if (d.hpMax > existing.hpMax) updateData.hpCurrent = existing.hpCurrent; // 不治疗
        if (d.mpMax < existing.mpMax) updateData.mpCurrent = Math.min(existing.mpCurrent, d.mpMax);
        else if (d.mpMax > existing.mpMax) updateData.mpCurrent = existing.mpCurrent;
        if (d.sanMax < existing.sanMax) updateData.sanCurrent = Math.min(existing.sanCurrent, d.sanMax);
        else if (d.sanMax > existing.sanMax) updateData.sanCurrent = existing.sanCurrent;
      }
      if (body.skills !== undefined) {
        // 差量更新：列表里没的删掉，列表里有则 update / create。
        // Prisma 的 upsert 会要求 `create` 里写 character 关系，比较啰嗦，
        // 而且 on conflict 路径还会重新指定 characterId。因此手动拆成
        // update-by-id + create 两步，配合 deleteMany 差量删除。
        const submitted = dedupeByName(body.skills);
        const submittedNames = new Set(submitted.map((s) => s.name));
        const existingByName = new Map(existing.skills.map((s) => [s.name, s]));
        skillOps = {
          deleteMany: { name: { notIn: Array.from(submittedNames) } },
          upsert: submitted.map((s) => {
            const prev = existingByName.get(s.name);
            return {
              where: { characterId_name: { characterId: id, name: s.name } },
              create: {
                name: s.name,
                value: s.value,
                isMythos: s.isMythos ?? false,
                note: s.note ?? null,
                character: { connect: { id } },
              },
              update: {
                value: s.value,
                isMythos: s.isMythos ?? prev?.isMythos ?? false,
                note: s.note ?? null,
              },
            };
          }),
        };
      }
      if (body.weapons !== undefined) {
        const weapons = dedupeByName(body.weapons);
        weaponOps = {
          deleteMany: {},
          create: weapons.map((w) => ({
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
        const equipment = dedupeByName(body.equipment);
        equipmentOps = {
          deleteMany: {},
          create: equipment.map((e) => ({
            name: e.name,
            quantity: e.quantity,
            note: e.note ?? null,
          })),
        };
      }
      // 任何变更都增加 version，配合乐观锁
      if (body.skills !== undefined || body.weapons !== undefined || body.equipment !== undefined
          || body.primary !== undefined || Object.keys(updateData).length > 0) {
        updateData.version = { increment: 1 };
      }
    }

    const character = await prisma.$transaction(async (tx) => {
      // 乐观锁：把 version 也加入 update where，防止 TOCTOU
      const where: any = { id };
      if (body.version !== undefined) where.version = body.version;
      const c = await tx.character.update({
        where,
        data: updateData,
      });
      if (skillOps) {
        if (skillOps.deleteMany) await tx.skill.deleteMany({ where: { characterId: id, ...skillOps.deleteMany } });
        if (skillOps.upsert) {
          for (const u of skillOps.upsert) {
            await tx.skill.upsert(u);
          }
        }
      }
      if (weaponOps) {
        await tx.weapon.deleteMany({ where: { characterId: id } });
        for (const w of weaponOps.create) {
          await tx.weapon.create({ data: { ...w, characterId: id } });
        }
      }
      if (equipmentOps) {
        await tx.equipment.deleteMany({ where: { characterId: id } });
        for (const e of equipmentOps.create) {
          await tx.equipment.create({ data: { ...e, characterId: id } });
        }
      }
      return tx.character.findUniqueOrThrow({
        where: { id: c.id },
        include: { skills: true, weapons: true, equipment: true },
      });
    });
    return ok(character);
  } catch (e) {
    // Prisma P2025 = record not found (version optimistic lock failure)
    if ((e as any)?.code === 'P2025') {
      return fail(409, 'version_mismatch', '版本冲突，请刷新后重试');
    }
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