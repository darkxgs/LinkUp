/**
 * Lucky Bag Service — حقيبة الحظ
 *
 * المرسل يرمي حقيبة في الروم:
 *  - المبلغ الكلي (كوينز) يُوزَّع بالتساوي على الفاتحين
 *  - عدد الفاتحين (حتى 20)
 *  - الجمهور: الكل | يتابعوني | لا يتابعوني | يتابعون الروم
 *  - مدة الظهور بالدقائق — لا يمكن الفتح بعد انتهائها
 */

import {
  ref,
  set,
  push,
  onValue,
  off,
  runTransaction,
  get,
  type DataSnapshot,
} from 'firebase/database';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  runTransaction as fsRunTransaction,
} from 'firebase/firestore';
import { realtimeDb, auth, firestore } from './firebase/index';
import { checkUserHasVipFeature } from './firebase/vipSystem';
import { buildBalanceIncrementPatch, getUserCoins } from '@/utils/userBalance';
import { isFollowing } from './firebase/follow';
import { isRoomFavorited } from '@/services/roomFeatures';
import { canJoinHostSeat } from '@/utils/roomHostSeat';

/** صاحب الوكالة / المضيف / المشرف — يمكنه فتح حقيبة الحظ حتى لو هو المرسل */
export async function canManageAgencyRoom(roomId: string, uid: string): Promise<boolean> {
  if (!roomId || !uid) return false;
  try {
    const snap = await get(ref(realtimeDb, `rooms/${roomId}`));
    const room = snap.val();
    if (!room) return false;
    return canJoinHostSeat(room, uid);
  } catch {
    return false;
  }
}

export type LuckyBagAudience =
  | 'everyone'
  | 'followers'
  | 'non_followers'
  | 'room_followers';

export interface LuckyBagGift {
  id: string;
  name: string;
  iconName: string;
  iconColor: string;
  value: number;
  weight: number;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface LuckyBagPrize {
  amount: number;
  giftId: string;
  giftName: string;
  giftIcon: string;
  giftColor: string;
  openedAt: number;
}

export interface LuckyBag {
  id: string;
  senderUid: string;
  senderName: string;
  senderAvatar?: string;
  totalAmount: number;
  maxOpeners: number;
  sharePerPerson: number;
  remainingAmount: number;
  remainingSlots: number;
  openedBy: Record<string, LuckyBagPrize>;
  audience: LuckyBagAudience;
  /** دقائق العد التنازلي قبل السماح بالفتح */
  countdownMinutes: number;
  /** وقت السماح بالفتح (بعد انتهاء العد التنازلي) */
  openAfterAt: number;
  durationMinutes: number;
  createdAt: number;
  expiresAt: number;
  status: 'active' | 'finished';
}

export interface ThrowLuckyBagOptions {
  totalAmount: number;
  maxOpeners: number;
  audience: LuckyBagAudience;
  /** مدة ظهور الحقيبة في الروم (دقائق) */
  durationMinutes: number;
  /** عد تنازلي قبل السماح بالفتح (0 = فوري) */
  countdownMinutes?: number;
}

export const DEFAULT_LUCKY_BAG_COUNTDOWN_MIN = 5;
export const QUICK_COUNTDOWN_MIN = [0, 1, 3, 5, 10] as const;

export const MAX_OPENERS = 20;
export const MAX_OPENERS_VIP = 100;
export const MIN_OPENERS = 1;
export const QUICK_BAG_AMOUNTS = [1000, 5000, 10000, 50000, 100000];
export const QUICK_DURATIONS_MIN = [1, 3, 5, 10, 15];

export const LUCKY_BAG_AUDIENCE_LABELS: Record<LuckyBagAudience, string> = {
  everyone: 'الكل',
  followers: 'يتابعوني',
  non_followers: 'لا يتابعوني',
  room_followers: 'يتابعون الروم',
};

export const DEFAULT_LUCKY_GIFTS: LuckyBagGift[] = [
  { id: 'lb_coin', name: 'كوينز', iconName: 'Coins', iconColor: '#FFC53D', value: 1, weight: 1, rarity: 'common' },
];

export const getLuckyBagGifts = async (): Promise<LuckyBagGift[]> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'luckyBagGifts'));
    if (snap.exists() && snap.data().items?.length) {
      return snap.data().items as LuckyBagGift[];
    }
  } catch {
    // fallback
  }
  return DEFAULT_LUCKY_GIFTS;
};

