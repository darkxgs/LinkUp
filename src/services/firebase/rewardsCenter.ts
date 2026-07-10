/**
 * مركز المكافآت — تسجيل الدخول اليومي + المهام + بطاقات الرسائل
 * Firestore: config/rewardsCenter
 */
import {
  doc,
  onSnapshot,
  getDoc,
  runTransaction,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { firestore, auth } from './index';
import {
  buildBalanceIncrementPatch,
  statsFromFirestoreDoc,
} from '@/utils/userBalance';
import { calculateProfileCompleteness } from './users';
import type { Relationship } from './social';

// ─── Config types ───────────────────────────────────────────────

export type RewardType = 'coins' | 'message_cards';
export type CheckInRewardType =
  | 'coins'
  | 'message_cards'
  | 'frame'
  | 'gift'
  | 'pearls';
export type TaskMetric =
  | 'messages_to_female'
  | 'relationship_level_2'
  | 'chat_rounds'
  | 'game_bet'
  | 'profile_complete';

export interface CheckInDayConfig {
  day: number;
  rewardType: CheckInRewardType;
  amount: number;
  labelAr?: string;
  labelEn?: string;
}

export interface RewardTaskConfig {
  id: string;
  enabled: boolean;
  order: number;
  titleAr: string;
  titleEn: string;
  metric: TaskMetric;
  target: number;
  rewardType: RewardType;
  rewardAmount: number;
  route: string;
  iconKey: 'message' | 'level' | 'chat' | 'game' | 'profile';
}

export interface RewardsCenterConfig {
  enabled: boolean;
  titleAr: string;
  titleEn: string;
  freeCardsLabelAr: string;
  freeCardsLabelEn: string;
  checkInFreeTitleAr: string;
  checkInFreeTitleEn: string;
  checkInPremiumTitleAr: string;
  checkInPremiumTitleEn: string;
  upgradePriceCoins: number;
  upgradePriceLabel: string;
  premiumMaxInfoAr: string;
  premiumMaxInfoEn: string;
  upgradeModalAr: string;
  upgradeModalEn: string;
  dailyTasksSubtitleAr: string;
  dailyTasksSubtitleEn: string;
  dailyTasksMaxCards: number;
  newUserTasksSubtitleAr: string;
  newUserTasksSubtitleEn: string;
  newUserTasksMaxCards: number;
  freeCheckInDays: CheckInDayConfig[];
  premiumCheckInDays: CheckInDayConfig[];
  dailyTasks: RewardTaskConfig[];
  newUserTasks: RewardTaskConfig[];
}

// ─── User progress ──────────────────────────────────────────────

export interface RewardsDailyStats {
  femaleMessageCounts: Record<string, number>;
  partnerChatRounds: Record<string, number>;
  gameBets: number;
  /** دقائق التواجد في الغرف اليوم — لمهمة «البقاء في غرفة» بمستوى الثروة */
  roomMinutes: number;
  /** دقائق التحدث على المايك اليوم — لمهمة «وقت المايك» */
  micMinutes: number;
  /** عدد الهدايا المرسلة اليوم — لمهمة «إرسال هدايا» */
  giftsSent: number;
}

export interface RewardsProgress {
  freeMessageCards: number;
  checkIn: {
    freeStreakDay: number;
    premiumStreakDay: number;
    lastFreeClaimDate: string | null;
    lastPremiumClaimDate: string | null;
    premiumExpiresAt: number | null;
  };
  daily: {
    dateKey: string;
    claimedTaskIds: string[];
    stats: RewardsDailyStats;
  };
  newUser: {
    claimedTaskIds: string[];
  };
}

export interface TaskProgressView {
  task: RewardTaskConfig;
  progress: number;
  target: number;
  done: boolean;
  claimed: boolean;
}

// ─── Defaults ───────────────────────────────────────────────────

export const DEFAULT_REWARDS_CENTER: RewardsCenterConfig = {
  enabled: true,
  titleAr: 'مركز المكافآت',
  titleEn: 'Rewards Center',
  freeCardsLabelAr: 'بطاقات رسائل مجانية',
  freeCardsLabelEn: 'Free message cards',
  checkInFreeTitleAr: 'تسجيل الدخول المتواصل',
  checkInFreeTitleEn: 'Continuous Check-in',
  checkInPremiumTitleAr: 'ترقية تسجيل الدخول',
  checkInPremiumTitleEn: 'Check-in Upgrade',
  upgradePriceCoins: 50_000,
  upgradePriceLabel: '$1.99',
  premiumMaxInfoAr: 'الحد الأقصى 1900 ≈ $2.71',
  premiumMaxInfoEn: 'Maximum 1900 ≈ $2.71',
  upgradeModalAr:
    'يمكنك ترقية مكافآت تسجيل الدخول اليومية بشراء البطاقة الأسبوعية. البطاقة صالحة لمدة 7 أيام ويمكن ترقيتها في أي وقت. تبدأ المكافآت من أول يوم شراء. يجب تسجيل الدخول يومياً لاستلام المكافآت — تفويت يوم يعني فقدان مكافأة ذلك اليوم. شراء واحد لكل جهاز.',
  upgradeModalEn:
    'Upgrade daily login rewards with the weekly card. Valid 7 days. Claim daily or miss that day\'s reward. One purchase per device.',
  dailyTasksSubtitleAr: 'أكمل المهام اليومية لتربح 3 بطاقات رسائل مجانية',
  dailyTasksSubtitleEn: 'Complete daily tasks to win 3 free message cards',
  dailyTasksMaxCards: 3,
  newUserTasksSubtitleAr: 'أكمل مهام المستخدمين الجدد لتربح بطاقات رسائل مجانية',
  newUserTasksSubtitleEn: 'Complete new user tasks for free message cards',
  newUserTasksMaxCards: 2,
  freeCheckInDays: [
    { day: 1, rewardType: 'coins', amount: 5 },
    { day: 2, rewardType: 'message_cards', amount: 1 },
    { day: 3, rewardType: 'frame', amount: 1, labelAr: 'إطار', labelEn: 'Frame' },
    { day: 4, rewardType: 'gift', amount: 1, labelAr: 'هدية', labelEn: 'Gift' },
    { day: 5, rewardType: 'coins', amount: 5 },
    { day: 6, rewardType: 'message_cards', amount: 1 },
    { day: 7, rewardType: 'coins', amount: 10 },
  ],
  premiumCheckInDays: [
    { day: 1, rewardType: 'coins', amount: 600 },
    { day: 2, rewardType: 'coins', amount: 500 },
    { day: 3, rewardType: 'coins', amount: 160 },
    { day: 4, rewardType: 'coins', amount: 160 },
    { day: 5, rewardType: 'coins', amount: 160 },
    { day: 6, rewardType: 'coins', amount: 160 },
    { day: 7, rewardType: 'coins', amount: 160 },
  ],
  dailyTasks: [
    {
      id: 'send-msgs-female',
      enabled: true,
      order: 1,
      titleAr: 'أرسل 5 رسائل إلى فتاة',
      titleEn: 'Send 5 messages to a girl',
      metric: 'messages_to_female',
      target: 1,
      rewardType: 'message_cards',
      rewardAmount: 2,
      route: '/(tabs)/chat',
      iconKey: 'message',
    },
    {
      id: 'rel-level-2',
      enabled: true,
      order: 2,
      titleAr: 'الوصول إلى مستوى 2 مع 1 فتاة',
      titleEn: 'Reach level 2 with 1 girl',
      metric: 'relationship_level_2',
      target: 1,
      rewardType: 'message_cards',
      rewardAmount: 1,
      route: '/relationships',
      iconKey: 'level',
    },
    {
      id: 'chat-rounds',
      enabled: true,
      order: 3,
      titleAr: 'الدردشة مع 2 لمدة 2 جولات',
      titleEn: 'Chat with 2 for 2 rounds',
      metric: 'chat_rounds',
      target: 2,
      rewardType: 'coins',
      rewardAmount: 2,
      route: '/(tabs)/chat',
      iconKey: 'chat',
    },
    {
      id: 'game-bet',
      enabled: true,
      order: 4,
      titleAr: 'العب لعبة 1 مراهنة',
      titleEn: 'Play 1 game bet',
      metric: 'game_bet',
      target: 1,
      rewardType: 'coins',
      rewardAmount: 8,
      route: '/games/webview?url=https://linkup-dc45f.web.app/games/wheel/&name=Lucky%20Wheel',
      iconKey: 'game',
    },
  ],
  newUserTasks: [
    {
      id: 'profile-complete',
      enabled: true,
      order: 1,
      titleAr: 'إكمال معلومات الملف الشخصي',
      titleEn: 'Complete profile information',
      metric: 'profile_complete',
      target: 1,
      rewardType: 'message_cards',
      rewardAmount: 2,
      route: '/profile/edit',
      iconKey: 'profile',
    },
  ],
};

// ─── Helpers ────────────────────────────────────────────────────

export function todayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const EMPTY_STATS: RewardsDailyStats = {
  femaleMessageCounts: {},
  partnerChatRounds: {},
  gameBets: 0,
  roomMinutes: 0,
  micMinutes: 0,
  giftsSent: 0,
};

export function readRewardsProgress(
  data: Record<string, unknown> | null | undefined,
): RewardsProgress {
  const today = todayDateKey();
  const raw = data?.rewardsProgress as RewardsProgress | undefined;

  const base: RewardsProgress = {
    freeMessageCards: Number(raw?.freeMessageCards ?? 0),
    checkIn: {
      freeStreakDay: Number(raw?.checkIn?.freeStreakDay ?? 1),
      premiumStreakDay: Number(raw?.checkIn?.premiumStreakDay ?? 1),
      lastFreeClaimDate: raw?.checkIn?.lastFreeClaimDate ?? null,
      lastPremiumClaimDate: raw?.checkIn?.lastPremiumClaimDate ?? null,
      premiumExpiresAt: raw?.checkIn?.premiumExpiresAt ?? null,
    },
    daily: {
      dateKey: today,
      claimedTaskIds: [],
      stats: { ...EMPTY_STATS },
    },
    newUser: {
      claimedTaskIds: Array.isArray(raw?.newUser?.claimedTaskIds)
        ? raw!.newUser!.claimedTaskIds.map(String)
        : [],
    },
  };

  if (raw?.daily?.dateKey === today) {
    base.daily = {
      dateKey: today,
      claimedTaskIds: Array.isArray(raw.daily.claimedTaskIds)
        ? raw.daily.claimedTaskIds.map(String)
        : [],
      stats: {
        femaleMessageCounts: { ...(raw.daily.stats?.femaleMessageCounts ?? {}) },
        partnerChatRounds: { ...(raw.daily.stats?.partnerChatRounds ?? {}) },
        gameBets: Number(raw.daily.stats?.gameBets ?? 0),
        roomMinutes: Number(raw.daily.stats?.roomMinutes ?? 0),
        micMinutes: Number(raw.daily.stats?.micMinutes ?? 0),
        giftsSent: Number(raw.daily.stats?.giftsSent ?? 0),
      },
    };
  }

  return base;
}

function canClaimCheckInToday(lastClaimDate: string | null): boolean {
  const today = todayDateKey();
  return lastClaimDate !== today;
}

function nextStreakDayAfterClaim(
  lastClaimDate: string | null,
  currentDay: number,
): { streakDay: number; reset: boolean } {
  const today = todayDateKey();
  const yesterday = yesterdayDateKey();

  if (!lastClaimDate || lastClaimDate === yesterday) {
    const next = currentDay >= 7 ? 1 : currentDay + 1;
    return { streakDay: next, reset: false };
  }
  if (lastClaimDate === today) {
    return { streakDay: currentDay, reset: false };
  }
  return { streakDay: 1, reset: true };
}

function messagesToFemaleProgress(stats: RewardsDailyStats): number {
  const counts = Object.values(stats.femaleMessageCounts);
  return counts.some((c) => c >= 5) ? 1 : 0;
}

function chatRoundsProgress(stats: RewardsDailyStats, targetRounds: number): number {
  const partners = Object.values(stats.partnerChatRounds).filter((r) => r >= targetRounds);
  return Math.min(partners.length, 2);
}

export function isPremiumCheckInActive(progress: RewardsProgress): boolean {
  const exp = progress.checkIn.premiumExpiresAt ?? 0;
  return exp > Date.now();
}

// ─── Config subscription ────────────────────────────────────────

export const subscribeToRewardsCenter = (
  cb: (config: RewardsCenterConfig) => void,
): (() => void) => {
  const ref = doc(firestore, 'config', 'rewardsCenter');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        cb({ ...DEFAULT_REWARDS_CENTER, ...(snap.data() as Partial<RewardsCenterConfig>) });
      } else {
        cb(DEFAULT_REWARDS_CENTER);
      }
    },
    () => cb(DEFAULT_REWARDS_CENTER),
  );
};

