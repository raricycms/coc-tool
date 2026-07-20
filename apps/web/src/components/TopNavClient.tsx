'use client';

/**
 * 顶栏客户端：active 高亮、移动端抽屉、登出表单。
 *
 * 视觉：
 *   - sticky 半透明白，底部一道细线
 *   - 左侧品牌 mark（蓝色 macaron 圆角方块）+ 字标
 *   - 中部主导航 + 右侧账户区；移动端折叠成汉堡 + 下拉抽屉
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export type NavSession = {
  username: string;
  role: string;
} | null;

interface NavLink {
  href: string;
  label: string;
}

const AUTHED_LINKS: NavLink[] = [
  { href: '/dashboard', label: '概览' },
  { href: '/characters', label: '我的车卡' },
  { href: '/recruitments', label: '招募' },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (pathname === href) return true;
  return pathname.startsWith(href + '/');
}

export function TopNavClient({ session }: { session: NavSession }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-sky-200 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Brand />

        {session ? (
          <div className="hidden flex-1 items-center justify-end gap-6 md:flex">
            <nav className="flex items-center gap-1">
              {AUTHED_LINKS.map((link) => (
                <NavLinkItem
                  key={link.href}
                  link={link}
                  active={isActive(pathname, link.href)}
                />
              ))}
            </nav>
            <UserCluster username={session.username} />
          </div>
        ) : (
          <div className="hidden flex-1 items-center justify-end gap-3 md:flex">
            <Link href="/login" className="btn-ghost text-sm">登录</Link>
            <Link href="/register" className="btn-primary text-sm">注册</Link>
          </div>
        )}

        <button
          type="button"
          aria-label={open ? '关闭菜单' : '打开菜单'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-200 bg-white text-ink-soft transition hover:bg-sky-50 md:hidden"
        >
          {open ? <IconClose /> : <IconMenu />}
        </button>
      </div>

      {open && (
        <div className="border-t border-sky-200 bg-white md:hidden">
          <div className="mx-auto max-w-6xl space-y-1 px-4 py-3">
            {(session ? AUTHED_LINKS : []).map((link) => (
              <NavLinkItem
                key={link.href}
                link={link}
                active={isActive(pathname, link.href)}
                onNavigate={() => setOpen(false)}
                variant="drawer"
              />
            ))}
            <div className="my-2 border-t border-sky-200 pt-2">
              {session ? (
                <>
                  <div className="px-3 py-2 text-sm text-ink-soft">@{session.username}</div>
                  <form action="/api/auth/logout" method="POST">
                    <button
                      type="submit"
                      className="w-full rounded-2xl px-3 py-2 text-left text-sm text-ink transition hover:bg-sky-50"
                    >
                      退出
                    </button>
                  </form>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="btn-ghost text-sm"
                  >
                    登录
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="btn-primary text-sm"
                  >
                    注册
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function Brand() {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="Coc-tools 首页">
      <span
        aria-hidden
        className="grid h-9 w-9 place-items-center rounded-2xl bg-macaron-300 text-white shadow-lift transition group-hover:bg-macaron-400"
      >
        <span className="font-bold text-[15px] tracking-wide">∴</span>
      </span>
      <span className="text-base font-extrabold tracking-tight text-ink">Coc-tools</span>
    </Link>
  );
}

function NavLinkItem({
  link,
  active,
  onNavigate,
  variant = 'desktop',
}: {
  link: NavLink;
  active: boolean;
  onNavigate?: () => void;
  variant?: 'desktop' | 'drawer';
}) {
  const cls =
    variant === 'drawer'
      ? 'block rounded-2xl px-3 py-2 text-sm transition ' +
        (active
          ? 'bg-macaron-100 text-macaron-600'
          : 'text-ink hover:bg-sky-50')
      : 'rounded-2xl px-3 py-1.5 text-sm transition ' +
        (active
          ? 'bg-macaron-100 text-macaron-600 font-semibold'
          : 'text-ink-soft hover:bg-sky-50 hover:text-ink');
  return (
    <Link href={link.href} onClick={onNavigate} className={cls}>
      {link.label}
    </Link>
  );
}

function UserCluster({ username }: { username: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-ink-soft">@{username}</span>
      <form action="/api/auth/logout" method="POST">
        <button type="submit" className="btn-ghost text-sm">退出</button>
      </form>
    </div>
  );
}

function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M6 18L18 6" />
    </svg>
  );
}