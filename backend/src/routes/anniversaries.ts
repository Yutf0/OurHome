import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import type {
  Anniversary,
  AnniversaryComputed,
  Milestone,
  Holiday,
} from '../types.js';

function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function diffDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function nextHundred(base: Date, today: Date): Milestone {
  const days = diffDays(base, today);
  const n = (Math.floor(Math.max(days, 0) / 100) + 1) * 100;
  const cand = new Date(base);
  cand.setDate(cand.getDate() + n);
  return { n, date: fmt(cand), daysLeft: diffDays(today, cand) };
}

function nextAnnual(base: Date, today: Date): Milestone {
  let n = 1;
  let cand = new Date(base.getFullYear() + n, base.getMonth(), base.getDate());
  while (diffDays(today, cand) < 0) {
    n++;
    cand = new Date(base.getFullYear() + n, base.getMonth(), base.getDate());
  }
  return { n, date: fmt(cand), daysLeft: diffDays(today, cand) };
}

const FIXED_HOLIDAYS: Array<{ name: string; month: number; day: number }> = [
  { name: '情人节', month: 2, day: 14 },
  { name: '白色情人节', month: 3, day: 14 },
  { name: '520', month: 5, day: 20 },
  { name: '圣诞节', month: 12, day: 25 },
];
const QIXI: Record<number, string> = {
  2025: '2025-08-29',
  2026: '2026-08-19',
  2027: '2027-08-08',
  2028: '2028-08-26',
  2029: '2029-08-16',
  2030: '2030-08-05',
};

export function registerAnniversaryRoutes(app: FastifyInstance): void {
  app.get(
    '/api/anniversaries',
    { preHandler: requireAuth },
    async (): Promise<AnniversaryComputed[]> => {
      const today = startOfToday();
      const rows = db
        .prepare('SELECT * FROM anniversaries ORDER BY date ASC')
        .all() as Anniversary[];
      return rows.map((r) => {
        const base = parseDate(r.date);
        return {
          ...r,
          days: diffDays(base, today),
          nextHundred: nextHundred(base, today),
          nextYear: nextAnnual(base, today),
        };
      });
    }
  );

  app.post('/api/anniversaries', { preHandler: requireAuth }, async (req, reply) => {
    const { name, date } = (req.body ?? {}) as { name?: string; date?: string };
    if (!name || !name.trim()) {
      return reply.code(400).send({ error: '给纪念日起个名字吧' });
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply.code(400).send({ error: '日期格式应为 YYYY-MM-DD' });
    }
    const { lastInsertRowid } = db
      .prepare('INSERT INTO anniversaries (name, date) VALUES (?, ?)')
      .run(name.trim(), date);
    return reply.code(201).send({ id: Number(lastInsertRowid) });
  });

  app.delete('/api/anniversaries/:id', { preHandler: requireAuth }, async (req) => {
    db.prepare('DELETE FROM anniversaries WHERE id = ?').run(
      Number((req.params as { id: string }).id)
    );
    return { ok: true };
  });

  app.get('/api/holidays', { preHandler: requireAuth }, async (): Promise<Holiday[]> => {
    const today = startOfToday();
    const out: Holiday[] = [];
    for (const h of FIXED_HOLIDAYS) {
      let cand = new Date(today.getFullYear(), h.month - 1, h.day);
      if (diffDays(today, cand) < 0) {
        cand = new Date(today.getFullYear() + 1, h.month - 1, h.day);
      }
      out.push({ name: h.name, date: fmt(cand), daysLeft: diffDays(today, cand) });
    }
    for (const y of [today.getFullYear(), today.getFullYear() + 1]) {
      const d = QIXI[y];
      if (!d) continue;
      const cand = parseDate(d);
      if (diffDays(today, cand) >= 0) {
        out.push({ name: '七夕', date: d, daysLeft: diffDays(today, cand) });
        break;
      }
    }
    out.sort((a, b) => a.daysLeft - b.daysLeft);
    return out;
  });
}
