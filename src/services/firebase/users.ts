/**
 * LinkUp App — Users Service
 * إدارة بيانات المستخدمين باستخدام Firestore
 */

import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { firestore, auth } from './index';
import { subscribeWhenAuthenticated } from './authReady';
import { parseLastSeen } from '@/utils/presence';
import { resolveUserDocAvatar } from '@/utils/userAvatar';
import { parseTimestampMs } from '@/utils/joinDays';
import { statsFromFirestoreDoc } from '@/utils/userBalance';
import { generatePublicAccountId } from '@/utils/publicAccountId';
import { syncPublicAccountIndex, normalizePublicId } from '@/services/publicAccountIndex';

export interface UserDoc {
  uid: string;
  email?: string;
  phoneNumber: string;
  displayName: string;
  avatar: string;
  bio?: string;
  gender: 'male' | 'female';
  birthYear: number;
  country: string;
  residence?: string; // بلد الإقامة
  photos?: string[];
  voiceBio?: string; // رابط لتسجيل صوتي
  voiceBioDuration?: number; // مدة التسجيل بالثواني
  tags?: string[]; // وسوم المستخدم

  // Details
  height?: string;
  weight?: string;
  education?: string;
  job?: string;
  relationship?: string; // single / married / engaged / complicated

  // Wallet
  coins: number;
  pearls: number;
  casinoCoins: number;

  // Stats
  level: number;
  xp: number;
  followers: number;
  following: number;
  visitors: number;
  totalRoomsCreated: number;

  // Status
  isVerified?: boolean;
  isVIP?: boolean;
  vipLevel?: number;
  userTitles?: {
    owned: { titleId: string; obtainedAt: number; expiresAt: number | null }[];
    equipped: (string | null)[];
  };
  /** معرّف عام قابل للنسخ (8 أرقام) */
  publicAccountId?: string;

  location?: {
    latitude: number;
    longitude: number;
    geohash: string;
    updatedAt: number;
  };
  privacyHideLocation?: boolean;

  createdAt: number;
  lastSeen?: number;
  updatedAt?: number;
}

export function normalizeUserDoc(uid: string, data: Record<string, unknown>): UserDoc {
  const merged = statsFromFirestoreDoc(data);
  const createdAt = parseTimestampMs(data.createdAt);
  return {
    ...(data as unknown as UserDoc),
    uid,
    lastSeen: parseLastSeen(data.lastSeen),
    createdAt,
    level: merged.level,
    xp: merged.xp,
    coins: merged.coins,
    pearls: merged.pearls,
    casinoCoins: merged.casinoCoins,
    followers: merged.followers,
    following: merged.following,
    visitors: merged.visitors,
    totalRoomsCreated: merged.totalRoomsCreated,
  };
}

// ==================== GET USER ====================
// ⚡ cache قصير الأمد (TTL) يلغّي القراءات المكرّرة لنفس الـ uid خلال نافذة قصيرة
//    (فتح شاشة، إرسال رسالة يقرأ نفس المستخدم 3 مرات، صفوف القوائم...).
//    المستخدم الحالي يبقى محدّثاً عبر مستمع authStore، فالـ cache يخصّ الآخرين أساساً.
const _userCache = new Map<string, { data: UserDoc | null; exp: number }>();
// ⚡ كاش الطلبات الجارية: يمنع إطلاق عدّة قراءات Firestore متزامنة لنفس الـ uid
//    (صفوف القوائم/المحادثات تطلب نفس المستخدم في آنٍ واحد ⇒ قراءة واحدة فقط).
const _userInflight = new Map<string, Promise<UserDoc | null>>();
const USER_CACHE_TTL = 20_000; // 20 ثانية

/** إبطال إدخال المستخدم من الكاش (يُستدعى بعد أي كتابة على مستنده) */
export const invalidateUserCache = (uid: string): void => {
  _userCache.delete(uid);
  _userInflight.delete(uid);
};

const _fetchUser = async (uid: string): Promise<UserDoc | null> => {
  try {
    const userDoc = await getDoc(doc(firestore, 'users', uid));
    const data = userDoc.exists()
      ? normalizeUserDoc(uid, userDoc.data() as Record<string, unknown>)
      : null;
    _userCache.set(uid, { data, exp: Date.now() + USER_CACHE_TTL });
    return data;
  } catch (e) {
    console.error('getUser error:', e);
    return null;
  } finally {
    _userInflight.delete(uid);
  }
};

