/**
 * LinkUp App — Matching Service
 * Voice/Video matching — أعداد وقائمة انتظار حقيقية من Firestore (بدون بذور وهمية)
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  increment,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { firestore, auth } from './index';
import { getUserCoins } from '@/utils/userBalance';

// ==================== TYPES ====================

export type MatchType = 'voice' | 'video';
export type MatchStatus = 'waiting' | 'matched' | 'in_call' | 'ended';

export interface MatchQueue {
  uid: string;
  displayName: string;
  avatar: string;
  gender: 'male' | 'female';
  country: string;
  type: MatchType;
  status: MatchStatus;
  isFemaleHost?: boolean;
  preferences: {
    gender?: 'male' | 'female' | 'any';
    ageRanges?: string[];
  };
  ageRanges?: string[];
  voiceBio?: string;
  voiceBioDuration?: number;
  voiceBioLikes?: number;
  createdAt: number;
  matchedWith?: string;
}

export interface VoiceBio {
  id: string;
  uid: string;
  displayName: string;
  avatar: string;
  gender: 'male' | 'female';
  country: string;
  duration: number;
  likes: number;
  text: string;
  createdAt: number;
}

export interface QueuePreviewUser {
  uid: string;
  displayName: string;
  avatar: string;
}

import {
  DEFAULT_CALL_PRICING,
  getMinutePriceFromRates,
  type CallPricingRates,
} from './callPricingConfig';

// ==================== PRICING ====================

/** @deprecated — استخدم callPricing من useConfig */
export const MATCH_PRICING = {
  voice: DEFAULT_CALL_PRICING.match.voicePerMinute,
  video_first_minute: DEFAULT_CALL_PRICING.match.videoFirstMinute,
  video_after_minute: DEFAULT_CALL_PRICING.match.videoAfterMinute,
};

export const getMatchMinCoins = (
  type: MatchType,
  rates: CallPricingRates = DEFAULT_CALL_PRICING.match,
): number =>
  type === 'voice'
    ? rates.voicePerMinute
    : rates.videoFirstMinute;

const REAL_UID = (id: unknown) =>
  typeof id === 'string' &&
  id.length > 4 &&
  !id.startsWith('fake_') &&
  !id.startsWith('demo_');

/** أقصى مدة انتظار نشطة — يطابق مهلة البحث في شاشة المطابقة + هامش */
const ACTIVE_QUEUE_MAX_MS = 120 * 1000;

function isFreshWaitingEntry(data: Record<string, unknown>, now = Date.now()): boolean {
  if (data.status !== 'waiting' || !REAL_UID(data.uid)) return false;
  const createdAt = typeof data.createdAt === 'number' ? data.createdAt : 0;
  return now - createdAt <= ACTIVE_QUEUE_MAX_MS;
}

function countFreshWaitingEntries(
  docs: Array<{ data: () => Record<string, unknown> }>,
  filter?: (data: Record<string, unknown>) => boolean,
): number {
  const now = Date.now();
  const seen = new Set<string>();
  let count = 0;
  for (const d of docs) {
    const data = d.data();
    if (!isFreshWaitingEntry(data, now)) continue;
    if (filter && !filter(data)) continue;
    const uid = String(data.uid);
    if (seen.has(uid)) continue;
    seen.add(uid);
    count += 1;
  }
  return count;
}

/** مضيفة أنثى موثّقة — مطابقات ومكالمات مجانية */
export function isVerifiedFemaleHostUser(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  return data.agencyRole === 'host' && data.isFemaleHost === true && data.isVerified === true;
}

export function readUserGender(data: Record<string, unknown> | undefined): 'male' | 'female' {
  if (!data) return 'male';
  const g = (data.profile as { gender?: string } | undefined)?.gender ?? data.gender;
  return g === 'female' ? 'female' : 'male';
}

/** الأنثى في المطابقة — جانب مجاني (لا يشترط توثيق للاقتران) */
export function isMatchFreeSide(data: Record<string, unknown> | undefined): boolean {
  return readUserGender(data) === 'female';
}

/** @deprecated — استخدم isMatchFreeSide */
export function isMatchHostUser(data: Record<string, unknown> | undefined): boolean {
  return isMatchFreeSide(data);
}

function readQueueGender(data: Record<string, unknown>): 'male' | 'female' {
  const g = data.gender ?? (data.profile as { gender?: string } | undefined)?.gender;
  return g === 'female' ? 'female' : 'male';
}

