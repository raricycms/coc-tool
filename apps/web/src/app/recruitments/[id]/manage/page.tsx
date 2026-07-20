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
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <header className="space-y-2">
        <Link href={`/recruitments/${r.id}`} className="text-sm font-semibold text-macaron-600 hover:underline">
          ← 返回招募详情
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">{r.title}</h1>
        <p className="text-sm text-ink-soft">
          {recruitmentStatusLabel(r.status)} · 已通过 {approvedCount}/{r.maxPlayers}
        </p>
      </header>

      <section className="card">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-soft">报名列表 · {r.applications.length}</h2>
        {r.applications.length === 0 ? (
          <p className="text-sm text-ink-soft">还没有 PL 报名。</p>
        ) : (
          <ul className="divide-y divide-sky-100">
            {r.applications.map((a) => (
              <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink">@{a.applicant.username}</div>
                    <div className="mt-0.5 text-xs text-ink-soft">
                      状态：<StatusTag status={a.status} />
                    </div>
                    {a.message && <p className="mt-2 text-sm text-ink">{a.message}</p>}
                  </div>
                  {a.status === 'PENDING' && (
                    <ApplicationReviewButtons recruitmentId={r.id} appId={a.id} />
                  )}
                </div>
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

function recruitmentStatusLabel(s: string): string {
  switch (s) {
    case 'OPEN': return '招募中';
    case 'CLOSED': return '已关闭';
    default: return s;
  }
}

function StatusTag({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING:  { label: '待审核', cls: 'bg-warn/20 text-warn' },
    APPROVED: { label: '已通过', cls: 'bg-ok/15 text-ok' },
    REJECTED: { label: '已拒绝', cls: 'bg-bad/15 text-bad' },
  };
  const m = map[status] ?? { label: status, cls: 'bg-sky-100 text-ink-soft' };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.label}</span>;
}