/**
 * رموز/صور الروم — config/roomReactions (لوحة التحكم)
 *
 * Firestore document: config/roomReactions
 * {
 *   packs: [
 *     {
 *       id: "pack_1",
 *       nameAr: "تعبيرات",
 *       nameEn: "Reactions",
 *       icon: "😊",
 *       iconUrl: "https://.../icon.png",
 *       enabled: true,
 *       order: 0,
 *       items: [
 *         {
 *           id: "happy",
 *           imageUrl: "https://.../happy.gif",
 *           enabled: true,
 *           order: 0
 *         }
 *       ]
 *     }
 *   ]
 * }
 */
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from './index';

export interface RoomReactionItem {
  id: string;
  imageUrl: string;
  enabled?: boolean;
  order?: number;
}

export interface RoomReactionPack {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: string;
  iconUrl?: string;
  enabled?: boolean;
  order?: number;
  items: RoomReactionItem[];
}

export interface RoomReactionsConfig {
  packs: RoomReactionPack[];
}

export const DEFAULT_ROOM_REACTIONS_CONFIG: RoomReactionsConfig = {
  packs: [],
};

function normalizeItem(raw: Partial<RoomReactionItem>): RoomReactionItem | null {
  const id = String(raw.id ?? '').trim();
  const imageUrl = String(raw.imageUrl ?? '').trim();
  if (!id || !imageUrl) return null;
  return {
    id,
    imageUrl,
    enabled: raw.enabled !== false,
    order: Number(raw.order) || 0,
  };
}

function normalizePack(raw: Partial<RoomReactionPack>): RoomReactionPack | null {
  const id = String(raw.id ?? '').trim();
  if (!id) return null;
  const items = (raw.items ?? [])
    .map((item) => normalizeItem(item))
    .filter((item): item is RoomReactionItem => Boolean(item && item.enabled))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (!items.length) return null;
  return {
    id,
    nameAr: raw.nameAr?.trim() || id,
    nameEn: raw.nameEn?.trim() || id,
    icon: raw.icon?.trim() || '✨',
    iconUrl: raw.iconUrl?.trim() || undefined,
    enabled: raw.enabled !== false,
    order: Number(raw.order) || 0,
    items,
  };
}

export function normalizeRoomReactionsConfig(data: unknown): RoomReactionsConfig {
  const raw = data as { packs?: Partial<RoomReactionPack>[] } | null | undefined;
  const packs = (raw?.packs ?? [])
    .map((pack) => normalizePack(pack))
    .filter((pack): pack is RoomReactionPack => Boolean(pack && pack.enabled))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return { packs };
}

export function subscribeToRoomReactionsConfig(
  callback: (config: RoomReactionsConfig) => void,
): () => void {
  const ref = doc(firestore, 'config', 'roomReactions');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback(DEFAULT_ROOM_REACTIONS_CONFIG);
        return;
      }
      callback(normalizeRoomReactionsConfig(snap.data()));
    },
    () => callback(DEFAULT_ROOM_REACTIONS_CONFIG),
  );
}