/** مطابقة ذكر ↔ أنثى فقط */
function isCompatibleQueuePartner(
  entry: Record<string, unknown>,
  myGender: 'male' | 'female',
): boolean {
  return readQueueGender(entry) !== myGender;
}

// ==================== JOIN QUEUE ====================

export const joinMatchQueue = async (
  type: MatchType,
  preferences: MatchQueue['preferences'] = {},
  pricing: CallPricingRates = DEFAULT_CALL_PRICING.match,
): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const userDoc = await getDoc(doc(firestore, 'users', user.uid));
  if (!userDoc.exists()) throw new Error('المستخدم غير موجود');

  const userData = userDoc.data();
  const myGender = readUserGender(userData);
  const isFemaleHost = isMatchFreeSide(userData);

  if (!isFemaleHost) {
    const coins = getUserCoins(userData as Record<string, unknown>);
    const minCoins = getMatchMinCoins(type, pricing);
    if (coins < minCoins) {
      throw new Error(`تحتاج ${minCoins} عملة على الأقل للمطابقة`);
    }
  }

  const queueId = `${user.uid}_${Date.now()}`;
  await setDoc(doc(firestore, 'matchQueue', queueId), {
    uid: user.uid,
    displayName: user.displayName ?? userData.displayName ?? 'مستخدم',
    avatar: user.photoURL ?? userData.avatar ?? '',
    gender: myGender,
    country: userData.country ?? (userData.profile as { country?: string } | undefined)?.country ?? 'PS',
    isFemaleHost,
    type,
    status: 'waiting',
    preferences,
    ageRanges: preferences.ageRanges ?? [],
    createdAt: Date.now(),
  });

  return queueId;
};

export const leaveMatchQueue = async (queueId: string): Promise<void> => {
  try {
    await deleteDoc(doc(firestore, 'matchQueue', queueId));
  } catch (e) {
    console.warn('leaveMatchQueue:', e);
  }
};

export const findMatch = async (
  type: MatchType,
  myGender: 'male' | 'female',
): Promise<MatchQueue | null> => {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const q = query(
      collection(firestore, 'matchQueue'),
      where('type', '==', type),
      where('status', '==', 'waiting'),
      limit(50),
    );
    const snap = await getDocs(q);

    const candidates = snap.docs
      .map((d) => d.data() as MatchQueue)
      .filter(
        (entry) =>
          REAL_UID(entry.uid) &&
          entry.uid !== user.uid &&
          isCompatibleQueuePartner(entry as unknown as Record<string, unknown>, myGender),
      )
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

    return candidates[0] ?? null;
  } catch (e) {
    console.error('findMatch:', e);
    return null;
  }
};

export const checkIsFemaleHost = async (): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    const snap = await getDoc(doc(firestore, 'users', user.uid));
    if (!snap.exists()) return false;
    return isMatchFreeSide(snap.data());
  } catch {
    return false;
  }
};

export const getMyMatchGender = async (): Promise<'male' | 'female'> => {
  const user = auth.currentUser;
  if (!user) return 'male';
  try {
    const snap = await getDoc(doc(firestore, 'users', user.uid));
    if (!snap.exists()) return 'male';
    return readUserGender(snap.data());
  } catch {
    return 'male';
  }
};

/** عدد المنتظرين المتوافقين مع دوري */
export const getQueueCount = async (
  type: MatchType,
  myGender: 'male' | 'female' = 'male',
): Promise<number> => {
  const uid = auth.currentUser?.uid;
  try {
    const q = query(
      collection(firestore, 'matchQueue'),
      where('type', '==', type),
      where('status', '==', 'waiting'),
      limit(200),
    );
    const snap = await getDocs(q);
    return countFreshWaitingEntries(snap.docs, (data) => {
      const id = data.uid;
      return id !== uid && isCompatibleQueuePartner(data, myGender);
    });
  } catch {
    return 0;
  }
};

/** تحديث مباشر لعدد المنتظرين */
export const subscribeToQueueCount = (
  type: MatchType,
  myGender: 'male' | 'female',
  callback: (count: number) => void,
): (() => void) => {
  const uid = auth.currentUser?.uid;
  const q = query(
    collection(firestore, 'matchQueue'),
    where('type', '==', type),
    where('status', '==', 'waiting'),
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(
        countFreshWaitingEntries(snap.docs, (data) => {
          const id = data.uid;
          return id !== uid && isCompatibleQueuePartner(data, myGender);
        }),
      );
    },
    () => callback(0),
  );
};

