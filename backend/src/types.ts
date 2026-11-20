// 全应用共享的数据类型。以后加模块时,新表的类型也写在这里。

export type Author = 'me' | 'her';
export type AttachmentKind = 'image' | 'audio' | 'file';

export interface Entry {
  id: number;
  author: Author;
  title: string | null;
  content: string | null;
  mood: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface Comment {
  id: number;
  entry_id: number;
  author: Author;
  content: string;
  created_at: string;
}

export interface CommentWithLikes extends Comment {
  like_authors: Author[];
}

export interface Attachment {
  id: number;
  entry_id: number;
  kind: AttachmentKind;
  filename: string;
  thumb: string | null;
  created_at: string;
}

export type AttachmentBrief = Pick<Attachment, 'id' | 'kind' | 'filename' | 'thumb'>;
export interface EntryWithAttachments extends Entry {
  attachments: AttachmentBrief[];
  comments: CommentWithLikes[];
}

export interface CreateEntryBody {
  author?: Author;
  title?: string;
  content?: string;
  mood?: string;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  attachments?: Array<{
    kind?: AttachmentKind;
    filename: string;
    thumb?: string | null;
  }>;
}

export interface UploadResult {
  kind: AttachmentKind;
  filename: string;
  thumb?: string;
}

/* ===== 电子衣柜 ===== */

export type ClothesCategory = 'top' | 'pants' | 'shoes' | 'jewelry' | 'accessory';
export type JewelrySub = 'bracelet' | 'necklace' | 'earring';

// v0.5: cutout 抠图文件名; cutout_status: done/none/pending/failed;
// use_cutout: 展示时是否使用抠图(1 用抠图 / 0 用原图),原图永远保留
export interface Clothes {
  id: number;
  category: ClothesCategory;
  subcategory: JewelrySub | null;
  name: string | null;
  note: string | null;
  photo: string | null;
  thumb: string | null;
  cutout: string | null;
  cutout_status: string | null;
  use_cutout: number;
  created_at: string;
}

export interface CreateClothesBody {
  category: ClothesCategory;
  subcategory?: JewelrySub | null;
  name?: string;
  note?: string;
  photo?: string | null;
  thumb?: string | null;
}

/* ===== 纪念日 ===== */

export interface Anniversary {
  id: number;
  name: string;
  date: string; // YYYY-MM-DD
  created_at: string;
}

export interface Milestone {
  n: number;
  date: string;
  daysLeft: number;
}

export interface AnniversaryComputed extends Anniversary {
  days: number;
  nextHundred: Milestone;
  nextYear: Milestone;
}

export interface Holiday {
  name: string;
  date: string;
  daysLeft: number;
}
