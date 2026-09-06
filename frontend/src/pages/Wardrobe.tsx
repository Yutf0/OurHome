import { useEffect, useState } from 'react';
import { api } from '../api';
import OutfitMatch from '../components/OutfitMatch';
import { displayImg, type Clothes, type ClothesCategory, type JewelrySub } from '../types';

const CATS: Array<{ key: '' | ClothesCategory; label: string; icon: string }> = [
  { key: '', label: '全部', icon: '🧺' },
  { key: 'top', label: '上衣', icon: '👚' },
  { key: 'pants', label: '裤子', icon: '👖' },
  { key: 'shoes', label: '鞋子', icon: '👟' },
  { key: 'jewelry', label: '首饰', icon: '💍' },
  { key: 'accessory', label: '配饰', icon: '🎀' },
];
const SUBS: Array<{ key: '' | JewelrySub; label: string }> = [
  { key: '', label: '全部首饰' },
  { key: 'bracelet', label: '手链' },
  { key: 'necklace', label: '项链' },
  { key: 'earring', label: '耳饰' },
];
const CAT_EMOJI: Record<string, string> = {
  top: '👚',
  pants: '👖',
  shoes: '👟',
  jewelry: '💍',
  accessory: '🎀',
};

export function catLabel(c: Clothes): string {
  const cat = CATS.find((x) => x.key === c.category)?.label ?? c.category;
  if (c.category === 'jewelry' && c.subcategory) {
    const sub = SUBS.find((x) => x.key === c.subcategory)?.label;
    return sub ? `${cat} · ${sub}` : cat;
  }
  return cat;
}

