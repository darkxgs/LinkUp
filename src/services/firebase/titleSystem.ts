/**
 * نظام الألقاب — جدار اللقب + فتحات VIP/ثروة
 * Firestore: config/titles
 */
import {
  doc,
  onSnapshot,
  getDoc,
  runTransaction,
  collection,
  addDoc,
} from 'firebase/firestore';
import { firestore, auth } from './index';
import {
  buildBalanceIncrementPatch,
  statsFromFirestoreDoc,
} from '@/utils/userBalance';
import { readAristocracyState, isAristocracyActive } from './aristocracySystem';
import { getEffectiveVipLevel } from './vipSystem';

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Config types ───────────────────────────────────────────────

export type TitleObtainType =
  | 'free'
  | 'vip'
  | 'wealth'
  | 'aristocracy'
  | 'purchase'
  | 'manual';

export type SlotUnlockType = 'free' | 'vip' | 'wealth';

export interface TitleSlotConfig {
  slotIndex: number;
  unlockType: SlotUnlockType;
  unlockValue: number;
}

export interface TitleDef {
  id: string;
  nameAr: string;
  nameEn: string;
  enabled: boolean;
  imageUrl: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  obtainType: TitleObtainType;
  obtainValue: number;
  priceCoins: number;
  validityDays: number;
  order: number;
  descAr: string;
  descEn: string;
  gradientColors: [string, string];
}

export interface TitlesConfig {
  enabled: boolean;
  wallTitleAr: string;
  wallTitleEn: string;
  aboutPageTitleAr: string;
  aboutPageTitleEn: string;
  defaultSlots: number;
  maxSlots: number;
  slots: TitleSlotConfig[];
  titles: TitleDef[];
  aboutUseAr: string[];
  aboutUseEn: string[];
  aboutBadgeAr: string[];
  aboutBadgeEn: string[];
}

export interface OwnedTitle {
  titleId: string;
  obtainedAt: number;
  expiresAt: number | null;
}

export interface UserTitlesState {
  owned: OwnedTitle[];
  equipped: (string | null)[];
}

// ─── Defaults ───────────────────────────────────────────────────

export const DEFAULT_TITLE_SLOTS: TitleSlotConfig[] = [
  { slotIndex: 0, unlockType: 'free', unlockValue: 0 },
  { slotIndex: 1, unlockType: 'free', unlockValue: 0 },
  { slotIndex: 2, unlockType: 'free', unlockValue: 0 },
  { slotIndex: 3, unlockType: 'vip', unlockValue: 1 },
  { slotIndex: 4, unlockType: 'vip', unlockValue: 6 },
  { slotIndex: 5, unlockType: 'vip', unlockValue: 8 },
  { slotIndex: 6, unlockType: 'wealth', unlockValue: 10 },
  { slotIndex: 7, unlockType: 'wealth', unlockValue: 15 },
  { slotIndex: 8, unlockType: 'wealth', unlockValue: 20 },
];

