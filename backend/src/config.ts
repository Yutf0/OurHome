import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import type { Author } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export const config = {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  dataDir: path.resolve(process.env.DATA_DIR || path.join(PROJECT_ROOT, 'data')),
  appPassword: process.env.APP_PASSWORD || 'change-me-520',
  cookieSecret: process.env.COOKIE_SECRET || 'change-this-to-a-long-random-secret',
  serveFrontend: process.env.SERVE_FRONTEND !== 'false',
  frontendDist: path.resolve(
    process.env.FRONTEND_DIST || path.join(PROJECT_ROOT, 'frontend', 'dist')
  ),

  // 上了 HTTPS 之后设为 true,Cookie 只走加密连接(本地 http 调试时保持 false)
  cookieSecure: process.env.COOKIE_SECURE === 'true',

  /* ===== Web Push ===== */
  // 用 `node scripts/gen-vapid.mjs` 生成一次,填进 ecosystem.config.cjs
  vapidPublic: process.env.VAPID_PUBLIC_KEY || '',
  vapidPrivate: process.env.VAPID_PRIVATE_KEY || '',
  // 必须是 mailto: 或 https: 开头,苹果要求能联系到推送方
  // 必须 mailto: 或 https: 开头;若只填了裸邮箱,这里自动补前缀,避免启动崩溃
  vapidSubject: (() => {
    const s = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
    return s.startsWith('mailto:') || s.startsWith('https:') ? s : `mailto:${s}`;
  })(),

  // 推送文案里显示的称呼,改成你们自己的昵称
  authorNames: { me: '我', her: '她' } as Record<Author, string>,
};

export const UPLOAD_DIR = path.join(config.dataDir, 'uploads');
export const DB_PATH = path.join(config.dataDir, 'app.db');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
