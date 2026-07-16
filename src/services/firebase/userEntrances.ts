/**
 * دخوليات الغرف — من المخزون + امتياز SVIP + امتياز الأرستقراطية
 */

import { collection, doc, getDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { firestore } from './index';
import type { StoreItem } from './shop';
import {
  unlockedPrivilegesForUser,
  readVipUserState,
  getEffectiveVipLevel,
  resolveVipPrivilegeAsset,
  isVipPrivilegeVisibleForUser,
  type VipPrivilegeDef,
  type VipSystemConfig,
} from './vipSystem';
import {
  getAristocracyConfigOnce,
  getAristocracyLevel,
  isAristocracyActive,
  readAristocracyState,
  type AristocracyConfig,
  type AristocracyPrivilege,
} from './aristocracySystem';
import { readUserAgencyPrince } from './agencyPrinceSystem';
import { parseStaffFromUserData } from '@/types/platformStaff';

const ENTRY_ASSET_KEYS = new Set(['entryEffect', 'vipEntry']);
const ARISTOCRACY_ENTRY_ASSET_KEYS = new Set(['entry']);

export function isVideoMediaUrl(url?: string | null): boolean {
  if (!url?.trim()) return false;
  return /\.(mp4|m4v|mov|webm)($|\?|#)/i.test(url.trim());
}

export function userHasRoomEntryPrivilege(
  vipLevel: number,
  privileges: VipPrivilegeDef[],
): boolean {
  return unlockedPrivilegesForUser(vipLevel, privileges).some((p) =>
    ENTRY_ASSET_KEYS.has(p.assetKey),
  );
}

export function resolveEntranceVideoUrls(
  item: Pick<StoreItem, 'animationUrl' | 'imageUrl'> & { videoUrl?: string; videoUrlMp4?: string },
): { videoUrl?: string; videoUrlMp4?: string; previewImageUrl?: string } {
  const videoUrl = [item.videoUrl, item.animationUrl].find((u) => isVideoMediaUrl(u));
  const videoUrlMp4 = item.videoUrlMp4?.trim() || undefined;
  const previewImageUrl = item.imageUrl?.trim() || undefined;
  return {
    videoUrl: videoUrl?.trim(),
    videoUrlMp4,
    previewImageUrl,
  };
}

function getEquippedEntranceIdFromUserData(data: Record<string, unknown> | undefined): string | null {
  const raw = data?.equippedEntranceId;
  if (raw === '' || raw === null) return null;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  // انتهاء صلاحية الدخولية المجهّزة (تُكتب عند التجهيز؛ 0/غياب = دائمة) — دخولية
  // منتهية كانت تبقى تعمل لأن هذا المسار السريع لم يكن يتحقق من الصلاحية
  const exp = Number(data?.equippedEntranceExpiresAt ?? 0) || 0;
  if (exp > 0 && exp < Date.now()) return null;
  return raw;
}

async function fetchEquippedEntranceIdFromInventory(uid: string): Promise<string | null> {
  const q = query(collection(firestore, 'inventory'), where('uid', '==', uid), limit(80));
  const snap = await getDocs(q);
  const now = Date.now();
  for (const d of snap.docs) {
    const data = d.data();
    if (data.itemType !== 'entrance' || data.isEquipped !== true) continue;
    const exp = data.expiresAt;
    if (typeof exp === 'number' && exp > 0 && exp < now) continue;
    const id = typeof data.itemId === 'string' ? data.itemId : '';
    if (id) return id;
  }
  return null;
}

export type RoomEntryMedia = {
  videoUrl: string;
  videoUrlMp4?: string;
};

/** دخولية فيديو موظف المنصة */
export function resolveStaffRoomEntryFromData(
  data: Record<string, unknown> | undefined,
): RoomEntryMedia | null {
  const staff = parseStaffFromUserData(data);
  if (!staff.staffRole || staff.staffActive === false) return null;
  const videoUrl = [staff.staffEntryVideoUrl, staff.staffBadgeUrl].find((u) =>
    isVideoMediaUrl(u),
  );
  if (!videoUrl) return null;
  return {
    videoUrl,
    videoUrlMp4: staff.staffEntryVideoUrlMp4?.trim() || undefined,
  };
}

/** شعار ثابت لشريط الدخول (صورة — ليس فيديو) */
export function resolveStaffEntryBadgeUrl(
  data: Record<string, unknown> | undefined,
): string | null {
  const staff = parseStaffFromUserData(data);
  if (!staff.staffRole || staff.staffActive === false) return null;
  const badge = staff.staffBadgeUrl?.trim();
  if (!badge || isVideoMediaUrl(badge)) return null;
  return badge;
}

function resolveAristocracyEntryPrivilege(
  data: Record<string, unknown>,
  aristocracyConfig: AristocracyConfig,
): AristocracyPrivilege | null {
  const state = readAristocracyState(data);
  if (!isAristocracyActive(state) || state.level <= 0) return null;
  const level = getAristocracyLevel(aristocracyConfig, state.level);
  if (!level?.enabled || level.comingSoon) return null;
  return (
    level.privileges.find((p) =>
      p.enabled !== false &&
      ARISTOCRACY_ENTRY_ASSET_KEYS.has(p.assetKey) &&
      (p.videoUrl || p.videoUrlMp4 || p.imageUrl),
    ) ?? null
  );
}

/** يُرجع فيديو الدخولية إن وُجد امتياز أرستقراطية/ SVIP + دخولية مفعّلة */
export async function resolveRoomEntryForUser(
  uid: string,
  catalog: StoreItem[],
  privileges: VipPrivilegeDef[],
  vipSystem?: VipSystemConfig,
  aristocracyConfig?: AristocracyConfig,
): Promise<RoomEntryMedia | null> {
  try {
    const userSnap = await getDoc(doc(firestore, 'users', uid));
    if (!userSnap.exists()) return null;
    const data = userSnap.data() as Record<string, unknown>;

    // 1) أولوية الأرستقراطية: فيديو دخولية محدد لكل مستوى من لوحة التحكم.
    const arCfg = aristocracyConfig ?? await getAristocracyConfigOnce();
    const arEntry = resolveAristocracyEntryPrivilege(data, arCfg);
    if (arEntry) {
      const aristocracyVideo = [arEntry.videoUrl, arEntry.imageUrl].find((u) => isVideoMediaUrl(u));
      if (aristocracyVideo) {
        return {
          videoUrl: aristocracyVideo,
          videoUrlMp4: arEntry.videoUrlMp4?.trim() || undefined,
        };
      }
    }

    // 1.5) أمير الوكالة: دخولية فيديو خاصة (تُمنح من لوحة التحكم)
    const prince = readUserAgencyPrince(data.agencyPrince);
    if (prince) {
      const princeVideo = [prince.entryVideoUrl, prince.entryAnimationUrl, prince.entryImageUrl].find((u) =>
        isVideoMediaUrl(u),
      );
      if (princeVideo) {
        return {
          videoUrl: princeVideo,
          videoUrlMp4: prince.entryVideoUrlMp4?.trim() || undefined,
        };
      }
    }

    // 1.6) موظف المنصة — دخولية فيديو (مانيجر / سوبر أدمن / أدمن)
    const staffEntry = resolveStaffRoomEntryFromData(data);
    if (staffEntry) return staffEntry;

    // 2) دخولية المتجر المجهّزة (شراء/هدية) — لا تتطلب SVIP: من اشتراها أو
    //    أُهديت له يستخدمها ما دامت صلاحيتها سارية (بوابة الـVIP كانت تمنع
    //    غير الـSVIP من رؤية دخولية اشتراها من المتجر).
    let entranceId = getEquippedEntranceIdFromUserData(data);
    if (!entranceId) {
      entranceId = await fetchEquippedEntranceIdFromInventory(uid);
    }

    let videoUrl: string | undefined = undefined;
    let videoUrlMp4: string | undefined = undefined;

    if (entranceId) {
      const item = catalog.find((i) => i.id === entranceId);
      if (item) {
        const media = resolveEntranceVideoUrls(item);
        videoUrl = media.videoUrl;
        videoUrlMp4 = media.videoUrlMp4;
      }
    }
    if (videoUrl) return { videoUrl, videoUrlMp4 };

    // 3) امتياز دخولية SVIP الافتراضي — هذا وحده يتطلب مستوى الـVIP المناسب
    const { vipLevel: fallbackVipLevel } = readVipUserState(data);
    const vipLevel = getEffectiveVipLevel(data) || fallbackVipLevel;
    if (!userHasRoomEntryPrivilege(vipLevel, privileges)) return null;

    if (!videoUrl) {
      const activeEntryPriv = vipSystem
        ? (resolveVipPrivilegeAsset(vipLevel, 'entryEffect', vipSystem) || resolveVipPrivilegeAsset(vipLevel, 'vipEntry', vipSystem))
        : privileges.find(
            (p) => ENTRY_ASSET_KEYS.has(p.assetKey) && p.enabled !== false && vipLevel >= p.unlockLevel
          );
      // احترام قائمة امتيازات SVIP المختارة للأرستقراطية: لا تُظهر دخولية SVIP
      // الممنوحة عبر الأرستقراطية إلا إن كانت ضمن المفاتيح المسموح بها.
      const entryAllowed =
        activeEntryPriv != null &&
        isVipPrivilegeVisibleForUser(data, activeEntryPriv.assetKey, activeEntryPriv.unlockLevel);
      if (entryAllowed && (activeEntryPriv?.videoUrl || activeEntryPriv?.imageUrl)) {
        videoUrl = activeEntryPriv.videoUrl || activeEntryPriv.imageUrl;
        videoUrlMp4 = activeEntryPriv.videoUrlMp4 || undefined;
      }
    }

    if (!videoUrl) return null;
    return { videoUrl, videoUrlMp4 };
  } catch {
    return null;
  }
}