export const DEFAULT_TITLES: TitleDef[] = [
  {
    id: 'traveler',
    nameAr: 'الرحّال',
    nameEn: 'Traveler',
    enabled: true,
    imageUrl: '',
    rarity: 'common',
    obtainType: 'free',
    obtainValue: 0,
    priceCoins: 0,
    validityDays: 0,
    order: 1,
    descAr: 'لقب ترحيبي لكل المستخدمين',
    descEn: 'Welcome title for all users',
    gradientColors: ['#EF5F5F', '#EC3E3E'],
  },
  {
    id: 'supporter',
    nameAr: 'داعم',
    nameEn: 'Supporter',
    enabled: true,
    imageUrl: '',
    rarity: 'rare',
    obtainType: 'vip',
    obtainValue: 3,
    priceCoins: 0,
    validityDays: 30,
    order: 2,
    descAr: 'للحاصلين على VIP3',
    descEn: 'For VIP3 members',
    gradientColors: ['#1A0A0C', '#FFD700'],
  },
  {
    id: 'party-organizer',
    nameAr: 'منظم بارتي مميز',
    nameEn: 'Party Organizer',
    enabled: true,
    imageUrl: '',
    rarity: 'epic',
    obtainType: 'wealth',
    obtainValue: 10,
    priceCoins: 0,
    validityDays: 30,
    order: 3,
    descAr: 'مستوى ثروة 10',
    descEn: 'Wealth level 10',
    gradientColors: ['#FF3340', '#B00E0E'],
  },
  {
    id: 'noble-lord',
    nameAr: 'اللورد النبيل',
    nameEn: 'Noble Lord',
    enabled: true,
    imageUrl: '',
    rarity: 'legendary',
    obtainType: 'aristocracy',
    obtainValue: 5,
    priceCoins: 0,
    validityDays: 0,
    order: 4,
    descAr: 'أرستقراطية النبيل فأعلى',
    descEn: 'Noble aristocracy and above',
    gradientColors: ['#2BD9A8', '#FFD700'],
  },
  {
    id: 'games-pro',
    nameAr: 'محترف الألعاب',
    nameEn: 'Games Pro',
    enabled: true,
    imageUrl: '',
    rarity: 'epic',
    obtainType: 'purchase',
    obtainValue: 0,
    priceCoins: 50_000,
    validityDays: 30,
    order: 5,
    descAr: 'شراء من جدار الألقاب',
    descEn: 'Purchase from title wall',
    gradientColors: ['#EC3E3E', '#4A0A0A'],
  },
];

export const DEFAULT_TITLES_CONFIG: TitlesConfig = {
  enabled: true,
  wallTitleAr: 'جدار الألقاب',
  wallTitleEn: 'Title Wall',
  aboutPageTitleAr: 'عن اللقب',
  aboutPageTitleEn: 'About Titles',
  defaultSlots: 3,
  maxSlots: 9,
  slots: DEFAULT_TITLE_SLOTS,
  titles: DEFAULT_TITLES,
  aboutUseAr: [
    'يمكنك استخدام كل الألقاب التي تملكها.',
    '3 فتحات افتراضياً، وتزيد مع VIP ومستوى الثروة حتى 9 فتحات.',
    'يمكن ارتداء حتى 9 ألقاب في نفس الوقت.',
  ],
  aboutUseEn: [
    'You can use all titles you own.',
    '3 slots by default; more unlock with VIP and wealth level up to 9.',
    'Wear up to 9 titles at once.',
  ],
  aboutBadgeAr: [
    'اضغط على تفاصيل اللقب لمعرفة طريقة الحصول عليه.',
    'للألقاب مدة صلاحية وتختفي بعد انتهائها.',
    'يمكنك مشاهدة جدار ألقابك وألقاب الآخرين.',
  ],
  aboutBadgeEn: [],
};

// ─── User state ─────────────────────────────────────────────────

export function readUserTitles(
  data: Record<string, unknown> | null | undefined,
): UserTitlesState {
  const raw = data?.userTitles as UserTitlesState | undefined;
  const max = DEFAULT_TITLES_CONFIG.maxSlots;
  const equipped = Array.from({ length: max }, (_, i) => raw?.equipped?.[i] ?? null);

  const now = Date.now();
  const owned = (Array.isArray(raw?.owned) ? raw!.owned : [])
    .filter((o) => !o.expiresAt || o.expiresAt > now)
    .map((o) => ({
      titleId: String(o.titleId),
      obtainedAt: Number(o.obtainedAt ?? 0),
      expiresAt: o.expiresAt != null ? Number(o.expiresAt) : null,
    }));

  return { owned, equipped };
}

export function countOwnedTitles(state: UserTitlesState): number {
  return state.owned.length;
}

export function isTitleOwned(state: UserTitlesState, titleId: string): boolean {
  return state.owned.some((o) => o.titleId === titleId);
}

// ─── Config subscription ────────────────────────────────────────

export const subscribeToTitles = (cb: (config: TitlesConfig) => void): (() => void) => {
  const ref = doc(firestore, 'config', 'titles');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        cb({ ...DEFAULT_TITLES_CONFIG, ...(snap.data() as Partial<TitlesConfig>) });
      } else {
        cb(DEFAULT_TITLES_CONFIG);
      }
    },
    () => cb(DEFAULT_TITLES_CONFIG),
  );
};

