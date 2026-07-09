/**
 * LinkUp App — Agencies & Relationships Service
 *
 * نظام العلاقات بـ 15 مستوى:
 * - يبدأ تلقائياً عند تبادل أول رسالة
 * - يتطور بناءً على إجمالي الـ Intimacy Points
 * - كل هدية تضيف نقاط (= قيمة الهدية × 1)
 * - كل رسالة تبادل تضيف 5 نقاط
 *
 * المزايا حسب المستوى:
 * - LV1-2: علاقة عادية (شات فقط)
 * - LV3: ميزة ستيكرز خاصة
 * - LV5: مكالمة صوتية مجانية (10 دقائق يومياً)
 * - LV7: ثيم شات مخصص
 * - LV10: مكالمة فيديو مجانية (5 دقائق يومياً)
 * - LV12: شارة "أصدقاء مقربون"
 * - LV15: علاقة مدى الحياة + شارة ذهبية
 */

import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  addDoc,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  where,
  increment,
  onSnapshot,
} from 'firebase/firestore';
import { firestore, auth } from './index';
import { waitForFirestoreAuth } from './authReady';
import { buildBalanceIncrementPatch, getUserCoins } from '@/utils/userBalance';

// ==================== AGENCIES ====================
export interface Agency {
  id: string;
  name: string;
  banner: string;
  logo: string;
  country: string;
  ownerName: string;
  ownerUid?: string;
  liveRoomId?: string;
  members: number;
  rank: number;
  earnings: number;
  rating: number;
  isVerified?: boolean;
  isHiring?: boolean;
  description: string;
  periodSupportCoins?: number;
  periodSupportWeekKey?: string;
  /** إطار بطاقة الوكالة في قائمة الغرف */
  cardFrameId?: string;
  cardFrameUrl?: string;
  /** خلفية معاينة البطاقة */
  cardBackgroundUrl?: string;
  roomFrameId?: string;
  roomBackgroundUrl?: string;
  isCountryOfficialAgency?: boolean;
  countryOfficialFor?: string;
}

function mapAgencyDoc(id: string, data: Record<string, unknown>, index: number): Agency {
  const ownerAvatar = String(data.ownerAvatar ?? '');
  const logoUrl = String(data.logo ?? '');
  const bannerUrl = String(data.banner ?? '');
  const resolvedLogo = logoUrl.startsWith('http') ? logoUrl : ownerAvatar;
  const resolvedBanner =
    bannerUrl.startsWith('http') ? bannerUrl
    : resolvedLogo.startsWith('http') ? resolvedLogo
    : `https://picsum.photos/seed/ag-${id}/400/200`;
  return {
    id,
    name: String(data.name ?? 'وكالة'),
    banner: resolvedBanner,
    logo: resolvedLogo,
    country: String(data.country ?? 'PS'),
    ownerName: String(data.ownerName ?? ''),
    ownerUid: data.ownerUid ? String(data.ownerUid) : undefined,
    liveRoomId: data.liveRoomId ? String(data.liveRoomId) : undefined,
    members: Number(data.members ?? data.memberCount ?? 0) || 0,
    rank: Number(data.rank ?? index + 1) || index + 1,
    earnings: Number(data.earnings ?? data.totalEarnings ?? 0) || 0,
    rating: Number(data.rating ?? 5) || 5,
    isVerified: Boolean(data.isVerified),
    isHiring: data.isHiring !== false,
    description: String(data.description ?? ''),
    periodSupportCoins: Number(data.periodSupportCoins ?? 0) || 0,
    periodSupportWeekKey: data.periodSupportWeekKey
      ? String(data.periodSupportWeekKey)
      : undefined,
    cardFrameId: data.cardFrameId ? String(data.cardFrameId) : undefined,
    cardFrameUrl: data.cardFrameUrl ? String(data.cardFrameUrl) : undefined,
    cardBackgroundUrl: data.cardBackgroundUrl ? String(data.cardBackgroundUrl) : undefined,
    roomFrameId: data.roomFrameId ? String(data.roomFrameId) : undefined,
    roomBackgroundUrl: data.roomBackgroundUrl ? String(data.roomBackgroundUrl) : undefined,
    isCountryOfficialAgency: data.isCountryOfficialAgency === true,
    countryOfficialFor: data.countryOfficialFor ? String(data.countryOfficialFor) : undefined,
  };
}

