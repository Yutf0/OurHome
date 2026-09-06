import { useEffect, useState } from 'react';
import { api } from '../api';
import { IDENTITY_LABEL } from '../identity';
import type { Author } from '../types';

/** VAPID 公钥是 base64url 字符串,subscribe() 要的是 Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  // 显式基于 ArrayBuffer 构造,满足 PushManager.subscribe 的 BufferSource 类型要求
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** 是否从主屏图标打开(iOS 只有这种情况才允许申请通知权限) */
function isStandalone(): boolean {
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return iosStandalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

type State = 'checking' | 'unsupported' | 'need-install' | 'off' | 'on' | 'denied';

interface Props {
  /** 本机身份,由助理页统一管理并传入;开启订阅时用它作为 owner */
  owner: Author;
}

export default function PushSetup({ owner }: Props) {
  const [state, setState] = useState<State>('checking');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [serverOn, setServerOn] = useState(true);

  useEffect(() => {
    (async () => {
      // 1. 浏览器能力
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setState(isStandalone() ? 'unsupported' : 'need-install');
        return;
      }
      // 2. 服务器是否配了 VAPID 密钥
      try {
        const k = await api.pushKey();
        setServerOn(k.enabled);
        if (!k.enabled) {
          setState('unsupported');
          return;
        }
      } catch {
        setState('unsupported');
        return;
      }
      // 3. 已经拒绝过就没法再弹窗了,只能去系统设置里改
      if (Notification.permission === 'denied') {
        setState('denied');
        return;
      }
      // 4. 看看这台设备是不是已经订阅过
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setEndpoint(sub.endpoint);
        setState('on');
      } else {
        setState('off');
      }
    })().catch(() => setState('unsupported'));
  }, []);

  const enable = async () => {
    setBusy(true);
    setMsg('');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setState(perm === 'denied' ? 'denied' : 'off');
        return;
      }
      const { publicKey } = await api.pushKey();
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      // owner 由助理页的身份卡片统一决定
      await api.pushSubscribe(owner, sub.toJSON() as PushSubscriptionJSON);
      setEndpoint(sub.endpoint);
      setState('on');
      setMsg('开启成功,对方发布新记录时你会收到通知 ♡');
    } catch (e) {
      setMsg('开启失败:' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMsg('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.pushUnsubscribe(sub.endpoint);
        await sub.unsubscribe();
      }
      setEndpoint(null);
      setState('off');
      setMsg('已关闭');
    } catch (e) {
      setMsg('关闭失败:' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setMsg('');
    try {
      await api.pushTest(endpoint ?? undefined);
      setMsg('已发送,稍等一两秒看看锁屏');
    } catch (e) {
      setMsg('发送失败:' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card push-card">
      <h3 className="card-title">🔔 新记录通知</h3>

      {state === 'checking' && <div className="hint">检查中...</div>}

      {state === 'need-install' && (
        <p className="push-tip">
          请先点击浏览器底部的「分享」→「添加到主屏幕」,
          然后<b>从主屏图标打开</b>本应用,再来这里开启通知。
        </p>
      )}

      {state === 'unsupported' && (
        <p className="push-tip">
          {serverOn
            ? '当前环境不支持推送。需要 iOS 16.4 以上、通过 HTTPS 访问、并从主屏图标打开。'
            : '服务器还没配置推送密钥(VAPID),请先完成部署配置。'}
        </p>
      )}

      {state === 'denied' && (
        <p className="push-tip">
          通知权限已被拒绝。请到 iPhone 的「设置 → 通知 → 小屋」里手动打开,
          或删除主屏图标后重新添加。
        </p>
      )}

      {(state === 'off' || state === 'on') && (
        <>
          <p className="push-tip">
            当前身份是「<b>{IDENTITY_LABEL[owner]}</b>」,开启后<b>只有对方</b>
            发布新记录时才会推给这台手机,自己发的不会推给自己。
            身份可在上方「我是谁」处修改。
          </p>

          <div className="c-actions">
            {state === 'on' && (
              <button className="ghost" onClick={test} disabled={busy}>
                发条测试
              </button>
            )}
            <div className="spacer" />
            {state === 'on' ? (
              <button className="ghost danger" onClick={disable} disabled={busy}>
                关闭通知
              </button>
            ) : (
              <button className="primary" onClick={enable} disabled={busy}>
                {busy ? '处理中...' : '开启通知'}
              </button>
            )}
          </div>
        </>
      )}

      {msg && <div className="push-msg">{msg}</div>}
    </div>
  );
}
