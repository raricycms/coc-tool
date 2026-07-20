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
    <main className="min-h-screen px-4 py-8 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{c.name} {c.status === 'RETIRED' && <span className="text-sm text-red-400 ml-2">⚰ 已撕卡</span>}</h1>
          <p className="text-sm text-ink-100/50">{c.occupation ?? '无职业'} · {c.era} · {c.age ? `${c.age}岁` : ''}</p>
        </div>
        <div className="flex gap-2">
          {c.status === 'ACTIVE' && (
            <Link href={`/characters/${c.id}/edit`} className="btn-primary text-sm">✎ 编辑</Link>
          )}
          <Link href="/characters" className="btn-ghost text-sm">← 返回</Link>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="card">
          <h2 className="font-bold mb-3">概览</h2>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>❤️ HP <b>{c.hpCurrent}/{c.hpMax}</b></div>
            <div>🔮 MP <b>{c.mpCurrent}/{c.mpMax}</b></div>
            <div>🧠 SAN <b>{c.sanCurrent}/{c.sanMax}</b></div>
            <div>🍀 Luck <b>{c.luckCurrent}</b></div>
            <div>👣 MOV <b>{c.mov}</b></div>
            <div>💪 Build <b>{c.build} ({c.damageBonus})</b></div>
          </div>
        </section>

        <section className="card">
          <h2 className="font-bold mb-3">属性</h2>
          <div className="flex flex-col gap-1 text-sm">
            <div>STR <b>{c.str}</b></div>
            <div>CON <b>{c.con}</b></div>
            <div>SIZ <b>{c.siz}</b></div>
            <div>DEX <b>{c.dex}</b></div>
            <div>APP <b>{c.app}</b></div>
            <div>INT <b>{c.int}</b></div>
            <div>POW <b>{c.pow}</b></div>
            <div>EDU <b>{c.edu}</b></div>
            <div>LUCK <b>{c.luck}</b></div>
          </div>
        </section>

        <section className="card md:col-span-2">
          <h2 className="font-bold mb-3">技能 ({c.skills.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-sm max-h-96 overflow-y-auto">
            {c.skills.map((s) => (
              <div key={s.id} className={s.isMythos ? 'text-red-400' : ''}>
                {s.name} <b>{s.value}</b>{s.isMythos ? ' *' : ''}
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="font-bold mb-3">武器</h2>
          {c.weapons.length === 0 ? <p className="text-ink-100/40 text-sm">无</p> : (
            <ul className="space-y-1 text-sm">
              {c.weapons.map((w) => (
                <li key={w.id}>{w.name} ({w.skill}) — {w.damage}{w.range ? ` · ${w.range}` : ''}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="font-bold mb-3">装备</h2>
          {c.equipment.length === 0 ? <p className="text-ink-100/40 text-sm">无</p> : (
            <ul className="space-y-1 text-sm">
              {c.equipment.map((e) => (
                <li key={e.id}>{e.name} × {e.quantity}</li>
              ))}
            </ul>
          )}
        </section>

        {c.background && (
          <section className="card md:col-span-2">
            <h2 className="font-bold mb-3">调查员背景</h2>
            <p className="whitespace-pre-wrap text-sm">{c.background}</p>
          </section>
        )}

        {c.notes && (
          <section className="card md:col-span-2">
            <h2 className="font-bold mb-3">玩家备注</h2>
            <p className="whitespace-pre-wrap text-sm">{c.notes}</p>
          </section>
        )}
      </div>

      {c.status === 'ACTIVE' && <CharacterRetireButton characterId={c.id} />}
    </main>
  );
}