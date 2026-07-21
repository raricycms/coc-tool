import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@coc-tools/db';
import { RecruitmentEditForm } from '@/components/RecruitmentEditForm';

export const dynamic = 'force-dynamic';

export default async function EditRecruitmentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;

  const r = await prisma.recruitment.findUnique({
    where: { id },
    include: { session: { select: { id: true } } },
  });
  if (!r) notFound();
  if (r.kpId !== user.id) notFound();
  // 已开团不允许编辑关键字段（min/maxPlayers），但允许改 summary / scenario
  const locked = !!r.session;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8">
        <Link href={`/recruitments/${r.id}`} className="text-sm font-semibold text-macaron-600 hover:underline">
          ← 返回招募详情
        </Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">编辑招募</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {locked
            ? '招募已开团，仅能修改简介 / 剧本 / 预计时长，不能改人数。'
            : '修改招募信息。已通过 PL 数量不受影响。'}
        </p>
      </header>

      <RecruitmentEditForm
        recruitmentId={r.id}
        initial={{
          title: r.title,
          summary: r.summary,
          scenario: r.scenario ?? '',
          minPlayers: r.minPlayers,
          maxPlayers: r.maxPlayers,
          expectedHours: r.expectedHours ?? null,
          visibility: (r.visibility as 'public' | 'link'),
          status: r.status as 'DRAFT' | 'OPEN' | 'CLOSED' | 'FINISHED',
        }}
        locked={locked}
      />
    </main>
  );
}