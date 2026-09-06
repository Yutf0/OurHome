import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from './config.js';

export function registerAuth(app: FastifyInstance): void {
  app.post('/api/login', async (req, reply) => {
    const { password } = (req.body ?? {}) as { password?: string };
    if (password !== config.appPassword) {
      return reply.code(401).send({ error: '暗号不对哦 ♡' });
    }
    reply.setCookie('auth', 'ok', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      signed: true,
      secure: config.cookieSecure, // 上了 HTTPS 后设 COOKIE_SECURE=true
      maxAge: 60 * 60 * 24 * 90,
    });
    return { ok: true };
  });

  app.post('/api/logout', async (_req, reply) => {
    reply.clearCookie('auth', { path: '/' });
    return { ok: true };
  });

  app.get('/api/me', async (req) => {
    return { loggedIn: isLoggedIn(req) };
  });
}

export function isLoggedIn(req: FastifyRequest): boolean {
  const c = req.cookies?.auth;
  if (!c) return false;
  const r = req.unsignCookie(c);
  return r.valid && r.value === 'ok';
}

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!isLoggedIn(req)) {
    reply.code(401).send({ error: '请先登录' });
  }
}
