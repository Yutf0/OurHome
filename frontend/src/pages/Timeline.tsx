import { useEffect, useState } from 'react';
import { api } from '../api';
import NewEntry from '../components/NewEntry';
import EntryCard from '../components/EntryCard';
import type { Entry } from '../types';

interface Props {
  onLogout: () => void;
}

export default function Timeline({ onLogout }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [q, setQ] = useState('');
  const [activeQ, setActiveQ] = useState('');

  const load = (query: string) => {
    setLoading(true);
    api
      .listEntries(query)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => load(''), []);

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
    await api.logout();
    onLogout();
  };

  const remove = async (id: number) => {
    if (!confirm('确定删掉这条回忆吗？')) return;
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
          <EntryCard key={e.id} entry={e} onDelete={() => remove(e.id)} />
        ))}

        <div className="feed-foot">forever ♡ and always</div>
      </main>
    </>
  );
}
