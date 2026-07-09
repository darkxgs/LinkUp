/**
 * challenges.ts — خدمة إدارة التحديات (1v1 Online Challenges)
 *
 * تتعامل مع كولكشن gameChallenges لإدارة دورة حياة التحدي
 * وتوزيع الأرباح والرهانات ديناميكياً من الإعدادات العامة.
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  limit,
  getDoc,
  getDocs,
  increment,
  runTransaction,
  addDoc,
} from 'firebase/firestore';
import { firestore, auth } from './index';
import { buildBalanceIncrementPatch, statsFromFirestoreDoc } from '@/utils/userBalance';
import { getSettingsOnce } from './config';
import { getGamesGlobalOnce, getGamesConfigOnce } from './gamesConfig';
import {
  assertStakeAllowed,
  getChallengeStakeOptions,
  CHALLENGE_CONFIG_GAME_IDS,
} from '@/services/games/stakeChips';
import { GameId } from './gameTransactions';

export type ChallengeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'active' | 'completed';

export interface ChallengeSession {
  id: string;
  challengerId: string;
  challengerName: string;
  challengerAvatar: string;
  challengedId: string;
  challengedName: string;
  challengedAvatar: string;
  gameId: ChallengeGameId;
  bet: number;
  status: ChallengeStatus;
  createdAt: number;
  acceptedAt?: number;
  winnerId?: string | null; // null تعني تعادل
  turn?: string; // UID الخاص باللاعب الذي عليه الدور
  gameState?: any; // تفاصيل حالة اللعبة اللحظية (اللوحة، الجولات، السكور)
  updatedAt?: number;
  /** مصدر التحدي — مطابقة تلقائية أو دعوة يدوية */
  source?: 'invite' | 'matchmaking';
}

export const CHALLENGE_GAME_IDS = ['penalty', 'coin-flip', 'billiards'] as const;

export type ChallengeGameId = (typeof CHALLENGE_GAME_IDS)[number];

import { getChallengeGameLabel, getChallengeGameDesc } from '@/utils/challengeI18n';

export { getChallengeGameLabel, getChallengeGameDesc };

export type ChallengeResult = 'win' | 'lose' | 'tie';

export interface ChallengeHistoryItem {
  id: string;
  gameId: ChallengeGameId;
  gameName: string;
  opponentName: string;
  opponentAvatar: string;
  result: ChallengeResult;
  earnings: number;
  completedAt: number;
}

export function challengeResultForUser(
  challenge: ChallengeSession,
  uid: string,
): ChallengeResult {
  if (challenge.winnerId === null || challenge.winnerId === undefined) return 'tie';
  return challenge.winnerId === uid ? 'win' : 'lose';
}

export function challengeEarningsForUser(
  bet: number,
  result: ChallengeResult,
  winnerPercent: number,
): number {
  if (result === 'tie') return 0;
  if (result === 'lose') return -bet;
  const winAmount = Math.floor((bet * 2 * winnerPercent) / 100);
  return winAmount - bet;
}

function mapChallengeToHistory(
  challenge: ChallengeSession,
  uid: string,
  winnerPercent: number,
): ChallengeHistoryItem {
  const isChallenger = challenge.challengerId === uid;
  const result = challengeResultForUser(challenge, uid);
  return {
    id: challenge.id,
    gameId: challenge.gameId,
    gameName: getChallengeGameLabel(challenge.gameId),
    opponentName: isChallenger ? challenge.challengedName : challenge.challengerName,
    opponentAvatar: isChallenger ? challenge.challengedAvatar : challenge.challengerAvatar,
    result,
    earnings: challengeEarningsForUser(challenge.bet, result, winnerPercent),
    completedAt: challenge.updatedAt ?? challenge.acceptedAt ?? challenge.createdAt,
  };
}

export function computeChallengeStats(history: ChallengeHistoryItem[]): {
  wins: number;
  streak: number;
} {
  const wins = history.filter((h) => h.result === 'win').length;
  const sorted = [...history].sort((a, b) => b.completedAt - a.completedAt);
  let streak = 0;
  for (const row of sorted) {
    if (row.result === 'win') streak += 1;
    else break;
  }
  return { wins, streak };
}