/** هل المستخدم مؤهل لفتح هذه الحقيبة؟ */
export async function checkLuckyBagEligibility(
  bag: LuckyBag,
  uid: string,
  roomId: string,
): Promise<{ eligible: boolean; reason?: string }> {
  const isOwnBag = bag.senderUid === uid;
  const canManage = isOwnBag ? await canManageAgencyRoom(roomId, uid) : false;

  if (isOwnBag && !canManage) {
    return { eligible: false, reason: 'لا يمكنك فتح حقيبتك' };
  }
  if (bag.status !== 'active' || bag.remainingSlots <= 0) {
    return { eligible: false, reason: 'انتهت الحقيبة' };
  }
  if (Date.now() > bag.expiresAt) {
    return { eligible: false, reason: 'انتهى وقت الحقيبة' };
  }
  if (bag.openedBy?.[uid]) {
    return { eligible: false, reason: 'فتحتها مسبقاً' };
  }

  const openAfter = bag.openAfterAt ?? bag.createdAt;
  if (Date.now() < openAfter) {
    return { eligible: false, reason: 'WAIT_COUNTDOWN' };
  }

  if (isOwnBag && canManage) {
    return { eligible: true };
  }

  const audience = bag.audience ?? 'everyone';
  if (audience === 'everyone') return { eligible: true };

  if (audience === 'followers') {
    const follows = await isFollowing(bag.senderUid);
    if (!follows) return { eligible: false, reason: 'للمتابِعين فقط' };
    return { eligible: true };
  }

  if (audience === 'non_followers') {
    const follows = await isFollowing(bag.senderUid);
    if (follows) return { eligible: false, reason: 'لغير المتابِعين فقط' };
    return { eligible: true };
  }

  if (audience === 'room_followers') {
    const fav = await isRoomFavorited(roomId);
    if (!fav) return { eligible: false, reason: 'لمتابعي الروم فقط' };
    return { eligible: true };
  }

  return { eligible: true };
}

export function getBagSecondsLeft(bag: LuckyBag): number {
  return Math.max(0, Math.ceil((bag.expiresAt - Date.now()) / 1000));
}

/** ثوانٍ متبقية قبل السماح بفتح الحقيبة */
export function getBagOpenCountdownSecondsLeft(bag: LuckyBag): number {
  const openAfter = bag.openAfterAt ?? bag.createdAt;
  return Math.max(0, Math.ceil((openAfter - Date.now()) / 1000));
}

export function isBagOpenUnlocked(bag: LuckyBag): boolean {
  return getBagOpenCountdownSecondsLeft(bag) <= 0;
}

export const throwLuckyBag = async (
  roomId: string,
  options: ThrowLuckyBagOptions,
): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  // امتياز SVIP «زيادة الحد الأقصى لحقيبة الحظ»: يرفع سقف الفاتحين
  const maxOpeners = (await checkUserHasVipFeature(user.uid, 'luckyBagMax'))
    ? MAX_OPENERS_VIP
    : MAX_OPENERS;
  const openers = Math.max(MIN_OPENERS, Math.min(maxOpeners, Math.floor(options.maxOpeners)));
  const amount = Math.floor(options.totalAmount);
  const durationMinutes = Math.max(1, Math.min(60, Math.floor(options.durationMinutes) || 15));
  const countdownMinutes = Math.max(
    0,
    Math.min(30, Math.floor(options.countdownMinutes ?? DEFAULT_LUCKY_BAG_COUNTDOWN_MIN)),
  );

  if (amount < openers) {
    throw new Error('المبلغ يجب أن يكون أكبر من عدد الفاتحين');
  }

  const sharePerPerson = Math.floor(amount / openers);

  let senderName = user.displayName ?? 'مستخدم';
  let senderAvatar = user.photoURL ?? '';

  await fsRunTransaction(firestore, async (tx) => {
    const userRef = doc(firestore, 'users', user.uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error('حسابك غير موجود');
    const data = userSnap.data();
    const coins = getUserCoins(data as Record<string, unknown>);

    if (coins < amount) {
      throw new Error(`رصيدك غير كافٍ. تحتاج ${amount.toLocaleString()} كوين`);
    }

    senderName = data.profile?.displayName ?? data.displayName ?? senderName;
    senderAvatar = data.profile?.avatar ?? data.avatar ?? senderAvatar;

    tx.update(userRef, buildBalanceIncrementPatch('coins', -amount));
  });

  const now = Date.now();
  const openAfterAt = now + countdownMinutes * 60 * 1000;
  const expiresAt = now + Math.max(durationMinutes, countdownMinutes + 1) * 60 * 1000;
  const bagsRef = ref(realtimeDb, `rooms/${roomId}/luckyBags`);
  const newBagRef = push(bagsRef);
  const bagId = newBagRef.key!;

  const bag: LuckyBag = {
    id: bagId,
    senderUid: user.uid,
    senderName,
    senderAvatar,
    totalAmount: amount,
    maxOpeners: openers,
    sharePerPerson,
    remainingAmount: amount,
    remainingSlots: openers,
    openedBy: {},
    audience: options.audience ?? 'everyone',
    countdownMinutes,
    openAfterAt,
    durationMinutes,
    createdAt: now,
    expiresAt,
    status: 'active',
  };

  await set(newBagRef, bag);
  return bagId;
};

