/**
 * متجر التطبيق — عناصر وتصنيفات من لوحة التحكم (config/store)
 * الإطارات تُدار منفصلة في config/roomFrames (تخصيص الروم).
 */
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from './index';
import { STORE_CATALOG, type StoreItem } from './shop';

export type { StoreItem };

export interface StoreCategoryConfig {
  id: string;
  labels: Record<string, string>;
  order?: number;
  enabled?: boolean;
  iconName?: string;
}

export const DEFAULT_STORE_CATEGORIES: StoreCategoryConfig[] = [
  { id: 'entrance', labels: { ar: 'دخولية', en: 'Entrance' }, order: 1, enabled: true, iconName: 'Sparkles' },
  { id: 'bubble', labels: { ar: 'فقاعة الدردشة', en: 'Chat Bubble' }, order: 2, enabled: true, iconName: 'MessageCircle' },
  { id: 'badge', labels: { ar: 'شارات', en: 'Badges' }, order: 3, enabled: true, iconName: 'Award' },
  { id: 'effect', labels: { ar: 'تأثيرات', en: 'Effects' }, order: 4, enabled: true, iconName: 'Sparkles' },
  { id: 'theme', labels: { ar: 'ثيمات', en: 'Themes' }, order: 5, enabled: true, iconName: 'Palette' },
  { id: 'vip', labels: { ar: 'VIP', en: 'VIP' }, order: 6, enabled: true, iconName: 'Crown' },
];

function normalizeCategory(raw: StoreCategoryConfig): StoreCategoryConfig {
  return {
    id: String(raw.id ?? '').trim(),
    labels: raw.labels && typeof raw.labels === 'object' ? raw.labels : { ar: String(raw.id) },
    order: Number(raw.order ?? 0),
    enabled: raw.enabled !== false,
    iconName: raw.iconName ? String(raw.iconName) : 'ShoppingBag',
  };
}

function normalizeStoreItem(raw: Record<string, unknown>): StoreItem | null {
  if (raw.enabled === false) return null;
  const id = String(raw.id ?? '').trim();
  const category = String(raw.category ?? raw.type ?? '').trim();
  if (!id || !category) return null;
  const bg1 = String(raw.bgColor1 ?? (raw.bgColors as string[] | undefined)?.[0] ?? '#FCD34D');
  const bg2 = String(raw.bgColor2 ?? (raw.bgColors as string[] | undefined)?.[1] ?? '#F59E0B');
  const item: StoreItem = {
    id,
    name: String(raw.name ?? ''),
    description: String(raw.description ?? ''),
    type: category as StoreItem['type'],
    price: Math.max(0, Number(raw.price) || 0),
    currency: raw.currency === 'pearls' ? 'pearls' : 'coins',
    iconName: String(raw.iconName ?? 'ShoppingBag'),
    iconColor: String(raw.iconColor ?? '#E11414'),
    bgColors: [bg1, bg2],
  };
  if (raw.nameEn) item.nameEn = String(raw.nameEn);
  if (raw.descriptionEn) item.descriptionEn = String(raw.descriptionEn);
  if (raw.imageUrl) item.imageUrl = String(raw.imageUrl);
  if (raw.animationUrl) item.animationUrl = String(raw.animationUrl);
  if (raw.videoUrl) item.videoUrl = String(raw.videoUrl);
  if (raw.videoUrlMp4) item.videoUrlMp4 = String(raw.videoUrlMp4);
  if (raw.isLimited === true) item.isLimited = true;
  if (raw.isNew === true) item.isNew = true;
  if (Number(raw.validityDays) > 0) item.validityDays = Number(raw.validityDays);
  if (Number(raw.sort) >= 0) item.sort = Number(raw.sort);
  return item;
}

const FALLBACK_ITEMS = STORE_CATALOG.filter((i) => i.type !== 'frame');

