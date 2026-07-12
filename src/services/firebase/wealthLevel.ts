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

export function todayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

export const WEALTH_DAILY_TASK_DEFS = [
  { id: 'stay-room', max: 3, xp: 5 },
  { id: 'mic-time', max: 3, xp: 5 },
  { id: 'send-gifts', max: 3, xp: 5 },
  { id: 'game-bet', max: 3, xp: 5 },
] as const;

export type WealthDailyTaskId = (typeof WEALTH_DAILY_TASK_DEFS)[number]['id'];

export interface WealthDailyTasksState {
  dateKey: string;
  claimedIds: string[];
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
    default:
      return 0;
  }
}

export function readWealthDailyTaskClaims(
  data: Record<string, unknown> | null | undefined,
): WealthDailyTasksState {
  const today = todayDateKey();
  const raw = data?.wealthDailyTasks as WealthDailyTasksState | undefined;
  if (!raw || raw.dateKey !== today) {
    return { dateKey: today, claimedIds: [] };
  }
  return {
    dateKey: today,
    claimedIds: Array.isArray(raw.claimedIds) ? raw.claimedIds.map(String) : [],
  };
}

/**
 * استلام XP مهمة يومية مكتملة — قبل هذا الإصلاح لم يكن أي مسار يمنح
 * XP المهام إطلاقاً (الصفوف عرض فقط) فبدا وكأن «الهدية تصل في اليوم التالي».
 */
export const claimWealthDailyTask = async (
  taskId: WealthDailyTaskId,
): Promise<{ gained: number; level: number; xp: number }> => {
  const me = auth.currentUser;
  if (!me) throw new Error('يجب تسجيل الدخول');

  const def = WEALTH_DAILY_TASK_DEFS.find((t) => t.id === taskId);
  if (!def) throw new Error('مهمة غير صالحة');

  const userRef = doc(firestore, 'users', me.uid);
  const today = todayDateKey();

  return runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('المستخدم غير موجود');

    const data = snap.data() as Record<string, unknown>;
    const stats = statsFromFirestoreDoc(data);
    const claims = readWealthDailyTaskClaims(data);

    if (claims.claimedIds.includes(taskId)) {
      throw new Error('تم استلام مكافأة هذه المهمة اليوم');
    }

    // إحصاءات اليوم فقط (dateKey محلي موحّد مع بقية منظومة المكافآت)
    const progress = readRewardsProgress(data);
    const current = wealthDailyTaskCurrent(taskId, progress.daily.stats);
    if (current < def.max) throw new Error('لم تُكمل المهمة بعد');

    const next = applyXpGain(stats.level, stats.xp, def.xp);

    tx.update(userRef, {
      ...buildWealthXpFirestoreUpdate(next.level, next.xp),
      wealthDailyTasks: {
        dateKey: today,
        claimedIds: [...claims.claimedIds, taskId],
      },
      updatedAt: Date.now(),
    });

    return { gained: def.xp, ...next };
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
