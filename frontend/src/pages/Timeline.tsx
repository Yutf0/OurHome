import { useEffect, useState } from 'react';
import { api } from '../api';
import NewEntry from '../components/NewEntry';
import EntryCard from '../components/EntryCard';
import type { Entry } from '../types';

interface Props {
  onLogout: () => void;
  preview?: boolean;
}

const PREVIEW_ENTRY: Entry = {
  id: 99001,
  author: 'her',
  title: '晚风、热栗子，还有我们',
  content: '散步的时候风有点凉，但刚出炉的栗子很暖。以后看到这个地点，就会想起今天。',
  mood: null,
  created_at: '2026-11-20 11:26:00',
  location_name: '西湖边 · 北山街',
  latitude: 30.25932,
  longitude: 120.14845,
  attachments: [],
  comments: [
    {
      id: 99101,
      author: 'me',
      content: '下次还要沿着湖边慢慢走。',
      created_at: '2026-11-20 11:31:00',
      like_authors: ['her'],
    },
  ],
};

export default function Timeline({ onLogout, preview = false }: Props) {
  const [entries, setEntries] = useState<Entry[]>(preview ? [PREVIEW_ENTRY] : []);
  const [loading, setLoading] = useState(!preview);
  const [composing, setComposing] = useState(false);
  const [q, setQ] = useState('');
  const [activeQ, setActiveQ] = useState('');

  const load = (query: string) => {
    if (preview) {
      const normalized = query.trim().toLowerCase();
      setEntries(
        !normalized || JSON.stringify(PREVIEW_ENTRY).toLowerCase().includes(normalized)
          ? [PREVIEW_ENTRY]
          : []
      );
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .listEntries(query)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => load(''), [preview]);

  const doSearch = () => {
    setActiveQ(q);
    load(q);
  };
  const clearSearch = () => {
    setQ('');
    setActiveQ('');
    load('');
  };

  const logout = async () => {
    if (preview) {
      onLogout();
      return;
    }
    await api.logout();
    onLogout();
  };

  const remove = async (id: number) => {
    if (!confirm('确定删掉这条回忆吗？')) return;
    if (preview) {
      setEntries((list) => list.filter((e) => e.id !== id));
      return;
    }
    await api.deleteEntry(id);
    setEntries((list) => list.filter((e) => e.id !== id));
  };

  return (
    <>
      <header className="topbar">
        <div className="brand">日常</div>
        <button className="ghost" onClick={logout}>
          退出
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
            placeholder="搜索标题或文案"
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

        {activeQ && (
          <div className="hint">
            「{activeQ}」的搜索结果：{entries.length} 条
          </div>
        )}

        {composing ? (
          <NewEntry
            onDone={() => {
              setComposing(false);
              clearSearch();
            }}
            onCancel={() => setComposing(false)}
          />
        ) : (
          <button className="compose-btn" onClick={() => setComposing(true)}>
            ＋ 记录此刻
          </button>
        )}

        {loading && <div className="hint">加载中...</div>}
        {!loading && entries.length === 0 && !activeQ && (
          <div className="hint">还没有回忆，写下第一条吧 ♡</div>
        )}
        {!loading && entries.length === 0 && activeQ && (
          <div className="hint">没找到相关的记录</div>
        )}

        {entries.map((e) => (
          <EntryCard key={e.id} entry={e} onDelete={() => remove(e.id)} preview={preview} />
        ))}

        <div className="feed-foot">forever ♡ and always</div>
      </main>
    </>
  );
}
