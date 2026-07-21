/**
 * 顶栏：服务端壳。
 * - 调 getCurrentUser 拿到当前用户；
 * - 只把最小可见字段（username）透给客户端，避免敏感数据泄露。
 */
import { getCurrentUser } from '@/lib/auth';
import { TopNavClient, type NavSession } from './TopNavClient';

export async function TopNav() {
  const user = await getCurrentUser();
  const session: NavSession = user ? { username: user.username } : null;
  return <TopNavClient session={session} />;
}