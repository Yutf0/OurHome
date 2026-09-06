import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Touch as RTouch,
  type TouchEvent as RTouchEvent,
} from 'react';
import { createPortal } from 'react-dom';

interface Props {
  images: string[]; // 全分辨率原图文件名
  startIndex: number;
  onClose: () => void;
}

// 单次手势的临时状态(放 ref,避免高频 setState 卡顿)
interface Gesture {
  mode: 'idle' | 'decide' | 'swipe' | 'dismiss' | 'pan' | 'pinch';
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startDist: number;
  startScale: number;
  startTx: number;
  startTy: number;
  startTime: number;
  moved: number; // 累计位移,用来区分「点按」与「拖动」
  vw: number;
  vh: number;
}

const MAX_SCALE = 4;
const ZOOM_SCALE = 2.5;

export default function Lightbox({ images, startIndex, onClose }: Props) {
  const [page, setPageState] = useState(startIndex);
  const pageRef = useRef(startIndex);
  const setPage = (n: number) => {
    pageRef.current = n;
    setPageState(n);
  };

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const imgMap = useRef<Map<number, HTMLImageElement>>(new Map());

  // 当前图片的缩放/平移
  const t = useRef({ scale: 1, tx: 0, ty: 0 });
  const g = useRef<Gesture>({
    mode: 'idle',
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startDist: 0,
    startScale: 1,
    startTx: 0,
    startTy: 0,
    startTime: 0,
    moved: 0,
    vw: 0,
    vh: 0,
  });
  const tapTimer = useRef<number | undefined>(undefined);

  // 打开时锁背景滚动
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      if (tapTimer.current) window.clearTimeout(tapTimer.current);
    };
  }, []);

  // 把 track 定位到当前页
  const applyTrack = (offsetX: number, animate: boolean) => {
    const el = trackRef.current;
    if (!el) return;
    const vw = window.innerWidth;
    el.style.transition = animate ? 'transform 0.25s ease-out' : 'none';
    el.style.transform = `translate3d(${-pageRef.current * vw + offsetX}px,0,0)`;
  };

  // 把缩放/平移写到当前图
  const applyImg = (animate: boolean) => {
    const img = imgMap.current.get(pageRef.current);
    if (!img) return;
    img.style.transition = animate ? 'transform 0.25s ease-out' : 'none';
    img.style.transform = `translate3d(${t.current.tx}px,${t.current.ty}px,0) scale(${t.current.scale})`;
  };

  // 挂载时把 track 定位到起始页(无动画);之后翻页由导航函数带动画归位
  useLayoutEffect(() => {
    applyTrack(0, false);
    applyImg(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetZoom = (animate: boolean) => {
    t.current = { scale: 1, tx: 0, ty: 0 };
    applyImg(animate);
  };

  const clampPan = () => {
    const { scale } = t.current;
    const maxX = Math.max(0, ((scale - 1) * window.innerWidth) / 2);
    const maxY = Math.max(0, ((scale - 1) * window.innerHeight) / 2);
    t.current.tx = Math.min(maxX, Math.max(-maxX, t.current.tx));
    t.current.ty = Math.min(maxY, Math.max(-maxY, t.current.ty));
  };

  const dist = (a: RTouch, b: RTouch) =>
    Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  const doubleTap = (x: number, y: number) => {
    if (t.current.scale > 1) {
      resetZoom(true);
    } else {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      t.current.scale = ZOOM_SCALE;
      t.current.tx = -(x - vw / 2) * (ZOOM_SCALE - 1);
      t.current.ty = -(y - vh / 2) * (ZOOM_SCALE - 1);
      clampPan();
      applyImg(true);
    }
  };

  const onTouchStart = (e: RTouchEvent) => {
    const gs = g.current;
    if (e.touches.length === 2) {
      gs.mode = 'pinch';
      gs.startDist = dist(e.touches[0], e.touches[1]);
      gs.startScale = t.current.scale;
      gs.startTx = t.current.tx;
      gs.startTy = t.current.ty;
      return;
    }
    const tch = e.touches[0];
    gs.mode = t.current.scale > 1 ? 'pan' : 'decide';
    gs.startX = gs.lastX = tch.clientX;
    gs.startY = gs.lastY = tch.clientY;
    gs.startTx = t.current.tx;
    gs.startTy = t.current.ty;
    gs.startTime = Date.now();
    gs.moved = 0;
    gs.vw = window.innerWidth;
    gs.vh = window.innerHeight;
  };

  const onTouchMove = (e: RTouchEvent) => {
    const gs = g.current;

    // 双指缩放
    if (gs.mode === 'pinch' && e.touches.length === 2) {
      const d = dist(e.touches[0], e.touches[1]);
      let s = (d / (gs.startDist || 1)) * gs.startScale;
      s = Math.min(MAX_SCALE, Math.max(1, s));
      t.current.scale = s;
      clampPan();
      applyImg(false);
      return;
    }

    if (e.touches.length !== 1) return;
    const tch = e.touches[0];
    gs.lastX = tch.clientX;
    gs.lastY = tch.clientY;
    const dx = tch.clientX - gs.startX;
    const dy = tch.clientY - gs.startY;
    gs.moved = Math.max(gs.moved, Math.abs(dx) + Math.abs(dy));

    // 已放大 → 单指平移图片
    if (gs.mode === 'pan') {
      t.current.tx = gs.startTx + dx;
      t.current.ty = gs.startTy + dy;
      clampPan();
      applyImg(false);
      return;
    }

    // 未放大 → 判定横滑翻页 or 下拉关闭
    if (gs.mode === 'decide') {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        gs.mode = Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'dismiss';
      }
    }
    if (gs.mode === 'swipe') {
      // 到边界时给点阻尼
      let off = dx;
      const atStart = pageRef.current === 0 && dx > 0;
      const atEnd = pageRef.current === images.length - 1 && dx < 0;
      if (atStart || atEnd) off = dx * 0.35;
      applyTrack(off, false);
    } else if (gs.mode === 'dismiss') {
      const el = rootRef.current;
      if (el) {
        const k = Math.max(0, dy);
        el.style.background = `rgba(0,0,0,${Math.max(0.2, 1 - k / 400)})`;
        const track = trackRef.current;
        if (track) {
          track.style.transition = 'none';
          track.style.transform = `translate3d(${-pageRef.current * gs.vw}px,${k}px,0) scale(${Math.max(0.85, 1 - k / 1200)})`;
        }
      }
    }
  };

  const onTouchEnd = (e: RTouchEvent) => {
    const gs = g.current;

    if (gs.mode === 'pinch') {
      if (t.current.scale <= 1.02) resetZoom(true);
      // 还有一根手指留着 → 转入平移
      gs.mode = e.touches.length === 1 ? 'pan' : 'idle';
      if (gs.mode === 'pan' && e.touches.length === 1) {
        const tch = e.touches[0];
        gs.startX = gs.lastX = tch.clientX;
        gs.startY = gs.lastY = tch.clientY;
        gs.startTx = t.current.tx;
        gs.startTy = t.current.ty;
      }
      return;
    }

    // 点按(几乎没移动且时间短)→ 处理单击关闭 / 双击缩放
    const isTap = gs.moved < 10 && Date.now() - gs.startTime < 300;
    if (isTap && (gs.mode === 'decide' || gs.mode === 'pan')) {
      if (tapTimer.current) {
        window.clearTimeout(tapTimer.current);
        tapTimer.current = undefined;
        doubleTap(gs.startX, gs.startY);
      } else {
        tapTimer.current = window.setTimeout(() => {
          tapTimer.current = undefined;
          if (t.current.scale === 1) onClose();
        }, 280);
      }
      gs.mode = 'idle';
      return;
    }

    const endX = e.changedTouches[0]?.clientX ?? gs.lastX;
    const endY = e.changedTouches[0]?.clientY ?? gs.lastY;

    if (gs.mode === 'swipe') {
      const dx = endX - gs.startX;
      const threshold = gs.vw * 0.2;
      let next = pageRef.current;
      if (dx < -threshold && pageRef.current < images.length - 1) next++;
      else if (dx > threshold && pageRef.current > 0) next--;
      if (next !== pageRef.current) {
        resetZoom(false); // 先把当前页缩放归位
        setPage(next); // pageRef 同步更新
        applyTrack(0, true); // 带动画滑到新页
        applyImg(false); // 新页图片按 identity 就位
      } else {
        applyTrack(0, true); // 没过阈值,弹回当前页
      }
    } else if (gs.mode === 'dismiss') {
      const dy = endY - gs.startY;
      const el = rootRef.current;
      if (dy > 110) {
        onClose();
      } else {
        if (el) el.style.background = 'rgba(0,0,0,1)';
        const track = trackRef.current;
        if (track) {
          track.style.transition = 'transform 0.25s ease-out';
          track.style.transform = `translate3d(${-pageRef.current * gs.vw}px,0,0)`;
        }
      }
    }
    gs.mode = 'idle';
  };

  const go = (delta: number) => {
    const next = pageRef.current + delta;
    if (next < 0 || next > images.length - 1) return;
    resetZoom(false);
    setPage(next);
    applyTrack(0, true);
    applyImg(false);
  };

  // 控制按钮:阻止触摸冒泡到 root,避免被识别成「单击关闭」
  const stopTouch = (e: RTouchEvent) => e.stopPropagation();

  return createPortal(
    <div
      ref={rootRef}
      className="lightbox"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="lb-track" ref={trackRef}>
        {images.map((fn, i) => (
          <div className="lb-slide" key={i}>
            <img
              ref={(el) => {
                if (el) imgMap.current.set(i, el);
                else imgMap.current.delete(i);
              }}
              src={`/uploads/${fn}`}
              alt=""
              draggable={false}
            />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <div className="lb-count">
          {page + 1} / {images.length}
        </div>
      )}

      <button
        className="lb-close"
        onClick={onClose}
        onTouchStart={stopTouch}
        onTouchEnd={stopTouch}
        aria-label="关闭"
      >
        ×
      </button>

      {images.length > 1 && page > 0 && (
        <button
          className="lb-nav prev"
          onClick={() => go(-1)}
          onTouchStart={stopTouch}
          onTouchEnd={stopTouch}
          aria-label="上一张"
        >
          ‹
        </button>
      )}
      {images.length > 1 && page < images.length - 1 && (
        <button
          className="lb-nav next"
          onClick={() => go(1)}
          onTouchStart={stopTouch}
          onTouchEnd={stopTouch}
          aria-label="下一张"
        >
          ›
        </button>
      )}
    </div>,
    document.body
  );
}
