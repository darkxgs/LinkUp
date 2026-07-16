/**
 * مستوى الثروة — فقاعات EXP اليومية وترقية المستوى
 */
import { doc, runTransaction, collection, addDoc } from 'firebase/firestore';
import { firestore, auth } from './index';
import {
  buildBalanceIncrementPatch,
  statsFromFirestoreDoc,
} from '@/utils/userBalance';
import {
  readRewardsProgress,
  type RewardsDailyStats,
} from './rewardsCenter';

export const WEALTH_TODAY_BONUS = 10;

export const WEALTH_EXP_BUBBLE_DEFS = [
  { id: '0', amount: 5 },
  { id: '1', amount: 5 },
  { id: '2', amount: WEALTH_TODAY_BONUS },
] as const;

export type WealthExpBubbleId = (typeof WEALTH_EXP_BUBBLE_DEFS)[number]['id'];

export interface WealthExpBubblesState {
  dateKey: string;
  claimedIds: string[];
}

export function xpRequiredForLevel(level: number): number {
  return 500 + level * 250;
}

export function applyXpGain(
  level: number,
  xp: number,
  gain: number,
): { level: number; xp: number } {
  let newLevel = Math.max(1, level);
  let newXp = xp + gain;
  while (newXp >= xpRequiredForLevel(newLevel)) {
    newXp -= xpRequiredForLevel(newLevel);
    newLevel += 1;
  }
  return { level: newLevel, xp: newXp };
}

/** تحديث Firestore — stats + الحقول في الجذر معاً */
export function buildWealthXpFirestoreUpdate(
  level: number,
  xp: number,
): Record<string, number> {
  return {
    'stats.level': level,
    'stats.xp': xp,
    level,
    xp,
  };
}

// مفتاح اليوم بتوقيت UTC — موحّد مع rewardsCenter وتريغرات السيرفر (قرار المالك)
export function todayDateKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function readWealthExpBubbles(
  data: Record<string, unknown> | null | undefined,
): WealthExpBubblesState {
  const today = todayDateKey();
  const raw = data?.wealthExpBubbles as WealthExpBubblesState | undefined;
  if (!raw || raw.dateKey !== today) {
    return { dateKey: today, claimedIds: [] };
  }
  return {
    dateKey: today,
    claimedIds: Array.isArray(raw.claimedIds) ? raw.claimedIds.map(String) : [],
  };
}

export function bubbleAmountFor(id: WealthExpBubbleId): number {
  return WEALTH_EXP_BUBBLE_DEFS.find((b) => b.id === id)?.amount ?? 0;
}

/** جمع فقاعة EXP — تختفي ولا تظهر مجدداً اليوم */
export const claimWealthExpBubble = async (
  bubbleId: WealthExpBubbleId,
): Promise<{ gained: number; level: number; xp: number }> => {
  const me = auth.currentUser;
  if (!me) throw new Error('يجب تسجيل الدخول');

  const amount = bubbleAmountFor(bubbleId);
  if (amount <= 0) throw new Error('فقاعة غير صالحة');

  const userRef = doc(firestore, 'users', me.uid);
  const today = todayDateKey();

  const result = await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('المستخدم غير موجود');

    const data = snap.data() as Record<string, unknown>;
    const stats = statsFromFirestoreDoc(data);
    const bubbles = readWealthExpBubbles(data);

    if (bubbles.claimedIds.includes(bubbleId)) {
      throw new Error('تم جمع هذه الفقاعة مسبقاً');
    }

    const next = applyXpGain(stats.level, stats.xp, amount);
    const claimedIds = [...bubbles.claimedIds, bubbleId];

    tx.update(userRef, {
      'stats.xp': next.xp,
      'stats.level': next.level,
      xp: next.xp,
      level: next.level,
      wealthExpBubbles: { dateKey: today, claimedIds },
      updatedAt: Date.now(),
    });

    return { gained: amount, ...next };
  });

  return result;
};

// ─── المهام اليومية لمستوى الثروة ────────────────────────────────
// حساب التقدّم والمكافأة هنا (مصدر واحد) — العرض (العنوان/الأيقونة)
// في شاشة app/wealth-level.tsx

