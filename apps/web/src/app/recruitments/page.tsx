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
    <main className="min-h-screen px-4 py-8 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">招募列表</h1>
        <div className="flex gap-2">
          <Link href="/dashboard" className="btn-ghost text-sm">← 返回</Link>
          <Link href="/recruitments/new" className="btn-primary text-sm">+ 发布招募</Link>
        </div>
      </header>

      {list.length === 0 ? (
        <div className="card text-center text-ink-100/60 py-12">暂无公开招募。</div>
      ) : (
        <div className="grid gap-3">
          {list.map((r) => (
            <Link key={r.id} href={`/recruitments/${r.id}`} className="card hover:border-brand-500 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <h2 className="font-bold">{r.title}</h2>
                <span className="text-xs text-ink-100/40">KP: @{r.kp.username}</span>
              </div>
              <p className="text-sm text-ink-100/70 line-clamp-2 mb-2">{r.summary}</p>
              <div className="flex gap-3 text-xs text-ink-100/50">
                <span>已批准 {r._count.applications}/{r.maxPlayers}</span>
                {r.scenario && <span>剧本: {r.scenario}</span>}
                {r.expectedHours && <span>{r.expectedHours}h</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}