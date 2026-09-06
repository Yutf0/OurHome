import type { Entry } from '../types';

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

export default function EntryCard({ entry, onDelete }: Props) {
  const imgs = entry.attachments.filter((a) => a.kind === 'image');
  const audios = entry.attachments.filter((a) => a.kind === 'audio');

  return (
    <article className="card">
      <div className="card-head">
        <span className={`who-tag ${entry.author}`}>
          {entry.author === 'her' ? '幸幸陛下' : '狗奴才'}
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
            <a
              key={a.id ?? i}
              href={`/uploads/${a.filename}`}
              target="_blank"
              rel="noreferrer"
            >
              <img src={`/uploads/${a.thumb || a.filename}`} alt="" loading="lazy" />
            </a>
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
    </article>
  );
}