/** اشتراك مباشر بسجل التحديات المكتملة للمستخدم */
export function subscribeToMyChallengeHistory(
  uid: string,
  winnerPercent: number,
  callback: (items: ChallengeHistoryItem[], stats: { wins: number; streak: number }) => void,
): () => void {
  let asChallenger: ChallengeSession[] = [];
  let asChallenged: ChallengeSession[] = [];

  const emit = () => {
    const byId = new Map<string, ChallengeSession>();
    for (const c of [...asChallenger, ...asChallenged]) {
      if (c.status === 'completed') byId.set(c.id, c);
    }
    const all = Array.from(byId.values()).sort(
      (a, b) =>
        (b.updatedAt ?? b.acceptedAt ?? b.createdAt) -
        (a.updatedAt ?? a.acceptedAt ?? a.createdAt),
    );
    const history = all.map((c) => mapChallengeToHistory(c, uid, winnerPercent));
    const stats = computeChallengeStats(history);
    callback(history.slice(0, 20), stats);
  };

  const qChallenger = query(
    collection(firestore, 'gameChallenges'),
    where('challengerId', '==', uid),
    limit(50),
  );
  const qChallenged = query(
    collection(firestore, 'gameChallenges'),
    where('challengedId', '==', uid),
    limit(50),
  );

  const unsub1 = onSnapshot(
    qChallenger,
    (snap) => {
      asChallenger = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as ChallengeSession,
      );
      emit();
    },
    () => {
      asChallenger = [];
      emit();
    },
  );

  const unsub2 = onSnapshot(
    qChallenged,
    (snap) => {
      asChallenged = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as ChallengeSession,
      );
      emit();
    },
    () => {
      asChallenged = [];
      emit();
    },
  );

  return () => {
    unsub1();
    unsub2();
  };
}

/**
 * 1️⃣ إرسال تحدي لصديق وخصم الرهان مؤقتاً
 */
export const createChallenge = async (
  gameId: ChallengeGameId,
  bet: number,
  challengedId: string,
  challengedName: string,
  challengedAvatar: string,
): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول أولاً');
  if (user.uid === challengedId) throw new Error('لا يمكنك تحدي نفسك!');

  const [configs, global] = await Promise.all([getGamesConfigOnce(), getGamesGlobalOnce()]);
  const configId = CHALLENGE_CONFIG_GAME_IDS[gameId] ?? gameId;
  const gameCfg = configs.find((c) => c.id === configId);
  if (!gameCfg || !gameCfg.enabled) {
    throw new Error('هذه اللعبة غير متاحة حالياً');
  }
  const stakeOptions = getChallengeStakeOptions(global, gameCfg);
  const stakeCheck = assertStakeAllowed(bet, gameCfg, stakeOptions);
  if (!stakeCheck.valid) throw new Error(stakeCheck.reason ?? 'قيمة الرهان غير مسموحة');

  const challengerUid = user.uid;
  const challengeRef = doc(collection(firestore, 'gameChallenges'));
  const challengeId = challengeRef.id;

  await runTransaction(firestore, async (transaction) => {
    // 1. التحقق من رصيد المتحدي
    const challengerDocRef = doc(firestore, 'users', challengerUid);
    const challengerSnap = await transaction.get(challengerDocRef);
    if (!challengerSnap.exists()) throw new Error('حساب المتحدي غير موجود');

    const userData = challengerSnap.data();
    const stats = statsFromFirestoreDoc(userData);
    if (stats.coins < bet) {
      throw new Error('رصيدك غير كافٍ لإجراء هذا الرهان');
    }

    // 2. إنشاء وثيقة التحدي
    const newChallenge: ChallengeSession = {
      id: challengeId,
      challengerId: challengerUid,
      challengerName: user.displayName || userData.displayName || 'متحدي',
      challengerAvatar: user.photoURL || userData.avatar || '',
      challengedId,
      challengedName,
      challengedAvatar,
      gameId,
      bet,
      status: 'pending',
      createdAt: Date.now(),
    };

    transaction.set(challengeRef, newChallenge);

    // 3. خصم الرهان من المتحدي
    transaction.update(challengerDocRef, buildBalanceIncrementPatch('coins', -bet));
  });

  return challengeId;
};

