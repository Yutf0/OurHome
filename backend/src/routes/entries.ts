import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { UPLOAD_DIR } from '../config.js';
import { notifyNewEntry } from '../push.js';
import type {
  Entry,
  AttachmentBrief,
  EntryWithAttachments,
  CreateEntryBody,
} from '../types.js';

export function registerEntryRoutes(app: FastifyInstance): void {
  app.get(
    '/api/entries',
    { preHandler: requireAuth },
    async (req): Promise<EntryWithAttachments[]> => {
      const { q } = req.query as { q?: string };
      let entries: Entry[];
      if (q && q.trim()) {
        const like = `%${q.trim()}%`;
        entries = db
          .prepare(
            `SELECT * FROM entries
             WHERE title LIKE ? OR content LIKE ?
             ORDER BY datetime(created_at) DESC, id DESC`
          )
          .all(like, like) as Entry[];
      } else {
        entries = db
          .prepare('SELECT * FROM entries ORDER BY datetime(created_at) DESC, id DESC')
          .all() as Entry[];
      }
      const attStmt = db.prepare(
        'SELECT id, kind, filename, thumb FROM attachments WHERE entry_id = ? ORDER BY id'
      );
      return entries.map((e) => ({
        ...e,
        attachments: attStmt.all(e.id) as AttachmentBrief[],
      }));
    }
  );

  app.post('/api/entries', { preHandler: requireAuth }, async (req, reply) => {
    const {
      author = 'me',
      title = '',
      content = '',
      mood = '',
      attachments = [],
    } = (req.body ?? {}) as CreateEntryBody;

    const insert = db.prepare(
      'INSERT INTO entries (author, title, content, mood) VALUES (?, ?, ?, ?)'
    );
    const attInsert = db.prepare(
      'INSERT INTO attachments (entry_id, kind, filename, thumb) VALUES (?, ?, ?, ?)'
    );

    const tx = db.transaction(() => {
      const { lastInsertRowid } = insert.run(
        author,
        title.slice(0, 100),
        content.slice(0, 500),
        mood
      );
      for (const a of attachments) {
        if (a && a.filename) {
          attInsert.run(lastInsertRowid, a.kind ?? 'image', a.filename, a.thumb ?? null);
        }
      }
      return lastInsertRowid;
    });

    const id = Number(tx());

    // 推送是「发完即忘」:失败也不影响记录保存,不阻塞接口返回
    notifyNewEntry(author, title, content).catch((err) => {
      app.log.warn({ err }, '推送发送失败');
    });

    return reply.code(201).send({ id });
  });

  app.delete('/api/entries/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const entryId = Number(id);

    const atts = db
      .prepare('SELECT filename, thumb FROM attachments WHERE entry_id = ?')
      .all(entryId) as Array<{ filename: string; thumb: string | null }>;

    for (const a of atts) {
      for (const f of [a.filename, a.thumb]) {
        if (!f) continue;
        const p = path.join(UPLOAD_DIR, f);
        if (fs.existsSync(p)) fs.rmSync(p, { force: true });
      }
    }
    db.prepare('DELETE FROM entries WHERE id = ?').run(entryId);
    return { ok: true };
  });
}