let _agenciesCacheVersion = 0;
export function getAgenciesCacheVersion(): number { return _agenciesCacheVersion; }
export function invalidateAgenciesCache(): void { _agenciesCacheVersion += 1; }

/** كل الوكالات — بما فيها المُنشأة من لوحة التحكم */
export const getAgencies = async (): Promise<Agency[]> => {
  try {
    const user = auth.currentUser ?? (await waitForFirestoreAuth());
    if (!user) return [];

    let snap;
    try {
      snap = await getDocs(
        query(collection(firestore, 'agencies'), orderBy('createdAt', 'desc'), limit(80)),
      );
    } catch {
      snap = await getDocs(query(collection(firestore, 'agencies'), limit(80)));
    }
    const list = snap.docs.map((d, i) => mapAgencyDoc(d.id, d.data() as Record<string, unknown>, i));
    return list.sort((a, b) => a.rank - b.rank);
  } catch (e) {
    if (auth.currentUser) console.error('getAgencies:', e);
    return [];
  }
};

/** اشتراك فوري بتحديثات الوكالات (خلفيات/إطارات البطاقة) */
export const subscribeToAgencies = (
  callback: (agencies: Agency[]) => void,
  limitN = 80,
): (() => void) => {
  const user = auth.currentUser;
  if (!user) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(firestore, 'agencies'),
    orderBy('createdAt', 'desc'),
    limit(limitN),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d, i) =>
        mapAgencyDoc(d.id, d.data() as Record<string, unknown>, i),
      );
      callback(list.sort((a, b) => a.rank - b.rank));
    },
    () => callback([]),
  );
};

export const seedDemoAgencies = async (): Promise<void> => {
  if (!auth.currentUser) return;

  const q = query(collection(firestore, 'agencies'), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) return;

  const demos: Omit<Agency, 'id'>[] = [
    {
      name: 'وكالة النخبة',
      banner: 'https://picsum.photos/seed/agency1/400/200',
      logo: 'https://i.pravatar.cc/100?img=51',
      country: 'SA',
      ownerName: 'أبو خالد',
      members: 124,
      rank: 1,
      earnings: 12500000,
      rating: 4.9,
      isVerified: true,
      isHiring: true,
      description: 'وكالة احترافية للمضيفين والمضيفات بأعلى نسب أرباح',
    },
    {
      name: 'وكالة الملوك',
      banner: 'https://picsum.photos/seed/agency2/400/200',
      logo: 'https://i.pravatar.cc/100?img=52',
      country: 'AE',
      ownerName: 'الفهد',
      members: 89,
      rank: 2,
      earnings: 9800000,
      rating: 4.8,
      isVerified: true,
      isHiring: true,
      description: 'نوفر تدريب احترافي وأرباح ممتازة',
    },
    {
      name: 'وكالة الأقمار',
      banner: 'https://picsum.photos/seed/agency3/400/200',
      logo: 'https://i.pravatar.cc/100?img=53',
      country: 'KW',
      ownerName: 'القمر',
      members: 67,
      rank: 3,
      earnings: 6500000,
      rating: 4.7,
      description: 'وكالة شبابية بجو ودود ومحفّز',
    },
  ];

  for (const a of demos) {
    await addDoc(collection(firestore, 'agencies'), a);
  }
};

// ==================== RELATIONSHIP SYSTEM ====================

/**
 * بيانات العلاقة بين شخصين
 * - علاقة واحدة بين كل شخصين (مشتركة)
 * - documentId = `relationship_${minUid}_${maxUid}` لضمان المرجع الفريد
 */
export interface Relationship {
  id: string;
  user1Uid: string; // الأصغر uid abc
  user2Uid: string; // الأكبر uid
  user1Name: string;
  user1Avatar: string;
  user2Name: string;
  user2Avatar: string;
  level: number; // 1-15
  intimacyPoints: number; // إجمالي النقاط (هدايا + رسائل)
  giftsExchanged: number; // عدد الهدايا المتبادلة
  messagesExchanged: number; // عدد الرسائل
  callMinutesUsedToday: { voice: number; video: number };
  callsResetDate: string; // YYYY-MM-DD
  type: 'friend' | 'best-friend' | 'partner' | 'soulmate';
  customTitle?: string; // عنوان مخصص للعلاقة
  createdAt: number;
  updatedAt: number;
}

