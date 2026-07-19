import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@coc-tools/db';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [characters, asKpSessions, asPlSessions, myRecruitments, openRecruitments] = await Promise.all([
    prisma.character.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
    prisma.session.findMany({
      where: { kpId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
    prisma.sessionMember.findMany({
      where: { userId: user.id, role: 'PL' },
      include: { session: true },
      orderBy: { joinedAt: 'desc' },
      take: 10,
    }),
    prisma.recruitment.findMany({
      where: { kpId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
    prisma.recruitment.findMany({
      where: { status: 'OPEN', visibility: 'public' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { kp: { select: { username: true } } },
    }),
  ]);

  return (
    <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Coc-tools</h1>
        <div className="flex items-center gap-3">
          <span className="text-ink-100/60 text-sm">@{user.username}</span>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="btn-ghost text-sm">退出</button>
          </form>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <section className="card">
          <header className="flex items-center justify-between mb-3">
            <h2 className="font-bold">我的车卡</h2>
            <Link href="/characters/new" className="text-sm text-brand-500">+ 新建</Link>
          </header>
          {characters.length === 0 ? (
            <p className="text-ink-100/50 text-sm">还没有车卡。</p>
          ) : (
            <ul className="space-y-2">
              {characters.map((c) => (
                <li key={c.id}>
                  <Link href={`/characters/${c.id}`} className="block hover:bg-ink-800 rounded p-2 -mx-2">
                    <div className="font-medium">{c.name} <span className="text-xs text-ink-100/40">{c.era}</span></div>
                    <div className="text-xs text-ink-100/50">HP {c.hpCurrent}/{c.hpMax} · SAN {c.sanCurrent}/{c.sanMax} · {c.status === 'ACTIVE' ? '✓' : '⚰'}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <header className="flex items-center justify-between mb-3">
            <h2 className="font-bold">我作为 KP 的团</h2>
          </header>
          {asKpSessions.length === 0 ? (
            <p className="text-ink-100/50 text-sm">暂无</p>
          ) : (
            <ul className="space-y-2">
              {asKpSessions.map((s) => (
                <li key={s.id}>
                  <Link href={`/sessions/${s.id}`} className="block hover:bg-ink-800 rounded p-2 -mx-2">
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs text-ink-100/50">{s.status}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <header className="flex items-center justify-between mb-3">
            <h2 className="font-bold">我作为 PL 的团</h2>
          </header>
          {asPlSessions.length === 0 ? (
            <p className="text-ink-100/50 text-sm">暂无</p>
          ) : (
            <ul className="space-y-2">
              {asPlSessions.map((m) => (
                <li key={m.id}>
                  <Link href={`/sessions/${m.sessionId}`} className="block hover:bg-ink-800 rounded p-2 -mx-2">
                    <div className="font-medium">{m.session.title}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card md:col-span-2 lg:col-span-2">
          <header className="flex items-center justify-between mb-3">
            <h2 className="font-bold">我发布的招募</h2>
            <Link href="/recruitments/new" className="text-sm text-brand-500">+ 发布</Link>
          </header>
          {myRecruitments.length === 0 ? (
            <p className="text-ink-100/50 text-sm">暂无</p>
          ) : (
            <ul className="space-y-2">
              {myRecruitments.map((r) => (
                <li key={r.id}>
                  <Link href={`/recruitments/${r.id}/manage`} className="block hover:bg-ink-800 rounded p-2 -mx-2">
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs text-ink-100/50">{r.status} · {r.minPlayers}-{r.maxPlayers} 人</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="font-bold mb-3">公开招募（最新）</h2>
          {openRecruitments.length === 0 ? (
            <p className="text-ink-100/50 text-sm">暂无</p>
          ) : (
            <ul className="space-y-2">
              {openRecruitments.map((r) => (
                <li key={r.id}>
                  <Link href={`/recruitments/${r.id}`} className="block hover:bg-ink-800 rounded p-2 -mx-2">
                    <div className="font-medium text-sm">{r.title}</div>
                    <div className="text-xs text-ink-100/50">KP: @{r.kp.username}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 text-right">
            <Link href="/recruitments" className="text-sm text-brand-500">查看全部 →</Link>
          </div>
        </section>
      </div>
    </main>
  );
}