export const getRewardsCenterOnce = async (): Promise<RewardsCenterConfig> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'rewardsCenter'));
    if (snap.exists()) {
      return { ...DEFAULT_REWARDS_CENTER, ...(snap.data() as Partial<RewardsCenterConfig>) };
    }
  } catch { /* fallback */ }
  return DEFAULT_REWARDS_CENTER;
};

// ─── Relationship helpers ─────────────────────────────────────────

async function countFemaleRelationshipsLevel2(uid: string): Promise<number> {
  const q = query(
    collection(firestore, 'relationships'),
    where('user1Uid', '==', uid),
  );
  const q2 = query(
    collection(firestore, 'relationships'),
    where('user2Uid', '==', uid),
  );
  const [snap1, snap2] = await Promise.all([getDocs(q), getDocs(q2)]);
  const rels: Relationship[] = [
    ...snap1.docs.map((d) => ({ id: d.id, ...d.data() } as Relationship)),
    ...snap2.docs.map((d) => ({ id: d.id, ...d.data() } as Relationship)),
  ].filter((r) => r.level >= 2);

  let count = 0;
  for (const rel of rels) {
    const partnerUid = rel.user1Uid === uid ? rel.user2Uid : rel.user1Uid;
    const partnerSnap = await getDoc(doc(firestore, 'users', partnerUid));
    if (partnerSnap.exists() && partnerSnap.data().gender === 'female') {
      count += 1;
    }
  }
  return count;
}

