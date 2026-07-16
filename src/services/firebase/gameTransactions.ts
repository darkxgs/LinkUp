/**
 * Game Transactions Service
 * يدير كل معاملات الألعاب: الرهان، الفوز، التحويل
 *
 * النظام:
 * - الرهان يخصم من coins (الرصيد العادي)
 * - ألعاب الكازينو: الفوز يضاف إلى casinoCoins (10,000 كوين = 1 عملة كازينو)
 * - ألعاب الذكاء: الفوز يضاف صافي الربح (الدخولية × المضاعف) + استرجاع الدخولية
 * - يمكن تحويل casinoCoins → coins بمعدل من إعدادات الأدمن (افتراضي 1:10,000)
 */
import {
  COINS_PER_CASINO_COIN,
  coinWinToStoredCasino,
  toDisplayCasinoCoins,
  toStoredCasinoCoins,
} from '@/utils/casinoCoins';

import {
  doc,
  updateDoc,
  increment,
  addDoc,
  collection,
  getDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { firestore, auth, functions } from './index';
import { httpsCallable } from 'firebase/functions';
import { buildBalanceIncrementPatch, getUserCoins } from '@/utils/userBalance';
import { getGamesGlobalOnce } from './gamesConfig';
import { fetchWeeklyLotteryState } from './weeklyLotterySystem';
import {
  ensureServerTimeOffsetReady,
  getUtcDateKey,
  getMsUntilNextUtcDay,
  serverNow,
} from '@/utils/serverTime';
import { callCallableWithAuth } from './callableHttp';
import { ensureCallableAuth } from './authReady';

export type GameId =
  | 'crash-rocket'
  | 'lucky-777'
  | 'dice'
  | 'duck-race'
  | 'rock-paper-scissors'
  | 'penalty-kick-casino'
  | 'hilo'
  | 'limbo'
  | 'roulette'
  | 'blackjack'
  | 'chicken-cross'
  | 'dragon-tower'
  | 'flag-guess'
  | 'memory-match'
  | 'sequence-memory'
  | 'pool'
  | 'penalty-kicks'
  | 'coin-flip'
  | 'lottery'
  | 'plinko'
  | 'dino'
  | 'spin-win'
  | 'mines'
  | 'wheel'
  | 'slot';

/** ألعاب الذكاء — رهان وفوز على الكوينز، مرة واحدة يومياً لكل الألعاب معاً */
export const INTELLIGENCE_GAME_IDS: GameId[] = [
  'flag-guess',
  'memory-match',
  'sequence-memory',
];

export const isIntelligenceGame = (gameId: string): gameId is GameId =>
  INTELLIGENCE_GAME_IDS.includes(gameId as GameId);

export interface GameTransaction {
  id?: string;
  uid: string;
  gameId: GameId;
  stake: number; // المبلغ المراهن (coins)
  winAmount: number; // المبلغ الفائز
  multiplier: number;
  isWin: boolean;
  payoutType?: 'coins' | 'casinoCoins';
  result: any; // تفاصيل النتيجة
  createdAt: number;
}

// ==================== PLACE BET ====================

/**
 * خصم مبلغ الرهان من رصيد المستخدم
 * يستخدم قبل بدء أي لعبة
 */
export const placeBet = async (stake: number): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  // تحقق من الرصيد
  const userRef = doc(firestore, 'users', user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('المستخدم غير موجود');

  const data = snap.data();
  if (getUserCoins(data as Record<string, unknown>) < stake) {
    throw new Error('رصيد غير كافٍ');
  }

  // خصم المبلغ
  await updateDoc(userRef, buildBalanceIncrementPatch('coins', -stake));

  void import('./rewardsCenter').then(({ trackRewardsGameBet }) => trackRewardsGameBet(stake)).catch(() => {});
};

export type IntelligenceDailyStatus = {
  hasPlayedToday: boolean;
  serverNow: number;
  msUntilNextDailyReset: number;
  playDayKey: string;
};

/** قفل المجموعة الموحّد: أي لعبة ذكاء تقفل البقية لليوم (يطابق السيرفر) */
function intelligenceGroupLockRef(uid: string, playDayKey: string) {
  return doc(firestore, 'users', uid, 'intelligenceDaily', `all_${playDayKey}`);
}

/** توافق خلفي مع مستندات القفل القديمة (لكل لعبة على حدة) */
function intelligenceDailyLockRef(uid: string, gameId: GameId, playDayKey: string) {
  return doc(firestore, 'users', uid, 'intelligenceDaily', `${gameId}_${playDayKey}`);
}

/**
 * خصم دخولية لعبة ذكاء + قفل يومي على السيرفر (لا يعتمد على ساعة الجهاز).
 */
export const placeIntelligenceBet = async (
  gameId: GameId,
  stake: number,
): Promise<IntelligenceDailyStatus> => {
  if (!isIntelligenceGame(gameId)) {
    throw new Error('هذه ليست لعبة ذكاء');
  }

  const user = await ensureCallableAuth();
  const amount = Math.floor(Number(stake));
  if (!amount || amount <= 0) throw new Error('قيمة الدخولية غير صالحة');

  const token = await user.getIdToken();
  const result = await callCallableWithAuth<
    { gameId: string; stake: number },
    { ok?: boolean; serverNow?: number; msUntilNextDailyReset?: number; playDayKey?: string }
  >('placeIntelligenceGameBet', { gameId, stake: amount }, token);

  void import('./rewardsCenter').then(({ trackRewardsGameBet }) => trackRewardsGameBet(amount)).catch(() => {});

  const serverNowMs = Number(result.serverNow) || serverNow();
  return {
    hasPlayedToday: true,
    serverNow: serverNowMs,
    msUntilNextDailyReset: Number(result.msUntilNextDailyReset) || getMsUntilNextUtcDay(serverNowMs),
    playDayKey: String(result.playDayKey || getUtcDateKey(serverNowMs)),
  };
};

/**
 * استرداد رهان أُلغي قبل بدء الجولة (مثل Crash — waiting)
 */
export const refundBet = async (stake: number): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const amount = Math.floor(Number(stake));
  if (!amount || amount <= 0) throw new Error('قيمة الرهان غير صالحة');

  const userRef = doc(firestore, 'users', user.uid);
  await updateDoc(userRef, buildBalanceIncrementPatch('coins', amount));
};