function sortCategories(cats: StoreCategoryConfig[]): StoreCategoryConfig[] {
  return [...cats]
    .filter((c) => c.enabled !== false && c.id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function sortItems(items: StoreItem[]): StoreItem[] {
  return [...items].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

export const subscribeToStoreCategories = (
  cb: (categories: StoreCategoryConfig[]) => void,
): (() => void) => {
  const ref = doc(firestore, 'config', 'store');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists() && snap.data().categories?.length) {
        cb(sortCategories((snap.data().categories as StoreCategoryConfig[]).map(normalizeCategory)));
      } else {
        cb(sortCategories(DEFAULT_STORE_CATEGORIES));
      }
    },
    () => cb(sortCategories(DEFAULT_STORE_CATEGORIES)),
  );
};

export const subscribeToStoreItems = (cb: (items: StoreItem[]) => void): (() => void) => {
  const ref = doc(firestore, 'config', 'store');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const items = ((snap.data().items ?? []) as Record<string, unknown>[])
          .map(normalizeStoreItem)
          .filter((i): i is StoreItem => i != null && i.name.length > 0);
        cb(sortItems(items));
        return;
      }
      cb(sortItems(FALLBACK_ITEMS));
    },
    () => cb(sortItems(FALLBACK_ITEMS)),
  );
};

export function localizeStoreItem(item: StoreItem, lang: string): StoreItem {
  const isEn = lang === 'en';
  return {
    ...item,
    name: isEn && item.nameEn?.trim() ? item.nameEn.trim() : item.name,
    description: isEn && item.descriptionEn?.trim() ? item.descriptionEn.trim() : item.description,
  };
}

export function storeItemMediaUrl(
  item: Pick<StoreItem, 'imageUrl' | 'animationUrl'>,
): string | undefined {
  const url = item.animationUrl?.trim() || item.imageUrl?.trim();
  return url || undefined;
}

export function storeCategoryLabel(
  cat: StoreCategoryConfig,
  lang: string,
): string {
  return cat.labels[lang]?.trim()
    || cat.labels.ar?.trim()
    || cat.labels.en?.trim()
    || cat.id;
}

/** تبويب الإطارات — من config/roomFrames وليس config/store */
export const STORE_TAB_FRAME_ID = 'frame';

/** تبويب «مميز» يجمع هذه التصنيفات من لوحة التحكم */
export const STORE_TAB_FEATURED_ID = 'featured';

export const FEATURED_STORE_TYPES: StoreItem['type'][] = [
  'badge',
  'effect',
  'theme',
  'vip',
];

export function isFeaturedStoreType(type: string): boolean {
  return (FEATURED_STORE_TYPES as string[]).includes(type);
}

export interface AppStoreTab {
  id: string;
  label: string;
}

/** تبويبات المتجر — نفس تصميم الشاشة (4 تبويبات) */
export function buildAppStoreTabs(_categories: StoreCategoryConfig[], lang: string): AppStoreTab[] {
  const isAr = lang.startsWith('ar');
  return [
    { id: 'entrance', label: isAr ? 'دخولية' : 'Entrance' },
    { id: STORE_TAB_FRAME_ID, label: isAr ? 'الإطارات' : 'Frames' },
    { id: 'bubble', label: isAr ? 'فقاعة' : 'Bubble' },
    { id: STORE_TAB_FEATURED_ID, label: isAr ? 'مميز' : 'Featured' },
  ];
}

export function filterStoreItemsForTab(
  tabId: string,
  catalogItems: StoreItem[],
  frameItems: StoreItem[],
): StoreItem[] {
  if (tabId === STORE_TAB_FRAME_ID) return frameItems;
  if (tabId === 'entrance') return catalogItems.filter((i) => i.type === 'entrance');
  if (tabId === 'bubble') return catalogItems.filter((i) => i.type === 'bubble');
  if (tabId === STORE_TAB_FEATURED_ID) {
    return catalogItems.filter(
      (i) => i.type !== 'entrance' && i.type !== 'bubble' && i.type !== 'frame',
    );
  }
  return catalogItems.filter((i) => i.type === tabId);
}