async function computeTaskProgress(
  task: RewardTaskConfig,
  progress: RewardsProgress,
  uid: string,
  userData: Record<string, unknown>,
): Promise<number> {
  switch (task.metric) {
    case 'messages_to_female':
      return messagesToFemaleProgress(progress.daily.stats);
    case 'relationship_level_2': {
      const n = await countFemaleRelationshipsLevel2(uid);
      return Math.min(n, task.target);
    }
    case 'chat_rounds':
      return chatRoundsProgress(progress.daily.stats, 2);
    case 'game_bet':
      return Math.min(progress.daily.stats.gameBets >= 1 ? 1 : 0, task.target);
    case 'profile_complete': {
      const pct = calculateProfileCompleteness(userData as any);
      return pct >= 80 ? 1 : 0;
    }
    default:
      return 0;
  }
}

export async function getTaskProgressList(
  config: RewardsCenterConfig,
  progress: RewardsProgress,
  uid: string,
  userData: Record<string, unknown>,
  section: 'daily' | 'newUser',
): Promise<TaskProgressView[]> {
  const tasks = (section === 'daily' ? config.dailyTasks : config.newUserTasks)
    .filter((t) => t.enabled)
    .sort((a, b) => a.order - b.order);

  const claimedIds =
    section === 'daily' ? progress.daily.claimedTaskIds : progress.newUser.claimedTaskIds;

  const results: TaskProgressView[] = [];
  for (const task of tasks) {
    const prog = await computeTaskProgress(task, progress, uid, userData);
    results.push({
      task,
      progress: prog,
      target: task.target,
      done: prog >= task.target,
      claimed: claimedIds.includes(task.id),
    });
  }
  return results;
}

