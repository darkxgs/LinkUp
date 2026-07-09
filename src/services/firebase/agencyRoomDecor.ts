/**
 * تخصيص غرف الوكالات — إطارات وخلفيات منفصلة عن متجر الروم العام.
 * الكتالوج: config/agencyRoomFrames + config/agencyRoomBackgrounds (لوحة التحكم).
 * التجهيز على وثيقة الوكالة + مزامنة غرفة البث المباشر.
 */

import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  arrayUnion,
} from 'firebase/firestore';
import { firestore, auth } from './index';
import { patchRoomLiveDecor } from './rooms';
import { invalidateAgenciesCache } from './social';
import { uploadImage } from './storage';
import {
  isFrameEntryActive,
  listActiveOwnedFrameIds,
  MS_PER_DAY,
  pruneFrameInventory,
  type FrameInventory,
} from './userFrames';
import type { DecorBadge, RoomBackground, RoomFrame } from './roomDecor';
import { DEFAULT_BACKGROUNDS, DEFAULT_FRAMES } from './roomDecor';
import { buildBalanceIncrementPatch, getUserCoins } from '@/utils/userBalance';

export type { DecorBadge, RoomBackground, RoomFrame };

const bySort = <T extends { sort?: number }>(a: T, b: T) =>
  (a.sort ?? 0) - (b.sort ?? 0);

export interface AgencyDecorState {
  cardFrameId?: string;
  cardFrameUrl?: string;
  cardBackgroundUrl?: string;
  roomFrameId?: string;
  roomBackgroundUrl?: string;
}

type AgencyManagerProfile = {
  agencyId?: string;
  isAgent?: boolean;
  agencyRole?: string;
};

/** هل المستخدم مالك أو مدير الوكالة؟ */
export async function canManageAgencyDecor(
  agencyId: string,
  agencyData?: Record<string, unknown>,
): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  let data = agencyData;
  if (!data) {
    const snap = await getDoc(doc(firestore, 'agencies', agencyId));
    if (!snap.exists()) return false;
    data = snap.data() as Record<string, unknown>;
  }

  if (String(data.ownerUid ?? '') === user.uid) return true;

  const userSnap = await getDoc(doc(firestore, 'users', user.uid));
  const profile = (userSnap.data() ?? {}) as AgencyManagerProfile;
  return (
    String(profile.agencyId ?? '') === agencyId &&
    (profile.isAgent === true || profile.agencyRole === 'owner')
  );
}

async function assertCanManageAgencyDecor(
  agencyId: string,
  agencyData: Record<string, unknown>,
): Promise<void> {
  if (!(await canManageAgencyDecor(agencyId, agencyData))) {
    throw new Error('فقط مالك أو مدير الوكالة يمكنه التعديل');
  }
}

function agencyInventoryKey(data: Record<string, unknown>): FrameInventory {
  const raw = data.agencyFrameInventory;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return pruneFrameInventory(raw as FrameInventory);
  }
  return {};
}

function listAgencyOwnedFrameIds(data: Record<string, unknown>): string[] {
  const inv = agencyInventoryKey(data);
  return Object.keys(inv).filter((id) => {
    const entry = inv[id];
    return entry != null && isFrameEntryActive(entry);
  });
}

/** اشتراك بكتالوج إطارات الوكالات */
export const subscribeToAgencyRoomFrames = (cb: (frames: RoomFrame[]) => void): (() => void) => {
  const ref = doc(firestore, 'config', 'agencyRoomFrames');
  return onSnapshot(
    ref,
    (snap) => {
      const items = (snap.exists() ? (snap.data().items as RoomFrame[]) : []) ?? [];
      const enabled = items.filter((f) => f.enabled !== false).sort(bySort);
      cb(enabled.length ? enabled : DEFAULT_FRAMES);
    },
    () => cb(DEFAULT_FRAMES),
  );
};

