import { useState } from 'react';
import { api } from '../api';
import AudioRecorder from './AudioRecorder';
import { getIdentity, setIdentity, syncPushOwner, IDENTITY_LABEL } from '../identity';
import type { AttachmentRef, Author } from '../types';

const MAX_CONTENT = 200;

interface Props {
  onDone: () => void;
  onCancel: () => void;
}

export default function NewEntry({ onDone, onCancel }: Props) {
  // 默认用本机已设置的身份发布;从未设过则先给 me,并让选择器显示出来
  const savedIdentity = getIdentity();
  const [author, setAuthor] = useState<Author>(savedIdentity ?? 'me');
  // 设过身份 → 默认收起选择器(自动发布);没设过 → 展开让其选一次
  const [pickOpen, setPickOpen] = useState<boolean>(savedIdentity === null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [atts, setAtts] = useState<AttachmentRef[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 选择/切换身份:立即落库,并让推送 owner 跟随(保持两处一致)
  const chooseIdentity = (a: Author) => {
    setAuthor(a);
    setIdentity(a);
    void syncPushOwner(a);
    setPickOpen(false);
  };

  const addImages = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const res = await api.upload(f);
        setAtts((a) => [...a, res]);
      }
    } catch (e) {
      alert('图片上传失败：' + (e instanceof Error ? e.message : ''));
    } finally {
      setUploading(false);
    }
  };

  const addAudio = async (blob: Blob) => {
    setUploading(true);
    try {
      const file = new File([blob], `voice_${Date.now()}.webm`, {
        type: blob.type || 'audio/webm',
      });
      const res = await api.upload(file);
      setAtts((a) => [...a, res]);
    } catch (e) {
      alert('录音上传失败：' + (e instanceof Error ? e.message : ''));
    } finally {
      setUploading(false);
    }
  };

  const removeAtt = (i: number) => setAtts((a) => a.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!content.trim() && !title.trim() && atts.length === 0) {
      alert('写点什么，或者加张图吧 ♡');
      return;
    }
    // 发布前把当前身份记牢(冷启动首次发布也能记住,下次自动)
    setIdentity(author);
    setBusy(true);
    try {
      await api.createEntry({ author, title, content, attachments: atts });
      onDone();
    } catch (e) {
      alert('保存失败：' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="composer">
      {pickOpen ? (
        <div className="who">
          <button
            className={author === 'me' ? 'on' : ''}
            onClick={() => chooseIdentity('me')}
          >
            {IDENTITY_LABEL.me}
          </button>
          <button
            className={author === 'her' ? 'on' : ''}
            onClick={() => chooseIdentity('her')}
          >
            {IDENTITY_LABEL.her}
          </button>
        </div>
      ) : (
        <div className="who-current">
          以「<b>{IDENTITY_LABEL[author]}</b>」的身份发布
          <button className="who-switch" onClick={() => setPickOpen(true)}>
            切换
          </button>
        </div>
      )}

      <input
        className="c-title"
        placeholder="标题（可留空）"
        value={title}
        maxLength={50}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="c-body"
        placeholder="此刻想说的话…（200 字以内）"
        rows={4}
        value={content}
        maxLength={MAX_CONTENT}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className={`counter ${content.length >= MAX_CONTENT ? 'full' : ''}`}>
        {content.length}/{MAX_CONTENT}
      </div>

      {atts.length > 0 && (
        <div className="att-preview">
          {atts.map((a, i) => (
            <div className="att" key={i}>
              {a.kind === 'image' ? (
                <img src={`/uploads/${a.thumb || a.filename}`} alt="" />
              ) : (
                <div className="att-audio">🎵</div>
              )}
              <button className="att-x" onClick={() => removeAtt(i)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {uploading && <div className="hint">上传中...</div>}

      <div className="c-actions">
        <label className="tool">
          📷 图片
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => addImages(e.target.files)}
          />
        </label>
        <AudioRecorder onRecorded={addAudio} />
        <div className="spacer" />
        <button className="ghost" onClick={onCancel}>
          取消
        </button>
        <button className="primary" onClick={save} disabled={busy || uploading}>
          {busy ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
