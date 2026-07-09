/**
 * تحويل إطارات الأدمن (config/roomFrames) لعرضها في المتجر
 */
import type { DecorBadge, RoomFrame } from './roomDecor';
import { STORE_CATALOG, type StoreItem } from './shop';

const GRADIENTS: [string, string][] = [
  ['#FCD34D', '#F59E0B'],
  ['#F16F6F', '#C61414'],
  ['#FCA5A5', '#EF4444'],
  ['#FCA5A5', '#E11414'],
  ['#FCA5A5', '#E11414'],
  ['#6EE7B7', '#10B981'],
];

export type StoreDisplayItem = StoreItem & {
  imageUrl?: string;
  /** إطار من لوحة التحكم — يُشترى عبر purchaseFrame */
  isRoomFrame?: boolean;
};

function badgeFlags(badge?: DecorBadge): { isLimited?: boolean; isNew?: boolean } {
  if (badge === 'limited') return { isLimited: true };
  if (badge === 'new') return { isNew: true };
  if (badge === 'hot') return { isNew: true };
  return {};
}

export function roomFrameToStoreItem(frame: RoomFrame, index: number): StoreDisplayItem {
  const colors = GRADIENTS[index % GRADIENTS.length]!;
  return {
    id: frame.id,
    name: frame.name,
    /** يُستبدل في شاشة المتجر بترجمة i18n */
    description: '',
    type: 'frame',
    price: frame.price,
    currency: 'coins',
    iconName: 'Crown',
    iconColor: colors[1],
    bgColors: colors,
    validityDays: frame.durationDays && frame.durationDays > 0 ? frame.durationDays : undefined,
    imageUrl: frame.imageUrl,
    isRoomFrame: true,
    ...badgeFlags(frame.badge),
  };
}

/** شارات/تأثيرات/VIP — بدون الإطارات الثابتة القديمة */
export const STORE_CATALOG_NO_FRAMES = STORE_CATALOG.filter((i) => i.type !== 'frame');
