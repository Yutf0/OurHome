import { useEffect, useState } from 'react';
import { api } from '../api';
import { displayImg, type Clothes, type ClothesCategory } from '../types';

// 参与搭配的三个部位，自上而下排列
const SLOTS: Array<{ cat: ClothesCategory; label: string; icon: string }> = [
  { cat: 'top', label: '上衣', icon: '👚' },
  { cat: 'pants', label: '裤子', icon: '👖' },
  { cat: 'shoes', label: '鞋子', icon: '👟' },
];

interface Props {
  onClose: () => void;
}

export default function OutfitMatch({ onClose }: Props) {
  // 每个大类的全部物品（进入时一次性拉取）
  const [pool, setPool] = useState<Record<string, Clothes[]>>({});
  const [loading, setLoading] = useState(true);
  // 当前每个部位选中的物品
  const [picked, setPicked] = useState<Record<string, Clothes | null>>({
    top: null,
    pants: null,
    shoes: null,
  });
  // 正在挑选哪个部位（null 表示选择层未打开）
  const [picking, setPicking] = useState<ClothesCategory | null>(null);

  useEffect(() => {
    Promise.all(SLOTS.map((s) => api.listClothes({ category: s.cat })))
      .then((lists) => {
        const p: Record<string, Clothes[]> = {};
        SLOTS.forEach((s, i) => {
          p[s.cat] = lists[i];
        });
        setPool(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const choose = (cat: ClothesCategory, item: Clothes) => {
    setPicked((p) => ({ ...p, [cat]: item }));
    setPicking(null);
  };

  const randomize = () => {
    setPicked((p) => {
      const next = { ...p };
      for (const s of SLOTS) {
        const list = pool[s.cat] ?? [];
        if (list.length) next[s.cat] = list[Math.floor(Math.random() * list.length)];
      }
      return next;
    });
  };

  const clearAll = () => setPicked({ top: null, pants: null, shoes: null });

  const hasAny = SLOTS.some((s) => (pool[s.cat] ?? []).length > 0);
  const pickingSlot = SLOTS.find((s) => s.cat === picking);
  const pickingList = picking ? pool[picking] ?? [] : [];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="match-card" onClick={(e) => e.stopPropagation()}>
        <div className="match-head">
          <span className="match-title">今日搭配</span>
          <button className="card-del" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        {loading ? (
          <div className="hint">加载中...</div>
        ) : (
          <div className="match-slots">
            {SLOTS.map((s) => {
              const item = picked[s.cat];
              const count = (pool[s.cat] ?? []).length;
              return (
                <button
                  key={s.cat}
                  className={`match-slot ${item ? 'filled' : ''}`}
                  onClick={() => setPicking(s.cat)}
                >
                  {item && displayImg(item) ? (
                    <img src={`/uploads/${displayImg(item)}`} alt="" />
                  ) : item ? (
                    <div className="match-slot-emoji">{s.icon}</div>
                  ) : (
                    <div className="match-slot-empty">
                      <span className="match-slot-icon">{s.icon}</span>
                      <span>{count ? `选择${s.label}` : `还没有${s.label}，请添加`}</span>
                    </div>
                  )}
                  {item && <div className="match-slot-name">{item.name || s.label}</div>}
                  <span className="match-slot-tag">{s.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="c-actions match-actions">
          <button className="ghost" onClick={clearAll}>
            清空
          </button>
          <div className="spacer" />
          <button className="primary" onClick={randomize} disabled={!hasAny}>
            🎲 随机搭配
          </button>
        </div>
      </div>

      {/* 第二层：从已存储的该品类中挑选 */}
      {picking && pickingSlot && (
        <div className="overlay picker-layer" onClick={() => setPicking(null)}>
          <div className="picker-card" onClick={(e) => e.stopPropagation()}>
            <div className="match-head">
              <span className="match-title">
                选择{pickingSlot.label}（{pickingList.length} 件）
              </span>
              <button
                className="card-del"
                onClick={() => setPicking(null)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>

            {pickingList.length === 0 ? (
              <div className="picker-empty">
                <div className="picker-empty-icon">{pickingSlot.icon}</div>
                <p>衣柜里还没有{pickingSlot.label}</p>
                <p className="picker-empty-sub">请先回衣柜添加一件吧 ♡</p>
              </div>
            ) : (
              <div className="picker-grid">
                {pickingList.map((c) => {
                  const src = displayImg(c);
                  const usingCut = Boolean(c.use_cutout && c.cutout);
                  return (
                    <button
                      key={c.id}
                      className={`picker-item ${picked[picking]?.id === c.id ? 'on' : ''} ${
                        usingCut ? 'cut' : ''
                      }`}
                      onClick={() => choose(picking, c)}
                    >
                      {src ? (
                        <img src={`/uploads/${src}`} alt="" loading="lazy" />
                      ) : (
                        <div className="picker-item-ph">{pickingSlot.icon}</div>
                      )}
                      <span className="picker-item-name">{c.name || '未命名'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
