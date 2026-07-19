import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@coc-tools/db';
import { ApplicationReviewButtons } from '@/components/ApplicationReviewButtons';
import { StartSessionButton } from '@/components/StartSessionButton';

export const dynamic = 'force-dynamic';

export default async function ManageRecruitmentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;

  const r = await prisma.recruitment.findUnique({
    where: { id },
    include: {
      applications: {
        include: { applicant: { select: { username: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!r) notFound();
  if (r.kpId !== user.id) notFound();

  const approvedCount = r.applications.filter((a) => a.status === 'APPROVED').length;

  return (
    <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <Link href={`/recruitments/${r.id}`} className="btn-ghost text-sm mb-3 inline-block">← 返回详情</Link>
        <h1 className="text-2xl font-bold">{r.title}</h1>
        <p className="text-sm text-ink-100/60">状态：{r.status} · 已批准 {approvedCount}/{r.maxPlayers}</p>
      </header>

      <section className="card mb-4">
        <h2 className="font-bold mb-3">报名列表 ({r.applications.length})</h2>
        {r.applications.length === 0 ? (
          <p className="text-ink-100/40 text-sm">暂无报名</p>
        ) : (
          <ul className="space-y-3">
            {r.applications.map((a) => (
              <li key={a.id} className="flex items-center justify-between border-b border-ink-800 pb-2">
                <div>
                  <div className="font-medium">@{a.applicant.username}</div>
                  <div className="text-xs text-ink-100/40">
                    状态：<span className={a.status === 'APPROVED' ? 'text-green-400' : a.status === 'REJECTED' ? 'text-red-400' : 'text-yellow-400'}>{a.status}</span>
                  </div>
                  {a.message && <p className="text-sm text-ink-100/60 mt-1">{a.message}</p>}
                </div>
                {a.status === 'PENDING' && (
                  <ApplicationReviewButtons recruitmentId={r.id} appId={a.id} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {r.status === 'OPEN' && (
        <StartSessionButton recruitmentId={r.id} approvedCount={approvedCount} />
      )}
    </main>
  );
}