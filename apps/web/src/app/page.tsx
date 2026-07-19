import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <h1 className="text-5xl font-bold tracking-tight mb-4">Coc-tools</h1>
      <p className="text-ink-100/70 text-lg mb-8">在线 CoC 7e 跑团工具 · 建卡 · 招募 · 跑团 · 结算</p>
      <div className="flex gap-3">
        <Link href="/register" className="btn-primary">立即注册</Link>
        <Link href="/login" className="btn-ghost">raricy 一键登录 / 本地登录</Link>
      </div>
    </main>
  );
}