import webpush from 'web-push';
import type { FastifyInstance } from 'fastify';
import { db } from './db.js';
import { requireAuth } from './auth.js';
import { config } from './config.js';
import type { Author } from './types.js';

/* ============================================================
   Web Push 推送模块
   原理:浏览器订阅后拿到一个 endpoint(苹果的推送网关地址)+ 两个加密公钥,
   存进库;发消息时用 VAPID 私钥签名 + 订阅公钥加密,POST 给 endpoint,
   苹果再转发给手机,手机上的 Service Worker 被唤醒并弹出通知。
   ============================================================ */

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface SubRow {
  id: number;
  owner: Author;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// 只有配齐了 VAPID 密钥才启用,否则整个功能静默跳过(本地 http 调试时不会报错)
export const pushEnabled: boolean = Boolean(config.vapidPublic && config.vapidPrivate);

if (pushEnabled) {
  webpush.setVapidDetails(config.vapidSubject, config.vapidPublic, config.vapidPrivate);
}

interface Payload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** 给指定的一批订阅发推送;失效的订阅(404/410)自动从库里清掉 */
async function sendTo(rows: SubRow[], payload: Payload): Promise<number> {
  if (!pushEnabled || rows.length === 0) return 0;
  const text = JSON.stringify(payload);
  let ok = 0;

  await Promise.all(
    rows.map(async (r) => {
      try {
        await webpush.sendNotification(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          text,
          { TTL: 60 * 60 * 24 }
        );
        ok++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        // 410 Gone / 404 Not Found = 用户卸载了或订阅过期,清理掉
        if (code === 404 || code === 410) {
          db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(r.id);
        }
      }
    })
  );
  return ok;
}

/** 新记录发布后调用:推给「除了作者本人以外」的所有设备 */
export async function notifyNewEntry(
  author: Author,
  title: string,
  content: string
): Promise<void> {
  if (!pushEnabled) return;
  const rows = db
    .prepare('SELECT * FROM push_subscriptions WHERE owner != ?')
    .all(author) as SubRow[];

  const who = config.authorNames[author] ?? (author === 'her' ? '她' : '我');
  const preview = (title || content || '').trim().slice(0, 40) || '快去看看吧';

  await sendTo(rows, {
    title: `${who}更新了一条新记录`,
    body: preview,
    url: '/',
    tag: 'new-entry',
  });
}

export function registerPushRoutes(app: FastifyInstance): void {
  // 前端订阅前先来拿公钥;enabled=false 时前端直接隐藏「开启通知」入口
  app.get('/api/push/key', { preHandler: requireAuth }, async () => {
    return { enabled: pushEnabled, publicKey: config.vapidPublic };
  });

  app.post('/api/push/subscribe', { preHandler: requireAuth }, async (req, reply) => {
    const { owner, subscription } = (req.body ?? {}) as {
      owner?: Author;
      subscription?: PushSubscriptionJSON;
    };
    if (owner !== 'me' && owner !== 'her') {
      return reply.code(400).send({ error: '请先选择这台设备是谁在用' });
    }
    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return reply.code(400).send({ error: '订阅信息不完整' });
    }

    // endpoint 唯一:同一台设备重复订阅只更新 owner,不产生重复推送
    db.prepare(
      `INSERT INTO push_subscriptions (owner, endpoint, p256dh, auth, ua)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET owner = excluded.owner`
    ).run(
      owner,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth,
      (req.headers['user-agent'] ?? '').slice(0, 200)
    );
    return { ok: true };
  });

  app.post('/api/push/unsubscribe', { preHandler: requireAuth }, async (req) => {
    const { endpoint } = (req.body ?? {}) as { endpoint?: string };
    if (endpoint) {
      db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
    }
    return { ok: true };
  });

  // 调试用:给自己发一条,验证链路是否通
  app.post('/api/push/test', { preHandler: requireAuth }, async (req, reply) => {
    if (!pushEnabled) {
      return reply.code(400).send({ error: '服务器还没配置 VAPID 密钥' });
    }
    const { endpoint } = (req.body ?? {}) as { endpoint?: string };
    const rows = (
      endpoint
        ? db.prepare('SELECT * FROM push_subscriptions WHERE endpoint = ?').all(endpoint)
        : db.prepare('SELECT * FROM push_subscriptions').all()
    ) as SubRow[];

    const sent = await sendTo(rows, {
      title: '测试通知 ♡',
      body: '能看到这条,说明推送已经通了',
      url: '/',
      tag: 'test',
    });
    return { ok: true, sent };
  });

  // 看看当前有几台设备订阅了(排查用)
  app.get('/api/push/list', { preHandler: requireAuth }, async () => {
    const rows = db
      .prepare('SELECT id, owner, created_at FROM push_subscriptions ORDER BY id')
      .all();
    return { enabled: pushEnabled, subscriptions: rows };
  });
}
