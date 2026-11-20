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
  Comment,
  CommentWithLikes,
  Author,
} from '../types.js';

function validAuthor(value: unknown): value is Author {
  return value === 'me' || value === 'her';
}

function finiteCoordinate(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

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
             WHERE title LIKE ? OR content LIKE ? OR location_name LIKE ?
             ORDER BY datetime(created_at) DESC, id DESC`
          )
          .all(like, like, like) as Entry[];
      } else {
        entries = db
          .prepare('SELECT * FROM entries ORDER BY datetime(created_at) DESC, id DESC')
          .all() as Entry[];
      }
      const attStmt = db.prepare(
        'SELECT id, kind, filename, thumb FROM attachments WHERE entry_id = ? ORDER BY id'
      );
      const commentStmt = db.prepare(
        'SELECT id, entry_id, author, content, created_at FROM comments WHERE entry_id = ? ORDER BY id'
      );
      const likeStmt = db.prepare(
        'SELECT author FROM comment_likes WHERE comment_id = ? ORDER BY created_at, author'
      );
      return entries.map((e) => ({
        ...e,
        attachments: attStmt.all(e.id) as AttachmentBrief[],
        comments: (commentStmt.all(e.id) as Comment[]).map(
          (comment): CommentWithLikes => ({
            ...comment,
            like_authors: (likeStmt.all(comment.id) as Array<{ author: Author }>).map(
              (like) => like.author
            ),
          })
        ),
      }));
    }
  );

  app.post('/api/entries', { preHandler: requireAuth }, async (req, reply) => {
    const {
      author = 'me',
      title = '',
      content = '',
      mood = '',
      location_name = null,
      latitude = null,
      longitude = null,
      attachments = [],
    } = (req.body ?? {}) as CreateEntryBody;

    const safeAuthor: Author = validAuthor(author) ? author : 'me';
    const safeLatitude = finiteCoordinate(latitude, -90, 90);
    const safeLongitude = finiteCoordinate(longitude, -180, 180);
    const safeLocationName =
      safeLatitude !== null && safeLongitude !== null && location_name
        ? String(location_name).trim().slice(0, 120)
        : null;

    const insert = db.prepare(
      `INSERT INTO entries
       (author, title, content, mood, location_name, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const attInsert = db.prepare(
      'INSERT INTO attachments (entry_id, kind, filename, thumb) VALUES (?, ?, ?, ?)'
    );

    const tx = db.transaction(() => {
      const { lastInsertRowid } = insert.run(
        safeAuthor,
        title.slice(0, 100),
        content.slice(0, 500),
        mood,
        safeLocationName,
        safeLatitude,
        safeLongitude
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
    notifyNewEntry(safeAuthor, title, content).catch((err) => {
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

  app.post('/api/entries/:id/comments', { preHandler: requireAuth }, async (req, reply) => {
    const entryId = Number((req.params as { id: string }).id);
    const { author, content } = (req.body ?? {}) as { author?: unknown; content?: unknown };
    const text = typeof content === 'string' ? content.trim().slice(0, 300) : '';

    if (!Number.isInteger(entryId) || !validAuthor(author) || !text) {
      return reply.code(400).send({ error: '评论内容或身份无效' });
    }
    const entryExists = db.prepare('SELECT 1 FROM entries WHERE id = ?').get(entryId);
    if (!entryExists) return reply.code(404).send({ error: '这条日常不存在' });

    const result = db
      .prepare('INSERT INTO comments (entry_id, author, content) VALUES (?, ?, ?)')
      .run(entryId, author, text);
    const comment = db
      .prepare('SELECT id, entry_id, author, content, created_at FROM comments WHERE id = ?')
      .get(result.lastInsertRowid) as Comment;
    return reply.code(201).send({ ...comment, like_authors: [] } satisfies CommentWithLikes);
  });

  app.delete('/api/comments/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: '评论编号无效' });
    db.prepare('DELETE FROM comments WHERE id = ?').run(id);
    return { ok: true };
  });

  app.post('/api/comments/:id/likes', { preHandler: requireAuth }, async (req, reply) => {
    const commentId = Number((req.params as { id: string }).id);
    const { author } = (req.body ?? {}) as { author?: unknown };
    if (!Number.isInteger(commentId) || !validAuthor(author)) {
      return reply.code(400).send({ error: '点赞身份无效' });
    }
    const commentExists = db.prepare('SELECT 1 FROM comments WHERE id = ?').get(commentId);
    if (!commentExists) return reply.code(404).send({ error: '这条评论不存在' });

    const toggle = db.transaction(() => {
      const liked = db
        .prepare('SELECT 1 FROM comment_likes WHERE comment_id = ? AND author = ?')
        .get(commentId, author);
      if (liked) {
        db.prepare('DELETE FROM comment_likes WHERE comment_id = ? AND author = ?').run(
          commentId,
          author
        );
      } else {
        db.prepare('INSERT INTO comment_likes (comment_id, author) VALUES (?, ?)').run(
          commentId,
          author
        );
      }
      return !liked;
    });

    const liked = toggle();
    const likeAuthors = (
      db
        .prepare('SELECT author FROM comment_likes WHERE comment_id = ? ORDER BY created_at, author')
        .all(commentId) as Array<{ author: Author }>
    ).map((like) => like.author);
    return { liked, like_count: likeAuthors.length, like_authors: likeAuthors };
  });
}