/** تهيئة حالة اللعب الافتراضية عند بدء المباراة */
export function buildInitialChallengeGameState(
  gameId: ChallengeGameId,
  challengerId: string,
  billiardsTurnMs = 420000,
): { gameState: Record<string, unknown>; turn: string } {
  let gameState: Record<string, unknown> = {};
  if (gameId === 'coin-flip') {
    gameState = {
      round: 1,
      p1Choice: null,
      p2Choice: null,
      roundResults: [],
      flipResult: null,
      turn: challengerId,
    };
  } else if (gameId === 'penalty') {
    gameState = {
      round: 1,
      phase: 'shooting',
      challengerScore: 0,
      opponentScore: 0,
      lastResult: '',
      challengerChoice: null,
      opponentChoice: null,
      turn: challengerId,
    };
  } else if (gameId === 'billiards') {
    gameState = {
      board: null,
      challengerTime: billiardsTurnMs,
      opponentTime: billiardsTurnMs,
      currentTurnStartedAt: Date.now(),
      ballsLeft: 15,
    };
  }
  return { gameState, turn: challengerId };
}

/**
 * إنشاء تحدٍ نشط مباشرة (مطابقة ألعاب) — خصم الرهان من الطرفين دفعة واحدة
 */
export async function createActiveMatchChallenge(
  gameId: ChallengeGameId,
  bet: number,
  challengedId: string,
  challengedName: string,
  challengedAvatar: string,
  challengerName: string,
  challengerAvatar: string,
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول أولاً');
  if (user.uid === challengedId) throw new Error('لا يمكنك مطابقة نفسك!');

  const [configs, global] = await Promise.all([getGamesConfigOnce(), getGamesGlobalOnce()]);
  const configId = CHALLENGE_CONFIG_GAME_IDS[gameId] ?? gameId;
  const gameCfg = configs.find((c) => c.id === configId);
  if (!gameCfg || !gameCfg.enabled) {
    throw new Error('هذه اللعبة غير متاحة حالياً');
  }
  const stakeOptions = getChallengeStakeOptions(global, gameCfg);
  const stakeCheck = assertStakeAllowed(bet, gameCfg, stakeOptions);
  if (!stakeCheck.valid) throw new Error(stakeCheck.reason ?? 'قيمة الرهان غير مسموحة');

  const challengerUid = user.uid;
  const challengeRef = doc(collection(firestore, 'gameChallenges'));
  const challengeId = challengeRef.id;
  const now = Date.now();
  const billiardsTurnMs = global.billiardsTurnMs || 420000;
  const { gameState, turn } = buildInitialChallengeGameState(
    gameId,
    challengerUid,
    billiardsTurnMs,
  );

  await runTransaction(firestore, async (transaction) => {
    const challengerDocRef = doc(firestore, 'users', challengerUid);
    const challengedDocRef = doc(firestore, 'users', challengedId);
    const [challengerSnap, challengedSnap] = await Promise.all([
      transaction.get(challengerDocRef),
      transaction.get(challengedDocRef),
    ]);

    if (!challengerSnap.exists()) throw new Error('حساب المتحدي غير موجود');
    if (!challengedSnap.exists()) throw new Error('حساب الخصم غير موجود');

    const challengerStats = statsFromFirestoreDoc(challengerSnap.data());
    const challengedStats = statsFromFirestoreDoc(challengedSnap.data());
    if (challengerStats.coins < bet) {
      throw new Error('رصيدك غير كافٍ لإجراء هذا الرهان');
    }
    if (challengedStats.coins < bet) {
      throw new Error('رصيد الخصم غير كافٍ — تم إلغاء المطابقة');
    }

    const newChallenge: ChallengeSession = {
      id: challengeId,
      challengerId: challengerUid,
      challengerName,
      challengerAvatar,
      challengedId,
      challengedName,
      challengedAvatar,
      gameId,
      bet,
      status: 'active',
      source: 'matchmaking',
      createdAt: now,
      acceptedAt: now,
      turn,
      gameState,
    };

    transaction.set(challengeRef, newChallenge);
    transaction.update(challengerDocRef, buildBalanceIncrementPatch('coins', -bet));
    transaction.update(challengedDocRef, buildBalanceIncrementPatch('coins', -bet));
  });

  return challengeId;
}

/**
 * 2️⃣ قبول التحدي وخصم الرهان وبدء المباراة
 */