export const getUser = async (
  uid: string,
  opts?: { fresh?: boolean },
): Promise<UserDoc | null> => {
  if (!uid) return null;
  if (!opts?.fresh) {
    const hit = _userCache.get(uid);
    if (hit && hit.exp > Date.now()) return hit.data;
    // طلب جارٍ لنفس الـ uid؟ شاركه بدل فتح قراءة جديدة
    const pending = _userInflight.get(uid);
    if (pending) return pending;
  }
  const p = _fetchUser(uid);
  _userInflight.set(uid, p);
  return p;
};

/**
 * ⚡ قراءة دفعة مستخدمين دفعة واحدة مع إفادة الكاش/الطلبات الجارية.
 *    يُرجِع Map<uid, UserDoc|null>. استخدمها في القوائم بدل حلقة getUser.
 */
export const getUsers = async (
  uids: string[],
): Promise<Map<string, UserDoc | null>> => {
  const unique = Array.from(new Set(uids.filter(Boolean)));
  const results = await Promise.all(unique.map((uid) => getUser(uid)));
  const map = new Map<string, UserDoc | null>();
  unique.forEach((uid, i) => map.set(uid, results[i] ?? null));
  return map;
};

/** اشتراك مباشر في lastSeen + صورة العرض لمستخدم — للمحادثة */
export function subscribeToUserProfile(
  uid: string,
  callback: (patch: { lastSeen: number; avatar: string }) => void,
): () => void {
  if (!uid) return () => {};
  const ref = doc(firestore, 'users', uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as Record<string, unknown>;
      callback({
        lastSeen: parseLastSeen(data.lastSeen),
        avatar: resolveUserDocAvatar(data, uid),
      });
    },
    () => callback({ lastSeen: 0, avatar: '' }),
  );
}

/** @deprecated — استخدم subscribeToUserProfile */
export function subscribeToUserLastSeen(
  uid: string,
  callback: (lastSeen: number) => void,
): () => void {
  return subscribeToUserProfile(uid, ({ lastSeen }) => callback(lastSeen));
}

/** اسم العرض من Firestore — لا يُرجع الإيميل */
export const getResolvedDisplayName = async (
  uid: string,
  fallback = 'مستخدم',
): Promise<string> => {
  const u = await getUser(uid);
  if (!u) return fallback;
  const { resolveDisplayName } = await import('@/utils/displayName');
  return resolveDisplayName(
    { displayName: u.displayName, email: u.email },
    fallback,
  );
};

/** يحفظ المعرّف العام (8 أرقام) في Firestore إن لم يكن موجوداً — ضروري لدعوة الوكالة */
export const ensurePublicAccountId = async (uid: string): Promise<string> => {
  const ref = doc(firestore, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return generatePublicAccountId(uid);
  const data = snap.data() as Record<string, unknown>;
  if (data.publicAccountId != null && String(data.publicAccountId).trim() !== '') {
    const existing = normalizePublicId(String(data.publicAccountId));
    await syncPublicAccountIndex(existing, uid).catch(() => {});
    return existing;
  }
  const id = generatePublicAccountId(uid);
  await updateDoc(ref, { publicAccountId: id, updatedAt: Date.now() });
  await syncPublicAccountIndex(id, uid).catch(() => {});
  return id;
};

// ==================== UPDATE USER ====================
export const updateUser = async (
  uid: string,
  data: Partial<UserDoc>,
): Promise<void> => {
  // إزالة القيم undefined (Firestore لا يقبلها)
  const cleanData: Record<string, any> = { updatedAt: Date.now() };
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      cleanData[key] = value;
    }
  });
  await updateDoc(doc(firestore, 'users', uid), cleanData);
  _userCache.delete(uid); // إبطال الكاش بعد التحديث ليُقرأ الجديد
};

// ==================== CALCULATE PROFILE COMPLETENESS ====================
/**
 * يحسب نسبة اكتمال الملف الشخصي (0-100)
 * كل حقل له وزن معين
 */
export const calculateProfileCompleteness = (user: Partial<UserDoc>): number => {
  // أوزان الحقول
  const fields: Array<{ key: keyof UserDoc; weight: number }> = [
    { key: 'displayName', weight: 10 },
    { key: 'avatar', weight: 15 },
    { key: 'gender', weight: 5 },
    { key: 'birthYear', weight: 5 },
    { key: 'country', weight: 5 },
    { key: 'residence', weight: 5 },
    { key: 'bio', weight: 10 },
    { key: 'height', weight: 5 },
    { key: 'weight', weight: 5 },
    { key: 'education', weight: 5 },
    { key: 'job', weight: 5 },
    { key: 'relationship', weight: 5 },
    { key: 'photos', weight: 15 }, // album
    { key: 'voiceBio', weight: 5 },
  ];

  let total = 0;
  fields.forEach(({ key, weight }) => {
    const value = (user as any)[key];
    if (value) {
      if (key === 'photos' && Array.isArray(value) && value.length > 0) {
        total += weight;
      } else if (typeof value === 'string' && value.trim() !== '') {
        total += weight;
      } else if (typeof value === 'number' && value > 0) {
        total += weight;
      }
    }
  });

  return Math.min(100, Math.round(total));
};

