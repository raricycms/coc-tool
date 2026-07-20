import './globals.css';
import type { Metadata } from 'next';
import { TopNav } from '@/components/TopNav';

export const metadata: Metadata = {
  title: 'Coc-tools · 在线跑团工具',
  description: 'CoC 7e 在线跑团工具 — 建卡 / 招募 / 跑团 / 结算',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  );
}