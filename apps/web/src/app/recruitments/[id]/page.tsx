import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@coc-tools/db';
import { ApplyButton } from '@/components/ApplyButton';
import { ApprovedPLList, type ApprovedPLItem } from '@/components/ApprovedPLList';
import {
  KpApplicationsSection,
  type KpApplication,
} from '@/components/KpApplicationsSection';

export const dynamic = 'force-dynamic';

export default async function RecruitmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;

  const r = await prisma.recruitment.findUnique({
    where: { id },
    include: {
      kp: { select: { username: true, avatarUrl: true } },
      applications: {
        orderBy: { createdAt: 'asc' },
        include: {
          applicant: { select: { id: true, username: true, avatarUrl: true } },
        },
      },
      session: { select: { id: true, status: true } },
    },
  });
  if (!r) notFound();
  // 私密（link）招募：非 KP / 未报名者看不到
  if (r.visibility === 'link' && r.kpId !== user.id) {
    const myAppForVisibility = await prisma.application.findFirst({
      where: { recruitmentId: id, applicantId: user.id },
      select: { id: true },
    });
    if (!myAppForVisibility) notFound();
  }

  const myApp = await prisma.application.findFirst({
    where: { recruitmentId: id, applicantId: user.id },
  });
  const myCharacters = await prisma.character.findMany({
    where: { ownerId: user.id, status: 'ACTIVE' },
    select: { id: true, name: true, era: true },
  });

  // Application.characterId 没有 Prisma 关系；单独查一次车卡详情（仅 KP 视图用到）
  const characterIds = Array.from(new Set(r.applications.map((a) => a.characterId)));
  const characters = characterIds.length > 0
    ? await prisma.character.findMany({
        where: { id: { in: characterIds } },
        include: { skills: true, weapons: true, equipment: true },
      })
    : [];
  const characterById = new Map(characters.map((c) => [c.id, c]));

  const isKp = r.kpId === user.id;
  const approved = r.applications.filter((a) => a.status === 'APPROVED');

  // PL 视角也能查看其它已通过 PL 的车卡。复用 characterById（之前只 KP 用了），
  // character 字段与 KpApplication.character 同构，CharacterViewModal 接受即可。
  const approvedPLItems: ApprovedPLItem[] = approved.map((a) => {
    const c = characterById.get(a.characterId);
    return {
      applicationId: a.id,
      applicantUsername: a.applicant.username,
      character: c
        ? {
            id: c.id, name: c.name,
            str: c.str, con: c.con, siz: c.siz, dex: c.dex,
            app: c.app, int: c.int, pow: c.pow, edu: c.edu,
            hpCurrent: c.hpCurrent, hpMax: c.hpMax,
            sanCurrent: c.sanCurrent, sanMax: c.sanMax,
            mpCurrent: c.mpCurrent, mpMax: c.mpMax,
            luckCurrent: c.luckCurrent,
            damageBonus: c.damageBonus,
            era: c.era, occupation: c.occupation,
            skills: c.skills.map((s) => ({ name: s.name, value: s.value, isMythos: s.isMythos })),
            weapons: c.weapons.map((w) => ({
              id: w.id, name: w.name, skill: w.skill, damage: w.damage,
              range: w.range, ammo: w.ammo, note: w.note,
            })),
            equipment: c.equipment.map((e) => ({
              id: e.id, name: e.name, quantity: e.quantity, note: e.note,
            })),
          }
        : null,
    };
  });

  const kpApplications: KpApplication[] = r.applications.map((a) => {
    const c = characterById.get(a.characterId);
    return {
      id: a.id,
      status: a.status,
      message: a.message ?? null,
      createdAt: a.createdAt.toISOString(),
      applicant: {
        id: a.applicant.id,
        username: a.applicant.username,
        avatarUrl: a.applicant.avatarUrl ?? null,
      },
      character: c
        ? {
            id: c.id,
            name: c.name,
            str: c.str, con: c.con, siz: c.siz, dex: c.dex,
            app: c.app, int: c.int, pow: c.pow, edu: c.edu,
            hpCurrent: c.hpCurrent, hpMax: c.hpMax,
            sanCurrent: c.sanCurrent, sanMax: c.sanMax,
            mpCurrent: c.mpCurrent, mpMax: c.mpMax,
            luckCurrent: c.luckCurrent,
            damageBonus: c.damageBonus,
            era: c.era,
            occupation: c.occupation,
            background: c.background,
            skills: c.skills.map((s) => ({ name: s.name, value: s.value, isMythos: s.isMythos })),
            weapons: c.weapons.map((w) => ({
              id: w.id, name: w.name, skill: w.skill, damage: w.damage,
              range: w.range, ammo: w.ammo, note: w.note,
            })),
            equipment: c.equipment.map((e) => ({
              id: e.id, name: e.name, quantity: e.quantity, note: e.note,
            })),
          }
        : null,
    };
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <header className="space-y-2">
        <Link href="/recruitments" className="text-sm font-semibold text-macaron-600 hover:underline">
          ← 返回招募列表
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">{r.title}</h1>
        <p className="text-sm text-ink-soft">
          KP @{r.kp.username}
          {isKp && (
            <>
              {' · '}
              <span className="rounded-full bg-macaron-100 px-2 py-0.5 text-[11px] font-semibold text-macaron-600">
                我创建的
              </span>
            </>
          )}
        </p>
      </header>

      <section className="card space-y-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{r.summary}</p>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <Tag>已通过 PL {approved.length}/{r.maxPlayers}</Tag>
          <Tag>最少 {r.minPlayers} 人</Tag>
          {r.scenario && <Tag>剧本：{r.scenario}</Tag>}
          {r.expectedHours && <Tag>预计 {r.expectedHours} 小时</Tag>}
          {!isKp && <Tag>{recruitmentStatusLabel(r.status)}</Tag>}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-soft">已通过 PL</h2>
        <ApprovedPLList items={approvedPLItems} />
      </section>

      {!isKp && r.status === 'OPEN' && (
        <ApplyButton
          recruitmentId={r.id}
          myCharacters={myCharacters}
          existing={myApp ? { status: myApp.status, characterId: myApp.characterId } : null}
        />
      )}

      {isKp && (
        <KpApplicationsSection
          recruitmentId={r.id}
          recruitmentStatus={r.status}
          applications={kpApplications}
          approvedCount={approved.length}
          sessionId={r.session?.id ?? null}
          sessionStatus={r.session?.status ?? null}
        />
      )}
    </main>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-sky-100 px-2.5 py-1 font-medium text-ink">{children}</span>
  );
}

function recruitmentStatusLabel(s: string): string {
  switch (s) {
    case 'OPEN': return '招募中';
    case 'CLOSED': return '已关闭';
    case 'FINISHED': return '已开团';
    case 'DRAFT': return '草稿';
    default: return s;
  }
}