// ==================== LEVEL TABLE ====================

/**
 * جدول المستويات: النقاط المطلوبة لكل مستوى
 */
export const RELATIONSHIP_LEVELS: {
  level: number;
  pointsRequired: number;
  title: string;
  iconName: string; // lucide-react-native icon name
  color: string;
  perks: string[];
}[] = [
  { level: 1, pointsRequired: 0, title: 'تعارف', iconName: 'Hand', color: '#9A9AA5', perks: [] },
  { level: 2, pointsRequired: 500, title: 'معرفة', iconName: 'Handshake', color: '#EC3E3E', perks: ['ظهور حالة الكتابة'] },
  { level: 3, pointsRequired: 1500, title: 'صديق', iconName: 'Smile', color: '#2BD9A8', perks: ['ستيكرز خاصة'] },
  { level: 4, pointsRequired: 3500, title: 'صديق مقرب', iconName: 'UserPlus', color: '#2BD9A8', perks: ['ستيكرز خاصة', 'إيموجي تفاعلي'] },
  { level: 5, pointsRequired: 7500, title: 'صداقة قوية', iconName: 'HeartHandshake', color: '#2BD9A8', perks: ['ستيكرز خاصة', 'مكالمة صوتية مجانية 10د/يوم'] },
  { level: 6, pointsRequired: 15_000, title: 'علاقة وثيقة', iconName: 'Heart', color: '#FFC53D', perks: ['+ مكالمة صوتية 15د/يوم'] },
  { level: 7, pointsRequired: 30_000, title: 'علاقة مميزة', iconName: 'Heart', color: '#FF9A2E', perks: ['ثيم شات مخصص', 'مكالمة صوتية 20د/يوم'] },
  { level: 8, pointsRequired: 60_000, title: 'صديق العمر', iconName: 'Heart', color: '#FF2E62', perks: ['+ ثيمات حصرية'] },
  { level: 9, pointsRequired: 120_000, title: 'صديق روحي', iconName: 'HeartPulse', color: '#E11414', perks: ['ستيكرز VIP'] },
  { level: 10, pointsRequired: 250_000, title: 'رفيق الدرب', iconName: 'HeartPulse', color: '#FF5C5C', perks: ['مكالمة فيديو مجانية 5د/يوم'] },
  { level: 11, pointsRequired: 500_000, title: 'حبيب القلب', iconName: 'HeartPulse', color: '#E02B2B', perks: ['+ فيديو 10د/يوم'] },
  { level: 12, pointsRequired: 1_000_000, title: 'أصدقاء مقربون', iconName: 'Sparkles', color: '#E11414', perks: ['شارة على البروفايل', 'فيديو 15د/يوم'] },
  { level: 13, pointsRequired: 2_000_000, title: 'علاقة أبدية', iconName: 'Gem', color: '#E11414', perks: ['شارة ذهبية', 'فيديو 20د/يوم'] },
  { level: 14, pointsRequired: 5_000_000, title: 'توأم الروح', iconName: 'Crown', color: '#E11414', perks: ['مكالمات غير محدودة'] },
  { level: 15, pointsRequired: 10_000_000, title: 'علاقة الأسطورة', iconName: 'Star', color: '#FFC53D', perks: ['تأثيرات حصرية', 'مكالمات غير محدودة'] },
];

/**
 * احسب المستوى الحالي من إجمالي النقاط
 */
export const calculateLevel = (points: number): {
  level: number;
  currentLevelInfo: typeof RELATIONSHIP_LEVELS[0];
  nextLevelInfo?: typeof RELATIONSHIP_LEVELS[0];
  progress: number; // 0-100%
  pointsToNext: number;
} => {
  let currentLevel = 1;
  for (let i = RELATIONSHIP_LEVELS.length - 1; i >= 0; i--) {
    if (points >= RELATIONSHIP_LEVELS[i]!.pointsRequired) {
      currentLevel = RELATIONSHIP_LEVELS[i]!.level;
      break;
    }
  }

  const currentLevelInfo = RELATIONSHIP_LEVELS.find((l) => l.level === currentLevel)!;
  const nextLevelInfo = RELATIONSHIP_LEVELS.find((l) => l.level === currentLevel + 1);

  if (!nextLevelInfo) {
    return { level: 15, currentLevelInfo, progress: 100, pointsToNext: 0 };
  }

  const pointsInCurrentLevel = points - currentLevelInfo.pointsRequired;
  const pointsNeededForNext = nextLevelInfo.pointsRequired - currentLevelInfo.pointsRequired;
  const progress = Math.min(100, (pointsInCurrentLevel / pointsNeededForNext) * 100);

  return {
    level: currentLevel,
    currentLevelInfo,
    nextLevelInfo,
    progress,
    pointsToNext: nextLevelInfo.pointsRequired - points,
  };
};

