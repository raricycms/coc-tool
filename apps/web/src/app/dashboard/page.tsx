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
      take: 5,
    }),
    prisma.session.findMany({
      where: { kpId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.sessionMember.findMany({
      where: { userId: user.id, role: 'PL' },
      include: { session: true },
      orderBy: { joinedAt: 'desc' },
      take: 5,
    }),
    prisma.recruitment.findMany({
      where: { kpId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.recruitment.findMany({
      where: { status: 'OPEN', visibility: 'public' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { kp: { select: { username: true } } },
    }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-10">
      {/* 顶部欢迎条 + 一键动作 */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-ink-soft">欢迎回来</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink">@{user.username}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/characters/new" className="btn-primary text-sm">＋ 新建车卡</Link>
          <Link href="/recruitments/new" className="btn-soft text-sm">＋ 发布招募</Link>
        </div>
      </header>

      {/* 1. 我的车卡 */}
      <section>
        <SectionTitle title="我的车卡" link={{ href: '/characters', label: '查看全部' }} />
        {characters.length === 0 ? (
          <EmptyState text="还没有车卡。" cta={{ href: '/characters/new', label: '立即创建' }} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {characters.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/characters/${c.id}`}
                  className="card block transition hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-ink">{c.name}</h3>
                      <p className="text-xs text-ink-soft">
                        {c.occupation ?? '无职业'} · {c.era}
                      </p>
                    </div>
                    {c.status === 'RETIRED' && (
                      <span className="shrink-0 rounded-full bg-bad/15 px-2 py-0.5 text-[10px] font-semibold text-bad">
                        已退役
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-ink-soft">
                    <Pill>HP {c.hpCurrent}/{c.hpMax}</Pill>
                    <Pill>SAN {c.sanCurrent}/{c.sanMax}</Pill>
                    <Pill>LUCK {c.luckCurrent}</Pill>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 2. 我参与的跑团（KP + PL 合并成一栏） */}
      <section>
        <SectionTitle title="我参与的跑团" />
        {asKpSessions.length === 0 && asPlSessions.length === 0 ? (
          <EmptyState text="暂时还没参加任何跑团。" />
        ) : (
          <ul className="card divide-y divide-sky-200 p-0">
            {asKpSessions.map((s) => (
              <li key={s.id}>
                <Link href={`/sessions/${s.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-sky-50">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{s.title}</div>
                    <div className="text-xs text-ink-soft">我作为 KP</div>
                  </div>
                  <Tag>{sessionStatusLabel(s.status)}</Tag>
                </Link>
              </li>
            ))}
            {asPlSessions.map((m) => (
              <li key={m.id}>
                <Link href={`/sessions/${m.sessionId}`} className="flex items-center justify-between px-5 py-3 hover:bg-sky-50">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{m.session.title}</div>
                    <div className="text-xs text-ink-soft">我作为 PL</div>
                  </div>
                  <Tag>{sessionStatusLabel(m.session.status)}</Tag>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3. 我发布的招募 + 公开招募（左右两栏，避免再叠成三列拥挤） */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionTitle
            title="我发布的招募"
            link={{ href: '/recruitments/new', label: '＋ 发布' }}
          />
          {myRecruitments.length === 0 ? (
            <EmptyState text="暂无。" />
          ) : (
            <ul className="card divide-y divide-sky-200 p-0">
              {myRecruitments.map((r) => (
                <li key={r.id}>
                  <Link href={`/recruitments/${r.id}/manage`} className="flex items-center justify-between px-5 py-3 hover:bg-sky-50">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">{r.title}</div>
                      <div className="text-xs text-ink-soft">
                        {r.minPlayers}-{r.maxPlayers} 人
                      </div>
                    </div>
                    <Tag>{recruitmentStatusLabel(r.status)}</Tag>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <SectionTitle
            title="公开招募（最新）"
            link={{ href: '/recruitments', label: '查看全部' }}
          />
          {openRecruitments.length === 0 ? (
            <EmptyState text="暂无公开招募。" />
          ) : (
            <ul className="card divide-y divide-sky-200 p-0">
              {openRecruitments.map((r) => (
                <li key={r.id}>
                  <Link href={`/recruitments/${r.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-sky-50">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">{r.title}</div>
                      <div className="text-xs text-ink-soft">KP @{r.kp.username}</div>
                    </div>
                    <Tag tone="ok">招募中</Tag>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function sessionStatusLabel(s: string): string {
  switch (s) {
    case 'OPEN': return '进行中';
    case 'CLOSED': return '已结团';
    default: return s;
  }
}

function recruitmentStatusLabel(s: string): string {
  switch (s) {
    case 'OPEN': return '招募中';
    case 'CLOSED': return '已关闭';
    default: return s;
  }
}

/* —— 小元件 —— */

function SectionTitle({ title, link }: { title: string; link?: { href: string; label: string } }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {link && (
        <Link href={link.href} className="text-sm font-semibold text-macaron-600 hover:underline">
          {link.label}
        </Link>
      )}
    </div>
  );
}

function EmptyState({ text, cta }: { text: string; cta?: { href: string; label: string } }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-sm text-ink-soft">{text}</p>
      {cta && <Link href={cta.href} className="btn-primary text-sm">{cta.label}</Link>}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-ink">{children}</span>
  );
}

function Tag({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'ok' }) {
  const cls =
    tone === 'ok'
      ? 'bg-ok/15 text-ok'
      : 'bg-sky-100 text-ink-soft';
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>
  );
}