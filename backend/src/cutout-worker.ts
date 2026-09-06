// ============================================================
// ONNX(u2netp) 抠图子进程
//
// 由 cutout.ts 通过 fork 调用,处理不透明的平铺/挂拍照片:
//   预处理(320×320 归一化) → u2netp 推理出显著性图 → 归一化 + 曲线净化
//   → 作为 alpha 合成回原图 → 沿轮廓裁剪 → 输出透明 WebP
//
// 跑完即 process.exit(0),推理占用的内存随进程退出立刻归还系统。
// 模型: backend/models/u2netp.onnx (约 4.5MB,U²-Net 精简版)
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';

const MODEL_PATH = fileURLToPath(new URL('../models/u2netp.onnx', import.meta.url));
const SIZE = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

process.on('message', (msg: { photoFilename: string; uploadDir: string }) => {
  void (async () => {
    try {
      const out = await cutout(msg.photoFilename, msg.uploadDir);
      process.send?.({ ok: true, cutout: out });
    } catch (e) {
      console.error('[cutout-worker]', e);
      process.send?.({ ok: false });
    } finally {
      // 给 IPC 消息一点发送时间再退出
      setTimeout(() => process.exit(0), 100);
    }
  })();
});

async function cutout(photoFilename: string, uploadDir: string): Promise<string> {
  if (!fs.existsSync(MODEL_PATH)) {
    throw new Error('u2netp.onnx 模型不存在: ' + MODEL_PATH);
  }
  const src = path.join(uploadDir, photoFilename);

  // 1) 预处理:resize 到 320×320 → raw RGB → 归一化 + 标准化 → CHW Float32
  const { data } = await sharp(src)
    .removeAlpha()
    .resize(SIZE, SIZE, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const chw = new Float32Array(3 * SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    for (let c = 0; c < 3; c++) {
      const v = data[i * 3 + c] / 255;
      chw[c * SIZE * SIZE + i] = (v - MEAN[c]) / STD[c];
    }
  }

  // 2) 推理
  const session = await ort.InferenceSession.create(MODEL_PATH);
  const input = new ort.Tensor('float32', chw, [1, 3, SIZE, SIZE]);
  const feeds: Record<string, ort.Tensor> = { [session.inputNames[0]]: input };
  const output = await session.run(feeds);
  const mask = output[session.outputNames[0]].data as Float32Array; // 320*320 显著性图

  // 3) 归一化到 0-255 并做曲线净化:
  //    低于 60 视为背景清零,高于 200 视为主体拉满,中间线性过渡,
  //    去掉边缘的半透明雾感,轮廓更干净。
  let min = Infinity;
  let max = -Infinity;
  for (const v of mask) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const alpha = Buffer.alloc(SIZE * SIZE);
  for (let i = 0; i < mask.length; i++) {
    const v = ((mask[i] - min) / range) * 255;
    alpha[i] = v < 60 ? 0 : v > 200 ? 255 : Math.round(((v - 60) / 140) * 255);
  }

  // 4) alpha 放大回原图尺寸,与 RGB 手动交织成 RGBA
  //    (注意:不能用 sharp 的 joinChannel —— 实测它并不会把第 4 通道
  //     当作 alpha,输出仍是不透明图;手动拼 RGBA raw buffer 才可靠)
  const { data: rgb, info } = await sharp(src)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;

  // 注意:sharp 对 1 通道 raw 做 resize 后输出可能变成 3 通道,
  // 必须按 info.channels 取步长,否则 alpha 全部错位(实测踩过的坑)
  const { data: aData, info: aInfo } = await sharp(alpha, {
    raw: { width: SIZE, height: SIZE, channels: 1 },
  })
    .resize(W, H, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const aStep = aInfo.channels;

  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    rgba[i * 4] = rgb[i * 3];
    rgba[i * 4 + 1] = rgb[i * 3 + 1];
    rgba[i * 4 + 2] = rgb[i * 3 + 2];
    rgba[i * 4 + 3] = aData[i * aStep];
  }

  const base = photoFilename.replace(/\.[^.]+$/, '');
  const outName = `${base}_cut_${crypto.randomBytes(3).toString('hex')}.webp`;

  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .trim({ threshold: 20 }) // 沿透明边界裁掉四周空白
    .webp({ quality: 88 })
    .toFile(path.join(uploadDir, outName));

  return outName;
}
