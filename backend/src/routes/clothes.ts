import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { UPLOAD_DIR } from '../config.js';
import type { Clothes, CreateClothesBody } from '../types.js';
import {
  ensureCutoutColumns,
  recoverPendingCutouts,
  processClothesPhoto,
  requeueCutout,
} from '../cutout.js';

const CATEGORIES = ['top', 'pants', 'shoes', 'jewelry', 'accessory'];
const JEWELRY_SUBS = ['bracelet', 'necklace', 'earring'];

export function registerClothesRoutes(app: FastifyInstance): void {
  // v0.5: 补 cutout 三列(幂等) + 恢复重启前未完成的抠图任务
  ensureCutoutColumns();
  recoverPendingCutouts();

  app.get('/api/clothes', { preHandler: requireAuth }, async (req): Promise<Clothes[]> => {
    const { category, sub, q } = req.query as {
      category?: string;
      sub?: string;
      q?: string;
    };
    const conds: string[] = [];
    const args: unknown[] = [];
    if (category && CATEGORIES.includes(category)) {
      conds.push('category = ?');
      args.push(category);
    }
    if (sub && JEWELRY_SUBS.includes(sub)) {
      conds.push('subcategory = ?');
      args.push(sub);
    }
    if (q && q.trim()) {
      const like = `%${q.trim()}%`;
      conds.push('(note LIKE ? OR name LIKE ?)');
      args.push(like, like);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return db
      .prepare(`SELECT * FROM clothes ${where} ORDER BY id DESC`)
      .all(...args) as Clothes[];
  });

  app.post('/api/clothes', { preHandler: requireAuth }, async (req, reply) => {
    const b = (req.body ?? {}) as CreateClothesBody;
    if (!b.category || !CATEGORIES.includes(b.category)) {
      return reply.code(400).send({ error: '请选择正确的分类' });
    }
    const sub =
      b.category === 'jewelry' && b.subcategory && JEWELRY_SUBS.includes(b.subcategory)
        ? b.subcategory
        : null;
    const { lastInsertRowid } = db
      .prepare(
        'INSERT INTO clothes (category, subcategory, name, note, photo, thumb) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(b.category, sub, b.name ?? '', b.note ?? '', b.photo ?? null, b.thumb ?? null);
    const id = Number(lastInsertRowid);

    // v0.5: 自动抠图。透明图秒级裁剪;普通照片入队后台 ONNX 抠图,
    // 接口立即返回,抠图失败绝不影响入库。
    if (b.photo) {
      await processClothesPhoto(id, b.photo).catch((e) =>
        console.error('[clothes] cutout dispatch failed:', e)
      );
    }

    return reply.code(201).send({ id });
  });

  // v0.5: 手动重新抠图（效果不满意时用）
  app.post('/api/clothes/:id/recut', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const row = db.prepare('SELECT photo FROM clothes WHERE id = ?').get(id) as
      | { photo: string | null }
      | undefined;
    if (!row) return reply.code(404).send({ error: '没找到这件物品' });
    if (!row.photo) return reply.code(400).send({ error: '这件物品没有照片' });
    requeueCutout(id, row.photo);
    return { ok: true };
  });

  // v0.5: 切换展示用图（抠图 / 原图）,原图和抠图文件都保留
  app.post('/api/clothes/:id/use-cutout', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const { use } = (req.body ?? {}) as { use?: boolean };
    const row = db.prepare('SELECT id FROM clothes WHERE id = ?').get(id);
    if (!row) return reply.code(404).send({ error: '没找到这件物品' });
    db.prepare('UPDATE clothes SET use_cutout = ? WHERE id = ?').run(use ? 1 : 0, id);
    return { ok: true };
  });

  app.put('/api/clothes/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const b = (req.body ?? {}) as Partial<CreateClothesBody>;
    const row = db.prepare('SELECT * FROM clothes WHERE id = ?').get(id) as
      | Clothes
      | undefined;
    if (!row) return reply.code(404).send({ error: '没找到这件物品' });

    const category =
      b.category && CATEGORIES.includes(b.category) ? b.category : row.category;
    const sub =
      category === 'jewelry'
        ? b.subcategory && JEWELRY_SUBS.includes(b.subcategory)
          ? b.subcategory
          : row.subcategory
        : null;
    db.prepare(
      'UPDATE clothes SET category = ?, subcategory = ?, name = ?, note = ? WHERE id = ?'
    ).run(category, sub, b.name ?? row.name, b.note ?? row.note, id);
    return { ok: true };
  });

  app.delete('/api/clothes/:id', { preHandler: requireAuth }, async (req) => {
    const id = Number((req.params as { id: string }).id);
    const row = db
      .prepare('SELECT photo, thumb, cutout FROM clothes WHERE id = ?')
      .get(id) as
      | { photo: string | null; thumb: string | null; cutout: string | null }
      | undefined;
    if (row) {
      for (const f of [row.photo, row.thumb, row.cutout]) {
        if (!f) continue;
        const p = path.join(UPLOAD_DIR, f);
        if (fs.existsSync(p)) fs.rmSync(p, { force: true });
      }
    }
    db.prepare('DELETE FROM clothes WHERE id = ?').run(id);
    return { ok: true };
  });
}