// xp: قيمة الدورة الواحدة — bet-5000 جائزتها عشوائية (30-300) تُرمى وتُستلم
// في السيرفر حصرياً (claimWealthBetMission) فقيمتها هنا 0
export const WEALTH_DAILY_TASK_DEFS = [
  { id: 'stay-room', max: 3, xp: 5 },
  { id: 'mic-time', max: 3, xp: 5 },
  { id: 'send-gifts', max: 3, xp: 5 },
  { id: 'game-bet', max: 5, xp: 5 },
  { id: 'lucky-gifts', max: 5, xp: 10 },
  { id: 'bet-5000', max: 10, xp: 0 },
  { id: 'login', max: 1, xp: 5 },
] as const;

export type WealthDailyTaskId = (typeof WEALTH_DAILY_TASK_DEFS)[number]['id'];

export interface WealthDailyTasksState {
  dateKey: string;
  claimedIds: string[];
  /** عدد الدورات المستلمة لكل مهمة — الاستلام الجزئي المتكرر خلال اليوم */
  claimedCounts: Record<string, number>;
}

/** تقدّم المهمة من إحصاءات اليوم (rewardsProgress.daily.stats) */
export function wealthDailyTaskCurrent(
  taskId: WealthDailyTaskId,
  stats: RewardsDailyStats,
): number {
  switch (taskId) {
    case 'stay-room':
      return Math.floor(Number(stats.roomMinutes ?? 0) / 5);
    case 'mic-time':
      return Math.floor(Number(stats.micMinutes ?? 0) / 10);
    case 'send-gifts':
      return Number(stats.giftsSent ?? 0);
    case 'game-bet':
      return Number(stats.gameBets ?? 0);
    // الأسعار مضاعفة ×10 بأمر المالك (2026-07-17): «أي حاجة فيها فلوس حط صفر زيادة»
    case 'lucky-gifts':
      return Math.floor(Number(stats.luckyGiftCoins ?? 0) / 5000);
    case 'bet-5000':
      return Math.floor(Number(stats.betCoins ?? 0) / 50000);
    case 'login':
      // فتح الصفحة يعني جلسة موثّقة — الدخول نفسه مسجّل بالسيرفر (recordLoginSession)
      return 1;
    default:
      return 0;
  }
}

export function readWealthDailyTaskClaims(
  data: Record<string, unknown> | null | undefined,
): WealthDailyTasksState {
  const today = todayDateKey();
  const raw = data?.wealthDailyTasks as Partial<WealthDailyTasksState> | undefined;
  if (!raw || raw.dateKey !== today) {
    return { dateKey: today, claimedIds: [], claimedCounts: {} };
  }
  const claimedIds = Array.isArray(raw.claimedIds) ? raw.claimedIds.map(String) : [];
  const claimedCounts: Record<string, number> = {};
  if (raw.claimedCounts && typeof raw.claimedCounts === 'object') {
    for (const [k, v] of Object.entries(raw.claimedCounts)) {
      const n = Math.max(0, Math.floor(Number(v) || 0));
      if (n > 0) claimedCounts[k] = n;
    }
  }
  // توافق خلفي: مهمة في claimedIds (نسخ قديمة) = مستلمة بالكامل
  for (const id of claimedIds) {
    const def = WEALTH_DAILY_TASK_DEFS.find((t) => t.id === id);
    if (def) claimedCounts[id] = Math.max(claimedCounts[id] ?? 0, def.max);
  }
  return { dateKey: today, claimedIds, claimedCounts };
}

/** الدورات المستحقة غير المستلمة لمهمة — للعرض وتفعيل زر الاستلام */
export function wealthDailyTaskOwed(
  taskId: WealthDailyTaskId,
  stats: RewardsDailyStats,
  claims: WealthDailyTasksState,
): number {
  const def = WEALTH_DAILY_TASK_DEFS.find((t) => t.id === taskId);
  if (!def) return 0;
  const current = Math.min(wealthDailyTaskCurrent(taskId, stats), def.max);
  return Math.max(0, current - (claims.claimedCounts[taskId] ?? 0));
}

