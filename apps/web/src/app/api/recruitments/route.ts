import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { RecruitmentCreateSchema } from '@coc-tools/shared';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  let rawBody: unknown = null;
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
  let rawBody: unknown = null;
  try {
    const user = await requireUser();
    rawBody = await req.json();
    // 用 z.parse 后再读 asDraft：asDraft 不在 schema 里，避免污染 RecruitmentCreateSchema
    const parsed = RecruitmentCreateSchema.parse(rawBody) as any;
    const asDraft = typeof (rawBody as any)?.asDraft === 'boolean'
      ? !!(rawBody as any).asDraft
      : false;

    const recruitment = await prisma.recruitment.create({
      data: {
        kpId: user.id,
        title: parsed.title,
        summary: parsed.summary,
        scenario: parsed.scenario ?? null,
        minPlayers: parsed.minPlayers,
        maxPlayers: parsed.maxPlayers,
        expectedHours: parsed.expectedHours ?? null,
        startAt: parsed.startAt ?? null,
        visibility: parsed.visibility,
        // 默认仍直接创建为 OPEN（保持旧行为兼容）；前端表单显式传 asDraft:true → DRAFT
        status: asDraft ? 'DRAFT' : 'OPEN',
      },
    });
    return ok(recruitment);
  } catch (e) {
    return handleError(e, { root: rawBody ?? undefined });
  }
}