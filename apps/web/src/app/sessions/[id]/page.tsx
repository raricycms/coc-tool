import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@coc-tools/db';
import { SessionClient } from '@/components/SessionClient';

export const dynamic = 'force-dynamic';

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      members: {
        where: { leftAt: null },
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          character: { select: { id: true, name: true, hpCurrent: true, hpMax: true, sanCurrent: true, sanMax: true, mpCurrent: true, mpMax: true, luckCurrent: true, skills: true, damageBonus: true } },
        },
      },
    },
  });
  if (!session) notFound();

  // 判断角色
  const member = session.members.find((m) => m.userId === user.id);
  const role = member?.role ?? 'SPECTATOR';
  const isKp = role === 'KP';

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-4 py-3 border-b border-ink-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-ink-100/60 hover:text-ink-100 text-sm">← 返回</Link>
          <h1 className="font-bold">{session.title}</h1>
          <span className="text-xs text-ink-100/40">[{role}]</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-mono">⏰ {session.inGameDate} {session.inGameTime}</span>
          {isKp && (
            <Link href={`/sessions/${session.id}/settlement`} className="btn-ghost text-xs">→ 结算</Link>
          )}
        </div>
      </header>

      <SessionClient
        sessionId={session.id}
        role={role as 'KP' | 'PL' | 'SPECTATOR'}
        currentUserId={user.id}
        initialClock={{
          inGameTime: session.inGameTime ?? '08:00',
          inGameDate: session.inGameDate ?? '1/1',
          running: session.clockRunning,
          rate: session.clockRate,
        }}
        initialMembers={session.members.map((m) => ({
          userId: m.userId,
          username: m.user.username,
          avatar: m.user.avatarUrl,
          role: m.role as 'KP' | 'PL' | 'SPECTATOR',
          // SSR 无法判断谁真正连着 socket：统一标离线，等客户端连上后再被 PRESENCE_UPDATE 覆盖。
          online: false,
          characterId: m.characterId ?? undefined,
          character: m.character ? {
            id: m.character.id,
            name: m.character.name,
            hp: m.character.hpCurrent,
            hpMax: m.character.hpMax,
            san: m.character.sanCurrent,
            sanMax: m.character.sanMax,
            mp: m.character.mpCurrent,
            mpMax: m.character.mpMax,
            luck: m.character.luckCurrent,
            damageBonus: m.character.damageBonus,
            skills: m.character.skills.map((s) => ({ name: s.name, value: s.value, isMythos: s.isMythos })),
          } : undefined,
        }))}
      />
    </main>
  );
}