export const acceptChallenge = async (challengeId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول أولاً');

  const myUid = user.uid;
  const challengeRef = doc(firestore, 'gameChallenges', challengeId);
  const global = await getGamesGlobalOnce();
  const billiardsTurnMs = global.billiardsTurnMs || 420000;

  await runTransaction(firestore, async (transaction) => {
    const challengeSnap = await transaction.get(challengeRef);
    if (!challengeSnap.exists()) throw new Error('التحدي غير موجود');

    const challenge = challengeSnap.data() as ChallengeSession;
    if (challenge.status !== 'pending') {
      throw new Error('التحدي لم يعد معلقاً (تم قبوله أو إلغاؤه بالفعل)');
    }
    if (challenge.challengedId !== myUid) {
      throw new Error('أنت لست الشخص المتحدّى في هذه الجولة');
    }

    // التحقق من رصيدي
    const myDocRef = doc(firestore, 'users', myUid);
    const mySnap = await transaction.get(myDocRef);
    if (!mySnap.exists()) throw new Error('حساب المستخدم غير موجود');

    const myData = mySnap.data();
    const myStats = statsFromFirestoreDoc(myData);
    if (myStats.coins < challenge.bet) {
      throw new Error('رصيدك غير كافٍ لقبول التحدي');
    }

    const { gameState, turn } = buildInitialChallengeGameState(
      challenge.gameId,
      challenge.challengerId,
      billiardsTurnMs,
    );

    transaction.update(challengeRef, {
      status: 'active',
      acceptedAt: Date.now(),
      turn,
      gameState,
    });

    // خصم الرهان مني
    transaction.update(myDocRef, buildBalanceIncrementPatch('coins', -challenge.bet));
  });
};

/**
 * 3️⃣ رفض التحدي ورد رصيد الرهان للمرسل
 */
export const declineChallenge = async (challengeId: string): Promise<void> => {
  const challengeRef = doc(firestore, 'gameChallenges', challengeId);

  await runTransaction(firestore, async (transaction) => {
    const challengeSnap = await transaction.get(challengeRef);
    if (!challengeSnap.exists()) throw new Error('التحدي غير موجود');

    const challenge = challengeSnap.data() as ChallengeSession;
    if (challenge.status !== 'pending') {
      throw new Error('التحدي لم يعد معلقاً');
    }

    // تحديث التحدي
    transaction.update(challengeRef, { status: 'declined' });

    // رد الرهان للمتحدي الأول
    const challengerDocRef = doc(firestore, 'users', challenge.challengerId);
    transaction.update(challengerDocRef, buildBalanceIncrementPatch('coins', challenge.bet));
  });
};

/**
 * 4️⃣ إلغاء التحدي بواسطة المرسل واسترداد رصيده
 */
export const cancelChallenge = async (challengeId: string): Promise<void> => {
  const challengeRef = doc(firestore, 'gameChallenges', challengeId);

  await runTransaction(firestore, async (transaction) => {
    const challengeSnap = await transaction.get(challengeRef);
    if (!challengeSnap.exists()) throw new Error('التحدي غير موجود');

    const challenge = challengeSnap.data() as ChallengeSession;
    if (challenge.status !== 'pending') {
      throw new Error('لا يمكن إلغاء التحدي لأنه بدأ أو انتهى');
    }

    // تحديث التحدي
    transaction.update(challengeRef, { status: 'cancelled' });

    // رد الرهان
    const challengerDocRef = doc(firestore, 'users', challenge.challengerId);
    transaction.update(challengerDocRef, buildBalanceIncrementPatch('coins', challenge.bet));
  });
};

/**
 * 5️⃣ إرسال حركة لعب وتحديث حالة الجولة
 */
export const updateChallengeState = async (
  challengeId: string,
  nextState: any,
  nextTurn?: string,
): Promise<void> => {
  const challengeRef = doc(firestore, 'gameChallenges', challengeId);
  const patch: any = {
    gameState: nextState,
    updatedAt: Date.now(),
  };
  if (nextTurn !== undefined) {
    patch.turn = nextTurn;
  }
  await updateDoc(challengeRef, patch);
};

/**
 * 6️⃣ إنهاء التحدي وتوزيع الأرباح الحقيقية من المحفظة ديناميكياً
 */
