import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { ApplicationCreateSchema, ApplicationReviewSchema } from '@coc-tools/shared';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const r = await prisma.recruitment.findUnique({ where: { id } });
    if (!r) return fail(404, 'not_found');
    if (r.kpId !== user.id) return fail(403, 'forbidden');
    const list = await prisma.application.findMany({
      where: { recruitmentId: id },
      include: { applicant: { select: { username: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return ok(list);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = ApplicationCreateSchema.parse(await req.json());

    const r = await prisma.recruitment.findUnique({ where: { id } });
    if (!r) return fail(404, 'not_found');
    if (r.status !== 'OPEN') return fail(400, 'recruitment_not_open');

    // 校验车卡属于当前用户
    const char = await prisma.character.findUnique({ where: { id: body.characterId } });
    if (!char) return fail(404, 'character_not_found');
    if (char.ownerId !== user.id) return fail(403, 'not_your_character');
    if (char.status !== 'ACTIVE') return fail(400, 'character_retired');

    // 重复报名（unique(recruitmentId, characterId)）
    const exists = await prisma.application.findUnique({
      where: { recruitmentId_characterId: { recruitmentId: id, characterId: body.characterId } },
    });
    if (exists) return fail(409, 'already_applied');

    // 检查已批准数量
    const approvedCount = await prisma.application.count({
      where: { recruitmentId: id, status: 'APPROVED' },
    });
    if (approvedCount >= r.maxPlayers) return fail(400, 'full');

    const app = await prisma.application.create({
      data: {
        recruitmentId: id,
        applicantId: user.id,
        characterId: body.characterId,
        message: body.message ?? null,
        status: 'PENDING',
      },
    });
    return ok(app);
  } catch (e) {
    return handleError(e);
  }
}