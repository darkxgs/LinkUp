/**
 * تخصيص الروم — إطارات (مدفوعة) + خلفيات (مجانية).
 * يقرأ الكتالوج من config/roomFrames و config/roomBackgrounds (يديره الأدمن)،
 * ويدير ملكية الإطارات على users/{uid}.frameInventory + equippedFrameId.
 */

import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  arrayUnion,
  collection,
  addDoc,
} from 'firebase/firestore';
import { firestore, auth } from './index';
import { updateRoomSettings } from './rooms';
import {
  getFrameInventoryFromUserData,
  isFrameEntryActive,
  listActiveOwnedFrameIds,
  MS_PER_DAY,
  pruneFrameInventory,
  type FrameInventory,
} from './userFrames';
import { buildBalanceIncrementPatch, getUserCoins } from '@/utils/userBalance';

export type DecorBadge = 'limited' | 'event' | 'hot' | 'new';

export interface RoomFrame {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  badge?: DecorBadge;
  durationDays?: number;
  enabled?: boolean;
  sort?: number;
}

export interface RoomBackground {
  id: string;
  name: string;
  imageUrl: string;
  enabled?: boolean;
  sort?: number;
}

const bySort = <T extends { sort?: number }>(a: T, b: T) =>
  (a.sort ?? 0) - (b.sort ?? 0);

/** عناصر تجريبية تظهر عند فراغ المتجر — لاختبار الشراء/التفعيل قبل رفع الأصول من لوحة التحكم */
export const DEFAULT_BACKGROUNDS: RoomBackground[] = [
  { id: 'bg_demo_1', name: 'سماء ليلية', imageUrl: 'https://picsum.photos/seed/linkupbg1/400/800', enabled: true },
  { id: 'bg_demo_2', name: 'تدرّج بنفسجي', imageUrl: 'https://picsum.photos/seed/linkupbg2/400/800', enabled: true },
  { id: 'bg_demo_3', name: 'مدينة الليل', imageUrl: 'https://picsum.photos/seed/linkupbg3/400/800', enabled: true },
  { id: 'bg_demo_4', name: 'قمر هادئ', imageUrl: 'https://picsum.photos/seed/linkupbg4/400/800', enabled: true },
];

export const DEFAULT_FRAMES: RoomFrame[] = [
  {
    id: 'frame_golden_crown',
    name: 'إطار التاج الذهبي',
    imageUrl: 'https://storage.googleapis.com/linkup-dc45f.firebasestorage.app/store/decor/frame_golden_crown.png',
    price: 5000,
    badge: 'new',
    durationDays: 3,
    enabled: true,
    sort: 1
  },
  {
    id: 'frame_royal_red',
    name: 'إطار ملكي أحمر',
    imageUrl: 'https://storage.googleapis.com/linkup-dc45f.firebasestorage.app/store/decor/frame_royal_red.png',
    price: 3000,
    badge: 'hot',
    durationDays: 3,
    enabled: true,
    sort: 2
  },
  {
    id: 'frame_blue_angel',
    name: 'إطار الملاك الأزرق',
    imageUrl: 'https://storage.googleapis.com/linkup-dc45f.firebasestorage.app/store/decor/frame_blue_angel.png',
    price: 6000,
    badge: 'limited',
    durationDays: 7,
    enabled: true,
    sort: 3
  },
  {
    id: 'frame_gold_wings',
    name: 'إطار أجنحة الذهب',
    imageUrl: 'https://storage.googleapis.com/linkup-dc45f.firebasestorage.app/store/decor/frame_golden_crown.png',
    price: 9000,
    badge: 'new',
    durationDays: 7,
    enabled: true,
    sort: 4
  },
  {
    id: 'frame_lion_gold',
    name: 'إطار الأسد الذهبي',
    imageUrl: 'https://storage.googleapis.com/linkup-dc45f.firebasestorage.app/store/decor/frame_royal_red.png',
    price: 10000,
    badge: 'hot',
    durationDays: 7,
    enabled: true,
    sort: 5
  },
  {
    id: 'frame_purple_wings',
    name: 'إطار الأجنحة البنفسجية',
    imageUrl: 'https://storage.googleapis.com/linkup-dc45f.firebasestorage.app/store/decor/frame_blue_angel.png',
    price: 8000,
    badge: 'limited',
    durationDays: 7,
    enabled: true,
    sort: 6
  }
];

