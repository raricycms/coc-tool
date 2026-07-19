'use client';

/**
 * 顶栏客户端：负责 active 高亮、移动端抽屉、登出表单。
 * 视觉：
 *   - 整条 sticky，64px 高，深蓝玻璃（ink-950/60 + backdrop-blur-xl），底部一道白/6% 细线。
 *   - 左侧品牌：克苏鲁星符 ∴（金琥珀色，唯一一处暖色）+ Coc-tools 字标。
 *   - 中部主导航 + 右侧账户区；移动端折叠成汉堡 + 下拉抽屉。
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
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/characters', label: '我的车卡' },
  { href: '/recruitments', label: '招募' },
];

const PUBLIC_LINKS: NavLink[] = [
  { href: '/', label: '首页' },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (pathname === href) return true;
  // 仅当 href 是其它路径的「目录前缀」时算 active；避免 /characters 误匹配 /characters-archive。
  return pathname.startsWith(href + '/');
}

export function TopNavClient({ session }: { session: NavSession }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = session ? AUTHED_LINKS : PUBLIC_LINKS;
  const user = session; // 别名，下面读起来更顺手

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Brand />

        {/* 桌面端：中部导航 + 右侧账户 */}
        <div className="hidden flex-1 items-center justify-end gap-6 md:flex">
          <nav className="flex items-center gap-1">
            {links.map((link) => (
              <NavLinkItem
                key={link.href}
                link={link}
                active={isActive(pathname, link.href)}
              />
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {user ? <UserCluster username={user.username} /> : <AuthCluster />}
          </div>
        </div>

        {/* 移动端：只露汉堡按钮 */}
        <button
          type="button"
          aria-label={open ? '关闭菜单' : '打开菜单'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-100/80 transition hover:bg-white/[0.06] hover:text-ink-50 md:hidden"
        >
          {open ? <IconClose /> : <IconMenu />}
        </button>
      </div>

      {/* 移动端抽屉 */}
      {open && (
        <div className="border-t border-white/[0.06] bg-ink-950/95 backdrop-blur-xl md:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-4 py-3">
            {links.map((link) => (
              <NavLinkItem
                key={link.href}
                link={link}
                active={isActive(pathname, link.href)}
                onNavigate={() => setOpen(false)}
                variant="drawer"
              />
            ))}
            <div className="my-2 border-t border-white/[0.06] pt-2">
              {user ? (
                <>
                  <div className="px-3 py-2 text-sm text-ink-100/60">@{user.username}</div>
                  <form action="/api/auth/logout" method="POST">
                    <button
                      type="submit"
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink-100/80 transition hover:bg-white/[0.06] hover:text-ink-50"
                    >
                      退出
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm text-ink-100/80 transition hover:bg-white/[0.06] hover:text-ink-50"
                  >
                    登录
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="mt-1 block rounded-lg bg-brand-500 px-3 py-2 text-center text-sm font-medium text-white transition hover:brightness-110"
                  >
                    注册
                  </Link>
                </>
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
    <Link
      href="/"
      className="group flex items-center gap-2.5"
      aria-label="Coc-tools 首页"
    >
      {/* 克苏鲁「星符」——整页唯一的暖色装饰，三粒星成三角 */}
      <span
        aria-hidden
        className="grid h-7 w-7 place-items-center rounded-full border border-amber-400/30 bg-amber-400/[0.06] font-bold text-amber-300 shadow-[inset_0_0_8px_rgba(212,175,55,0.12)]"
        style={{ fontSize: 9, letterSpacing: '0.2em', lineHeight: 1 }}
      >
        ∴
      </span>
      <span className="text-sm font-bold uppercase tracking-[0.18em] text-ink-50 transition group-hover:text-white">
        Coc-tools
      </span>
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
  if (variant === 'drawer') {
    return (
      <Link
        href={link.href}
        onClick={onNavigate}
        className={[
          'block rounded-lg px-3 py-2 text-sm transition',
          active
            ? 'bg-brand-500/15 text-brand-100 ring-1 ring-brand-500/30'
            : 'text-ink-100/80 hover:bg-white/[0.06] hover:text-ink-50',
        ].join(' ')}
      >
        {link.label}
      </Link>
    );
  }

  return (
    <Link
      href={link.href}
      className={[
        'rounded-lg px-3 py-1.5 text-sm transition',
        active
          ? 'bg-brand-500/15 text-brand-100 ring-1 ring-brand-500/30'
          : 'text-ink-100/70 hover:bg-white/[0.06] hover:text-ink-50',
      ].join(' ')}
    >
      {link.label}
    </Link>
  );
}

function UserCluster({ username }: { username: string }) {
  return (
    <>
      <span className="text-sm text-ink-100/60">@{username}</span>
      <form action="/api/auth/logout" method="POST">
        <button type="submit" className="btn-ghost text-sm">
          退出
        </button>
      </form>
    </>
  );
}

function AuthCluster() {
  return (
    <>
      <Link href="/login" className="btn-ghost text-sm">
        登录
      </Link>
      <Link href="/register" className="btn-primary text-sm">
        注册
      </Link>
    </>
  );
}

function IconMenu() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M6 18L18 6" />
    </svg>
  );
}