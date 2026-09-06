import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AnniversaryItem, Holiday } from '../types';

function prettyDate(s: string): string {
  const [y, m, d] = s.split('-');
  return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`;
}

function leftText(daysLeft: number): string {
  if (daysLeft === 0) return '就是今天 ♡';
  if (daysLeft === 1) return '就在明天';
  return `还有 ${daysLeft} 天`;
}

export default function Anniversaries() {
  const [list, setList] = useState<AnniversaryItem[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.listAnniversaries(), api.listHolidays()])
      .then(([a, h]) => {
        setList(a);
        setHolidays(h);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const save = async () => {
    if (!name.trim() || !date) {
      alert('名字和日期都要填哦');
      return;
    }
    setBusy(true);
    try {
      await api.createAnniversary(name.trim(), date);
      setName('');
      setDate('');
      setAdding(false);
      load();
    } catch (e) {
      alert('保存失败：' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('确定删除这个纪念日吗？')) return;
    await api.deleteAnniversary(id);
    load();
  };

  return (
    <>
      <header className="topbar">
        <div className="brand">纪念日</div>
      </header>

      <main className="page">
        {adding ? (
          <div className="composer">
            <input
              className="c-title"
              placeholder="纪念日名字，比如「在一起」「领证」"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="c-title"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <div className="c-actions">
              <div className="spacer" />
              <button className="ghost" onClick={() => setAdding(false)}>
                取消
              </button>
              <button className="primary" onClick={save} disabled={busy}>
                {busy ? '保存中...' : '记下这一天'}
              </button>
            </div>
          </div>
        ) : (
          <button className="compose-btn" onClick={() => setAdding(true)}>
            ＋ 添加纪念日
          </button>
        )}

        {loading && <div className="hint">加载中...</div>}
        {!loading && list.length === 0 && (
          <div className="hint">把重要的日子记下来，我帮你们一起数着 ♡</div>
        )}

        {list.map((a) => (
          <article className="card ann-card" key={a.id}>
            <div className="card-head">
              <h3 className="card-title">{a.name}</h3>
              <button className="card-del" onClick={() => remove(a.id)} aria-label="删除">
                ×
              </button>
            </div>
            <div className="ann-date">{prettyDate(a.date)}</div>

            {a.days >= 0 ? (
              <div className="ann-days">
                已经一起走过 <b>{a.days}</b> 天
                {a.days > 0 && a.days % 100 === 0 && (
                  <span className="ann-today">今天正好是第 {a.days} 天 ♡</span>
                )}
              </div>
            ) : (
              <div className="ann-days">
                还有 <b>{-a.days}</b> 天到来
              </div>
            )}

            <div className="ann-next">
              <div className="ann-next-row">
                <span className="ann-label">下个百天</span>
                <span>
                  第 {a.nextHundred.n} 天 · {prettyDate(a.nextHundred.date)} ·{' '}
                  {leftText(a.nextHundred.daysLeft)}
                </span>
              </div>
              <div className="ann-next-row">
                <span className="ann-label">下个周年</span>
                <span>
                  {a.nextYear.n} 周年 · {prettyDate(a.nextYear.date)} ·{' '}
                  {leftText(a.nextYear.daysLeft)}
                </span>
              </div>
            </div>
          </article>
        ))}

        {holidays.length > 0 && (
          <>
            <div className="section-title">近期的节日</div>
            <div className="card">
              {holidays.map((h) => (
                <div className="holiday-row" key={h.name + h.date}>
                  <span className="holiday-name">{h.name}</span>
                  <span className="holiday-date">{prettyDate(h.date)}</span>
                  <span className={`holiday-left ${h.daysLeft <= 7 ? 'soon' : ''}`}>
                    {leftText(h.daysLeft)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="feed-foot">岁岁年年 ♡ 携手共进</div>
      </main>
    </>
  );
}