// ==================== RECORD WIN ====================

/**
 * تسجيل الفوز وإضافة المبلغ لرصيد Casino
 */
export const recordWin = async (
  gameId: GameId,
  stake: number,
  winAmount: number,
  multiplier: number,
  result: any,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const userRef = doc(firestore, 'users', user.uid);

  const casinoStored = coinWinToStoredCasino(winAmount);
  const casinoCredit = toDisplayCasinoCoins(casinoStored);

  if (casinoStored > 0) {
    await updateDoc(userRef, {
      'stats.casinoCoins': increment(casinoStored),
      casinoCoins: increment(casinoStored),
    });
  }

  await addDoc(collection(firestore, 'gameTransactions'), {
    uid: user.uid,
    gameId,
    stake,
    winAmount,
    casinoCredit,
    multiplier,
    isWin: casinoStored > 0,
    payoutType: 'casinoCoins',
    result,
    createdAt: Date.now(),
  });

  void import('./casinoLiveActivity')
    .then(({ logCasinoWinActivity }) => logCasinoWinActivity(gameId, stake, casinoCredit, multiplier))
    .catch(() => {});
};

/**
 * تسجيل فوز ألعاب الذكاء — يُضاف الربح لرصيد الكوينز العادي
 */
export const recordIntelligenceWin = async (
  gameId: GameId,
  stake: number,
  winAmount: number,
  multiplier: number,
  result: any,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  if (!isIntelligenceGame(gameId)) {
    throw new Error('هذه ليست لعبة ذكاء');
  }

  const userRef = doc(firestore, 'users', user.uid);

  if (winAmount > 0) {
    await updateDoc(userRef, buildBalanceIncrementPatch('coins', winAmount));
    try {
      const { addVipPoints } = await import('./vipSystem');
      await addVipPoints(user.uid, winAmount);
    } catch { /* non-blocking */ }
  }

  await addDoc(collection(firestore, 'gameTransactions'), {
    uid: user.uid,
    gameId,
    stake,
    winAmount,
    multiplier,
    isWin: winAmount > 0,
    payoutType: 'coins',
    result,
    playDayKey: getUtcDateKey(serverNow()),
    createdAt: serverNow(),
  });
};