// ==================== HELPER: GET RELATIONSHIP ID ====================

/**
 * توليد ID ثابت بين شخصين (مهما كان الترتيب)
 */
export const getRelationshipId = (uid1: string, uid2: string): string => {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
};

// ==================== GET RELATIONSHIP (Single) ====================

/**
 * جلب العلاقة مع مستخدم معين (تنشأ تلقائياً إذا لم تكن موجودة)
 */
export const getOrCreateRelationship = async (
  partnerUid: string,
  partnerName: string,
  partnerAvatar: string,
): Promise<Relationship | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  if (user.uid === partnerUid) return null; // لا علاقة مع النفس

  const relId = getRelationshipId(user.uid, partnerUid);
  const relRef = doc(firestore, 'relationships', relId);

  try {
    const snap = await getDoc(relRef);
    if (snap.exists()) {
      return { id: snap.id, ...(snap.data() as any) };
    }

    // إنشاء جديدة
    const myUserSnap = await getDoc(doc(firestore, 'users', user.uid));
    const myData = myUserSnap.exists() ? myUserSnap.data() : {};

    const isMineFirst = user.uid < partnerUid;
    const today = new Date().toISOString().slice(0, 10);

    const newRel: Omit<Relationship, 'id'> = {
      user1Uid: isMineFirst ? user.uid : partnerUid,
      user2Uid: isMineFirst ? partnerUid : user.uid,
      user1Name: isMineFirst ? (myData.displayName ?? 'مستخدم') : partnerName,
      user1Avatar: isMineFirst ? (myData.avatar ?? '') : partnerAvatar,
      user2Name: isMineFirst ? partnerName : (myData.displayName ?? 'مستخدم'),
      user2Avatar: isMineFirst ? partnerAvatar : (myData.avatar ?? ''),
      level: 1,
      intimacyPoints: 0,
      giftsExchanged: 0,
      messagesExchanged: 0,
      callMinutesUsedToday: { voice: 0, video: 0 },
      callsResetDate: today,
      type: 'friend',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await setDoc(relRef, newRel);
    return { id: relId, ...newRel };
  } catch (e) {
    console.error('getOrCreateRelationship:', e);
    return null;
  }
};

// ==================== ADD POINTS ====================

/**
 * إضافة Intimacy Points للعلاقة
 * - عند إرسال هدية: amount = قيمة الهدية بالعملات
 * - عند رسالة: amount = 5
 */
export const addRelationshipPoints = async (
  partnerUid: string,
  partnerName: string,
  partnerAvatar: string,
  amount: number,
  source: 'gift' | 'message' | 'call',
): Promise<{
  newLevel: number;
  levelUp: boolean;
  previousLevel: number;
  newPoints: number;
}> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');

  const rel = await getOrCreateRelationship(partnerUid, partnerName, partnerAvatar);
  if (!rel) throw new Error('فشل إنشاء العلاقة');

  const relRef = doc(firestore, 'relationships', rel.id);
  const previousLevel = rel.level;
  const newPoints = rel.intimacyPoints + amount;
  const { level: newLevel } = calculateLevel(newPoints);

  // تحديث
  const updates: any = {
    intimacyPoints: increment(amount),
    updatedAt: Date.now(),
  };

  if (source === 'gift') updates.giftsExchanged = increment(1);
  if (source === 'message') updates.messagesExchanged = increment(1);

  if (newLevel !== previousLevel) {
    updates.level = newLevel;
    // تحديث الـ type بناءً على المستوى
    if (newLevel >= 12) updates.type = 'soulmate';
    else if (newLevel >= 8) updates.type = 'partner';
    else if (newLevel >= 5) updates.type = 'best-friend';
    else updates.type = 'friend';
  }

  await updateDoc(relRef, updates);

  return {
    newLevel,
    levelUp: newLevel > previousLevel,
    previousLevel,
    newPoints,
  };
};

