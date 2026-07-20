import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return (
    <main className="relative">
      <div className="dotted-bg">
        <section className="mx-auto max-w-5xl px-4 pt-16 pb-12 sm:pt-24 sm:pb-16">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3.5 py-1 text-xs font-semibold text-macaron-600 shadow-paper">
              <span aria-hidden>✦</span> CoC 7e 在线跑团工具
            </span>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl md:text-6xl">
              把克苏鲁神话<br className="hidden sm:block" />搬到一张干净的桌面上
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-ink-soft sm:text-lg">
              建卡、招募、开团、结算，一套齐活。轻量、专注、好上手。
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/register" className="btn-primary px-6 py-3 text-base">
                创建账号
              </Link>
              <Link href="/login" className="btn-ghost px-6 py-3 text-base">
                raricy 一键登录
              </Link>
            </div>
          </div>
        </section>
      </div>

      <section className="mx-auto max-w-5xl px-4 pb-20">
        <ul className="grid gap-4 sm:grid-cols-3">
          <FeatureCard icon="📜" title="建卡" desc="9 项基础属性 + 技能 / 武器 / 物品 / 背景，五步走完。"/>
          <FeatureCard icon="📣" title="招募" desc="发布招募页，PL 选卡报名，KP 一键审核。"/>
          <FeatureCard icon="🎲" title="跑团" desc="画内画外两栏聊天、实时判定、HP / SAN 全员可见。"/>
        </ul>
      </section>
    </main>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <li className="card text-center">
      <div className="text-3xl" aria-hidden>{icon}</div>
      <h3 className="mt-2 text-base font-bold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-ink-soft">{desc}</p>
    </li>
  );
}