// ==================== ADD/REMOVE PHOTO TO ALBUM ====================
export const addPhotoToAlbum = async (uid: string, photoUrl: string): Promise<void> => {
  const userDoc = await getUser(uid);
  if (!userDoc) throw new Error('المستخدم غير موجود');

  const photos = [...(userDoc.photos ?? []), photoUrl];
  await updateUser(uid, { photos });
};

export const removePhotoFromAlbum = async (uid: string, photoUrl: string): Promise<void> => {
  const userDoc = await getUser(uid);
  if (!userDoc) throw new Error('المستخدم غير موجود');

  const photos = (userDoc.photos ?? []).filter((p) => p !== photoUrl);
  await updateUser(uid, { photos });
};

// ==================== ADD/REMOVE TAG ====================
export const addUserTag = async (uid: string, tag: string): Promise<void> => {
  const userDoc = await getUser(uid);
  if (!userDoc) throw new Error('المستخدم غير موجود');

  const tags = [...new Set([...(userDoc.tags ?? []), tag.trim()])]; // unique
  await updateUser(uid, { tags });
};

export const removeUserTag = async (uid: string, tag: string): Promise<void> => {
  const userDoc = await getUser(uid);
  if (!userDoc) throw new Error('المستخدم غير موجود');

  const tags = (userDoc.tags ?? []).filter((t) => t !== tag);
  await updateUser(uid, { tags });
};

// ==================== GET USERS LIST (DISCOVER) ====================
// نسحب كل المستخدمين ونصفي/نرتب في الكلاينت لتجنب الحاجة لـ Firestore indexes
export const getDiscoverUsers = async (
  filters: {
    country?: string;
    gender?: 'male' | 'female';
    minLevel?: number;
    excludeUid?: string;
  } = {},
  pageSize: number = 20,
  lastDoc?: QueryDocumentSnapshot<DocumentData>,
): Promise<{ users: UserDoc[]; lastDoc?: QueryDocumentSnapshot<DocumentData> }> => {
  try {
    const wantCountry = filters.country?.trim().toUpperCase();
    const fetchLimit = wantCountry ? Math.min(Math.max(pageSize, 40), 100) : 100;

    let snap;
    if (wantCountry) {
      // استعلام مباشر بنفس الدولة (حقل واحد — لا يحتاج فهرس مركّب)
      try {
        snap = await getDocs(
          query(
            collection(firestore, 'users'),
            where('country', '==', wantCountry),
            limit(fetchLimit),
          ),
        );
      } catch {
        snap = null;
      }
      if (!snap || snap.empty) {
        snap = await getDocs(query(collection(firestore, 'users'), limit(100)));
      }
    } else {
      snap = await getDocs(query(collection(firestore, 'users'), limit(100)));
    }

    let users: UserDoc[] = snap.docs.map((d) =>
      normalizeUserDoc(d.id, d.data() as Record<string, unknown>),
    );

    if (wantCountry) {
      users = users.filter(
        (u) => (u.country ?? '').trim().toUpperCase() === wantCountry,
      );
    }
    if (filters.gender) {
      users = users.filter((u) => u.gender === filters.gender);
    }
    if (filters.minLevel) {
      users = users.filter((u) => (u.level ?? 1) >= filters.minLevel!);
    }
    const excludeUid = filters.excludeUid ?? auth.currentUser?.uid;
    if (excludeUid) {
      users = users.filter((u) => u.uid !== excludeUid);
    }

    // ترتيب حسب lastSeen في الكلاينت
    users.sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));

    // تطبيق pageSize
    users = users.slice(0, pageSize);

    return { users, lastDoc: snap.docs[snap.docs.length - 1] };
  } catch (e) {
    console.error('getDiscoverUsers error:', e);
    return { users: [] };
  }
};

