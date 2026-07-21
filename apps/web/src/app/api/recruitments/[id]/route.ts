import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { RecruitmentUpdateSchema } from '@coc-tools/shared';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';

/**
 * 检查当前用户是否能查看该招募：
 * - 公开招募：所有人都能看
 * - link 招募：KP 本人 / 已报名者 / session 成员可见
 */
async function canViewRecruitment(recruitmentId: string, userId: string | null): Promise<boolean> {
  const r = await prisma.recruitment.findUnique({
    where: { id: recruitmentId },
    select: { visibility: true, kpId: true },
  });
  if (!r) return false;
  if (r.visibility === 'public') return true;
  if (userId && r.kpId === userId) return true;
  if (userId) {
    const app = await prisma.application.findFirst({
      where: { recruitmentId, applicantId: userId },
      select: { id: true },
    });
    if (app) return true;
  }
  return false;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let rawBody: unknown = null;
  try {
    const { id } = await params;
    // 优先用 session 校验，未登录且私密招募会 404
    const session = await requireUser().catch(() => null);
    const userId = session?.id ?? null;
    const allowed = await canViewRecruitment(id, userId);
    if (!allowed) return fail(404, 'not_found');

    const r = await prisma.recruitment.findUnique({
      where: { id },
      include: {
        kp: { select: { username: true, avatarUrl: true } },
        applications: {
          include: {
            applicant: { select: { username: true, avatarUrl: true } },
          },
        },
      },
    });
    if (!r) return fail(404, 'not_found');
    return ok(r);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let rawBody: unknown = null;
  try {
    const user = await requireUser();
    const { id } = await params;
    const r = await prisma.recruitment.findUnique({ where: { id } });
    if (!r) return fail(404, 'not_found');
    if (r.kpId !== user.id) return fail(403, 'forbidden');

    rawBody = await req.json();
    const body = RecruitmentUpdateSchema.parse(rawBody);
    const minPlayers = body.minPlayers ?? r.minPlayers;
    const maxPlayers = body.maxPlayers ?? r.maxPlayers;
    if (maxPlayers < minPlayers) {
      return fail(400, 'invalid_input', 'maxPlayers 必须 >= minPlayers');
    }
    // 缩小 maxPlayers 不能小于已通过 PL 数量
    if (body.maxPlayers !== undefined && body.maxPlayers < r.maxPlayers) {
      const approvedCount = await prisma.application.count({
        where: { recruitmentId: id, status: 'APPROVED' },
      });
      if (body.maxPlayers < approvedCount) {
        return fail(400, 'max_below_approved', `maxPlayers 不能小于已通过的 ${approvedCount} 人`);
      }
    }

    const updated = await prisma.recruitment.update({
      where: { id },
      data: {
        title: body.title ?? undefined,
        summary: body.summary ?? undefined,
        scenario: body.scenario ?? undefined,
        minPlayers: body.minPlayers ?? undefined,
        maxPlayers: body.maxPlayers ?? undefined,
        expectedHours: body.expectedHours ?? undefined,
        startAt: body.startAt ?? undefined,
        visibility: body.visibility ?? undefined,
      },
    });
    return ok(updated);
  } catch (e) {
    return handleError(e, { root: rawBody ?? undefined });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let rawBody: unknown = null;
  try {
    const user = await requireUser();
    const { id } = await params;
    const r = await prisma.recruitment.findUnique({
      where: { id },
      include: { session: { select: { id: true } } },
    });
    if (!r) return fail(404, 'not_found');
    if (r.kpId !== user.id) return fail(403, 'forbidden');
    if (r.session) {
      return fail(400, 'session_started', '已开团，不能删除');
    }
    // 仅允许删除 DRAFT 或 CLOSED 的招募；OPEN 状态应走 POST /close
    if (r.status === 'OPEN' || r.status === 'FINISHED') {
      return fail(400, 'cannot_delete_open', 'OPEN 状态请用 POST /api/recruitments/[id]/close 关闭');
    }
    // 级联删除：Application 没 ON DELETE CASCADE 在 prisma 里，但 schema.prisma 已配 cascade；
    // 真删会一起带掉 applications。
    await prisma.recruitment.delete({ where: { id } });
    return ok({ id, deleted: true });
  } catch (e) {
    return handleError(e);
  }
}