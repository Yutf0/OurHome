import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth.js';
import { UPLOAD_DIR } from '../config.js';
import type { UploadResult } from '../types.js';

const AUDIO_EXT: Record<string, string> = {
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/wav': '.wav',
};

export function registerUploadRoutes(app: FastifyInstance): void {
  app.post(
    '/api/upload',
    { preHandler: requireAuth },
    async (req, reply): Promise<UploadResult | undefined> => {
      const file = await req.file();
      if (!file) {
        reply.code(400).send({ error: '没有收到文件' });
        return;
      }

      const id = crypto.randomBytes(8).toString('hex');
      const mime = file.mimetype || '';

      if (mime.startsWith('image/')) {
        const buf = await file.toBuffer();
        const fullName = `${id}.webp`;
        const thumbName = `${id}_thumb.webp`;
        await sharp(buf)
          .rotate()
          .resize({ width: 1600, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toFile(path.join(UPLOAD_DIR, fullName));
        await sharp(buf)
          .rotate()
          .resize({ width: 400, withoutEnlargement: true })
          .webp({ quality: 70 })
          .toFile(path.join(UPLOAD_DIR, thumbName));
        return { kind: 'image', filename: fullName, thumb: thumbName };
      }

      const ext =
        AUDIO_EXT[mime] ||
        (file.filename ? path.extname(file.filename) : '') ||
        '.bin';
      const name = `${id}${ext}`;
      await pipeline(file.file, fs.createWriteStream(path.join(UPLOAD_DIR, name)));
      const kind = mime.startsWith('audio/') ? 'audio' : 'file';
      return { kind, filename: name };
    }
  );
}
