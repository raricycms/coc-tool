import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@coc-tools/db';
import { RECRUITMENT_STATUS, type RecruitmentStatus } from '@coc-tools/shared';

/**
 * /recruitments 列表页
 *
 * 支持的 searchParams（来自 URL query）：
 *   ?status=OPEN|CLOSED|FINISHED|DRAFT   — 按状态筛；省略时默认只显示 OPEN + 公开
 *   ?mine=true                           — 仅当前用户发布的
 *
 * 这是简单的 server-side filter；和现有 GET /api/recruitments 行为一致。
 */

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
  mine?: string;
}

const STATUS_LABEL: Record<RecruitmentStatus, string> = {
  DRAFT: '草稿',
  OPEN: '招募中',
  CLOSED: '已关闭',
  FINISHED: '已开团',
};

export default async function RecruitmentsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const params = await searchParams;

  const statusParam = (params.status ?? '').toUpperCase();
  const validStatuses = (RECRUITMENT_STATUS as readonly string[]).includes(statusParam)
    ? statusParam
    : null;
  const mine = params.mine === 'true';

  const where: any = { visibility: 'public' };
  if (validStatuses) {
    where.status = validStatuses;
  } else {
    // 默认：仅显示 OPEN
    where.status = 'OPEN';
  }
  if (mine) where.kpId = user.id;

  const list = await prisma.recruitment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      kp: { select: { username: true } },
      _count: { select: { applications: { where: { status: 'APPROVED' } } } },
    },
    take: 50,
  });

  // 当前激活 tab 用于高亮
  const currentStatus = validStatuses ?? 'OPEN';
  const currentMine = mine;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        title="招募"
        actions={<Link href="/recruitments/new" className="btn-primary text-sm">＋ 发布招募</Link>}
      />

      {/* 筛选条 */}
      <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm">
        <FilterTab href="/recruitments" label="全部" active={!currentMine} />
        <FilterTab href="/recruitments?mine=true" label="我发布的" active={currentMine} />
        <span className="mx-2 h-4 w-px bg-sky-200" />
        {RECRUITMENT_STATUS.map((s) => (
          <FilterTab
            key={s}
            href={`/recruitments?status=${s}${currentMine ? '&mine=true' : ''}`}
            label={STATUS_LABEL[s]}
            active={currentStatus === s && !currentMine}
            // 我的招募 tab 下，状态筛选放在 mine tab 后
            disabled={currentMine}
          />
        ))}
      </nav>

      {list.length === 0 ? (
        <div className="card py-12 text-center text-ink-soft">
          {mine ? '你还没发布过招募。' : '暂无该状态的招募。'}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {list.map((r) => (
            <li key={r.id}>
              <Link href={`/recruitments/${r.id}`} className="card block transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="truncate text-lg font-bold text-ink">{r.title}</h2>
                  <StatusTag status={r.status as RecruitmentStatus} />
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

function FilterTab({ href, label, active, disabled }: { href: string; label: string; active: boolean; disabled?: boolean }) {
  const base = 'rounded-full px-3 py-1 transition';
  const cls = disabled
    ? `${base} cursor-not-allowed bg-sky-50 text-ink-muted`
    : active
      ? `${base} bg-macaron-300 text-white`
      : `${base} text-ink-soft hover:bg-sky-100`;
  if (disabled) {
    return <span className={cls}>{label}</span>;
  }
  return <Link href={href} className={cls}>{label}</Link>;
}

function StatusTag({ status }: { status: RecruitmentStatus }) {
  const map: Record<RecruitmentStatus, { label: string; cls: string }> = {
    DRAFT:    { label: '草稿',   cls: 'bg-sky-100 text-ink-soft' },
    OPEN:     { label: '招募中', cls: 'bg-ok/15 text-ok' },
    CLOSED:   { label: '已关闭', cls: 'bg-bad/15 text-bad' },
    FINISHED: { label: '已开团', cls: 'bg-mythos/15 text-mythos' },
  };
  const m = map[status] ?? { label: status, cls: 'bg-sky-100 text-ink-soft' };
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.label}</span>;
}