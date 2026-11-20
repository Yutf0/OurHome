import Fastify from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import { config, UPLOAD_DIR } from './config.js';
import './db.js';
import { registerAuth } from './auth.js';
import { registerEntryRoutes } from './routes/entries.js';
import { registerUploadRoutes } from './routes/uploads.js';
import { registerClothesRoutes } from './routes/clothes.js';
import { registerAnniversaryRoutes } from './routes/anniversaries.js';
import { registerPushRoutes, pushEnabled } from './push.js';
import { registerShenlunRoutes } from './routes/exclusive/shenlun.js';

const app = Fastify({
  logger: true,
  bodyLimit: 10 * 1024 * 1024,
  // Caddy 反代时,让 Fastify 认 X-Forwarded-* 头,日志里能看到真实来源 IP
  trustProxy: true,
});

await app.register(cookie, { secret: config.cookieSecret });
await app.register(multipart, {
  limits: { fileSize: 30 * 1024 * 1024 },
});

await app.register(fastifyStatic, {
  root: UPLOAD_DIR,
  prefix: '/uploads/',
  decorateReply: false,
});

registerAuth(app);
registerEntryRoutes(app);
registerUploadRoutes(app);
registerClothesRoutes(app);
registerAnniversaryRoutes(app);
registerPushRoutes(app);
registerShenlunRoutes(app);

if (config.serveFrontend && fs.existsSync(config.frontendDist)) {
  await app.register(fastifyStatic, {
    root: config.frontendDist,
    prefix: '/',
  });
  app.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
    const url = req.raw.url ?? '';
    if (url.startsWith('/api') || url.startsWith('/uploads')) {
      return reply.code(404).send({ error: 'not found' });
    }
    return reply.sendFile('index.html');
  });
}

try {
  const addr = await app.listen({ port: config.port, host: config.host });
  app.log.info(`服务已启动 ${addr}  数据目录: ${config.dataDir}`);
  app.log.info(pushEnabled ? '推送:已启用' : '推送:未配置 VAPID 密钥,已跳过');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
