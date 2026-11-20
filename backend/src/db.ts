import Database from 'better-sqlite3';
import { DB_PATH } from './config.js';

export const db: Database.Database = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    author      TEXT NOT NULL DEFAULT 'me',
    title       TEXT,
    content     TEXT,
    mood        TEXT,
    location_name TEXT,
    latitude    REAL,
    longitude   REAL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id    INTEGER NOT NULL,
    kind        TEXT NOT NULL,
    filename    TEXT NOT NULL,
    thumb       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS clothes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category    TEXT NOT NULL,
    subcategory TEXT,
    name        TEXT,
    note        TEXT,
    photo       TEXT,
    thumb       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS anniversaries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    date        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS comments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id    INTEGER NOT NULL,
    author      TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comment_likes (
    comment_id  INTEGER NOT NULL,
    author      TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (comment_id, author),
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
  );

  -- 推送订阅:一台设备一条,endpoint 唯一
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    owner       TEXT NOT NULL,
    endpoint    TEXT NOT NULL UNIQUE,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    ua          TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_attachments_entry ON attachments(entry_id);
  CREATE INDEX IF NOT EXISTS idx_entries_created ON entries(created_at);
  CREATE INDEX IF NOT EXISTS idx_clothes_cat ON clothes(category, subcategory);
  CREATE INDEX IF NOT EXISTS idx_push_owner ON push_subscriptions(owner);
  CREATE INDEX IF NOT EXISTS idx_comments_entry ON comments(entry_id, id);
  CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);
`);

// 旧数据库在启动时原地补列，保留已有日常、照片和衣柜数据。
const entryColumns = new Set(
  (db.prepare('PRAGMA table_info(entries)').all() as Array<{ name: string }>).map((column) =>
    column.name
  )
);
if (!entryColumns.has('location_name')) db.exec('ALTER TABLE entries ADD COLUMN location_name TEXT');
if (!entryColumns.has('latitude')) db.exec('ALTER TABLE entries ADD COLUMN latitude REAL');
if (!entryColumns.has('longitude')) db.exec('ALTER TABLE entries ADD COLUMN longitude REAL');
