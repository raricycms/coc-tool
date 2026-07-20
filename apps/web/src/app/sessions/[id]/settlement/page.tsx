import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@coc-tools/db';
import { SettlementWizard } from '@/components/SettlementWizard';

export const dynamic = 'force-dynamic';

export default async function SettlementPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;

  const s = await prisma.session.findUnique({
    where: { id },
    include: {
      members: {
        where: { leftAt: null },
        include: {
          character: {
            include: { skills: true },
          },
          user: { select: { username: true } },
        },
      },
      settlement: true,
    },
  });
  if (!s) notFound();
  if (s.kpId !== user.id) notFound();

  const isKp = s.kpId === user.id;

  const pcs = s.members
    .filter((m) => m.character)
    .map((m) => ({
      characterId: m.character!.id,
      characterName: m.character!.name,
      ownerUsername: m.user.username,
      sanCurrent: m.character!.sanCurrent,
      sanMax: m.character!.sanMax,
      hpCurrent: m.character!.hpCurrent,
      hpMax: m.character!.hpMax,
      mpCurrent: m.character!.mpCurrent,
      mpMax: m.character!.mpMax,
      luck: m.character!.luckCurrent,
      mythos: m.character!.skills.find((sk) => sk.name === '克苏鲁知识')?.value ?? 0,
      skills: m.character!.skills.filter((sk) => sk.name !== '克苏鲁知识'),
      retired: m.character!.status === 'RETIRED',
    }));

  return (
    <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <Link href={`/sessions/${s.id}`} className="btn-ghost text-sm mb-3 inline-block">← 返回跑团</Link>
        <h1 className="text-2xl font-bold">跑团结算 · {s.title}</h1>
        <p className="text-sm text-ink-100/60">状态：{s.status}</p>
      </header>

      {!isKp ? (
        <p className="text-ink-100/60">仅 KP 可进入结算流程。</p>
      ) : (
        <SettlementWizard
          sessionId={s.id}
          pcs={pcs}
          initialStep={s.settlement?.step ?? 'SAN_RECOVERY'}
        />
      )}
    </main>
  );
}