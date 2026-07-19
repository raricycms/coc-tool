import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { RecruitmentCreateSchema } from '@coc-tools/shared';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const onlyMine = url.searchParams.get('mine') === 'true';
    const user = await requireUser();

    const where: any = {};
    if (status) where.status = status;
    if (onlyMine) where.kpId = user.id;

    const list = await prisma.recruitment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { kp: { select: { username: true, avatarUrl: true } }, _count: { select: { applications: true } } },
      take: 50,
    });
    return ok(list);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = RecruitmentCreateSchema.parse(await req.json());

    const recruitment = await prisma.recruitment.create({
      data: {
        kpId: user.id,
        title: body.title,
        summary: body.summary,
        scenario: body.scenario ?? null,
        minPlayers: body.minPlayers,
        maxPlayers: body.maxPlayers,
        expectedHours: body.expectedHours ?? null,
        startAt: body.startAt ?? null,
        visibility: body.visibility,
        status: 'OPEN',
      },
    });
    return ok(recruitment);
  } catch (e) {
    return handleError(e);
  }
}