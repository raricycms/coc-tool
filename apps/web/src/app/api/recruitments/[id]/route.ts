import { NextRequest } from 'next/server';
import { prisma } from '@coc-tools/db';
import { RecruitmentUpdateSchema } from '@coc-tools/shared';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let rawBody: unknown = null;
  try {
    const { id } = await params;
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
    const r = await prisma.recruitment.findUnique({ where: { id } });
    if (!r) return fail(404, 'not_found');
    if (r.kpId !== user.id) return fail(403, 'forbidden');
    await prisma.recruitment.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
    return ok({ id });
  } catch (e) {
    return handleError(e);
  }
}