// ==================== RECORD LOSS ====================

/**
 * تسجيل الخسارة (المبلغ مخصوم بالفعل من placeBet)
 */
export const recordLoss = async (
  gameId: GameId,
  stake: number,
  result: any,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  await addDoc(collection(firestore, 'gameTransactions'), {
    uid: user.uid,
    gameId,
    stake,
    winAmount: 0,
    multiplier: 0,
    isWin: false,
    payoutType: isIntelligenceGame(gameId) ? 'coins' : 'casinoCoins',
    result,
    ...(isIntelligenceGame(gameId) ? { playDayKey: getUtcDateKey(serverNow()) } : {}),
    createdAt: isIntelligenceGame(gameId) ? serverNow() : Date.now(),
  });
};

// ==================== CONVERT CASINO COINS → COINS ====================

/**
 * تحويل عملات الكازينو إلى عملات عادية — يستخدم المعدّل من config
 * (الاستخدام الموصى به: app/wallet/exchange.tsx — لكن نُبقي هذه للتوافق)
 */
export const convertCasinoCoins = async (amount: number): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  if (amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');

  let rate = COINS_PER_CASINO_COIN;
  try {
    const cfg = await getDoc(doc(firestore, 'config', 'settings'));
    if (cfg.exists()) {
      const r = (cfg.data() as any).casinoToCoinsRate;
      if (typeof r === 'number' && r > 0) rate = r;
    }
  } catch {}

  const microAmount = toStoredCasinoCoins(amount);
  const received = Math.floor(amount * rate);
  if (microAmount <= 0 || received <= 0) {
    throw new Error('المبلغ غير كافٍ للتحويل');
  }

  const userRef = doc(firestore, 'users', user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('المستخدم غير موجود');

  const data = snap.data();
  const balance = data.stats?.casinoCoins ?? data.casinoCoins ?? 0;
  if (balance < microAmount) {
    throw new Error('رصيد عملات الكازينو غير كافٍ');
  }

  await updateDoc(userRef, {
    'stats.casinoCoins': increment(-microAmount),
    casinoCoins: increment(-microAmount),
    ...buildBalanceIncrementPatch('coins', received),
  });

  await addDoc(collection(firestore, 'transactions'), {
    uid: user.uid,
    type: 'casino_conversion',
    amount: -amount,
    received,
    rate,
    currency: 'casinoCoins',
    itemName: 'تحويل من Casino Coins',
    status: 'completed',
    createdAt: Date.now(),
  });

  if (received > 0) {
    try {
      const { addVipPoints } = await import('./vipSystem');
      await addVipPoints(user.uid, received);
    } catch { /* non-blocking */ }
  }
};

// ==================== GET USER GAME HISTORY ====================

/**
 * الحصول على سجل الألعاب لمستخدم
 */
export const getUserGameHistory = async (
  uid: string,
  limit: number = 50,
): Promise<GameTransaction[]> => {
  const q = query(
    collection(firestore, 'gameTransactions'),
    where('uid', '==', uid),
  );
  const snap = await getDocs(q);
  const transactions: GameTransaction[] = [];
  snap.forEach((doc) => {
    transactions.push({ id: doc.id, ...(doc.data() as any) });
  });
  // ترتيب من الأحدث للأقدم
  transactions.sort((a, b) => b.createdAt - a.createdAt);
  return transactions.slice(0, limit);
};

// ==================== DAILY GAME PLAY CHECK ====================

/**
 * فحص هل لعب المستخدم أي لعبة ذكاء اليوم؟ (قفل موحّد: أي لعبة تقفل المجموعة كلها — وقت السيرفر UTC)
 */
export const hasPlayedDailyGame = async (
  uid: string,
  gameId: GameId,
): Promise<boolean> => {
  if (!isIntelligenceGame(gameId)) return false;

  await ensureServerTimeOffsetReady();
  const playDayKey = getUtcDateKey(serverNow());

  // قفل المجموعة الجديد + مستندات القفل القديمة (لكل لعبة) للتوافق الخلفي
  const lockSnaps = await Promise.all([
    getDoc(intelligenceGroupLockRef(uid, playDayKey)),
    ...INTELLIGENCE_GAME_IDS.map((g) =>
      getDoc(intelligenceDailyLockRef(uid, g, playDayKey)),
    ),
  ]);
  if (lockSnaps.some((s) => s.exists())) return true;

  // توافق مع جلسات قديمة قبل قفل السيرفر — أي معاملة لعبة ذكاء اليوم تقفل الجميع
  const dayStartUtc = Date.UTC(
    Number(playDayKey.slice(0, 4)),
    Number(playDayKey.slice(5, 7)) - 1,
    Number(playDayKey.slice(8, 10)),
  );

  const q = query(
    collection(firestore, 'gameTransactions'),
    where('uid', '==', uid),
    where('gameId', 'in', INTELLIGENCE_GAME_IDS),
  );
  const snap = await getDocs(q);

  let hasPlayed = false;
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const createdAt = Number(data.createdAt ?? 0);
    if (createdAt >= dayStartUtc) {
      hasPlayed = true;
    }
  });

  return hasPlayed;
};

