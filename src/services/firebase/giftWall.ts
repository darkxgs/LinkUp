/**
 * جدار الهدايا — تجميع الهدايا المستلمة من transactions
 */
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { firestore } from './index';
import { getPrivacySettings } from './privacySettings';
import { shouldHideGiftWall } from '@/utils/privacyDisplay';
import { resolveGiftMediaUrl } from '@/components/ui/giftUtils';
import type { Gift } from './shop';

export interface GiftWallItem {
  giftId: string;
  giftName: string;
  count: number;
  imageUrl?: string;
  animationUrl?: string;
  iconName?: string;
  iconColor?: string;
  totalPearls: number;
  lastReceivedAt: number;
}

function findCatalogGift(
  catalog: Gift[],
  giftId: string,
  itemName?: string,
): Gift | undefined {
  const byId = catalog.find((g) => g.id === giftId);
  if (byId) return byId;
  const name = itemName?.trim();
  if (!name) return undefined;
  return catalog.find((g) => g.name.trim() === name);
}

function mediaFromCatalog(catalog?: Gift) {
  if (!catalog) {
    return {
      imageUrl: undefined as string | undefined,
      animationUrl: undefined as string | undefined,
      iconName: undefined as string | undefined,
      iconColor: undefined as string | undefined,
      giftName: undefined as string | undefined,
    };
  }
  return {
    giftName: catalog.name,
    imageUrl: resolveGiftMediaUrl(catalog) ?? undefined,
    animationUrl: catalog.animationUrl?.trim() || undefined,
    iconName: catalog.iconName,
    iconColor: catalog.iconColor,
  };
}

export async function getGiftWall(
  uid: string,
  viewerUid?: string | null,
  giftCatalog: Gift[] = [],
): Promise<GiftWallItem[]> {
  const privacy = await getPrivacySettings(uid);
  if (shouldHideGiftWall(uid, viewerUid ?? undefined, privacy)) return [];

  try {
    let docs: { id: string; data: Record<string, unknown> }[] = [];

    try {
      const q = query(
        collection(firestore, 'transactions'),
        where('uid', '==', uid),
        where('type', '==', 'gift_received'),
        orderBy('createdAt', 'desc'),
        limit(200),
      );
      const snap = await getDocs(q);
      docs = snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));
    } catch {
      const q = query(
        collection(firestore, 'transactions'),
        where('uid', '==', uid),
        limit(300),
      );
      const snap = await getDocs(q);
      docs = snap.docs
        .map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
        .filter((d) => d.data.type === 'gift_received')
        .sort((a, b) => Number(b.data.createdAt ?? 0) - Number(a.data.createdAt ?? 0));
    }

    const byGift = new Map<string, GiftWallItem>();

    for (const { data } of docs) {
      const giftId = String(data.itemId ?? '');
      if (!giftId) continue;
      const itemName = String(data.itemName ?? '');
      const catalog = findCatalogGift(giftCatalog, giftId, itemName);
      const media = mediaFromCatalog(catalog);
      const existing = byGift.get(giftId);
      const pearls = Number(data.amount ?? 0);
      const at = Number(data.createdAt ?? 0);
      const giftQty = Math.max(1, Number(data.quantity ?? 1));

      if (existing) {
        existing.count += giftQty;
        existing.totalPearls += pearls;
        if (at > existing.lastReceivedAt) existing.lastReceivedAt = at;
        if (!existing.imageUrl && media.imageUrl) {
          existing.imageUrl = media.imageUrl;
          existing.animationUrl = media.animationUrl;
          existing.iconName = media.iconName;
          existing.iconColor = media.iconColor;
        }
      } else {
        byGift.set(giftId, {
          giftId,
          giftName: itemName || media.giftName || giftId,
          count: giftQty,
          imageUrl: media.imageUrl,
          animationUrl: media.animationUrl,
          iconName: media.iconName,
          iconColor: media.iconColor,
          totalPearls: pearls,
          lastReceivedAt: at,
        });
      }
    }

    return [...byGift.values()].sort((a, b) => b.lastReceivedAt - a.lastReceivedAt);
  } catch (e) {
    console.error('getGiftWall:', e);
    return [];
  }
}

export function countGiftWallItems(items: GiftWallItem[]): number {
  return items.reduce((sum, i) => sum + i.count, 0);
}