/** عدد من يبحثون عن مطابقة الآن (للبanner في الصفحة الرئيسية) */
export const subscribeToMatchQueueOnlineCount = (
  type: MatchType,
  callback: (count: number) => void,
): (() => void) => {
  const q = query(
    collection(firestore, 'matchQueue'),
    where('type', '==', type),
    where('status', '==', 'waiting'),
  );
  return onSnapshot(
    q,
    (snap) => callback(countFreshWaitingEntries(snap.docs)),
    () => callback(0),
  );
};

/** معاينة منتظرين حقيقيين للدوائر المتحركة */
export const subscribeToQueuePreview = (
  type: MatchType,
  myGender: 'male' | 'female',
  callback: (users: QueuePreviewUser[]) => void,
): (() => void) => {
  const uid = auth.currentUser?.uid;
  const q = query(
    collection(firestore, 'matchQueue'),
    where('type', '==', type),
    where('status', '==', 'waiting'),
    limit(15),
  );
  return onSnapshot(
    q,
    (snap) => {
      const users = snap.docs
        .map((d) => d.data())
        .filter(
          (d) =>
            REAL_UID(d.uid) &&
            d.uid !== uid &&
            isCompatibleQueuePartner(d, myGender),
        )
        .slice(0, 5)
        .map((d) => ({
          uid: String(d.uid),
          displayName: String(d.displayName ?? 'مستخدم'),
          avatar: String(d.avatar ?? ''),
        }));
      callback(users);
    },
    () => callback([]),
  );
};

/** إزالة بقايا الحسابات الوهمية القديمة (مرة عند فتح الشاشة) */
export const cleanupFakeQueueEntries = async (): Promise<void> => {
  try {
    const snap = await getDocs(query(collection(firestore, 'matchQueue'), limit(100)));
    const batch = writeBatch(firestore);
    let n = 0;
    snap.docs.forEach((d) => {
      const id = d.data().uid;
      if (typeof id === 'string' && (id.startsWith('fake_') || id.startsWith('demo_'))) {
        batch.delete(d.ref);
        n++;
      }
    });
    if (n > 0) await batch.commit();
  } catch {
    // ignore
  }
};

export const subscribeToMyMatch = (
  queueId: string,
  callback: (status: MatchStatus, matchedUid?: string) => void,
): (() => void) => {
  return onSnapshot(doc(firestore, 'matchQueue', queueId), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    callback(data.status, data.matchedWith);
  });
};

/**
 * يستمع مباشرة لأي تطابق جديد للمستخدم الحالي في قائمة الانتظار.
 * يستخدم onSnapshot بدل polling لاكتشاف التطابق فوراً.
 */
export const subscribeToMyMatchStatus = (
  type: MatchType,
  callback: (result: { channelName: string; partnerUid: string } | null) => void,
): (() => void) => {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    callback(null);
    return () => {};
  }
  const q = query(
    collection(firestore, 'matchQueue'),
    where('uid', '==', uid),
  );
  return onSnapshot(
    q,
    (snap) => {
      // ⚠️ نقبل فقط وثيقة مطابقة حديثة (آخر 90 ثانية). الـ matchedAt يُضبط عبر
      //    createMatch بـ Date.now()، فالوثائق العالقة القديمة تُرفض بدل القفز
      //    إلى قناة ميتة (تسريب matchQueue غير مُنظّف من جهة السيرفر).
      const FRESH_WINDOW_MS = 90 * 1000;
      const now = Date.now();
      const matched = snap.docs
        .map((d) => d.data())
        .find(
          (d) =>
            d.type === type &&
            d.status === 'matched' &&
            d.channelName &&
            typeof d.matchedAt === 'number' &&
            now - d.matchedAt < FRESH_WINDOW_MS,
        );
      if (matched) {
        callback({
          channelName: matched.channelName as string,
          partnerUid: matched.matchedWith as string,
        });
      }
    },
    () => callback(null),
  );
};

export const getVoiceBios = async (): Promise<VoiceBio[]> => {
  try {
    const q = query(collection(firestore, 'voiceBios'), limit(50));
    const snap = await getDocs(q);
    const bios = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as VoiceBio)
      .filter((b) => REAL_UID(b.uid));
    bios.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    return bios.slice(0, 20);
  } catch (e) {
    console.error('getVoiceBios:', e);
    return [];
  }
};

export const likeVoiceBio = async (bioId: string): Promise<void> => {
  await updateDoc(doc(firestore, 'voiceBios', bioId), {
    likes: increment(1),
  });
};
