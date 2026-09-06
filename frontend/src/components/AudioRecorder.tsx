import { useRef, useState } from 'react';

const MAX_SECONDS = 30;

interface Props {
  onRecorded: (blob: Blob) => void;
}

export default function AudioRecorder({ onRecorded }: Props) {
  const [recording, setRecording] = useState(false);
  const [sec, setSec] = useState(0);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const secRef = useRef(0);

  const stop = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mrRef.current?.stop();
    setRecording(false);
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mr.mimeType || 'audio/webm',
        });
        onRecorded(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mrRef.current = mr;
      secRef.current = 0;
      setSec(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        secRef.current += 1;
        setSec(secRef.current);
        if (secRef.current >= MAX_SECONDS) stop();
      }, 1000);
    } catch {
      alert('无法访问麦克风，请检查浏览器权限（需要 https 或 localhost）');
    }
  };

  return (
    <button
      type="button"
      className={`tool ${recording ? 'rec' : ''}`}
      onClick={recording ? stop : start}
    >
      {recording ? `■ ${sec}s / ${MAX_SECONDS}s` : '🎤 录音'}
    </button>
  );
}