export const getTitlesConfigOnce = async (): Promise<TitlesConfig> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'titles'));
    if (snap.exists()) {
      return { ...DEFAULT_TITLES_CONFIG, ...(snap.data() as Partial<TitlesConfig>) };
    }
  } catch { /* fallback */ }
  return DEFAULT_TITLES_CONFIG;
};

export function getTitleDef(config: TitlesConfig, id: string): TitleDef | undefined {
  return config.titles.find((t) => t.id === id && t.enabled);
}

// ─── Slot unlock ────────────────────────────────────────────────

export function isSlotUnlocked(
  slot: TitleSlotConfig,
  vipLevel: number,
  wealthLevel: number,
): boolean {
  if (slot.unlockType === 'free') return true;
  if (slot.unlockType === 'vip') return vipLevel >= slot.unlockValue;
  if (slot.unlockType === 'wealth') return wealthLevel >= slot.unlockValue;
  return false;
}

export function slotLockLabel(
  slot: TitleSlotConfig,
  isAr: boolean,
): string {
  if (slot.unlockType === 'vip') {
    return isAr ? `VIP ${slot.unlockValue}` : `VIP ${slot.unlockValue}`;
  }
  if (slot.unlockType === 'wealth') {
    return isAr ? `ثروة ${slot.unlockValue}` : `Lv.${slot.unlockValue}`;
  }
  return '';
}

export function userMeetsObtainRequirement(
  title: TitleDef,
  vipLevel: number,
  wealthLevel: number,
  aristocracyLevel: number,
): boolean {
  switch (title.obtainType) {
    case 'free':
      return true;
    case 'vip':
      return vipLevel >= title.obtainValue;
    case 'wealth':
      return wealthLevel >= title.obtainValue;
    case 'aristocracy':
      return aristocracyLevel >= title.obtainValue;
    case 'purchase':
      return false;
    case 'manual':
      return false;
    default:
      return false;
  }
}

// ─── Sync eligible titles ───────────────────────────────────────

export const syncEligibleTitles = async (): Promise<string[]> => {
  const me = auth.currentUser;
  if (!me) return [];

  const config = await getTitlesConfigOnce();
  const userRef = doc(firestore, 'users', me.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return [];

  const data = snap.data() as Record<string, unknown>;
  const stats = statsFromFirestoreDoc(data);
  // المستوى الفعّال = الأعلى بين VIP العادي وSVIP الممنوح من الأرستقراطية النشطة
  const vipLevel = getEffectiveVipLevel(data);
  const aristo = readAristocracyState(data);
  const aristocracyLevel = isAristocracyActive(aristo) ? aristo.level : 0;
  const state = readUserTitles(data);
  const now = Date.now();
  const granted: string[] = [];

  for (const title of config.titles.filter((t) => t.enabled)) {
    if (title.obtainType === 'purchase' || title.obtainType === 'manual') continue;
    if (isTitleOwned(state, title.id)) continue;
    if (!userMeetsObtainRequirement(title, vipLevel, stats.level, aristocracyLevel)) continue;

    const expiresAt =
      title.validityDays > 0 ? now + title.validityDays * DAY_MS : null;

    state.owned.push({ titleId: title.id, obtainedAt: now, expiresAt });
    granted.push(title.id);
  }

  if (granted.length === 0) return [];

  await runTransaction(firestore, async (tx) => {
    tx.update(userRef, { userTitles: state, updatedAt: now });
  });

  return granted;
};

// ─── Equip / unequip ────────────────────────────────────────────

export const equipTitle = async (slotIndex: number, titleId: string): Promise<void> => {
  const me = auth.currentUser;
  if (!me) throw new Error('يجب تسجيل الدخول');

  const config = await getTitlesConfigOnce();
  const title = getTitleDef(config, titleId);
  if (!title) throw new Error('اللقب غير موجود');

  const slot = config.slots.find((s) => s.slotIndex === slotIndex);
  if (!slot) throw new Error('فتحة غير صالحة');

  const userRef = doc(firestore, 'users', me.uid);
  const now = Date.now();

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('المستخدم غير موجود');

    const data = snap.data() as Record<string, unknown>;
    const stats = statsFromFirestoreDoc(data);
    const vipLevel = getEffectiveVipLevel(data);

    if (!isSlotUnlocked(slot, vipLevel, stats.level)) {
      throw new Error('الفتحة مقفلة — ارتقِ VIP أو مستوى الثروة');
    }

    const state = readUserTitles(data);
    if (!isTitleOwned(state, titleId)) {
      throw new Error('لا تملك هذا اللقب');
    }

    const equipped = [...state.equipped];
    while (equipped.length < config.maxSlots) equipped.push(null);

    const prevIdx = equipped.indexOf(titleId);
    if (prevIdx >= 0) equipped[prevIdx] = null;

    equipped[slotIndex] = titleId;
    tx.update(userRef, { userTitles: { ...state, equipped }, updatedAt: now });
  });
};

