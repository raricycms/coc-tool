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

  // KP 点了「→ 结算」直接进本页等价于点开始：把 Session 切到 SETTLING，
  // 并确保有 Settlement 行。否则下一步 SAN 恢复的接口会判
  // `not_settling` 拒掉，错误信息也不友好。
  // FINISHED 不允许再进；其它状态（RUNNING/PAUSED）一律视为「要结算」。
  const s0 = await prisma.session.findUnique({
    where: { id },
    select: { id: true, kpId: true, status: true },
  });
  if (!s0) notFound();
  if (s0.kpId !== user.id) notFound();

  if (s0.status === 'FINISHED') {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">
        <header className="space-y-2">
          <Link href={`/sessions/${id}`} className="text-sm font-semibold text-macaron-600 hover:underline">
            ← 返回跑团
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">跑团结算</h1>
        </header>
        <p className="text-ink-soft">这场跑团已经完结，不能再进入结算流程。</p>
      </main>
    );
  }

  if (s0.status !== 'SETTLING') {
    await prisma.$transaction([
      prisma.session.update({
        where: { id },
        data: { status: 'SETTLING' },
      }),
      prisma.settlement.upsert({
        where: { sessionId: id },
        create: { sessionId: id, step: 'SAN_RECOVERY' },
        update: {},
      }),
    ]);
  }

  const s = await prisma.session.findUnique({
    where: { id },
    include: {
      members: {
        where: { leftAt: null },
        include: {
          character: { include: { skills: true } },
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
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <header className="space-y-2">
        <Link href={`/sessions/${s.id}`} className="text-sm font-semibold text-macaron-600 hover:underline">
          ← 返回跑团
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">跑团结算</h1>
        <p className="text-sm text-ink-soft">{s.title}</p>
      </header>

      {!isKp ? (
        <p className="text-ink-soft">只有 KP 可以进入结算流程。</p>
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