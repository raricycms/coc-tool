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
    <main className="min-h-screen px-4 py-8 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">我的车卡</h1>
        <div className="flex gap-2">
          <Link href="/dashboard" className="btn-ghost text-sm">← 返回</Link>
          <Link href="/characters/new" className="btn-primary text-sm">+ 新建车卡</Link>
        </div>
      </header>

      {characters.length === 0 ? (
        <div className="card text-center text-ink-100/60 py-12">
          <p>还没有车卡。</p>
          <Link href="/characters/new" className="btn-primary inline-block mt-4">立即创建</Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {characters.map((c) => (
            <Link key={c.id} href={`/characters/${c.id}`} className="card hover:border-brand-500 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-bold text-lg">
                    {c.name} {c.status === 'RETIRED' && <span className="text-xs text-red-400 ml-2">⚰ 已撕卡</span>}
                  </h2>
                  <p className="text-xs text-ink-100/50">
                    {c.occupation ?? '无职业'} · {c.era} · {c.age ? `${c.age}岁` : ''}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <div>❤️ {c.hpCurrent}/{c.hpMax}</div>
                  <div>🧠 {c.sanCurrent}/{c.sanMax}</div>
                  <div>🍀 {c.luckCurrent}</div>
                </div>
              </div>
              <div className="mt-2 flex gap-3 text-xs text-ink-100/50">
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
          ))}
        </div>
      )}
    </main>
  );
}