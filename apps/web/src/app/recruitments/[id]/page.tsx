import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@coc-tools/db';
import { ApplyButton } from '@/components/ApplyButton';

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
        where: { status: 'APPROVED' },
        include: { applicant: { select: { username: true } } },
      },
    },
  });
  if (!r) notFound();

  const myApp = await prisma.application.findFirst({
    where: { recruitmentId: id, applicantId: user.id },
  });
  const myCharacters = await prisma.character.findMany({
    where: { ownerId: user.id, status: 'ACTIVE' },
    select: { id: true, name: true, era: true },
  });

  const isKp = r.kpId === user.id;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <header className="space-y-2">
        <Link href="/recruitments" className="text-sm font-semibold text-macaron-600 hover:underline">
          ← 返回招募列表
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">{r.title}</h1>
        <p className="text-sm text-ink-soft">KP @{r.kp.username}</p>
      </header>

      <section className="card space-y-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{r.summary}</p>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <Tag>已通过 PL {r.applications.length}/{r.maxPlayers}</Tag>
          <Tag>最少 {r.minPlayers} 人</Tag>
          {r.scenario && <Tag>剧本：{r.scenario}</Tag>}
          {r.expectedHours && <Tag>预计 {r.expectedHours} 小时</Tag>}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-soft">已通过 PL</h2>
        {r.applications.length === 0 ? (
          <p className="text-sm text-ink-soft">还没有 PL 通过审核。</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {r.applications.map((a) => (
              <li key={a.id} className="rounded-full bg-sky-100 px-3 py-1 text-sm text-ink">
                @{a.applicant.username}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!isKp && r.status === 'OPEN' && (
        <ApplyButton
          recruitmentId={r.id}
          myCharacters={myCharacters}
          existing={myApp ? { status: myApp.status, characterId: myApp.characterId } : null}
        />
      )}

      {isKp && (
        <div className="flex justify-end">
          <Link href={`/recruitments/${r.id}/manage`} className="btn-primary">
            管理招募 →
          </Link>
        </div>
      )}
    </main>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-sky-100 px-2.5 py-1 font-medium text-ink">{children}</span>
  );
}