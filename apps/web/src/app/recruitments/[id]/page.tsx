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
    <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <Link href="/recruitments" className="btn-ghost text-sm mb-3 inline-block">← 返回列表</Link>
        <h1 className="text-3xl font-bold mb-1">{r.title}</h1>
        <p className="text-ink-100/60 text-sm">KP: @{r.kp.username}</p>
      </header>

      <section className="card mb-4">
        <p className="whitespace-pre-wrap text-sm">{r.summary}</p>
        <div className="mt-4 flex gap-4 text-xs text-ink-100/50">
          <span>已批准 PL {r.applications.length}/{r.maxPlayers}</span>
          <span>最小 {r.minPlayers} 人</span>
          {r.scenario && <span>剧本: {r.scenario}</span>}
          {r.expectedHours && <span>{r.expectedHours}h</span>}
        </div>
      </section>

      <section className="card mb-4">
        <h2 className="font-bold mb-2">已报名 PL</h2>
        {r.applications.length === 0 ? (
          <p className="text-ink-100/40 text-sm">还没有 PL 通过审核。</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {r.applications.map((a) => (
              <li key={a.id}>@{a.applicant.username}</li>
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
        <Link href={`/recruitments/${r.id}/manage`} className="btn-primary inline-block">
          管理招募 →
        </Link>
      )}
    </main>
  );
}