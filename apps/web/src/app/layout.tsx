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
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  );
}