// ─── Activity tracking ──────────────────────────────────────────

export const trackRewardsMessageSent = async (
  toUid: string,
  recipientIsFemale: boolean,
  hadIncomingReply: boolean,
): Promise<void> => {
  const me = auth.currentUser;
  if (!me) return;

  const userRef = doc(firestore, 'users', me.uid);
  const today = todayDateKey();

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) return;

    const progress = readRewardsProgress(snap.data() as Record<string, unknown>);
    const stats = { ...progress.daily.stats };

    if (recipientIsFemale) {
      const prev = stats.femaleMessageCounts[toUid] ?? 0;
      stats.femaleMessageCounts = { ...stats.femaleMessageCounts, [toUid]: prev + 1 };
    }

    if (hadIncomingReply) {
      const prevRounds = stats.partnerChatRounds[toUid] ?? 0;
      stats.partnerChatRounds = { ...stats.partnerChatRounds, [toUid]: prevRounds + 1 };
    }

    tx.update(userRef, {
      rewardsProgress: {
        ...progress,
        daily: { dateKey: today, claimedTaskIds: progress.daily.claimedTaskIds, stats },
      },
      updatedAt: Date.now(),
    });
  });
};

export const trackRewardsGameBet = async (): Promise<void> => {
  const me = auth.currentUser;
  if (!me) return;

  const userRef = doc(firestore, 'users', me.uid);
  const today = todayDateKey();

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) return;

    const progress = readRewardsProgress(snap.data() as Record<string, unknown>);
    const stats = { ...progress.daily.stats, gameBets: progress.daily.stats.gameBets + 1 };

    tx.update(userRef, {
      rewardsProgress: {
        ...progress,
        daily: { dateKey: today, claimedTaskIds: progress.daily.claimedTaskIds, stats },
      },
      updatedAt: Date.now(),
    });
  });
};

