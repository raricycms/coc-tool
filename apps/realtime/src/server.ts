import Fastify from 'fastify';
import { Server } from 'socket.io';
import { createHash } from 'node:crypto';
import { authMiddleware } from './auth.js';
import { registerHandlers } from './handlers.js';

const PORT = parseInt(process.env.REALTIME_PORT || '4000', 10);
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:3000';

/**
 * 启动期硬校验 SESSION_SECRET：
 *  - 必须存在；
 *  - 不能是仓库自带的 dev 占位串（那代表「忘了 set -a; source .env; set +a」）；
 *  - 测试环境（NODE_ENV=test 或 vitest 注入的 SESSION_SECRET）跳过此校验。
 *
 * 之前两边用不同 secret 时，浏览器端会拿到「连接已断开」的死循环但
 * realtime 服务端只是默默返回 `unauthorized: invalid token`，极难定位；
 * 在这里 fail-loud，问题立刻显形。
 */
function assertSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  const PLACEHOLDER = 'dev-secret-please-replace-this-32-bytes';
  if (secret && secret !== PLACEHOLDER) return;
  if (process.env.NODE_ENV === 'test') return;
  console.error('');
  console.error('┌──────────────────────────────────────────────────────────────────┐');
  console.error('│ realtime: SESSION_SECRET 未设置或仍是仓库占位串，启动被拒绝        │');
  console.error('│                                                                  │');
  console.error('│ 这会导致 web 签的 JWT 在 realtime 端校验失败，                    │');
  console.error('│ 浏览器看到「连接已断开，正在重连…」的死循环。                     │');
  console.error('│                                                                  │');
  console.error('│ 修法（启动前先导入 .env）：                                       │');
  console.error('│     set -a && source .env && set +a && npm run dev:realtime       │');
  console.error('│                                                                  │');
  console.error('│ 或者在 systemd 单元里加：                                         │');
  console.error('│     EnvironmentFile=/opt/coc-tools/.env                          │');
  console.error('└──────────────────────────────────────────────────────────────────┘');
  console.error('');
  process.exit(2);
}
assertSessionSecret();

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL || 'info' },
});

app.get('/health', async () => ({
  ok: true,
  ts: Date.now(),
  // 调试用：暴露 SESSION_SECRET 的 sha256 前 12 位指纹（不是密钥本身）。
  // apps/web/tests/e2e/ws-flow.mjs 会调 web 和 realtime 的 health，
  // 比对两个指纹——不一致就是「unauthorized: invalid token」的根因。
  secretFp: createHash('sha256').update(process.env.SESSION_SECRET || '').digest('hex').slice(0, 12),
}));

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`realtime HTTP listening on :${PORT}`);

    const io = new Server(app.server, {
      cors: { origin: WEB_ORIGIN, credentials: true },
      transports: ['websocket', 'polling'],
    });

    io.use(authMiddleware);
    await registerHandlers(io);

    app.log.info(`socket.io ready, accepting connections from ${WEB_ORIGIN}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

// 优雅退出
process.on('SIGTERM', () => {
  app.log.info('SIGTERM received, shutting down');
  app.close().then(() => process.exit(0));
});
process.on('SIGINT', () => {
  app.log.info('SIGINT received, shutting down');
  app.close().then(() => process.exit(0));
});