import Fastify from 'fastify';
import { Server } from 'socket.io';
import { authMiddleware } from './auth.js';
import { registerHandlers } from './handlers.js';

const PORT = parseInt(process.env.REALTIME_PORT || '4000', 10);
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:3000';

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL || 'info' },
});

app.get('/health', async () => ({ ok: true, ts: Date.now() }));

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