export const completeChallenge = async (
  challengeId: string,
  winnerId: string | null, // null في حال التعادل
  matchResultLog: any,
): Promise<void> => {
  const challengeRef = doc(firestore, 'gameChallenges', challengeId);

  await runTransaction(firestore, async (transaction) => {
    const challengeSnap = await transaction.get(challengeRef);
    if (!challengeSnap.exists()) throw new Error('التحدي غير موجود');

    const challenge = challengeSnap.data() as ChallengeSession;
    if (challenge.status !== 'active') {
      throw new Error('المباراة ليست نشطة ليتم إنهاؤها');
    }

    // جلب النسب من لوحة الألعاب (مع fallback للإعدادات العامة)
    const gamesGlobal = await getGamesGlobalOnce();
    const settings = await getSettingsOnce();
    const winnerPercent = gamesGlobal.challengeWinnerPercent ?? settings.challengeWinnerPercent ?? 80;
    const commissionPercent = gamesGlobal.challengeAppPercent ?? settings.challengeAppCommission ?? 20;

    const totalPot = challenge.bet * 2;

    // تحديث حالة وثيقة التحدي
    transaction.update(challengeRef, {
      status: 'completed',
      winnerId,
      updatedAt: Date.now(),
    });

    const gameTypeMapping: Record<ChallengeGameId, GameId> = {
      'penalty': 'penalty-kicks',
      'coin-flip': 'coin-flip',
      'billiards': 'pool',
    };
    const logGameId = gameTypeMapping[challenge.gameId];

    if (winnerId === null) {
      // تعادل: رد الرهان لكلا اللاعبين بالكامل
      const p1Ref = doc(firestore, 'users', challenge.challengerId);
      const p2Ref = doc(firestore, 'users', challenge.challengedId);

      transaction.update(p1Ref, buildBalanceIncrementPatch('coins', challenge.bet));
      transaction.update(p2Ref, buildBalanceIncrementPatch('coins', challenge.bet));

      // تسجيل المعاملة بالـ Firestore
      const txRef1 = doc(collection(firestore, 'gameTransactions'));
      const txRef2 = doc(collection(firestore, 'gameTransactions'));

      transaction.set(txRef1, {
        uid: challenge.challengerId,
        gameId: logGameId,
        stake: challenge.bet,
        winAmount: challenge.bet,
        multiplier: 1,
        isWin: true,
        result: { ...matchResultLog, tie: true },
        createdAt: Date.now(),
      });

      transaction.set(txRef2, {
        uid: challenge.challengedId,
        gameId: logGameId,
        stake: challenge.bet,
        winAmount: challenge.bet,
        multiplier: 1,
        isWin: true,
        result: { ...matchResultLog, tie: true },
        createdAt: Date.now(),
      });
    } else {
      // فوز: يحسب نصيب الفائز ونصيب الإدارة
      const winnerGets = Math.floor((totalPot * winnerPercent) / 100);
      const appGets = totalPot - winnerGets;

      // إضافة الكوينز العادية للفائز مباشرة في المحفظة
      const winnerRef = doc(firestore, 'users', winnerId);
      transaction.update(winnerRef, buildBalanceIncrementPatch('coins', winnerGets));

      // تسجيل الفوز للفائز
      const txWinRef = doc(collection(firestore, 'gameTransactions'));
      transaction.set(txWinRef, {
        uid: winnerId,
        gameId: logGameId,
        stake: challenge.bet,
        winAmount: winnerGets,
        multiplier: winnerGets / challenge.bet,
        isWin: true,
        result: matchResultLog,
        createdAt: Date.now(),
      });

      // تسجيل الخسارة للخاسر
      const loserId = winnerId === challenge.challengerId ? challenge.challengedId : challenge.challengerId;
      const txLoseRef = doc(collection(firestore, 'gameTransactions'));
      transaction.set(txLoseRef, {
        uid: loserId,
        gameId: logGameId,
        stake: challenge.bet,
        winAmount: 0,
        multiplier: 0,
        isWin: false,
        result: matchResultLog,
        createdAt: Date.now(),
      });

      // عمولة الإدارة تسجل كربح للتطبيق
      const adminRevRef = doc(collection(firestore, 'adminRevenue'));
      transaction.set(adminRevRef, {
        type: 'challenge_commission',
        challengeId,
        amount: appGets,
        percentage: commissionPercent,
        gameId: logGameId,
        createdAt: Date.now(),
      });
    }
  });
};

/** خصم نشط في التحدي للمستخدم */
export function getChallengeOpponent(
  challenge: ChallengeSession,
  uid: string,
): { id: string; name: string; avatar: string } {
  if (challenge.challengerId === uid) {
    return {
      id: challenge.challengedId,
      name: challenge.challengedName,
      avatar: challenge.challengedAvatar,
    };
  }
  return {
    id: challenge.challengerId,
    name: challenge.challengerName,
    avatar: challenge.challengerAvatar,
  };
}