/** دقائق الغرفة/المايك اليومية — تغذّي مهام مستوى الثروة (البقاء في غرفة/وقت المايك) */
export const trackRewardsRoomMinutes = async (
  minutes: number,
  micMinutes = 0,
): Promise<void> => {
  const me = auth.currentUser;
  if (!me || (minutes < 1 && micMinutes < 1)) return;

  const userRef = doc(firestore, 'users', me.uid);
  const today = todayDateKey();

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) return;

    const progress = readRewardsProgress(snap.data() as Record<string, unknown>);
    const stats = {
      ...progress.daily.stats,
      roomMinutes: progress.daily.stats.roomMinutes + Math.max(0, Math.floor(minutes)),
      micMinutes: progress.daily.stats.micMinutes + Math.max(0, Math.floor(micMinutes)),
    };

    tx.update(userRef, {
      rewardsProgress: {
        ...progress,
        daily: { dateKey: today, claimedTaskIds: progress.daily.claimedTaskIds, stats },
      },
      updatedAt: Date.now(),
    });
  });
};

/** هدية مُرسلة — تغذّي مهمة «إرسال هدايا» بمستوى الثروة */
export const trackRewardsGiftSent = async (count = 1): Promise<void> => {
  const me = auth.currentUser;
  if (!me || count < 1) return;

  const userRef = doc(firestore, 'users', me.uid);
  const today = todayDateKey();

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) return;

    const progress = readRewardsProgress(snap.data() as Record<string, unknown>);
    const stats = {
      ...progress.daily.stats,
      giftsSent: progress.daily.stats.giftsSent + Math.floor(count),
    };

    tx.update(userRef, {
      rewardsProgress: {
        ...progress,
        daily: { dateKey: today, claimedTaskIds: progress.daily.claimedTaskIds, stats },
      },
      updatedAt: Date.now(),
    });
  });
};

// ─── Check-in claims ──────────────────────────────────────────────

function applyCheckInReward(
  reward: CheckInDayConfig,
  patch: Record<string, unknown>,
): void {
  if (reward.rewardType === 'coins') {
    Object.assign(patch, buildBalanceIncrementPatch('coins', reward.amount));
  } else if (reward.rewardType === 'message_cards') {
    const current = Number(patch._cards ?? 0);
    patch._cards = current + reward.amount;
  }
}

