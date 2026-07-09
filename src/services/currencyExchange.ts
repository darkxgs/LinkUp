/**
 * Currency Exchange Service — تحويل العملات الذاتية للمستخدم نفسه
 *
 *  1. coins → pearls     (coinsToPearlsRate — 50,000 كوين = 1 ماسة)
 *  2. casino → coins     (casinoToCoinsRate — 1 كازينو = 10,000 كوين)
 *  3. casino → pearls    (casinoToPearlsRate — 1 كازينو = 1 ماسة)
 */

import {
  doc,
  getDoc,
  runTransaction,
  collection,
  addDoc,
} from 'firebase/firestore';
import { firestore, auth } from './firebase/index';
import {
  statsFromFirestoreDoc,
  buildBalanceIncrementPatch,
  type BalanceStats,
} from '@/utils/userBalance';
import {
  COINS_PER_CASINO_COIN,
  toDisplayCasinoCoins,
  toStoredCasinoCoins,
} from '@/utils/casinoCoins';

export type ExchangeRoute = 'coins_to_pearls' | 'casino_to_coins' | 'casino_to_pearls';

export const ALLOWED_EXCHANGE_ROUTES: ExchangeRoute[] = [
  'coins_to_pearls',
  'casino_to_coins',
  'casino_to_pearls',
];

export const FORBIDDEN_EXCHANGE_ROUTES = [
  'pearls_to_coins',
  'coins_to_casino',
  'pearls_to_casino',
] as const;

const safeRate = (n: unknown, fallback: number): number =>
  Math.max(1, typeof n === 'number' && Number.isFinite(n) ? n : fallback);

export interface ExchangeRates {
  coinsToPearls: number;
  casinoToCoins: number;
  casinoToPearls: number;
}

export interface ExchangeResult {
  ok: boolean;
  message: string;
  spent: number;
  received: number;
  rate: number;
  rateMode: 'divide' | 'multiply';
}

export const getExchangeRates = async (): Promise<ExchangeRates> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'settings'));
    if (!snap.exists()) {
      return { coinsToPearls: 50_000, casinoToCoins: COINS_PER_CASINO_COIN, casinoToPearls: 1 };
    }
    const s = snap.data() as Record<string, unknown>;
    return {
      coinsToPearls: safeRate(s.coinsToPearlsRate, 50_000),
      casinoToCoins: safeRate(s.casinoToCoinsRate, COINS_PER_CASINO_COIN),
      casinoToPearls: safeRate(s.casinoToPearlsRate, 1),
    };
  } catch {
    return { coinsToPearls: 50_000, casinoToCoins: COINS_PER_CASINO_COIN, casinoToPearls: 1 };
  }
};

export const calculateExchange = (
  route: ExchangeRoute,
  sourceAmount: number,
  rates: ExchangeRates,
): {
  received: number;
  rate: number;
  rateMode: 'divide' | 'multiply';
  sourceLabel: string;
  targetLabel: string;
} => {
  const amount = Math.floor(sourceAmount);

  switch (route) {
    case 'coins_to_pearls': {
      const rate = rates.coinsToPearls;
      return {
        received: Math.floor(amount / rate),
        rate,
        rateMode: 'divide',
        sourceLabel: 'كوينز',
        targetLabel: 'ماسة',
      };
    }
    case 'casino_to_coins': {
      const rate = rates.casinoToCoins;
      return {
        received: Math.floor(amount * rate),
        rate,
        rateMode: 'multiply',
        sourceLabel: 'كازينو',
        targetLabel: 'كوينز',
      };
    }
    case 'casino_to_pearls': {
      const rate = rates.casinoToPearls;
      return {
        received: Math.floor(amount * rate),
        rate,
        rateMode: 'multiply',
        sourceLabel: 'كازينو',
        targetLabel: 'ماسة',
      };
    }
    default:
      return {
        received: 0,
        rate: 1,
        rateMode: 'divide',
        sourceLabel: '',
        targetLabel: '',
      };
  }
};

export const formatExchangeRateText = (
  route: ExchangeRoute,
  rate: number,
  sourceLabel: string,
  targetLabel: string,
): string => {
  if (route === 'coins_to_pearls') {
    return `${rate.toLocaleString()} ${sourceLabel} = 1 ${targetLabel}`;
  }
  return `1 ${sourceLabel} = ${rate.toLocaleString()} ${targetLabel}`;
};

function balanceKeyForRoute(route: ExchangeRoute): {
  source: keyof Pick<BalanceStats, 'coins' | 'pearls' | 'casinoCoins'>;
  target: keyof Pick<BalanceStats, 'coins' | 'pearls' | 'casinoCoins'>;
  txType: string;
} {
  switch (route) {
    case 'coins_to_pearls':
      return { source: 'coins', target: 'pearls', txType: 'exchange_coins_to_pearls' };
    case 'casino_to_coins':
      return { source: 'casinoCoins', target: 'coins', txType: 'exchange_casino_to_coins' };
    case 'casino_to_pearls':
      return { source: 'casinoCoins', target: 'pearls', txType: 'exchange_casino_to_pearls' };
  }
}

export const exchangeCurrency = async (
  route: ExchangeRoute,
  sourceAmount: number,
): Promise<ExchangeResult> => {
  if (!ALLOWED_EXCHANGE_ROUTES.includes(route)) {
    throw new Error('هذا التحويل غير مسموح');
  }

  const me = auth.currentUser;
  if (!me) throw new Error('يجب تسجيل الدخول');

  const amount = Math.floor(sourceAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('المبلغ غير صحيح');
  }

  const isCasinoRoute = route === 'casino_to_coins' || route === 'casino_to_pearls';
  const debitAmount = isCasinoRoute ? toStoredCasinoCoins(amount) : amount;

  const rates = await getExchangeRates();
  const { received, rate, rateMode, sourceLabel, targetLabel } = calculateExchange(
    route,
    amount,
    rates,
  );

  if (received <= 0) {
    if (route === 'coins_to_pearls') {
      throw new Error(`الكمية أقل من المعدّل (${rate.toLocaleString()} ${sourceLabel} = 1 ${targetLabel})`);
    }
    throw new Error('المبلغ غير كافٍ للتحويل');
  }

  const { source, target, txType } = balanceKeyForRoute(route);
  const meRef = doc(firestore, 'users', me.uid);

  await runTransaction(firestore, async (tx) => {
    const meSnap = await tx.get(meRef);
    if (!meSnap.exists()) throw new Error('حسابك غير موجود');

    const stats = statsFromFirestoreDoc(meSnap.data() as Record<string, unknown>);
    const balance = isCasinoRoute
      ? stats.casinoCoins
      : stats[source];
    if (balance < debitAmount) {
      throw new Error(`رصيدك من الـ${sourceLabel} غير كافٍ`);
    }

    tx.update(meRef, {
      ...buildBalanceIncrementPatch(source, -debitAmount),
      ...buildBalanceIncrementPatch(target, received),
    });
  });

  await addDoc(collection(firestore, 'transactions'), {
    uid: me.uid,
    type: txType,
    amount: -amount,
    received,
    rate,
    rateMode,
    currency: sourceLabel,
    status: 'completed',
    createdAt: Date.now(),
  });

  if (route === 'casino_to_coins' && received > 0) {
    try {
      const { addVipPoints } = await import('./firebase/vipSystem');
      await addVipPoints(me.uid, received);
    } catch { /* non-blocking */ }
  }

  return {
    ok: true,
    message: `تم! حصلت على ${received.toLocaleString()} ${targetLabel}`,
    spent: amount,
    received,
    rate,
    rateMode,
  };
};