/** هل يمكن العودة للتحدي (لم ينتهِ الوقت ولم تُكمَل الجولة) */
export function isChallengeRejoinable(
  challenge: ChallengeSession,
  uid: string,
  billiardsTurnMs = 420_000,
): boolean {
  if (challenge.status !== 'active') return false;
  if (challenge.challengerId !== uid && challenge.challengedId !== uid) return false;

  if (challenge.gameId === 'billiards') {
    const state = challenge.gameState as {
      challengerTime?: number;
      opponentTime?: number;
    } | undefined;
    if (!state) return true;
    const chTime =
      typeof state.challengerTime === 'number' ? state.challengerTime : billiardsTurnMs;
    const opTime =
      typeof state.opponentTime === 'number' ? state.opponentTime : billiardsTurnMs;
    return chTime > 0 && opTime > 0;
  }

  return true;
}

/** أقل وقت متبقٍ للبلياردو (للعرض في البانر) */
export function formatChallengeBilliardsTimeLeft(
  challenge: ChallengeSession,
  billiardsTurnMs = 420_000,
): string | null {
  if (challenge.gameId !== 'billiards') return null;
  const state = challenge.gameState as {
    challengerTime?: number;
    opponentTime?: number;
  } | undefined;
  if (!state) return null;
  const minMs = Math.min(
    typeof state.challengerTime === 'number' ? state.challengerTime : billiardsTurnMs,
    typeof state.opponentTime === 'number' ? state.opponentTime : billiardsTurnMs,
  );
  const totalSec = Math.max(0, Math.floor(minMs / 1000));
  const m = Math.floor(totalSec / 60);
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** اشتراك بالتحديات النشطة للمستخدم (كطرف أو خصم) */
export function subscribeToMyActiveChallenges(
  uid: string,
  callback: (challenges: ChallengeSession[]) => void,
): () => void {
  if (!uid) {
    callback([]);
    return () => {};
  }

  let asChallenger: ChallengeSession[] = [];
  let asChallenged: ChallengeSession[] = [];

  const emit = () => {
    const byId = new Map<string, ChallengeSession>();
    for (const c of [...asChallenger, ...asChallenged]) {
      if (c.status === 'active') byId.set(c.id, c);
    }
    const all = Array.from(byId.values()).sort(
      (a, b) =>
        (b.acceptedAt ?? b.updatedAt ?? b.createdAt) -
        (a.acceptedAt ?? a.updatedAt ?? a.createdAt),
    );
    callback(all);
  };

  const qChallenger = query(
    collection(firestore, 'gameChallenges'),
    where('challengerId', '==', uid),
    where('status', '==', 'active'),
    limit(5),
  );
  const qChallenged = query(
    collection(firestore, 'gameChallenges'),
    where('challengedId', '==', uid),
    where('status', '==', 'active'),
    limit(5),
  );

  const unsub1 = onSnapshot(
    qChallenger,
    (snap) => {
      asChallenger = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as ChallengeSession,
      );
      emit();
    },
    () => {
      asChallenger = [];
      emit();
    },
  );

  const unsub2 = onSnapshot(
    qChallenged,
    (snap) => {
      asChallenged = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as ChallengeSession,
      );
      emit();
    },
    () => {
      asChallenged = [];
      emit();
    },
  );

  return () => {
    unsub1();
    unsub2();
  };
}

/**
 * 7️⃣ الاستماع للدعوات الواردة المعلقة للمستخدم الحالي
 */
export const subscribeToIncomingChallenges = (
  uid: string,
  callback: (challenges: ChallengeSession[]) => void,
): (() => void) => {
  if (!uid) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(firestore, 'gameChallenges'),
    where('challengedId', '==', uid),
    where('status', '==', 'pending'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const challenges: ChallengeSession[] = [];
      snap.forEach((docSnap) => {
        challenges.push({ id: docSnap.id, ...docSnap.data() } as ChallengeSession);
      });
      challenges.sort((a, b) => b.createdAt - a.createdAt);
      callback(challenges);
    },
    (err) => {
      console.warn('subscribeToIncomingChallenges error:', err);
      callback([]);
    },
  );
};

/** جلب حالة تحدي واحد */
export async function getChallengeById(
  challengeId: string,
): Promise<ChallengeSession | null> {
  if (!challengeId) return null;
  const snap = await getDoc(doc(firestore, 'gameChallenges', challengeId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ChallengeSession;
}

/**
 * 8️⃣ الاستماع لوثيقة تحدي معينة (متابعة سير اللعبة)
 */
export const subscribeToChallenge = (
  challengeId: string,
  callback: (challenge: ChallengeSession | null) => void,
): (() => void) => {
  return onSnapshot(
    doc(firestore, 'gameChallenges', challengeId),
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as ChallengeSession);
      } else {
        callback(null);
      }
    },
    () => callback(null),
  );
};