export const claimFreeCheckIn = async (): Promise<{ day: number; reward: CheckInDayConfig }> => {
  const me = auth.currentUser;
  if (!me) throw new Error('يجب تسجيل الدخول');

  const config = await getRewardsCenterOnce();
  const today = todayDateKey();
  const userRef = doc(firestore, 'users', me.uid);

  return runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('المستخدم غير موجود');

    const progress = readRewardsProgress(snap.data() as Record<string, unknown>);
    if (!canClaimCheckInToday(progress.checkIn.lastFreeClaimDate)) {
      throw new Error('لقد استلمت مكافأة اليوم بالفعل');
    }

    const streakReset =
      progress.checkIn.lastFreeClaimDate &&
      progress.checkIn.lastFreeClaimDate !== yesterdayDateKey() &&
      progress.checkIn.lastFreeClaimDate !== today;
    const claimDay = streakReset ? 1 : progress.checkIn.freeStreakDay;

    const reward =
      config.freeCheckInDays.find((d) => d.day === claimDay) ??
      config.freeCheckInDays[0]!;

    const { streakDay: nextDay } = nextStreakDayAfterClaim(
      progress.checkIn.lastFreeClaimDate,
      claimDay,
    );

    const updatePatch: Record<string, unknown> = { updatedAt: Date.now(), _cards: progress.freeMessageCards };
    applyCheckInReward(reward, updatePatch);

    const newCards = Number(updatePatch._cards);
    delete updatePatch._cards;

    tx.update(userRef, {
      ...updatePatch,
      rewardsProgress: {
        ...progress,
        freeMessageCards: newCards,
        checkIn: {
          ...progress.checkIn,
          freeStreakDay: nextDay,
          lastFreeClaimDate: today,
        },
      },
    });

    return { day: claimDay, reward };
  });
};

export const claimPremiumCheckIn = async (): Promise<{ day: number; reward: CheckInDayConfig }> => {
  const me = auth.currentUser;
  if (!me) throw new Error('يجب تسجيل الدخول');

  const config = await getRewardsCenterOnce();
  const today = todayDateKey();
  const userRef = doc(firestore, 'users', me.uid);

  return runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('المستخدم غير موجود');

    const progress = readRewardsProgress(snap.data() as Record<string, unknown>);
    if (!isPremiumCheckInActive(progress)) {
      throw new Error('البطاقة الأسبوعية غير مفعّلة');
    }
    if (!canClaimCheckInToday(progress.checkIn.lastPremiumClaimDate)) {
      throw new Error('لقد استلمت مكافأة الترقية اليوم');
    }

    const streakReset =
      progress.checkIn.lastPremiumClaimDate &&
      progress.checkIn.lastPremiumClaimDate !== yesterdayDateKey() &&
      progress.checkIn.lastPremiumClaimDate !== today;
    const claimDay = streakReset ? 1 : progress.checkIn.premiumStreakDay;

    const reward =
      config.premiumCheckInDays.find((d) => d.day === claimDay) ??
      config.premiumCheckInDays[0]!;

    const { streakDay: nextDay } = nextStreakDayAfterClaim(
      progress.checkIn.lastPremiumClaimDate,
      claimDay,
    );

    const updatePatch: Record<string, unknown> = { updatedAt: Date.now(), _cards: progress.freeMessageCards };
    applyCheckInReward(reward, updatePatch);

    const newCards = Number(updatePatch._cards);
    delete updatePatch._cards;

    tx.update(userRef, {
      ...updatePatch,
      rewardsProgress: {
        ...progress,
        freeMessageCards: newCards,
        checkIn: {
          ...progress.checkIn,
          premiumStreakDay: nextDay,
          lastPremiumClaimDate: today,
        },
      },
    });

    return { day: claimDay, reward };
  });
};

export const purchaseCheckInUpgrade = async (): Promise<{ expiresAt: number }> => {
  const me = auth.currentUser;
  if (!me) throw new Error('يجب تسجيل الدخول');

  const config = await getRewardsCenterOnce();
  const userRef = doc(firestore, 'users', me.uid);
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  const expiresAt = await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('المستخدم غير موجود');

    const data = snap.data() as Record<string, unknown>;
    const stats = statsFromFirestoreDoc(data);
    const progress = readRewardsProgress(data);

    if (stats.coins < config.upgradePriceCoins) {
      throw new Error(
        `رصيدك ${stats.coins.toLocaleString('en-US')} — تحتاج ${config.upgradePriceCoins.toLocaleString('en-US')} كوين`,
      );
    }

    const currentExp = progress.checkIn.premiumExpiresAt ?? 0;
    const base = currentExp > now ? currentExp : now;
    const newExp = base + sevenDays;

    tx.update(userRef, {
      ...buildBalanceIncrementPatch('coins', -config.upgradePriceCoins),
      rewardsProgress: {
        ...progress,
        checkIn: {
          ...progress.checkIn,
          premiumExpiresAt: newExp,
          premiumStreakDay: 1,
          lastPremiumClaimDate: null,
        },
      },
      updatedAt: now,
    });

    return newExp;
  });

  await addDoc(collection(firestore, 'transactions'), {
    uid: me.uid,
    type: 'rewards_checkin_upgrade',
    amount: -config.upgradePriceCoins,
    currency: 'coins',
    itemName: config.checkInPremiumTitleAr,
    status: 'completed',
    createdAt: now,
  });

  return { expiresAt };
};