/** اشتراك بكتالوج خلفيات الوكالات */
export const subscribeToAgencyRoomBackgrounds = (
  cb: (bgs: RoomBackground[]) => void,
): (() => void) => {
  const ref = doc(firestore, 'config', 'agencyRoomBackgrounds');
  return onSnapshot(
    ref,
    (snap) => {
      const items = (snap.exists() ? (snap.data().items as RoomBackground[]) : []) ?? [];
      const enabled = items.filter((b) => b.enabled !== false).sort(bySort);
      cb(enabled.length ? enabled : DEFAULT_BACKGROUNDS);
    },
    () => cb(DEFAULT_BACKGROUNDS),
  );
};

export const getAgencyOwnedFrames = async (agencyId: string): Promise<string[]> => {
  try {
    const snap = await getDoc(doc(firestore, 'agencies', agencyId));
    if (!snap.exists()) return [];
    return listAgencyOwnedFrameIds(snap.data() as Record<string, unknown>);
  } catch {
    return [];
  }
};

async function syncAgencyLiveRoom(
  agencyId: string,
  patch: { frameId?: string; background?: string },
): Promise<void> {
  const snap = await getDoc(doc(firestore, 'agencies', agencyId));
  if (!snap.exists()) return;
  const liveRoomId = String(snap.data()?.liveRoomId ?? '').trim();
  if (!liveRoomId) return;
  await patchRoomLiveDecor(liveRoomId, patch);
}

/** رفع خلفية مخصصة من الجهاز */
export const uploadAgencyBackgroundFromUri = async (localUri: string): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  return uploadImage(localUri, 'agencies');
};

/** شراء إطار وكالة — يخصم من عملات مالك الوكالة */
export const purchaseAgencyFrame = async (
  agencyId: string,
  frameId: string,
  price: number,
  durationDays = 0,
): Promise<{ ok: boolean; balance: number }> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const agencyRef = doc(firestore, 'agencies', agencyId);
  const userRef = doc(firestore, 'users', user.uid);
  let balanceAfter = 0;

  await runTransaction(firestore, async (tx) => {
    const [agencySnap, userSnap] = await Promise.all([tx.get(agencyRef), tx.get(userRef)]);
    if (!agencySnap.exists()) throw new Error('الوكالة غير موجودة');
    const agencyData = agencySnap.data()!;
    if (String(agencyData.ownerUid ?? '') !== user.uid) {
      throw new Error('فقط مالك الوكالة يمكنه الشراء');
    }
    if (!userSnap.exists()) throw new Error('حسابك غير موجود');

    const inv = agencyInventoryKey(agencyData as Record<string, unknown>);
    const existing = inv[frameId];
    if (existing != null && isFrameEntryActive(existing)) {
      balanceAfter = getUserCoins(userSnap.data() as Record<string, unknown>);
      return;
    }

    const coins = getUserCoins(userSnap.data() as Record<string, unknown>);
    if (coins < price) {
      throw new Error(`رصيدك غير كافٍ. تحتاج ${price.toLocaleString()} عملة`);
    }

    const now = Date.now();
    const expiresAt = durationDays > 0 ? now + durationDays * MS_PER_DAY : 0;
    const nextInv: FrameInventory = { ...inv, [frameId]: expiresAt };

    tx.update(userRef, {
      ...buildBalanceIncrementPatch('coins', -price),
    });
    tx.update(agencyRef, {
      agencyFrameInventory: nextInv,
      ownedAgencyFrames: arrayUnion(frameId),
      updatedAt: now,
    });
    balanceAfter = coins - price;
  });

  return { ok: true, balance: balanceAfter };
};

/** تفعيل إطار على بطاقة الوكالة (قائمة الغرف) */
export const equipAgencyCardFrame = async (
  agencyId: string,
  frameId: string,
  frameUrl: string,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const agencyRef = doc(firestore, 'agencies', agencyId);
  const preSnap = await getDoc(agencyRef);
  if (!preSnap.exists()) throw new Error('الوكالة غير موجودة');
  await assertCanManageAgencyDecor(agencyId, preSnap.data() as Record<string, unknown>);

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(agencyRef);
    if (!snap.exists()) throw new Error('الوكالة غير موجودة');
    const data = snap.data()!;

    if (frameId) {
      const inv = agencyInventoryKey(data as Record<string, unknown>);
      const entry = inv[frameId];
      if (entry == null || !isFrameEntryActive(entry)) {
        throw new Error('لا تملك هذا الإطار');
      }
    }

    tx.update(agencyRef, {
      cardFrameId: frameId || '',
      cardFrameUrl: frameUrl || '',
      updatedAt: Date.now(),
    });
  });
};

