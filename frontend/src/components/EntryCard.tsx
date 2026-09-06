import { useState } from 'react';
import Lightbox from './Lightbox';
import { api } from '../api';
import { getIdentityOr, IDENTITY_LABEL } from '../identity';
import type { Entry, Comment, Author } from '../types';

interface Props {
  entry: Entry;
  onDelete: () => void;
}

function formatTime(s: string | null): string {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShort(s: string): string {
  const d = new Date(s.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EntryCard({ entry, onDelete }: Props) {
  const imgs = entry.attachments.filter((a) => a.kind === 'image');
  const audios = entry.attachments.filter((a) => a.kind === 'audio');

  const [viewer, setViewer] = useState<number | null>(null);
  const fullImages = imgs.map((a) => a.filename);

  // 评论:初始来自服务端,本地增删即时更新
  const me: Author = getIdentityOr('me');
  const [comments, setComments] = useState<Comment[]>(entry.comments ?? []);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const c = await api.addComment(entry.id, me, t);
      setComments((list) => [...list, c]);
      setText('');
    } catch (e) {
      alert('评论失败：' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  };

  const removeComment = async (id: number) => {
    if (!confirm('删除这条评论？')) return;
    try {
      await api.deleteComment(id);
      setComments((list) => list.filter((c) => c.id !== id));
    } catch (e) {
      alert('删除失败：' + (e instanceof Error ? e.message : ''));
    }
  };

  return (
    <article className="card">
      <div className="card-head">
        <span className={`who-tag ${entry.author}`}>
          {IDENTITY_LABEL[entry.author]}
        </span>
        <span className="card-time">{formatTime(entry.created_at)}</span>
        <button className="card-del" onClick={onDelete} aria-label="删除">
          ×
        </button>
      </div>

      {entry.title && <h3 className="card-title">{entry.title}</h3>}
      {entry.content && <p className="card-body">{entry.content}</p>}

      {imgs.length > 0 && (
        <div className={`gallery g-${Math.min(imgs.length, 3)}`}>
          {imgs.map((a, i) => (
            <button
              key={a.id ?? i}
              className="gallery-cell"
              onClick={() => setViewer(i)}
              aria-label={`查看第 ${i + 1} 张图片`}
            >
              <img src={`/uploads/${a.thumb || a.filename}`} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {audios.map((a, i) => (
        <audio
          key={a.id ?? i}
          controls
          src={`/uploads/${a.filename}`}
          className="card-audio"
        />
      ))}

      {/* 评论区 */}
      <div className="cmt">
        <button className="cmt-toggle" onClick={() => setOpen((v) => !v)}>
          💬 {comments.length > 0 ? `${comments.length} 条评论` : '评论'}
          <span className={`cmt-arrow ${open ? 'up' : ''}`}>▾</span>
        </button>

        {open && (
          <div className="cmt-panel">
            {comments.length > 0 && (
              <ul className="cmt-list">
                {comments.map((c) => (
                  <li className="cmt-item" key={c.id}>
                    <span className={`who-tag sm ${c.author}`}>
                      {IDENTITY_LABEL[c.author]}
                    </span>
                    <div className="cmt-main">
                      <div className="cmt-text">{c.content}</div>
                      <div className="cmt-meta">
                        <span>{formatShort(c.created_at)}</span>
                        {c.author === me && (
                          <button
                            className="cmt-del"
                            onClick={() => removeComment(c.id)}
                          >
                            删除
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="cmt-input">
              <input
                type="text"
                placeholder={`以「${IDENTITY_LABEL[me]}」的身份评论…`}
                value={text}
                maxLength={300}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') send();
                }}
              />
              <button
                className="primary"
                onClick={send}
                disabled={busy || !text.trim()}
              >
                {busy ? '发送中' : '发送'}
              </button>
            </div>
          </div>
        )}
      </div>

      {viewer !== null && (
        <Lightbox
          images={fullImages}
          startIndex={viewer}
          onClose={() => setViewer(null)}
        />
      )}
    </article>
  );
}
