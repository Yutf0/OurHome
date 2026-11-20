import type { SelectedFile } from './types';

interface Props {
  id: string;
  title: string;
  hint: string;
  accept: string;
  files: SelectedFile[];
  multiple?: boolean;
  onAdd: (files: FileList | null) => void;
  onRemove: (id: string) => void;
}

function readableSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function UploadBox({
  id,
  title,
  hint,
  accept,
  files,
  multiple = true,
  onAdd,
  onRemove,
}: Props) {
  return (
    <div className="sl-upload-wrap">
      <label className="sl-upload" htmlFor={id}>
        <span className="sl-upload-icon" aria-hidden="true">＋</span>
        <strong>{title}</strong>
        <span>{hint}</span>
        <input
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(event) => {
            onAdd(event.target.files);
            event.target.value = '';
          }}
        />
      </label>

      {files.length > 0 && (
        <div className="sl-file-list" aria-live="polite">
          {files.map((item, index) => (
            <div className="sl-file" key={item.id}>
              {item.previewUrl ? (
                <img src={item.previewUrl} alt="" />
              ) : (
                <span className="sl-file-doc" aria-hidden="true">PDF</span>
              )}
              <span className="sl-file-copy">
                <strong>{index + 1}. {item.file.name}</strong>
                <small>{readableSize(item.file.size)}</small>
              </span>
              <button type="button" onClick={() => onRemove(item.id)} aria-label={`移除 ${item.file.name}`}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
