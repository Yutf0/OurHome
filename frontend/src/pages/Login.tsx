import { useState } from 'react';
import { api } from '../api';

interface Props {
  onSuccess: () => void;
}

export default function Login({ onSuccess }: Props) {
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      await api.login(pwd);
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '出错了');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-avatar">
          <img src="/login-cat.jpg" alt="小猫头像" />
          <span aria-hidden="true">♡</span>
        </div>
        <h1>我们的小屋</h1>
        <p className="login-sub">记录属于我们的每一天</p>
        <input
          type="password"
          placeholder="请输入暗号"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />
        {err && <div className="login-err">{err}</div>}
        <button onClick={submit} disabled={busy}>
          {busy ? '...' : '进入小屋'}
        </button>
      </div>
    </div>
  );
}