export const unequipTitle = async (slotIndex: number): Promise<void> => {
  const me = auth.currentUser;
  if (!me) throw new Error('يجب تسجيل الدخول');

  const userRef = doc(firestore, 'users', me.uid);

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('المستخدم غير موجود');

    const state = readUserTitles(snap.data() as Record<string, unknown>);
    const equipped = [...state.equipped];
    equipped[slotIndex] = null;
    tx.update(userRef, {
      userTitles: { ...state, equipped },
      updatedAt: Date.now(),
    });
  });
};

// ─── Purchase title ─────────────────────────────────────────────

export const purchaseTitle = async (titleId: string): Promise<void> => {
  const me = auth.currentUser;
  if (!me) throw new Error('يجب تسجيل الدخول');

  const config = await getTitlesConfigOnce();
  const title = getTitleDef(config, titleId);
  if (!title || title.obtainType !== 'purchase') {
    throw new Error('هذا اللقب غير متاح للشراء');
  }

  const userRef = doc(firestore, 'users', me.uid);
  const now = Date.now();

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('المستخدم غير موجود');

    const data = snap.data() as Record<string, unknown>;
    const stats = statsFromFirestoreDoc(data);
    const state = readUserTitles(data);

    if (stats.coins < title.priceCoins) {
      throw new Error(`رصيدك ${stats.coins} — تحتاج ${title.priceCoins} كوين`);
    }

    const existing = state.owned.find((o) => o.titleId === titleId);
    const expiresAt =
      title.validityDays > 0 ? now + title.validityDays * DAY_MS : null;

    if (existing) {
      existing.expiresAt = expiresAt;
      existing.obtainedAt = now;
    } else {
      state.owned.push({ titleId, obtainedAt: now, expiresAt });
    }

    tx.update(userRef, {
      ...buildBalanceIncrementPatch('coins', -title.priceCoins),
      userTitles: state,
      updatedAt: now,
    });
  });

  await addDoc(collection(firestore, 'transactions'), {
    uid: me.uid,
    type: 'title_purchase',
    titleId,
    amount: -title.priceCoins,
    currency: 'coins',
    itemName: title.nameAr,
    status: 'completed',
    createdAt: now,
  });
};

/** إزالة الألقاب المنتهية وتنظيف الفتحات */
export const cleanupExpiredTitles = async (): Promise<void> => {
  const me = auth.currentUser;
  if (!me) return;

  const userRef = doc(firestore, 'users', me.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const data = snap.data() as Record<string, unknown>;
  const state = readUserTitles(data);
  const now = Date.now();
  const before = state.owned.length;

  state.owned = state.owned.filter((o) => !o.expiresAt || o.expiresAt > now);
  const expiredIds = new Set(
    (snap.data()?.userTitles as UserTitlesState | undefined)?.owned
      ?.filter((o) => o.expiresAt && o.expiresAt <= now)
      .map((o) => o.titleId) ?? [],
  );

  state.equipped = state.equipped.map((id) =>
    id && expiredIds.has(id) ? null : id,
  );

  if (state.owned.length !== before || expiredIds.size > 0) {
    await runTransaction(firestore, async (tx) => {
      tx.update(userRef, { userTitles: state, updatedAt: now });
    });
  }
};
