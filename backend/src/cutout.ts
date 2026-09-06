// ============================================================
// v0.5 抠图模块（服务器自动抠图,默认开启）
//
// 上传衣服照片后的处理流程:
//   1. 若图片本身带透明(比如你曾用 iPhone「提取主体」抠好的图),
//      直接用 sharp .trim() 沿透明边界裁剪 —— 快速路径,秒级完成。
//   2. 普通不透明照片(平铺/挂拍) → 丢进串行队列,fork 子进程用
//      ONNX(u2netp) 推理出衣服轮廓,合成 alpha 后裁剪输出透明 WebP。
//      子进程跑完即退出,峰值内存(~350MB)立刻还给系统,2G 机器友好。
//
// 每件衣物有 use_cutout 开关(默认 1):抠得不满意时可切回原图展示,
// 原图 photo/thumb 永远保留,cutout 只是「额外多出来的一张」。
//
// 环境变量 ENABLE_AUTO_CUTOUT=false 可整体关闭自动抠图(默认开启)。
// ============================================================

import path from 'node:path';
import { rmSync as fsUnlinkRaw } from 'node:fs';
import { fork } from 'node:child_process';

const fsUnlink = (p: string): void => fsUnlinkRaw(p, { force: true });
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { db } from './db.js';
import { UPLOAD_DIR } from './config.js';

// 默认开启;显式设 ENABLE_AUTO_CUTOUT=false 才关闭
const AUTO_CUTOUT = process.env.ENABLE_AUTO_CUTOUT !== 'false';

// ---- 幂等迁移:给 clothes 表补上三列 ----
// db.ts 用的是 CREATE TABLE IF NOT EXISTS,这里在路由注册时调用一次,
// 已有列就跳过,重复启动不报错,也不动任何现有数据。
export function ensureCutoutColumns(): void {
  const cols = db.prepare('PRAGMA table_info(clothes)').all() as Array<{ name: string }>;
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('cutout')) db.exec('ALTER TABLE clothes ADD COLUMN cutout TEXT');
  if (!names.has('cutout_status'))
    db.exec('ALTER TABLE clothes ADD COLUMN cutout_status TEXT');
  if (!names.has('use_cutout'))
    db.exec('ALTER TABLE clothes ADD COLUMN use_cutout INTEGER NOT NULL DEFAULT 1');
}

// ---- 重启恢复:进程重启时把卡在 pending 的任务捡回来重跑 ----
export function recoverPendingCutouts(): void {
  if (!AUTO_CUTOUT) return;
  const rows = db
    .prepare("SELECT id, photo FROM clothes WHERE cutout_status = 'pending' AND photo IS NOT NULL")
    .all() as Array<{ id: number; photo: string }>;
  for (const r of rows) enqueue(r.id, r.photo);
  if (rows.length) console.log(`[cutout] 恢复 ${rows.length} 个未完成的抠图任务`);
}

// ---- 快速路径:透明图检测 + 直接裁剪 ----

// stats.isOpaque === false 表示图里确实存在透明像素。
// JPEG 之类没有 alpha 通道的照片,isOpaque 恒为 true,自动走「不透明」分支。
export async function hasTransparency(absPath: string): Promise<boolean> {
  try {
    const stats = await sharp(absPath).stats();
    return stats.isOpaque === false;
  } catch {
    return false;
  }
}

async function trimTransparent(photoFilename: string): Promise<string> {
  const src = path.join(UPLOAD_DIR, photoFilename);
  const base = photoFilename.replace(/\.[^.]+$/, '');
  const outName = `${base}_cut.webp`;
  await sharp(src)
    .trim() // 沿透明边界裁掉四周空白,衣服正好填满画面
    .webp({ quality: 88 })
    .toFile(path.join(UPLOAD_DIR, outName));
  return outName;
}

// ---- ONNX 队列:串行执行,同一时间只跑一个子进程 ----

let running = false;
const queue: Array<{ id: number; photo: string }> = [];
const queuedIds = new Set<number>();

function enqueue(id: number, photo: string): void {
  if (queuedIds.has(id)) return;
  queuedIds.add(id);
  queue.push({ id, photo });
  void drain();
}

async function drain(): Promise<void> {
  if (running) return;
  running = true;
  while (queue.length) {
    const job = queue.shift();
    if (!job) break;
    try {
      await runWorker(job.id, job.photo);
    } catch (e) {
      console.error('[cutout] job failed:', e);
      db.prepare('UPDATE clothes SET cutout_status = ? WHERE id = ?').run('failed', job.id);
    } finally {
      queuedIds.delete(job.id);
    }
  }
  running = false;
}

// fork 独立子进程跑推理,跑完进程退出,峰值内存立刻还给系统。
function runWorker(id: number, photoFilename: string): Promise<void> {
  return new Promise((resolve) => {
    const workerPath = fileURLToPath(new URL('./cutout-worker.js', import.meta.url));
    const child = fork(workerPath, [], { env: process.env });
    let settled = false;

    const finish = (status: string, cutout: string | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (cutout) {
        // 重抠场景:先删掉旧的抠图文件,避免磁盘残留
        const old = db.prepare('SELECT cutout FROM clothes WHERE id = ?').get(id) as
          | { cutout: string | null }
          | undefined;
        if (old?.cutout && old.cutout !== cutout) {
          try {
            fsUnlink(path.join(UPLOAD_DIR, old.cutout));
          } catch {
            /* ignore */
          }
        }
        db.prepare('UPDATE clothes SET cutout = ?, cutout_status = ? WHERE id = ?').run(
          cutout,
          status,
          id
        );
      } else {
        db.prepare('UPDATE clothes SET cutout_status = ? WHERE id = ?').run(status, id);
      }
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      resolve();
    };

    // 兜底:单张最多 60 秒,防止子进程卡死拖住队列
    const timer = setTimeout(() => finish('failed', null), 60_000);

    child.on('message', (m: { ok: boolean; cutout?: string }) => {
      if (m && m.ok && m.cutout) finish('done', m.cutout);
      else finish('failed', null);
    });
    child.on('error', () => finish('failed', null));
    child.on('exit', () => finish('failed', null));
    child.send({ photoFilename, uploadDir: UPLOAD_DIR });
  });
}

// ---- 对外入口:新建/重抠时调用 ----

/**
 * 处理一件衣物的照片。透明图同步裁剪并返回状态;
 * 不透明图标记 pending 并入队(异步),接口无需等待。
 */
export async function processClothesPhoto(id: number, photoFilename: string): Promise<void> {
  try {
    if (await hasTransparency(photoFilename ? path.join(UPLOAD_DIR, photoFilename) : '')) {
      const cut = await trimTransparent(photoFilename);
      db.prepare('UPDATE clothes SET cutout = ?, cutout_status = ? WHERE id = ?').run(
        cut,
        'done',
        id
      );
      return;
    }
  } catch (e) {
    console.error('[cutout] transparent fast-path failed:', e);
  }

  if (!AUTO_CUTOUT) {
    db.prepare('UPDATE clothes SET cutout_status = ? WHERE id = ?').run('none', id);
    return;
  }
  db.prepare('UPDATE clothes SET cutout_status = ? WHERE id = ?').run('pending', id);
  enqueue(id, photoFilename);
}

/** 手动重抠(效果不满意时,从详情页触发) */
export function requeueCutout(id: number, photoFilename: string): void {
  db.prepare('UPDATE clothes SET cutout_status = ? WHERE id = ?').run('pending', id);
  enqueue(id, photoFilename);
}
