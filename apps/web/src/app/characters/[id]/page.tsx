import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@coc-tools/db';
import { CharacterRetireButton } from '@/components/CharacterRetireButton';

export const dynamic = 'force-dynamic';

export default async function CharacterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;
  const c = await prisma.character.findUnique({
    where: { id },
    include: { skills: { orderBy: { name: 'asc' } }, weapons: true, equipment: true, members: { include: { session: true } } },
  });
  if (!c) notFound();
  if (c.ownerId !== user.id) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-ink">{c.name}</h1>
            {c.status === 'RETIRED' && (
              <span className="rounded-full bg-bad/15 px-2.5 py-0.5 text-xs font-semibold text-bad">已退役</span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {c.occupation ?? '无职业'} · {c.era}
            {c.age ? ` · ${c.age}岁` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {c.status === 'ACTIVE' && (
            <Link href={`/characters/${c.id}/edit`} className="btn-primary text-sm">✎ 编辑</Link>
          )}
        </div>
      </header>

      {/* 概览 + 属性：左基础信息，右九大属性 */}
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-soft">状态</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <StatRow label="HP" value={`${c.hpCurrent}/${c.hpMax}`} />
            <StatRow label="MP" value={`${c.mpCurrent}/${c.mpMax}`} />
            <StatRow label="SAN" value={`${c.sanCurrent}/${c.sanMax}`} />
            <StatRow label="LUCK" value={`${c.luckCurrent}`} />
            <StatRow label="MOV" value={`${c.mov}`} />
            <StatRow label="体型 / 伤害加值" value={`${c.build} (${c.damageBonus})`} />
          </div>
        </section>

        <section className="card">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-soft">属性</h2>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <AttrCell label="STR" value={c.str} />
            <AttrCell label="CON" value={c.con} />
            <AttrCell label="SIZ" value={c.siz} />
            <AttrCell label="DEX" value={c.dex} />
            <AttrCell label="APP" value={c.app} />
            <AttrCell label="INT" value={c.int} />
            <AttrCell label="POW" value={c.pow} />
            <AttrCell label="EDU" value={c.edu} />
            <AttrCell label="LUCK" value={c.luck} />
          </div>
        </section>
      </div>

      {/* 技能：宽栏单独一整条 */}
      <section className="card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-soft">技能 · {c.skills.length}</h2>
        {c.skills.length === 0 ? (
          <p className="text-sm text-ink-soft">无。</p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {c.skills.map((s) => (
              <li key={s.id} className="flex justify-between border-b border-sky-100 py-1">
                <span className={s.isMythos ? 'text-mythos' : 'text-ink'}>
                  {s.name}{s.isMythos && ' ✦'}
                </span>
                <span className="font-mono text-ink-soft">{s.value}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 武器 + 装备：双栏 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-soft">武器</h2>
          {c.weapons.length === 0 ? (
            <p className="text-sm text-ink-soft">无。</p>
          ) : (
            <ul className="divide-y divide-sky-100 text-sm">
              {c.weapons.map((w) => (
                <li key={w.id} className="py-2">
                  <div className="font-semibold text-ink">{w.name}</div>
                  <div className="text-xs text-ink-soft">
                    {w.skill} · 伤害 {w.damage}
                    {w.range && ` · 射程 ${w.range}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-soft">装备</h2>
          {c.equipment.length === 0 ? (
            <p className="text-sm text-ink-soft">无。</p>
          ) : (
            <ul className="divide-y divide-sky-100 text-sm">
              {c.equipment.map((e) => (
                <li key={e.id} className="py-2">
                  <div className="font-semibold text-ink">{e.name} <span className="text-ink-soft font-normal">× {e.quantity}</span></div>
                  {e.note && <div className="text-xs text-ink-soft">{e.note}</div>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {(c.background || c.notes) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {c.background && (
            <section className="card">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-soft">调查员背景</h2>
              <p className="whitespace-pre-wrap text-sm text-ink">{c.background}</p>
            </section>
          )}
          {c.notes && (
            <section className="card">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-soft">玩家备注</h2>
              <p className="whitespace-pre-wrap text-sm text-ink">{c.notes}</p>
            </section>
          )}
        </div>
      )}

      {c.status === 'ACTIVE' && <CharacterRetireButton characterId={c.id} />}
    </main>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-0.5 text-base font-bold text-ink">{value}</div>
    </div>
  );
}

function AttrCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-2 py-2 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="font-mono text-sm font-bold text-ink">{value}</div>
    </div>
  );
}