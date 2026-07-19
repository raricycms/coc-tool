import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { CharacterForm } from '@/components/CharacterForm';

export const dynamic = 'force-dynamic';

export default async function NewCharacterPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">新建车卡</h1>
        <Link href="/characters" className="btn-ghost text-sm">← 返回</Link>
      </header>
      <CharacterForm />
    </main>
  );
}