/** حالة الحد اليومي لألعاب الذكاء (للعرض في الويب فيو) */
export const getIntelligenceDailyStatus = async (
  uid: string,
  gameId: GameId,
): Promise<IntelligenceDailyStatus> => {
  await ensureServerTimeOffsetReady();
  const now = serverNow();
  const hasPlayedToday = await hasPlayedDailyGame(uid, gameId);
  return {
    hasPlayedToday,
    serverNow: now,
    msUntilNextDailyReset: getMsUntilNextUtcDay(now),
    playDayKey: getUtcDateKey(now),
  };
};

// ==================== CHECK FIRST EVER SPIN (Slot) ====================

/**
 * هل هذه أول لفة في عمر الحساب؟ (للسلوت - 3 برونزية مضمونة)
 */
export const isFirstEverSpin = async (uid: string): Promise<boolean> => {
  const q = query(
    collection(firestore, 'gameTransactions'),
    where('uid', '==', uid),
    where('gameId', 'in', ['slot', 'lucky-777']),
  );
  const snap = await getDocs(q);
  return snap.empty;
};

// ==================== LOTTERY TICKETS ====================

/**
 * شراء تذكرة يانصيب واحدة
 */
export const buyLotteryTicket = async (): Promise<string> => {
  const ids = await buyLotteryTickets(1);
  const ticketId = ids[0];
  if (!ticketId) throw new Error('فشل إصدار تذكرة اليانصيب');
  return ticketId;
};

/**
 * شراء عدة تذاكر يانصيب للأسبوع الحالي — بدون حد أقصى
 */
export const buyLotteryTickets = async (count: number): Promise<string[]> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  if (!Number.isFinite(count) || count < 1 || count > 500) {
    throw new Error('عدد التذاكر غير صالح (1–500)');
  }

  const fn = httpsCallable<{ count: number }, { ok: boolean; ticketIds: string[] }>(
    functions,
    'buyWeeklyLotteryTickets',
  );
  const res = await fn({ count });
  return res.data.ticketIds ?? [];
};

// ==================== GET MY LOTTERY TICKETS ====================

export const getMyLotteryTickets = async (uid: string): Promise<any[]> => {
  const q = query(
    collection(firestore, 'lotteryTickets'),
    where('uid', '==', uid),
  );
  const snap = await getDocs(q);
  const tickets: any[] = [];
  snap.forEach((doc) => {
    tickets.push({ id: doc.id, ...doc.data() });
  });
  tickets.sort((a, b) => b.purchasedAt - a.purchasedAt);
  return tickets;
};

// ==================== GET CURRENT WEEK STATS ====================

export const getCurrentLotteryWeekStats = async (): Promise<{
  totalTickets: number;
  totalPool: number;
  weekId: string;
  salesOpen: boolean;
}> => {
  const [state, global] = await Promise.all([
    fetchWeeklyLotteryState(),
    getGamesGlobalOnce(),
  ]);
  const ticketPrice = global.lotteryTicketPrice;
  return {
    totalTickets: state.totalTickets,
    totalPool: state.totalTickets * ticketPrice,
    weekId: state.weekId,
    salesOpen: state.salesOpen,
  };
};