/** فلترة/ترتيب قائمة الاكتشاف على العميل — مشتركة بين الجلب لمرة واحدة والاشتراك الحي */
function applyDiscoverFilters(
  all: UserDoc[],
  filters: {
    country?: string;
    gender?: 'male' | 'female';
    minLevel?: number;
    excludeUid?: string;
  },
  pageSize: number,
): UserDoc[] {
  const wantCountry = filters.country?.trim().toUpperCase();
  let users = [...all];
  if (wantCountry) {
    const filtered = users.filter(
      (u) => (u.country ?? '').trim().toUpperCase() === wantCountry,
    );
    // لو لا يوجد أحد بنفس الدولة، اعرض الكل بدل قائمة فارغة
    if (filtered.length > 0) users = filtered;
  }
  if (filters.gender) users = users.filter((u) => u.gender === filters.gender);
  if (filters.minLevel) users = users.filter((u) => (u.level ?? 1) >= filters.minLevel!);
  const excludeUid = filters.excludeUid ?? auth.currentUser?.uid;
  if (excludeUid) users = users.filter((u) => u.uid !== excludeUid);
  users.sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));
  return users.slice(0, pageSize);
}

/**
 * اشتراك حيّ (realtime) بقائمة اكتشاف المستخدمين.
 * يستدعي onData فوراً عند أي تغيير في users دون الحاجة لإعادة فتح التطبيق.
 * يُرجع دالة إلغاء الاشتراك.
 */
export const subscribeToDiscoverUsers = (
  filters: {
    country?: string;
    gender?: 'male' | 'female';
    minLevel?: number;
    excludeUid?: string;
  } = {},
  pageSize: number = 20,
  onData?: (users: UserDoc[]) => void,
): (() => void) => {
  const wantCountry = filters.country?.trim().toUpperCase();
  const fetchLimit = wantCountry ? Math.min(Math.max(pageSize, 40), 100) : 100;

  const baseQuery = wantCountry
    ? query(
        collection(firestore, 'users'),
        where('country', '==', wantCountry),
        limit(fetchLimit),
      )
    : query(collection(firestore, 'users'), limit(100));

  const handle = (docs: QueryDocumentSnapshot<DocumentData>[]) => {
    const all = docs.map((d) =>
      normalizeUserDoc(d.id, d.data() as Record<string, unknown>),
    );
    onData?.(applyDiscoverFilters(all, filters, pageSize));
  };

  let unsubSnapshot: (() => void) | undefined;

  const startSnapshot = () => {
    unsubSnapshot?.();
    unsubSnapshot = onSnapshot(
      baseQuery,
      (snap) => {
        if (wantCountry && snap.empty) {
          getDocs(query(collection(firestore, 'users'), limit(100)))
            .then((s) => handle(s.docs))
            .catch((e) => {
              if (auth.currentUser) console.error('subscribeToDiscoverUsers fallback:', e);
            });
          return;
        }
        handle(snap.docs);
      },
      (e) => {
        if (auth.currentUser) console.error('subscribeToDiscoverUsers:', e);
        else onData?.([]);
      },
    );
  };

  const unsubAuth = subscribeWhenAuthenticated(
    () => startSnapshot(),
    () => {
      unsubSnapshot?.();
      unsubSnapshot = undefined;
      onData?.([]);
    },
  );

  return () => {
    unsubAuth();
    unsubSnapshot?.();
  };
};

// ==================== GET LEADERBOARD ====================
// orderBy على حقل واحد مسموح بدون index
export const getLeaderboard = async (
  category: 'coins' | 'gifts' | 'followers' | 'level',
  period: 'daily' | 'weekly' | 'monthly' | 'all' = 'all',
  limitCount: number = 100,
): Promise<UserDoc[]> => {
  try {
    // سحب بدون orderBy ثم رتب في الكلاينت
    const q = query(collection(firestore, 'users'), limit(limitCount));
    const snap = await getDocs(q);
    let users = snap.docs.map((d) =>
      normalizeUserDoc(d.id, d.data() as Record<string, unknown>),
    );

    // ترتيب في الكلاينت
    const sortField =
      category === 'coins' ? 'coins'
      : category === 'gifts' ? 'pearls'
      : category === 'followers' ? 'followers'
      : 'level';

    users = users.filter((u) => {
      const ps = (u as unknown as Record<string, unknown>).privacySettings as { hideFromRanking?: boolean } | undefined;
      return !ps?.hideFromRanking;
    });

    users.sort((a, b) => ((b as any)[sortField] ?? 0) - ((a as any)[sortField] ?? 0));
    return users;
  } catch (e) {
    console.error('getLeaderboard error:', e);
    return [];
  }
};

