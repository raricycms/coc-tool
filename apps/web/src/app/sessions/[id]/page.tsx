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
          character: {
            include: {
              skills: true,
              weapons: true,
              equipment: true,
            },
          },
        },
      },
    },
  });
  if (!session) notFound();

  const member = session.members.find((m) => m.userId === user.id);
  const role = member?.role ?? 'SPECTATOR';
  const isKp = role === 'KP';

  return (
    <main className="flex min-h-screen flex-col">
      <header className="border-b border-sky-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm font-semibold text-macaron-600 hover:underline">
              ← 概览
            </Link>
            <h1 className="truncate text-lg font-bold text-ink">{session.title}</h1>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
              {role === 'KP' ? '主持人' : role === 'PL' ? '玩家' : '旁观'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-ink-soft">
            <span className="font-mono">⏰ {session.inGameDate} {session.inGameTime}</span>
            {isKp && (
              <Link href={`/sessions/${session.id}/settlement`} className="btn-soft text-xs">
                → 结算
              </Link>
            )}
          </div>
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
          online: false,
          characterId: m.characterId ?? undefined,
          character: m.character ? {
            id: m.character.id,
            name: m.character.name,
            str: m.character.str,
            con: m.character.con,
            siz: m.character.siz,
            dex: m.character.dex,
            app: m.character.app,
            int: m.character.int,
            pow: m.character.pow,
            edu: m.character.edu,
            hp: m.character.hpCurrent,
            hpMax: m.character.hpMax,
            san: m.character.sanCurrent,
            sanMax: m.character.sanMax,
            mp: m.character.mpCurrent,
            mpMax: m.character.mpMax,
            luck: m.character.luckCurrent,
            damageBonus: m.character.damageBonus,
            background: m.character.background,
            skills: m.character.skills.map((s) => ({ name: s.name, value: s.value, isMythos: s.isMythos })),
            weapons: m.character.weapons.map((w) => ({
              id: w.id, name: w.name, skill: w.skill, damage: w.damage,
              range: w.range, ammo: w.ammo, note: w.note,
            })),
            equipment: m.character.equipment.map((e) => ({
              id: e.id, name: e.name, quantity: e.quantity, note: e.note,
            })),
          } : undefined,
        }))}
      />
    </main>
  );
}