/** تفعيل إطار على غرفة البث المباشر للوكالة */
export const equipAgencyRoomFrame = async (
  agencyId: string,
  frameId: string,
  frameUrl: string,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const agencyRef = doc(firestore, 'agencies', agencyId);
  const preSnap = await getDoc(agencyRef);
  if (!preSnap.exists()) throw new Error('الوكالة غير موجودة');
  await assertCanManageAgencyDecor(agencyId, preSnap.data() as Record<string, unknown>);

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(agencyRef);
    if (!snap.exists()) throw new Error('الوكالة غير موجودة');
    const data = snap.data()!;

    if (frameId) {
      const inv = agencyInventoryKey(data as Record<string, unknown>);
      const entry = inv[frameId];
      if (entry == null || !isFrameEntryActive(entry)) {
        throw new Error('لا تملك هذا الإطار');
      }
    }

    tx.update(agencyRef, {
      roomFrameId: frameId || '',
      roomFrameUrl: frameUrl || '',
      updatedAt: Date.now(),
    });
  });

  await syncAgencyLiveRoom(agencyId, { frameId: frameId || '' });
};

/** تفعيل خلفية على غرفة الوكالة */
export const applyAgencyRoomBackground = async (
  agencyId: string,
  imageUrl: string,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const agencyRef = doc(firestore, 'agencies', agencyId);
  const preSnap = await getDoc(agencyRef);
  if (!preSnap.exists()) throw new Error('الوكالة غير موجودة');
  await assertCanManageAgencyDecor(agencyId, preSnap.data() as Record<string, unknown>);

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(agencyRef);
    if (!snap.exists()) throw new Error('الوكالة غير موجودة');
    tx.update(agencyRef, {
      roomBackgroundUrl: imageUrl || '',
      cardBackgroundUrl: imageUrl || '',
      updatedAt: Date.now(),
    });
  });

  invalidateAgenciesCache();
  if (imageUrl) {
    await syncAgencyLiveRoom(agencyId, { background: imageUrl });
  } else {
    await syncAgencyLiveRoom(agencyId, { background: '' });
  }
};

/** قراءة حقول التخصيص من وثيقة الوكالة */
export function parseAgencyDecor(data: Record<string, unknown>): AgencyDecorState {
  return {
    cardFrameId: data.cardFrameId ? String(data.cardFrameId) : undefined,
    cardFrameUrl: data.cardFrameUrl ? String(data.cardFrameUrl) : undefined,
    cardBackgroundUrl: data.cardBackgroundUrl ? String(data.cardBackgroundUrl) : undefined,
    roomFrameId: data.roomFrameId ? String(data.roomFrameId) : undefined,
    roomBackgroundUrl: data.roomBackgroundUrl ? String(data.roomBackgroundUrl) : undefined,
  };
}

/** للمستخدم العادي — إطارات مملوكة شخصياً يمكن استخدامها أيضاً */
export async function getCombinedOwnedFrameIds(agencyId: string): Promise<string[]> {
  const user = auth.currentUser;
  const agencyOwned = await getAgencyOwnedFrames(agencyId);
  if (!user) return agencyOwned;
  try {
    const snap = await getDoc(doc(firestore, 'users', user.uid));
    if (!snap.exists()) return agencyOwned;
    const personal = listActiveOwnedFrameIds(snap.data() as Record<string, unknown>);
    return [...new Set([...agencyOwned, ...personal])];
  } catch {
    return agencyOwned;
  }
}

export function resolveAgencyCardFrameUrl(
  agency: AgencyDecorState,
  catalog: RoomFrame[],
): string | undefined {
  if (agency.cardFrameUrl?.startsWith('http')) return agency.cardFrameUrl;
  if (!agency.cardFrameId) return undefined;
  return catalog.find((f) => f.id === agency.cardFrameId)?.imageUrl;
}
