import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@coc-tools/db';
import { CharacterForm } from '@/components/CharacterForm';

export const dynamic = 'force-dynamic';

export default async function EditCharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;
  const c = await prisma.character.findUnique({
    where: { id },
    include: { skills: true, weapons: true, equipment: true },
  });
  if (!c) notFound();
  if (c.ownerId !== user.id) notFound();
  if (c.status !== 'ACTIVE') {
    // 已撕卡的车卡不允许编辑（防止复活死掉的 PC）
    redirect(`/characters/${id}`);
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">编辑车卡 — {c.name}</h1>
        <Link href={`/characters/${id}`} className="btn-ghost text-sm">← 返回详情</Link>
      </header>
      <CharacterForm
        initial={{
          id: c.id,
          name: c.name,
          gender: (c.gender as 'male' | 'female' | 'other' | null) ?? '',
          age: c.age ?? 30,
          birthplace: c.birthplace ?? '',
          residence: c.residence ?? '',
          nationality: c.nationality ?? '中国',
          occupation: c.occupation ?? '',
          era: c.era as 'modern' | '1920s' | 'victorian' | 'ancient' | 'future',
          primary: {
            str: c.str, con: c.con, siz: c.siz, dex: c.dex, app: c.app,
            int: c.int, pow: c.pow, edu: c.edu, luck: c.luck,
          },
          skills: c.skills.map((s) => ({ name: s.name, value: s.value, isMythos: s.isMythos })),
          weapons: c.weapons.map((w) => ({ name: w.name, skill: w.skill, damage: w.damage, range: w.range ?? '' })),
          equipment: c.equipment.map((e) => ({ name: e.name, quantity: e.quantity, note: e.note ?? '' })),
          background: c.background ?? '',
          notes: c.notes ?? '',
        }}
      />
    </main>
  );
}
