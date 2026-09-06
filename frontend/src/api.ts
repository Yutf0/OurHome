import type {
  Entry,
  Comment,
  AttachmentRef,
  Author,
  Clothes,
  ClothesCategory,
  JewelrySub,
  AnniversaryItem,
  Holiday,
} from './types';

async function handle<T>(r: Response): Promise<T> {
  if (r.ok) return (await r.json()) as T;
  const e = (await r.json().catch(() => ({}))) as { error?: string };
  throw new Error(e.error || '出错了');
}

function jsonReq<T>(url: string, method: string, body: unknown): Promise<T> {
  return fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => handle<T>(r));
}

export interface CreateEntryInput {
  author: Author;
  title: string;
  content: string;
  attachments: AttachmentRef[];
}

export interface ClothesInput {
  category: ClothesCategory;
  subcategory?: JewelrySub | null;
  name?: string;
  note?: string;
  photo?: string | null;
  thumb?: string | null;
}

export const api = {
  me: () => fetch('/api/me').then((r) => handle<{ loggedIn: boolean }>(r)),
  login: (password: string) => jsonReq<{ ok: true }>('/api/login', 'POST', { password }),
  logout: () =>
    fetch('/api/logout', { method: 'POST' }).then((r) => handle<{ ok: true }>(r)),

  listEntries: (q?: string) =>
    fetch(`/api/entries${q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`).then(
      (r) => handle<Entry[]>(r)
    ),
  createEntry: (data: CreateEntryInput) =>
    jsonReq<{ id: number }>('/api/entries', 'POST', data),
  deleteEntry: (id: number) =>
    fetch(`/api/entries/${id}`, { method: 'DELETE' }).then((r) => handle<{ ok: true }>(r)),

  addComment: (entryId: number, author: Author, content: string) =>
    jsonReq<Comment>(`/api/entries/${entryId}/comments`, 'POST', { author, content }),
  deleteComment: (id: number) =>
    fetch(`/api/comments/${id}`, { method: 'DELETE' }).then((r) => handle<{ ok: true }>(r)),

  upload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch('/api/upload', { method: 'POST', body: fd }).then((r) =>
      handle<AttachmentRef>(r)
    );
  },

  listClothes: (p: { category?: string; sub?: string; q?: string }) => {
    const sp = new URLSearchParams();
    if (p.category) sp.set('category', p.category);
    if (p.sub) sp.set('sub', p.sub);
    if (p.q && p.q.trim()) sp.set('q', p.q.trim());
    const qs = sp.toString();
    return fetch(`/api/clothes${qs ? `?${qs}` : ''}`).then((r) => handle<Clothes[]>(r));
  },
  createClothes: (data: ClothesInput) =>
    jsonReq<{ id: number }>('/api/clothes', 'POST', data),
  updateClothes: (id: number, data: Partial<ClothesInput>) =>
    jsonReq<{ ok: true }>(`/api/clothes/${id}`, 'PUT', data),
  deleteClothes: (id: number) =>
    fetch(`/api/clothes/${id}`, { method: 'DELETE' }).then((r) => handle<{ ok: true }>(r)),
  recutClothes: (id: number) =>
    fetch(`/api/clothes/${id}/recut`, { method: 'POST' }).then((r) => handle<{ ok: true }>(r)),
  setUseCutout: (id: number, use: boolean) =>
    jsonReq<{ ok: true }>(`/api/clothes/${id}/use-cutout`, 'POST', { use }),

  listAnniversaries: () =>
    fetch('/api/anniversaries').then((r) => handle<AnniversaryItem[]>(r)),
  createAnniversary: (name: string, date: string) =>
    jsonReq<{ id: number }>('/api/anniversaries', 'POST', { name, date }),
  deleteAnniversary: (id: number) =>
    fetch(`/api/anniversaries/${id}`, { method: 'DELETE' }).then((r) =>
      handle<{ ok: true }>(r)
    ),
  listHolidays: () => fetch('/api/holidays').then((r) => handle<Holiday[]>(r)),

  /* ===== 推送 ===== */
  pushKey: () =>
    fetch('/api/push/key').then((r) => handle<{ enabled: boolean; publicKey: string }>(r)),
  pushSubscribe: (owner: Author, subscription: PushSubscriptionJSON) =>
    jsonReq<{ ok: true }>('/api/push/subscribe', 'POST', { owner, subscription }),
  pushUnsubscribe: (endpoint: string) =>
    jsonReq<{ ok: true }>('/api/push/unsubscribe', 'POST', { endpoint }),
  pushTest: (endpoint?: string) =>
    jsonReq<{ ok: true; sent: number }>('/api/push/test', 'POST', { endpoint }),
};