export const openLuckyBag = async (
  roomId: string,
  bagId: string,
): Promise<LuckyBagPrize | null> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const bagRef = ref(realtimeDb, `rooms/${roomId}/luckyBags/${bagId}`);
  const preSnap = await get(bagRef);
  const preBag = preSnap.val() as LuckyBag | null;
  if (!preBag) throw new Error('الحقيبة غير موجودة');

  const eligibility = await checkLuckyBagEligibility(preBag, user.uid, roomId);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? 'غير مؤهل لفتح الحقيبة');
  }

  let myPrize: LuckyBagPrize | null = null;

  const result = await runTransaction(bagRef, (bag: LuckyBag | null) => {
    if (!bag) return bag;
    if (bag.status === 'finished') return bag;
    if (bag.openedBy && bag.openedBy[user.uid]) return bag;
    if (bag.remainingSlots <= 0) return bag;
    if (Date.now() < (bag.openAfterAt ?? bag.createdAt)) return bag;
    if (Date.now() > bag.expiresAt) {
      bag.status = 'finished';
      return bag;
    }

    const baseShare =
      bag.sharePerPerson ?? Math.floor(bag.totalAmount / Math.max(1, bag.maxOpeners));
    const share =
      bag.remainingSlots === 1
        ? bag.remainingAmount
        : Math.min(baseShare, bag.remainingAmount - (bag.remainingSlots - 1));

    const prize: LuckyBagPrize = {
      amount: share,
      giftId: 'lb_coin',
      giftName: 'كوينز',
      giftIcon: 'Coins',
      giftColor: '#FFC53D',
      openedAt: Date.now(),
    };
    myPrize = prize;

    if (!bag.openedBy) bag.openedBy = {};
    bag.openedBy[user.uid] = prize;
    bag.remainingAmount -= share;
    bag.remainingSlots -= 1;

    if (bag.remainingSlots <= 0 || bag.remainingAmount <= 0) {
      bag.status = 'finished';
    }

    return bag;
  });

  if (!result.committed || !myPrize) {
    const snap = await get(bagRef);
    const bag = snap.val() as LuckyBag | null;
    if (bag?.openedBy?.[user.uid]) {
      return bag.openedBy[user.uid] ?? null;
    }
    return null;
  }

  const prize = myPrize as LuckyBagPrize;
  try {
    await fsRunTransaction(firestore, async (tx) => {
      const userRef = doc(firestore, 'users', user.uid);
      tx.update(userRef, buildBalanceIncrementPatch('coins', prize.amount));
    });

    await addDoc(collection(firestore, 'transactions'), {
      uid: user.uid,
      type: 'lucky_bag_won',
      amount: prize.amount,
      currency: 'coins',
      roomId,
      bagId,
      status: 'completed',
      createdAt: Date.now(),
    });
  } catch (e) {
    console.warn('credit prize failed', e);
  }

  return prize;
};

const DISPLAY_TTL_MS = 30 * 60 * 1000;

/** هل الحقيبة نشطة ويمكن رؤيتها في الغرفة؟ */
export function isLuckyBagCurrentlyActive(bag: LuckyBag): boolean {
  return (
    bag.status === 'active' &&
    bag.remainingSlots > 0 &&
    getBagSecondsLeft(bag) > 0
  );
}

function parseActiveLuckyBagsFromSnapshot(snap: DataSnapshot): LuckyBag[] {
  if (!snap.exists()) return [];
  const val = snap.val() as Record<string, LuckyBag>;
  return Object.values(val).filter((b) => Date.now() - b.createdAt < DISPLAY_TTL_MS);
}

/** اشتراك بعدة غرف — يُبلّغ عن وجود حقيبة حظ نشطة لكل roomId */
export function subscribeToRoomsLuckyBagActive(
  roomIds: string[],
  callback: (activeByRoomId: Record<string, boolean>) => void,
): () => void {
  const unique = [...new Set(roomIds.filter(Boolean))];
  if (!unique.length) {
    callback({});
    return () => {};
  }

  const state: Record<string, boolean> = {};
  const emit = () => callback({ ...state });
  const unsubs: (() => void)[] = [];

  for (const roomId of unique) {
    const bagsRef = ref(realtimeDb, `rooms/${roomId}/luckyBags`);
    const handler = (snap: DataSnapshot) => {
      const bags = parseActiveLuckyBagsFromSnapshot(snap);
      state[roomId] = bags.some(isLuckyBagCurrentlyActive);
      emit();
    };
    onValue(bagsRef, handler);
    unsubs.push(() => off(bagsRef, 'value', handler));
  }

  return () => unsubs.forEach((u) => u());
}

export const subscribeToLuckyBags = (
  roomId: string,
  callback: (bags: LuckyBag[]) => void,
): (() => void) => {
  const bagsRef = ref(realtimeDb, `rooms/${roomId}/luckyBags`);
  const handler = onValue(bagsRef, (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const val = snap.val() as Record<string, LuckyBag>;
    const list = parseActiveLuckyBagsFromSnapshot(snap)
      .sort((a, b) => b.createdAt - a.createdAt);
    callback(list);
  });
  return () => off(bagsRef, 'value', handler);
};

export const hasOpenedBag = (bag: LuckyBag, uid: string): boolean => {
  return !!bag.openedBy?.[uid];
};