// ==================== USE FREE CALL MINUTES ====================

/**
 * استخدام دقائق المكالمة المجانية اليومية
 */
export const useFreeCallMinutes = async (
  partnerUid: string,
  callType: 'voice' | 'video',
  minutes: number,
): Promise<{ success: boolean; remainingMinutes: number }> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');

  const relId = getRelationshipId(user.uid, partnerUid);
  const relRef = doc(firestore, 'relationships', relId);
  const snap = await getDoc(relRef);
  if (!snap.exists()) return { success: false, remainingMinutes: 0 };

  const rel = snap.data() as Relationship;
  const today = new Date().toISOString().slice(0, 10);

  // Reset counter if new day
  let voiceMinutes = rel.callMinutesUsedToday?.voice ?? 0;
  let videoMinutes = rel.callMinutesUsedToday?.video ?? 0;
  if (rel.callsResetDate !== today) {
    voiceMinutes = 0;
    videoMinutes = 0;
  }

  // قيود حسب المستوى
  const maxMinutes = getMaxFreeMinutes(rel.level, callType);
  if (maxMinutes === 0) {
    return { success: false, remainingMinutes: 0 };
  }

  const used = callType === 'voice' ? voiceMinutes : videoMinutes;
  if (used + minutes > maxMinutes) {
    return { success: false, remainingMinutes: maxMinutes - used };
  }

  // تحديث
  await updateDoc(relRef, {
    [`callMinutesUsedToday.${callType}`]: used + minutes,
    callsResetDate: today,
  });

  return {
    success: true,
    remainingMinutes: maxMinutes - (used + minutes),
  };
};

/**
 * الحد الأقصى للدقائق المجانية حسب المستوى
 */
export const getMaxFreeMinutes = (level: number, type: 'voice' | 'video'): number => {
  if (type === 'voice') {
    if (level >= 14) return 9999; // غير محدود
    if (level >= 8) return 20;
    if (level >= 7) return 20;
    if (level >= 6) return 15;
    if (level >= 5) return 10;
    return 0;
  } else {
    // video
    if (level >= 14) return 9999;
    if (level >= 13) return 20;
    if (level >= 12) return 15;
    if (level >= 11) return 10;
    if (level >= 10) return 5;
    return 0;
  }
};

// ==================== GET MY RELATIONSHIPS LIST ====================

/**
 * جلب كل علاقاتي
 */
/**
 * أعلى مستوى علاقة لمستخدم معيّن (لعرض وسام «مستوى العلاقة» في الروم/البروفايل).
 * استعلامان فقط ويُخزَّن في كاش ميتاداتا الدردشة، فلا يُكرَّر مع كل رسالة.
 */
export const getTopRelationshipLevelForUser = async (uid: string): Promise<number> => {
  if (!uid) return 0;
  try {
    const q1 = query(collection(firestore, 'relationships'), where('user1Uid', '==', uid), limit(50));
    const q2 = query(collection(firestore, 'relationships'), where('user2Uid', '==', uid), limit(50));
    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    let best = 0;
    snap1.forEach((d) => { const l = Number((d.data() as any).level ?? 0); if (l > best) best = l; });
    snap2.forEach((d) => { const l = Number((d.data() as any).level ?? 0); if (l > best) best = l; });
    return best;
  } catch {
    return 0;
  }
};

export const getMyRelationships = async (): Promise<Relationship[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    // Query بكل العلاقات التي أنا فيها user1 أو user2
    const q1 = query(
      collection(firestore, 'relationships'),
      where('user1Uid', '==', user.uid),
      limit(50),
    );
    const q2 = query(
      collection(firestore, 'relationships'),
      where('user2Uid', '==', user.uid),
      limit(50),
    );

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const rels: Relationship[] = [];
    snap1.forEach((d) => rels.push({ id: d.id, ...(d.data() as any) }));
    snap2.forEach((d) => rels.push({ id: d.id, ...(d.data() as any) }));

    // ترتيب حسب المستوى
    rels.sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    return rels;
  } catch (e) {
    console.error('getMyRelationships:', e);
    return [];
  }
};

// ==================== GET RELATIONSHIP WITH SPECIFIC USER ====================

