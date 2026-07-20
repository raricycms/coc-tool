import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@coc-tools/db';

export const dynamic = 'force-dynamic';

export default async function RecruitmentsListPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const list = await prisma.recruitment.findMany({
    where: { status: 'OPEN', visibility: 'public' },
    orderBy: { createdAt: 'desc' },
    include: { kp: { select: { username: true } }, _count: { select: { applications: { where: { status: 'APPROVED' } } } } },
    take: 50,
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        title="招募"
        actions={<Link href="/recruitments/new" className="btn-primary text-sm">＋ 发布招募</Link>}
      />

      {list.length === 0 ? (
        <div className="card py-12 text-center text-ink-soft">暂无公开招募。</div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {list.map((r) => (
            <li key={r.id}>
              <Link href={`/recruitments/${r.id}`} className="card block transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="truncate text-lg font-bold text-ink">{r.title}</h2>
                  <span className="shrink-0 rounded-full bg-ok/15 px-2 py-0.5 text-[11px] font-semibold text-ok">招募中</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{r.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-ink-muted">
                  <span>已通过 {r._count.applications}/{r.maxPlayers}</span>
                  {r.scenario && <span>· {r.scenario}</span>}
                  {r.expectedHours && <span>· 预计 {r.expectedHours} 小时</span>}
                </div>
                <div className="mt-3 text-xs text-ink-muted">KP @{r.kp.username}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function PageHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <header className="mb-8 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-sm text-ink-soft">找一个团，或者发起一个。</p>
      </div>
      <div className="flex gap-2">{actions}</div>
    </header>
  );
}