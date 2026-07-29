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
  const isSpectator = role === 'SPECTATOR';

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

      {/* 状态横幅：清晰告诉用户这场团当前阶段，避免在 FINISHED 团里误操作 */}
      {(session.status === 'SETTLING' || session.status === 'FINISHED' || session.status === 'ABANDONED') && (
        <div
          className={`border-b px-4 py-2 text-center text-sm ${
            session.status === 'FINISHED'
              ? 'border-ink-soft/30 bg-sky-50 text-ink-soft'
              : session.status === 'SETTLING'
                ? 'border-warn/40 bg-warn/10 text-warn'
                : 'border-bad/40 bg-bad/10 text-bad'
          }`}
        >
          {session.status === 'SETTLING' && '这场跑团正在结算中（只读）。'}
          {session.status === 'FINISHED' && '这场跑团已完结（只读存档）。'}
          {session.status === 'ABANDONED' && '这场跑团已被放弃。'}
        </div>
      )}

      {/* 观战不再需要「退出」动作：presence 只在有连接时把旁观者算进名单，
          离开本页就自动从名单消失。这里只说明这一点并给个返回入口。 */}
      {isSpectator && session.status !== 'FINISHED' && session.status !== 'ABANDONED' && (
        <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-center text-sm text-ink-soft">
          你正在观战，离开本页即退出观战。
          <Link href="/dashboard" className="ml-2 font-semibold text-macaron-600 hover:underline">
            返回概览
          </Link>
        </div>
      )}

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
        // 首屏名单同样只放名册 + 自己：DB 里的 SPECTATOR 行是历史痕迹，
        // 若直接铺上去，会在首个 PRESENCE_UPDATE 到达前闪一批灰掉的路人。
        // 自己要留着，否则 SessionClient 的 me 在这一小段时间里是 undefined。
        initialMembers={session.members
          .filter((m) => m.role !== 'SPECTATOR' || m.userId === user.id)
          .map((m) => ({
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