// ─── Task claim ─────────────────────────────────────────────────

export const claimTaskReward = async (
  taskId: string,
  section: 'daily' | 'newUser',
): Promise<{ rewardType: RewardType; amount: number }> => {
  const me = auth.currentUser;
  if (!me) throw new Error('يجب تسجيل الدخول');

  const config = await getRewardsCenterOnce();
  const tasks = section === 'daily' ? config.dailyTasks : config.newUserTasks;
  const task = tasks.find((t) => t.id === taskId && t.enabled);
  if (!task) throw new Error('المهمة غير موجودة');

  const userRef = doc(firestore, 'users', me.uid);
  const today = todayDateKey();
  const now = Date.now();

  const preSnap = await getDoc(userRef);
  if (!preSnap.exists()) throw new Error('المستخدم غير موجود');
  const preData = preSnap.data() as Record<string, unknown>;
  const preProgress = readRewardsProgress(preData);
  const preClaimed =
    section === 'daily' ? preProgress.daily.claimedTaskIds : preProgress.newUser.claimedTaskIds;

  if (preClaimed.includes(taskId)) throw new Error('تم استلام المكافأة مسبقاً');

  const prog = await computeTaskProgress(task, preProgress, me.uid, preData);
  if (prog < task.target) throw new Error('لم تُكمل المهمة بعد');

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('المستخدم غير موجود');

    const data = snap.data() as Record<string, unknown>;
    const progress = readRewardsProgress(data);
    const claimedIds =
      section === 'daily' ? progress.daily.claimedTaskIds : progress.newUser.claimedTaskIds;

    if (claimedIds.includes(taskId)) throw new Error('تم استلام المكافأة مسبقاً');

    const updatePatch: Record<string, unknown> = { updatedAt: now };
    let newCards = progress.freeMessageCards;

    if (task.rewardType === 'coins') {
      Object.assign(updatePatch, buildBalanceIncrementPatch('coins', task.rewardAmount));
    } else {
      newCards += task.rewardAmount;
    }

    const newClaimed = [...claimedIds, taskId];
    const newProgress: RewardsProgress = {
      ...progress,
      freeMessageCards: newCards,
      ...(section === 'daily'
        ? { daily: { ...progress.daily, dateKey: today, claimedTaskIds: newClaimed } }
        : { newUser: { claimedTaskIds: newClaimed } }),
    };

    tx.update(userRef, { ...updatePatch, rewardsProgress: newProgress });
  });

  await addDoc(collection(firestore, 'transactions'), {
    uid: me.uid,
    type: 'rewards_task',
    taskId,
    section,
    amount: task.rewardAmount,
    currency: task.rewardType === 'coins' ? 'coins' : 'message_cards',
    itemName: task.titleAr,
    status: 'completed',
    createdAt: now,
  });

  return { rewardType: task.rewardType, amount: task.rewardAmount };
};

/** هل يمكن المطالبة بمكافأة تسجيل الدخول المجاني اليوم؟ */
export function canClaimFreeCheckIn(progress: RewardsProgress): boolean {
  return canClaimCheckInToday(progress.checkIn.lastFreeClaimDate);
}

export function canClaimPremiumCheckInToday(progress: RewardsProgress): boolean {
  return (
    isPremiumCheckInActive(progress) &&
    canClaimCheckInToday(progress.checkIn.lastPremiumClaimDate)
  );
}

/** آخر رسالة في المحادثة قبل الإرسال — لحساب الجولات */
export async function hadIncomingReplyBeforeSend(
  conversationId: string,
  myUid: string,
): Promise<boolean> {
  try {
    const q = query(
      collection(firestore, 'messages'),
      where('conversationId', '==', conversationId),
      orderBy('createdAt', 'desc'),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return false;
    const last = snap.docs[0]!.data();
    return last.fromUid !== myUid;
  } catch {
    return false;
  }
}
