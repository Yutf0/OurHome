export type Author = 'me' | 'her';
export type AttachmentKind = 'image' | 'audio' | 'file';

export interface AttachmentRef {
  id?: number;
  kind: AttachmentKind;
  filename: string;
  thumb?: string | null;
}

export interface Entry {
  id: number;
  author: Author;
  title: string | null;
  content: string | null;
  mood: string | null;
  created_at: string;
  attachments: AttachmentRef[];
}

export type ClothesCategory = 'top' | 'pants' | 'shoes' | 'jewelry' | 'accessory';
export type JewelrySub = 'bracelet' | 'necklace' | 'earring';

export interface Clothes {
  id: number;
  category: ClothesCategory;
  subcategory: JewelrySub | null;
  name: string | null;
  note: string | null;
  photo: string | null;
  thumb: string | null;
  cutout: string | null; // v0.5: 抠好的透明图
  cutout_status: string | null; // done / none / pending / failed
  use_cutout: number; // 1 展示抠图 / 0 展示原图
  created_at: string;
}

// v0.5: 展示图优先级 —— 启用了抠图且抠图存在 → 抠图,否则缩略图/原图
export function displayImg(c: Clothes): string | null {
  if (c.use_cutout && c.cutout) return c.cutout;
  return c.thumb || c.photo || null;
}

export interface Milestone {
  n: number;
  date: string;
  daysLeft: number;
}

export interface AnniversaryItem {
  id: number;
  name: string;
  date: string;
  days: number;
  nextHundred: Milestone;
  nextYear: Milestone;
}

export interface Holiday {
  name: string;
  date: string;
  daysLeft: number;
}