// ==================== SEARCH USERS ====================
export const searchUsers = async (searchTerm: string): Promise<UserDoc[]> => {
  try {
    // سحب الكل وفلتر في الكلاينت
    const q = query(collection(firestore, 'users'), limit(100));
    const snap = await getDocs(q);
    const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserDoc);

    const term = searchTerm.toLowerCase();
    return users.filter((u) => {
      const ps = (u as unknown as Record<string, unknown>).privacySettings as { profileUnsearchable?: boolean } | undefined;
      if (ps?.profileUnsearchable) return false;
      return (
        u.displayName?.toLowerCase().includes(term) ||
        u.uid.toLowerCase().includes(term) ||
        String((u as UserDoc).publicAccountId ?? '').includes(term)
      );
    }).slice(0, 20);
  } catch (e) {
    console.error('searchUsers error:', e);
    return [];
  }
};

// ==================== SEED DEMO USERS ====================
export const seedDemoUsers = async (): Promise<void> => {
  if (!auth.currentUser) return;

  const checkSnap = await getDocs(
    query(collection(firestore, 'users'), limit(1)),
  );
  if (!checkSnap.empty) {
    console.log('Users already seeded');
    return;
  }

  const demoUsers = [
    { name: 'محمود جميل', country: 'PS', gender: 'male', img: 12, level: 12, coins: 5420, pearls: 12500 },
    { name: 'مريم العتيبي', country: 'SA', gender: 'female', img: 47, level: 18, coins: 28400, pearls: 45000, isVIP: true },
    { name: 'سارة أحمد', country: 'EG', gender: 'female', img: 44, level: 14, coins: 8200, pearls: 22000 },
    { name: 'يوسف الفهد', country: 'AE', gender: 'male', img: 33, level: 22, coins: 45000, pearls: 78000, isVIP: true },
    { name: 'علي القحطاني', country: 'KW', gender: 'male', img: 8, level: 16, coins: 18500, pearls: 31000 },
    { name: 'ليلى المغربية', country: 'MA', gender: 'female', img: 45, level: 20, coins: 32000, pearls: 56000, isVIP: true },
    { name: 'محمد العتيبي', country: 'SA', gender: 'male', img: 15, level: 25, coins: 95000, pearls: 120000, isVIP: true },
    { name: 'فاطمة الزهراء', country: 'JO', gender: 'female', img: 16, level: 10, coins: 3400, pearls: 8500 },
    { name: 'خالد البحريني', country: 'BH', gender: 'male', img: 11, level: 28, coins: 145000, pearls: 230000, isVIP: true },
    { name: 'منى السورية', country: 'SY', gender: 'female', img: 48, level: 8, coins: 2100, pearls: 4500 },
    { name: 'حسن العراقي', country: 'IQ', gender: 'male', img: 22, level: 13, coins: 6700, pearls: 15000 },
    { name: 'نور القطرية', country: 'QA', gender: 'female', img: 49, level: 17, coins: 22000, pearls: 38000 },
    { name: 'أحمد التونسي', country: 'TN', gender: 'male', img: 18, level: 11, coins: 4200, pearls: 9800 },
    { name: 'هند العمانية', country: 'OM', gender: 'female', img: 32, level: 19, coins: 31000, pearls: 52000, isVIP: true },
    { name: 'سعيد الجزائري', country: 'DZ', gender: 'male', img: 14, level: 15, coins: 12500, pearls: 24000 },
  ];

  for (const u of demoUsers) {
    const uid = `demo_${u.name.replace(/\s+/g, '_')}`;
    await setDoc(doc(firestore, 'users', uid), {
      uid,
      phoneNumber: `+9665${Math.floor(Math.random() * 100000000)}`,
      displayName: u.name,
      avatar: `https://i.pravatar.cc/200?img=${u.img}`,
      gender: u.gender,
      birthYear: 1990 + Math.floor(Math.random() * 15),
      country: u.country,
      bio: 'مرحباً بكم في LinkUp',
      coins: u.coins,
      pearls: u.pearls,
      casinoCoins: Math.floor(Math.random() * 1000),
      level: u.level,
      xp: u.level * 1000 + Math.floor(Math.random() * 1000),
      followers: Math.floor(Math.random() * 5000),
      following: Math.floor(Math.random() * 500),
      visitors: Math.floor(Math.random() * 10000),
      totalRoomsCreated: Math.floor(Math.random() * 20),
      isVerified: Math.random() > 0.5,
      isVIP: u.isVIP ?? false,
      vipLevel: u.isVIP ? Math.floor(Math.random() * 10) + 1 : 0,
      createdAt: Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 365,
      lastSeen: Date.now() - Math.random() * 1000 * 60 * 60,
    });
  }

  console.log('✅ Seeded', demoUsers.length, 'demo users');
};
