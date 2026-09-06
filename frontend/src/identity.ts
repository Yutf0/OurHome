// ============================================================
// 统一身份模块
//
// 「这台手机是谁」在本地(localStorage)只存一份,键沿用推送用的
// love-app-owner —— 于是「发布日常的署名」与「推送发给谁」共用同一个
// 身份:在助理页设一次,发布时自动署名,推送也自动只推给对方。
//
// 两个人的身份:
//   me  → 狗奴才
//   her → 幸幸陛下
// ============================================================
import type { Author } from './types';
import { api } from './api';

const IDENTITY_KEY = 'love-app-owner';

export const IDENTITY_LABEL: Record<Author, string> = {
  me: '狗奴才',
  her: '幸幸陛下',
};

/** 读取本机身份;从未设置过返回 null(用于冷启动判断) */
export function getIdentity(): Author | null {
  const v = localStorage.getItem(IDENTITY_KEY);
  return v === 'me' || v === 'her' ? v : null;
}

/** 读取本机身份,未设置时给个默认(狗奴才) */
export function getIdentityOr(def: Author = 'me'): Author {
  return getIdentity() ?? def;
}

/** 落地本机身份 */
export function setIdentity(a: Author): void {
  localStorage.setItem(IDENTITY_KEY, a);
}

/**
 * 身份变更后,若本机已开启推送订阅,顺带把订阅的 owner 更新到服务器,
 * 让「推送发给谁」跟随身份一起改。没有订阅 / 环境不支持时静默跳过,
 * 绝不因为这一步失败影响主流程。
 */
export async function syncPushOwner(owner: Author): Promise<void> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api.pushSubscribe(owner, sub.toJSON() as PushSubscriptionJSON);
    }
  } catch {
    /* 忽略:推送同步失败不影响身份本身已保存 */
  }
}
