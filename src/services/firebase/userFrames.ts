/**
 * إطارات الملف الشخصي — ملكية بمدة صلاحية + تفعيل حول صورة المستخدم.
 * البيانات على users/{uid}: frameInventory, equippedFrameId
 */

import { doc, getDoc } from 'firebase/firestore';
import { firestore } from './index';
import type { RoomFrame } from './roomDecor';

/** frameId → expiresAt (ms). 0 = دائم */
export type FrameInventory = Record<string, number>;

export const MS_PER_DAY = 86_400_000;

export function getFrameInventoryFromUserData(data: Record<string, unknown> | undefined): FrameInventory {
  if (!data) return {};
  const raw = data.frameInventory;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as FrameInventory) };
  }
  const owned = Array.isArray(data.ownedFrames) ? (data.ownedFrames as string[]) : [];
  const migrated: FrameInventory = {};
  for (const id of owned) migrated[id] = 0;
  return migrated;
}

export function isFrameEntryActive(expiresAt: number, now = Date.now()): boolean {
  return expiresAt === 0 || expiresAt > now;
}

export function pruneFrameInventory(inv: FrameInventory, now = Date.now()): FrameInventory {
  const next: FrameInventory = {};
  for (const [id, expiresAt] of Object.entries(inv)) {
    if (isFrameEntryActive(expiresAt, now)) next[id] = expiresAt;
  }
  return next;
}

export function getActiveEquippedFrameId(
  data: Record<string, unknown> | undefined,
  now = Date.now(),
): string | null {
  if (!data) return null;
  const inv = pruneFrameInventory(getFrameInventoryFromUserData(data), now);
  const equippedRaw = data.equippedFrameId;

  // إزالة صريحة — لا نرجع لأول إطار مملوك
  if (equippedRaw === '' || equippedRaw === null) return null;

  const equipped =
    typeof equippedRaw === 'string' && equippedRaw.length > 0 ? equippedRaw : null;
  if (equipped && inv[equipped] != null && isFrameEntryActive(inv[equipped]!, now)) {
    return equipped;
  }

  // ترحيل قديم: مملوك بدون equippedFrameId محدد
  if (equippedRaw === undefined && Object.keys(inv).length > 0) {
    return Object.keys(inv)[0] || null;
  }

  return null;
}

export function resolveFrameImageUrl(frameId: string | null, catalog: RoomFrame[]): string | undefined {
  if (!frameId) return undefined;
  return catalog.find((f) => f.id === frameId)?.imageUrl;
}

import { hasVipPrivilege, getEffectiveVipLevel, getVipSystemCached, resolveVipPrivilegeAsset, type VipPrivilegeDef, type VipSystemConfig } from './vipSystem';
import { readUserAgencyPrince } from './agencyPrinceSystem';

export function getEquippedFrameUrlFromUserData(
  data: Record<string, unknown> | undefined,
  catalog: RoomFrame[],
  now = Date.now(),
  privileges?: VipPrivilegeDef[],
  vipSystem?: VipSystemConfig,
): string | undefined {
  // إطار أمير الوكالة له الأولوية القصوى (وسام شهري حصري)
  if (data) {
    const princeFrame = readUserAgencyPrince(data.agencyPrince)?.frameImageUrl;
    if (princeFrame) return princeFrame;
  }

  // إطار موظف المنصة (مانيجر / سوبر أدمن / أدمن)
  if (data?.staffRole && data.staffActive !== false) {
    const staffFrame = data.staffFrameUrl;
    if (typeof staffFrame === 'string' && staffFrame.length > 0) return staffFrame;
  }

  // إطار عضوية SVIP له الأولوية: إذا كان المستوى نشطاً وامتياز photoFrame مفتوح،
  // نعرض إطار العضوية حتى لو جهّز المستخدم إطاراً من المتجر.
  if (data) {
    const activePrivileges = vipSystem?.privileges ?? privileges;
    if (activePrivileges) {
      const isVipFrameActive = hasVipPrivilege(data, 'photoFrame', activePrivileges);
      if (isVipFrameActive) {
        const vipLevel = getEffectiveVipLevel(data);
        const framePriv = vipSystem
          ? resolveVipPrivilegeAsset(vipLevel, 'photoFrame', vipSystem)
          : activePrivileges.find(
              (p) => p.assetKey === 'photoFrame' && p.enabled !== false && vipLevel >= p.unlockLevel
            );
        if (framePriv?.imageUrl) {
          return framePriv.imageUrl;
        }
      }
    }
  }

  // وإلا نرجع للإطار المُجهَّز يدوياً من المتجر
  const frameId = getActiveEquippedFrameId(data, now);
  return resolveFrameImageUrl(frameId, catalog);
}

const frameUrlInFlight = new Map<string, Promise<string | undefined>>();
// كاش نتيجة بـTTL — الغرفة كانت تعيد قراءة إطارات كل المستخدمين مع أي تغيّر في
// الحضور/نافذة الشات (تصاعد Firestore 77→119 طلب/10ث كلما طال الجلوس)
const FRAME_URL_TTL_MS = 5 * 60 * 1000;
const frameUrlCache = new Map<string, { url: string | undefined; ts: number }>();

async function fetchEquippedFrameUrlForUser(
  uid: string,
  catalog: RoomFrame[],
  now: number,
  vipConfig: VipSystemConfig,
): Promise<string | undefined> {
  const cached = frameUrlCache.get(uid);
  if (cached && now - cached.ts < FRAME_URL_TTL_MS) return cached.url;

  const pending = frameUrlInFlight.get(uid);
  if (pending) return pending;

  const request = (async () => {
    try {
      const snap = await getDoc(doc(firestore, 'users', uid));
      if (!snap.exists()) return undefined;
      const userData = snap.data() as Record<string, unknown>;
      const url = getEquippedFrameUrlFromUserData(userData, catalog, now, undefined, vipConfig);
      frameUrlCache.set(uid, { url, ts: Date.now() });
      return url;
    } catch {
      return undefined;
    } finally {
      frameUrlInFlight.delete(uid);
    }
  })();

  frameUrlInFlight.set(uid, request);
  return request;
}

export async function fetchEquippedFrameUrlsForUsers(
  uids: string[],
  catalog: RoomFrame[],
): Promise<Record<string, string>> {
  const unique = [...new Set(uids.filter(Boolean))];
  if (!unique.length || !catalog.length) return {};
  const now = Date.now();
  // جلب إعداد VIP مرة واحدة للدفعة كلها بدل قراءة لكل uid (خفض 2N → N+1)
  const vipConfig = await getVipSystemCached();
  const map: Record<string, string> = {};
  await Promise.all(
    unique.map(async (uid) => {
      const url = await fetchEquippedFrameUrlForUser(uid, catalog, now, vipConfig);
      if (url) map[uid] = url;
    }),
  );
  return map;
}

export function listActiveOwnedFrameIds(data: Record<string, unknown> | undefined): string[] {
  const inv = pruneFrameInventory(getFrameInventoryFromUserData(data));
  return Object.keys(inv);
}