export const getRelationshipWith = async (
  partnerUid: string,
): Promise<Relationship | null> => {
  const user = auth.currentUser;
  if (!user) return null;

  const relId = getRelationshipId(user.uid, partnerUid);
  try {
    const snap = await getDoc(doc(firestore, 'relationships', relId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as any) };
  } catch (e) {
    return null;
  }
};

// ==================== GET PARTNER INFO ====================

/**
 * من Relationship، احصل على بيانات الشريك (الطرف الآخر)
 */
export const getPartnerInfo = (rel: Relationship, myUid: string): {
  uid: string;
  name: string;
  avatar: string;
} => {
  if (rel.user1Uid === myUid) {
    return { uid: rel.user2Uid, name: rel.user2Name, avatar: rel.user2Avatar };
  }
  return { uid: rel.user1Uid, name: rel.user1Name, avatar: rel.user1Avatar };
};

// ==================== PURCHASE LEVEL UPGRADE ====================

/**
 * شراء ترقية مستوى مباشرة بالعملات
 * - يخصم النقاط المطلوبة للمستوى التالي
 * - يضيف intimacyPoints للعلاقة
 * - يخصم من رصيد المستخدم
 */
export const purchaseLevelUpgrade = async (
  partnerUid: string,
  partnerName: string,
  partnerAvatar: string,
): Promise<{
  success: boolean;
  newLevel: number;
  previousLevel: number;
  pointsAdded: number;
  coinsSpent: number;
  perks: string[];
}> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');

  // جلب أو إنشاء العلاقة
  const rel = await getOrCreateRelationship(partnerUid, partnerName, partnerAvatar);
  if (!rel) throw new Error('فشل في جلب العلاقة');

  const currentInfo = calculateLevel(rel.intimacyPoints);
  if (!currentInfo.nextLevelInfo) {
    throw new Error('وصلت للحد الأقصى من المستويات');
  }

  // النقاط المطلوبة = الفرق بين المستوى الحالي والتالي
  const pointsNeeded = currentInfo.pointsToNext;
  // التكلفة = 1 عملة لكل نقطة (يمكن تعديلها)
  const coinsRequired = pointsNeeded;

  // جلب رصيد المستخدم
  const { doc: docRef, getDoc, updateDoc, increment } = await import('firebase/firestore');
  const userRef = docRef(firestore, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error('المستخدم غير موجود');

  const userData = userSnap.data();
  const currentCoins = getUserCoins(userData as Record<string, unknown>);

  if (currentCoins < coinsRequired) {
    throw new Error(`تحتاج ${coinsRequired.toLocaleString()} عملة. لديك ${currentCoins.toLocaleString()} فقط`);
  }

  // خصم العملات
  await updateDoc(userRef, buildBalanceIncrementPatch('coins', -coinsRequired));

  // إضافة النقاط للعلاقة
  const relRef = docRef(firestore, 'relationships', rel.id);
  const newPoints = rel.intimacyPoints + pointsNeeded;
  const newLevelInfo = calculateLevel(newPoints);

  await updateDoc(relRef, {
    intimacyPoints: increment(pointsNeeded),
    level: newLevelInfo.level,
    type: newLevelInfo.level >= 12 ? 'soulmate' :
          newLevelInfo.level >= 8 ? 'partner' :
          newLevelInfo.level >= 5 ? 'best-friend' : 'friend',
    updatedAt: Date.now(),
  });

  // معاملة في سجل العملات
  const { collection, addDoc } = await import('firebase/firestore');
  await addDoc(collection(firestore, 'transactions'), {
    uid: user.uid,
    type: 'relationship_upgrade',
    amount: -coinsRequired,
    currency: 'coins',
    itemName: `ترقية علاقة مع ${partnerName}`,
    metadata: {
      partnerUid,
      fromLevel: currentInfo.level,
      toLevel: newLevelInfo.level,
    },
    status: 'completed',
    createdAt: Date.now(),
  });

  return {
    success: true,
    newLevel: newLevelInfo.level,
    previousLevel: currentInfo.level,
    pointsAdded: pointsNeeded,
    coinsSpent: coinsRequired,
    perks: newLevelInfo.currentLevelInfo.perks,
  };
};

// ==================== SEED DEMO ====================
export const seedDemoRelationships = async (): Promise<void> => {
  // قديم - يُترك للتوافق
  // التغذية الفعلية تحدث عبر إرسال الهدايا والرسائل
};
