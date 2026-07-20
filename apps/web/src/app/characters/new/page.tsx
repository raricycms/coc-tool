import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { CharacterForm } from '@/components/CharacterForm';

export const dynamic = 'force-dynamic';

export default async function NewCharacterPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">新建车卡</h1>
        <p className="mt-1 text-sm text-ink-soft">分五步：基础 → 属性 → 技能 → 装备 → 背景。</p>
      </header>
      <CharacterForm />
    </main>
  );
}