export default function Wardrobe() {
  const [cat, setCat] = useState<'' | ClothesCategory>('');
  const [sub, setSub] = useState<'' | JewelrySub>('');
  const [q, setQ] = useState('');
  const [activeQ, setActiveQ] = useState('');
  const [list, setList] = useState<Clothes[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [sel, setSel] = useState<Clothes | null>(null);
  const [matching, setMatching] = useState(false);

  const load = (query?: string) => {
    setLoading(true);
    api
      .listClothes({ category: cat, sub: cat === 'jewelry' ? sub : '', q: query ?? activeQ })
      .then(setList)
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, sub]);

  // v0.5: 只要列表里还有「抠图中」的物品,每 3 秒静默刷新一次,抠好自动出图
  useEffect(() => {
    if (!list.some((c) => c.cutout_status === 'pending')) return;
    const t = window.setInterval(() => {
      api
        .listClothes({ category: cat, sub: cat === 'jewelry' ? sub : '', q: activeQ })
        .then(setList)
        .catch(() => {});
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, cat, sub, activeQ]);

  const doSearch = () => {
    setActiveQ(q);
    load(q);
  };
  const clearSearch = () => {
    setQ('');
    setActiveQ('');
    load('');
  };

  return (
    <>
      <header className="topbar">
        <div className="brand">衣柜</div>
        <button className="match-btn" onClick={() => setMatching(true)}>
          ✨ 搭配
        </button>
      </header>

      <main className="page">
        <form
          className="searchbar"
          onSubmit={(e) => {
            e.preventDefault();
            doSearch();
          }}
        >
          <input
            placeholder="搜备注或名称，比如「显瘦」「约会」"
            value={q}
            onChange={(e) => {
              const v = e.target.value;
              setQ(v);
              // 输入框被清空且当前有生效的搜索词时,自动恢复完整列表
              if (!v.trim() && activeQ) {
                setActiveQ('');
                load('');
              }
            }}
          />
          {activeQ ? (
            <button type="button" className="ghost" onClick={clearSearch}>
              清除
            </button>
          ) : (
            <button type="submit" className="ghost">
              搜索
            </button>
          )}
        </form>

        {/* 分类：横向滚动的大触区图标块 */}
        <div className="cat-scroll">
          {CATS.map((c) => (
            <button
              key={c.key}
              className={`cat-tile ${cat === c.key ? 'on' : ''}`}
              onClick={() => {
                setCat(c.key);
                setSub('');
              }}
            >
              <span className="cat-tile-icon">{c.icon}</span>
              <span className="cat-tile-label">{c.label}</span>
            </button>
          ))}
        </div>

        {cat === 'jewelry' && (
          <div className="chips subchips">
            {SUBS.map((s) => (
              <button
                key={s.key}
                className={`chip ${sub === s.key ? 'on' : ''}`}
                onClick={() => setSub(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {adding ? (
          <AddForm
            defaultCat={cat || 'top'}
            onDone={() => {
              setAdding(false);
              load();
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button className="compose-btn" onClick={() => setAdding(true)}>
            ＋ 收进衣柜
          </button>
        )}

        {loading && <div className="hint">加载中...</div>}
        {!loading && list.length === 0 && (
          <div className="hint">
            {activeQ ? '没找到相关物品' : '衣柜还空着，放进第一件吧 ♡'}
          </div>
        )}

        <div className="wgrid">
          {list.map((c) => {
            // v0.5: 优先展示抠图,有抠图的卡片走完整显示 + 棋盘格底
            const src = displayImg(c);
            const usingCut = Boolean(c.use_cutout && c.cutout);
            return (
              <button
                key={c.id}
                className={`wcard ${usingCut ? 'cut' : ''}`}
                onClick={() => setSel(c)}
              >
                {src ? (
                  <img
                    className="wcard-img"
                    src={`/uploads/${src}`}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <div className="wcard-ph">{CAT_EMOJI[c.category] ?? '🧺'}</div>
                )}
                {c.cutout_status === 'pending' && (
                  <span className="wcard-badge">抠图中…</span>
                )}
                {c.cutout_status === 'failed' && (
                  <span className="wcard-badge fail">抠图失败</span>
                )}
                <div className="wcard-info">
                  <div className="wcard-name">{c.name || '未命名'}</div>
                  <div className="wcard-cat">{catLabel(c)}</div>
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {matching && <OutfitMatch onClose={() => setMatching(false)} />}

      {sel && (
        <Detail
          item={sel}
          onClose={() => setSel(null)}
          onChanged={() => {
            setSel(null);
            load();
          }}
        />
      )}
    </>
  );
}

/* ---- 新增物品表单 ---- */
function AddForm({
  defaultCat,
  onDone,
  onCancel,
}: {
  defaultCat: ClothesCategory;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<ClothesCategory>(defaultCat);
  const [subcategory, setSubcategory] = useState<JewelrySub>('bracelet');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<{ filename: string; thumb?: string | null } | null>(
    null
  );
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const pickPhoto = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    setUploading(true);
    try {
      const res = await api.upload(files[0]);
      setPhoto({ filename: res.filename, thumb: res.thumb });
    } catch (e) {
      alert('照片上传失败：' + (e instanceof Error ? e.message : ''));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.createClothes({
        category,
        subcategory: category === 'jewelry' ? subcategory : null,
        name,
        note,
        photo: photo?.filename ?? null,
        thumb: photo?.thumb ?? null,
      });
      onDone();
    } catch (e) {
      alert('保存失败：' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="composer">
      <label className="photo-pick">
        {photo ? (
          <img src={`/uploads/${photo.thumb || photo.filename}`} alt="" />
        ) : (
          <span>{uploading ? '上传中…' : '📷 拍一张 / 选照片'}</span>
        )}
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => pickPhoto(e.target.files)}
        />
      </label>

      <div className="formrow">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ClothesCategory)}
        >
          <option value="top">上衣</option>
          <option value="pants">裤子</option>
          <option value="shoes">鞋子</option>
          <option value="jewelry">首饰</option>
          <option value="accessory">其他配饰</option>
        </select>
        {category === 'jewelry' && (
          <select
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value as JewelrySub)}
          >
            <option value="bracelet">手链</option>
            <option value="necklace">项链</option>
            <option value="earring">耳饰</option>
          </select>
        )}
      </div>

      <input
        className="c-title"
        placeholder="名称，比如「白色泡泡袖衬衫」"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
      />
      <textarea
        className="c-body"
        placeholder="备注：颜色、季节、什么场合穿…（以后就靠它搜）"
        rows={3}
        maxLength={200}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="c-actions">
        <div className="spacer" />
        <button className="ghost" onClick={onCancel}>
          取消
        </button>
        <button className="primary" onClick={save} disabled={busy || uploading}>
          {busy ? '保存中...' : '收入衣柜'}
        </button>
      </div>
    </div>
  );
}

/* ---- 物品详情 ---- */
function Detail({
  item,
  onClose,
  onChanged,
}: {
  item: Clothes;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState(item.name ?? '');
  const [note, setNote] = useState(item.note ?? '');
  const [busy, setBusy] = useState(false);
  // 预览哪张图:抠图存在且启用时默认看抠图,否则看原图
  const [viewCut, setViewCut] = useState<boolean>(Boolean(item.use_cutout && item.cutout));
  // 本地记录 use_cutout 状态(点按钮立即生效并落库)
  const [useCut, setUseCut] = useState<boolean>(Boolean(item.use_cutout));

  const save = async () => {
    setBusy(true);
    try {
      await api.updateClothes(item.id, { name, note });
      onChanged();
    } catch (e) {
      alert('保存失败：' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm('确定把这件从衣柜里删掉吗？')) return;
    await api.deleteClothes(item.id);
    onChanged();
  };

  // 切换展示用图(抠图 / 原图),立即落库
  const applyUseCut = async (use: boolean) => {
    setUseCut(use);
    setViewCut(use && Boolean(item.cutout));
    try {
      await api.setUseCutout(item.id, use);
    } catch (e) {
      alert('切换失败：' + (e instanceof Error ? e.message : ''));
    }
  };

  // 重新抠图:入队后关闭弹层,列表上会显示「抠图中…」并自动刷新
  const recut = async () => {
    try {
      await api.recutClothes(item.id);
      onChanged();
    } catch (e) {
      alert('操作失败：' + (e instanceof Error ? e.message : ''));
    }
  };

  const showCutImg = viewCut && item.cutout;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
        {showCutImg ? (
          <img
            className="overlay-img checker"
            src={`/uploads/${item.cutout}`}
            alt=""
          />
        ) : item.photo ? (
          <img className="overlay-img" src={`/uploads/${item.photo}`} alt="" />
        ) : (
          <div className="overlay-ph">{CAT_EMOJI[item.category] ?? '🧺'}</div>
        )}

        {/* 抠图控制区 */}
        {item.cutout ? (
          <div className="cut-bar">
            <div className="cut-toggle">
              <button
                className={`chip ${viewCut ? 'on' : ''}`}
                onClick={() => setViewCut(true)}
              >
                抠图
              </button>
              <button
                className={`chip ${!viewCut ? 'on' : ''}`}
                onClick={() => setViewCut(false)}
              >
                原图
              </button>
            </div>
            <div className="spacer" />
            <button
              className={`chip ${useCut ? 'on' : ''}`}
              onClick={() => applyUseCut(!useCut)}
            >
              {useCut ? '✓ 搭配用抠图' : '搭配用原图中'}
            </button>
            <button className="ghost" onClick={recut}>
              重新抠图
            </button>
          </div>
        ) : item.cutout_status === 'pending' ? (
          <div className="cut-bar">
            <span className="cut-hint">✂️ 正在自动抠图，稍等片刻…</span>
          </div>
        ) : item.cutout_status === 'failed' ? (
          <div className="cut-bar">
            <span className="cut-hint">抠图失败了，可以重试一次</span>
            <div className="spacer" />
            <button className="ghost" onClick={recut}>
              重新抠图
            </button>
          </div>
        ) : null}

        <div className="overlay-cat">{catLabel(item)}</div>
        <input
          className="c-title"
          placeholder="名称"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className="c-body"
          placeholder="备注"
          rows={3}
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="c-actions">
          <button className="ghost danger" onClick={remove}>
            删除
          </button>
          <div className="spacer" />
          <button className="ghost" onClick={onClose}>
            关闭
          </button>
          <button className="primary" onClick={save} disabled={busy}>
            {busy ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