/** اشتراك حيّ بكتالوج الإطارات المفعّلة */
export const subscribeToRoomFrames = (cb: (frames: RoomFrame[]) => void): (() => void) => {
  const ref = doc(firestore, 'config', 'roomFrames');
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

/** اشتراك حيّ بكتالوج الخلفيات المفعّلة */
export const subscribeToRoomBackgrounds = (
  cb: (bgs: RoomBackground[]) => void,
): (() => void) => {
  const ref = doc(firestore, 'config', 'roomBackgrounds');
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

/** الإطارات الفعّالة (غير المنتهية) التي يملكها المستخدم */
export const getOwnedFrames = async (uid?: string): Promise<string[]> => {
  const id = uid ?? auth.currentUser?.uid;
  if (!id) return [];
  try {
    const snap = await getDoc(doc(firestore, 'users', id));
    if (!snap.exists()) return [];
    return listActiveOwnedFrameIds(snap.data() as Record<string, unknown>);
  } catch {
    return [];
  }
};

/**
 * شراء إطار بالعملات (ذرّي على العميل): يخصم السعر ويضيف الإطار للمملوكات.
 * يُرجع رصيد العملات بعد الشراء.
 */
export const purchaseFrame = async (
  frameId: string,
  price: number,
  durationDays = 0,
): Promise<{ ok: boolean; balance: number; equippedFrameId: string }> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const userRef = doc(firestore, 'users', user.uid);
  let balanceAfter = 0;

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('حسابك غير موجود');
    const data = snap.data()!;
    const inv = pruneFrameInventory(getFrameInventoryFromUserData(data as Record<string, unknown>));
    const existingEntry = inv[frameId];
    if (existingEntry != null && isFrameEntryActive(existingEntry)) {
      balanceAfter = getUserCoins(data as Record<string, unknown>);
      return;
    }
    const coins = getUserCoins(data as Record<string, unknown>);
    if (coins < price) {
      throw new Error(`رصيدك غير كافٍ. تحتاج ${price.toLocaleString()} عملة`);
    }
    const now = Date.now();
    const expiresAt = durationDays > 0 ? now + durationDays * MS_PER_DAY : 0;
    const nextInv: FrameInventory = { ...inv, [frameId]: expiresAt };
    tx.update(userRef, {
      ...buildBalanceIncrementPatch('coins', -price),
      ownedFrames: arrayUnion(frameId),
      frameInventory: nextInv,
      equippedFrameId: frameId,
    });
    balanceAfter = coins - price;
  });

  return { ok: true, balance: balanceAfter, equippedFrameId: frameId };
};

/** شراء إطار وإرساله لمستخدم آخر — عبر Cloud Function */
export const purchaseAndSendFrame = async (
  frameId: string,
  price: number,
  durationDays: number,
  toUid: string,
  toName: string,
  frameName = 'frame',
): Promise<{ balance: number }> => {
  const { purchaseAndSendStoreItem } = await import('./shop');
  const result = await purchaseAndSendStoreItem(
    {
      id: frameId,
      name: frameName,
      description: '',
      type: 'frame',
      price,
      currency: 'coins',
      iconName: 'Frame',
      iconColor: '#E11414',
      bgColors: ['#E11414', '#C61414'],
    },
    toUid,
    toName,
    { isRoomFrame: true, durationDays },
  );
  return { balance: result.balance };
};

/** تفعيل إطار شخصي حول صورة المستخدم (يجب أن يكون مملوكاً وغير منتهٍ) */
export const equipUserFrame = async (frameId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const userRef = doc(firestore, 'users', user.uid);
  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('حسابك غير موجود');
    const data = snap.data()! as Record<string, unknown>;
    const inv = pruneFrameInventory(getFrameInventoryFromUserData(data));
    const ownedEntry = inv[frameId];
    if (ownedEntry == null) throw new Error('لا تملك هذا الإطار');
    if (!isFrameEntryActive(ownedEntry)) throw new Error('انتهت صلاحية هذا الإطار');
    tx.update(userRef, { equippedFrameId: frameId, frameInventory: inv });
  });
};

/** إزالة الإطار الشخصي المفعّل */
export const clearEquippedUserFrame = async (): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  const userRef = doc(firestore, 'users', user.uid);
  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) return;
    tx.update(userRef, { equippedFrameId: '' });
  });
};

/** تفعيل إطار على الروم (للمضيف) */
export const applyFrameToRoom = async (roomId: string, frameId: string): Promise<void> => {
  await updateRoomSettings(roomId, { frameId });
};

/** إزالة الإطار */
export const clearRoomFrame = async (roomId: string): Promise<void> => {
  await updateRoomSettings(roomId, { frameId: '' });
};

/** تفعيل خلفية على الروم (مجانية) */
export const applyBackgroundToRoom = async (
  roomId: string,
  imageUrl: string,
): Promise<void> => {
  await updateRoomSettings(roomId, { background: imageUrl });
};
