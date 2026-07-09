/**
 * خلفيات المحادثة — أنواع + افتراضيات + دوال مساعدة
 */
import { lu } from '@/theme/lu-brand';

export type ChatBackgroundBlob = {
  color: string;
  size: number;
  top: `${number}%` | number;
  left: `${number}%` | number;
  opacity?: number;
};

export type ChatBackground = {
  id: string;
  name: string;
  minBondLevel: number;
  colors: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  blobs?: ChatBackgroundBlob[];
  /** صورة PNG/JPG اختيارية بدل التدرّج */
  imageUrl?: string;
  enabled?: boolean;
  sort?: number;
  isDefault?: boolean;
};

export const DEFAULT_CHAT_BACKGROUND_ID = 'lavender';

export const DEFAULT_CHAT_BACKGROUNDS: ChatBackground[] = [
  {
    id: 'lavender',
    name: 'لافندر',
    minBondLevel: 1,
    colors: [...lu.gradients.pageChat],
    start: { x: 0, y: 0 },
    end: { x: 0.3, y: 1 },
    enabled: true,
    sort: 0,
    isDefault: true,
  },
  {
    id: 'mint',
    name: 'نسيم النعناع',
    minBondLevel: 3,
    colors: ['#E6FFF5', '#F0FFF8', lu.colors.bg],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    blobs: [
      { color: '#2BD9A8', size: 180, top: '8%', left: '-12%', opacity: 0.12 },
      { color: '#EC3E3E', size: 140, top: '72%', left: '78%', opacity: 0.1 },
    ],
    enabled: true,
    sort: 1,
  },
  {
    id: 'ocean',
    name: 'أحلام المحيط',
    minBondLevel: 5,
    colors: ['#FDE6E6', '#FEF1F1', lu.colors.bg],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    blobs: [
      { color: '#EC3E3E', size: 200, top: '5%', left: '70%', opacity: 0.14 },
      { color: '#EF5F5F', size: 160, top: '65%', left: '-10%', opacity: 0.11 },
    ],
    enabled: true,
    sort: 2,
  },
  {
    id: 'royal',
    name: 'الملكي',
    minBondLevel: 7,
    colors: ['#FEE2E2', '#FEE2E2', lu.colors.bg],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0.8 },
    blobs: [
      { color: '#E11414', size: 190, top: '12%', left: '-8%', opacity: 0.13 },
      { color: '#FFC53D', size: 120, top: '58%', left: '82%', opacity: 0.1 },
    ],
    enabled: true,
    sort: 3,
  },
  {
    id: 'rose',
    name: 'حديقة الورد',
    minBondLevel: 8,
    colors: ['#FFE6E9', '#FFE6E9', lu.colors.bg],
    start: { x: 0, y: 0 },
    end: { x: 0.5, y: 1 },
    blobs: [
      { color: '#E11414', size: 170, top: '18%', left: '75%', opacity: 0.11 },
      { color: '#E02B2B', size: 150, top: '70%', left: '-5%', opacity: 0.1 },
    ],
    enabled: true,
    sort: 4,
  },
  {
    id: 'sunset',
    name: 'غروب دافئ',
    minBondLevel: 10,
    colors: ['#FFF0E8', '#FFE6E9', lu.colors.bg],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    blobs: [
      { color: '#FF9A2E', size: 180, top: '10%', left: '5%', opacity: 0.12 },
      { color: '#FF5C5C', size: 140, top: '68%', left: '72%', opacity: 0.11 },
    ],
    enabled: true,
    sort: 5,
  },
  {
    id: 'starlight',
    name: 'ضوء النجوم',
    minBondLevel: 12,
    colors: ['#FFE8E8', '#FEE2E2', '#FCD5D5'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    blobs: [
      { color: '#E11414', size: 210, top: '6%', left: '60%', opacity: 0.15 },
      { color: '#E11414', size: 130, top: '75%', left: '0%', opacity: 0.12 },
    ],
    enabled: true,
    sort: 6,
  },
  {
    id: 'golden',
    name: 'أسطورة ذهبية',
    minBondLevel: 15,
    colors: ['#FFF8E8', '#FFF0F0', lu.colors.bg],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    blobs: [
      { color: '#FFC53D', size: 200, top: '15%', left: '-10%', opacity: 0.14 },
      { color: '#FF9A2E', size: 160, top: '62%', left: '80%', opacity: 0.12 },
      { color: '#E02B2B', size: 90, top: '40%', left: '45%', opacity: 0.08 },
    ],
    enabled: true,
    sort: 7,
  },
];

const bySort = (a: ChatBackground, b: ChatBackground) =>
  (a.sort ?? 0) - (b.sort ?? 0);

export function normalizeChatBackgrounds(items: ChatBackground[]): ChatBackground[] {
  return items
    .filter((b) => b.enabled !== false && b.id && b.name)
    .sort(bySort);
}

export function getDefaultChatBackgroundId(backgrounds: ChatBackground[]): string {
  const list = backgrounds.length ? backgrounds : DEFAULT_CHAT_BACKGROUNDS;
  return list.find((b) => b.isDefault)?.id ?? list[0]?.id ?? DEFAULT_CHAT_BACKGROUND_ID;
}

export function getChatBackground(
  id: string | null | undefined,
  backgrounds: ChatBackground[],
): ChatBackground {
  const list = backgrounds.length ? backgrounds : DEFAULT_CHAT_BACKGROUNDS;
  const map = new Map(list.map((b) => [b.id, b]));
  const defaultId = getDefaultChatBackgroundId(list);
  if (id && map.has(id)) return map.get(id)!;
  return map.get(defaultId) ?? list[0] ?? DEFAULT_CHAT_BACKGROUNDS[0]!;
}

export function isChatBackgroundUnlocked(
  backgroundId: string,
  bondLevel: number,
  backgrounds: ChatBackground[],
): boolean {
  const list = backgrounds.length ? backgrounds : DEFAULT_CHAT_BACKGROUNDS;
  const bg = list.find((b) => b.id === backgroundId);
  if (!bg) return false;
  return bondLevel >= bg.minBondLevel;
}

export function resolveChatBackgroundId(
  savedId: string | undefined | null,
  bondLevel: number,
  backgrounds: ChatBackground[],
): string {
  if (savedId && isChatBackgroundUnlocked(savedId, bondLevel, backgrounds)) return savedId;
  return getDefaultChatBackgroundId(backgrounds);
}
