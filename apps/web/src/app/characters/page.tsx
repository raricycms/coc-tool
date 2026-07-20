import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@coc-tools/db';

export const dynamic = 'force-dynamic';

export default async function CharactersListPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const characters = await prisma.character.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        title="我的车卡"
        actions={
          <>
            <Link href="/characters/new" className="btn-primary text-sm">＋ 新建车卡</Link>
          </>
        }
      />

      {characters.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <p className="text-sm text-ink-soft">还没有车卡。</p>
          <Link href="/characters/new" className="btn-primary text-sm">立即创建</Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {characters.map((c) => (
            <li key={c.id}>
              <Link href={`/characters/${c.id}`} className="card block transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-ink">{c.name}</h2>
                    <p className="text-xs text-ink-soft">
                      {c.occupation ?? '无职业'} · {c.era}
                      {c.age ? ` · ${c.age}岁` : ''}
                    </p>
                  </div>
                  {c.status === 'RETIRED' && (
                    <span className="shrink-0 rounded-full bg-bad/15 px-2 py-0.5 text-[10px] font-semibold text-bad">已退役</span>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-ink-soft">
                  <Pill>❤️ HP {c.hpCurrent}/{c.hpMax}</Pill>
                  <Pill>🧠 SAN {c.sanCurrent}/{c.sanMax}</Pill>
                  <Pill>🍀 LUCK {c.luckCurrent}</Pill>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-muted font-mono">
                  <span>STR {c.str}</span>
                  <span>CON {c.con}</span>
                  <span>SIZ {c.siz}</span>
                  <span>DEX {c.dex}</span>
                  <span>APP {c.app}</span>
                  <span>INT {c.int}</span>
                  <span>POW {c.pow}</span>
                  <span>EDU {c.edu}</span>
                </div>
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
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
      <div className="flex gap-2">{actions}</div>
    </header>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-ink">{children}</span>
  );
}