/**
 * استلام XP مهمة يومية — لكل الدورات المستحقة غير المستلمة دفعة واحدة
 * (استلام جزئي متكرر خلال اليوم عبر claimedCounts، لا انتظار اكتمال max).
 * مهمة bet-5000 تُستلم من السيرفر حصرياً (claimWealthBetMission) لأن جائزتها
 * عشوائية — هذا المسار يرفضها.
 */
export const claimWealthDailyTask = async (
  taskId: WealthDailyTaskId,
): Promise<{ gained: number; cycles: number; level: number; xp: number }> => {
  const me = auth.currentUser;
  if (!me) throw new Error('يجب تسجيل الدخول');

  const def = WEALTH_DAILY_TASK_DEFS.find((t) => t.id === taskId);
  if (!def) throw new Error('مهمة غير صالحة');
  if (taskId === 'bet-5000') throw new Error('تُستلم هذه المهمة من الخادم');

  const userRef = doc(firestore, 'users', me.uid);
  const today = todayDateKey();

  return runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('المستخدم غير موجود');

    const data = snap.data() as Record<string, unknown>;
    const stats = statsFromFirestoreDoc(data);
    const claims = readWealthDailyTaskClaims(data);

    // إحصاءات اليوم فقط (dateKey بتوقيت UTC موحّد مع بقية منظومة المكافآت)
    const progress = readRewardsProgress(data);
    const current = Math.min(wealthDailyTaskCurrent(taskId, progress.daily.stats), def.max);
    const already = claims.claimedCounts[taskId] ?? 0;
    const owed = current - already;
    if (owed <= 0) {
      throw new Error(already >= def.max ? 'تم استلام مكافأة هذه المهمة اليوم' : 'لم تُكمل المهمة بعد');
    }

    const gained = owed * def.xp;
    const next = applyXpGain(stats.level, stats.xp, gained);

    const claimedCounts = { ...claims.claimedCounts, [taskId]: current };
    // claimedIds للتوافق مع النسخ القديمة — تُضاف المهمة عند اكتمال كل دوراتها
    const claimedIds =
      current >= def.max && !claims.claimedIds.includes(taskId)
        ? [...claims.claimedIds, taskId]
        : claims.claimedIds;

    tx.update(userRef, {
      ...buildWealthXpFirestoreUpdate(next.level, next.xp),
      wealthDailyTasks: { dateKey: today, claimedIds, claimedCounts },
      updatedAt: Date.now(),
    });

    return { gained, cycles: owed, ...next };
  });
};

/** كوينز مطلوبة لإكمال الترقية للمستوى التالي (1 كوين = 1 XP) */
export function coinsNeededForLevelUp(level: number, xp: number): number {
  const need = xpRequiredForLevel(level) - xp;
  return Math.max(0, need);
}

/** ترقية مستوى الثروة مباشرة بخصم الكوينز */
export const upgradeWealthLevelWithCoins = async (): Promise<{
  newLevel: number;
  coinsSpent: number;
}> => {
  const me = auth.currentUser;
  if (!me) throw new Error('يجب تسجيل الدخول');

  const userRef = doc(firestore, 'users', me.uid);

  const result = await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('المستخدم غير موجود');

    const data = snap.data() as Record<string, unknown>;
    const stats = statsFromFirestoreDoc(data);
    const cost = coinsNeededForLevelUp(stats.level, stats.xp);

    if (cost > 0 && stats.coins < cost) {
      throw new Error(
        `رصيدك ${stats.coins.toLocaleString('en-US')} كوين — تحتاج ${cost.toLocaleString('en-US')} كوين`,
      );
    }

    const newLevel = stats.level + 1;

    tx.update(userRef, {
      ...(cost > 0 ? buildBalanceIncrementPatch('coins', -cost) : {}),
      'stats.xp': 0,
      'stats.level': newLevel,
      xp: 0,
      level: newLevel,
      updatedAt: Date.now(),
    });

    return { newLevel, coinsSpent: cost };
  });

  if (result.coinsSpent > 0) {
    await addDoc(collection(firestore, 'transactions'), {
      uid: me.uid,
      type: 'wealth_level_up',
      amount: -result.coinsSpent,
      currency: 'coins',
      itemName: `ترقية مستوى الثروة → Lv.${result.newLevel}`,
      status: 'completed',
      createdAt: Date.now(),
    });
  }

  return result;
};
