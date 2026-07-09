/**
 * لوحة أعلى 100 رابح في الكازينو حسب الفترة
 */

import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type QuerySnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { firestore } from './index';
import { CASINO_FEATURED_GAME_IDS } from '@/constants/casinoGames';
import type { GameId, GameTransaction } from './gameTransactions';
import { getUsers } from './users';

export type CasinoWinnerPeriod = 'daily' | 'weekly' | 'all';

export const TOP_CASINO_WINNERS_LIMIT = 100;

export type CasinoTopWinner = {
  uid: string;
  displayName: string;
  avatar: string;
  /** صافي ربح الكازينو (كوينز كازينو مُضافة) */
  totalProfit: number;
  totalGrossWin: number;
  totalStaked: number;
  profitPercent: number;
  bestMultiplier: number;
  bestWinAmount: number;
  /** اللعبة الأكثر ربحاً في الفترة */
  topGameId: GameId;
  /** لعبة أعلى مضاعف */
  bestWinGameId: GameId;
  winsCount: number;
};

const CASINO_GAME_IDS = [...CASINO_FEATURED_GAME_IDS] as GameId[];

function periodStart(period: CasinoWinnerPeriod): number {
  if (period === 'all') return 0;
  const now = new Date();
  if (period === 'daily') {
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }
  const week = new Date();
  week.setDate(week.getDate() - 7);
  week.setHours(0, 0, 0, 0);
  return week.getTime();
}

type Agg = {
  uid: string;
  totalProfit: number;
  totalGrossWin: number;
  totalStaked: number;
  bestMultiplier: number;
  bestWinAmount: number;
  topGameId: GameId;
  bestWinGameId: GameId;
  winsCount: number;
  gameProfits: Record<string, number>;
  gameGrossWins: Record<string, number>;
};

function mapDocsToTransactions(snap: QuerySnapshot<DocumentData>): GameTransaction[] {
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as GameTransaction);
}

function aggregateWinners(
  transactions: GameTransaction[],
  period: CasinoWinnerPeriod,
  limit = TOP_CASINO_WINNERS_LIMIT,
): Omit<CasinoTopWinner, 'displayName' | 'avatar'>[] {
  const since = periodStart(period);
  const aggMap = new Map<string, Agg>();

  for (const tx of transactions) {
    if (tx.createdAt < since) continue;
    if (!CASINO_GAME_IDS.includes(tx.gameId)) continue;

    const net = tx.isWin ? tx.winAmount - tx.stake : -tx.stake;
    let agg = aggMap.get(tx.uid);
    if (!agg) {
      agg = {
        uid: tx.uid,
        totalProfit: 0,
        totalGrossWin: 0,
        totalStaked: 0,
        bestMultiplier: 0,
        bestWinAmount: 0,
        topGameId: tx.gameId,
        bestWinGameId: tx.gameId,
        winsCount: 0,
        gameProfits: {},
        gameGrossWins: {},
      };
      aggMap.set(tx.uid, agg);
    }

    agg.totalProfit += net;
    agg.totalStaked += tx.stake;
    agg.gameProfits[tx.gameId] = (agg.gameProfits[tx.gameId] ?? 0) + net;

    if (tx.isWin && tx.winAmount > 0) {
      agg.totalGrossWin += tx.winAmount;
      agg.winsCount += 1;
      agg.gameGrossWins[tx.gameId] = (agg.gameGrossWins[tx.gameId] ?? 0) + tx.winAmount;
      if (tx.multiplier > agg.bestMultiplier) {
        agg.bestMultiplier = tx.multiplier;
        agg.bestWinGameId = tx.gameId;
      }
      if (tx.winAmount > agg.bestWinAmount) agg.bestWinAmount = tx.winAmount;
    }
  }

  return Array.from(aggMap.values())
    .filter((a) => a.winsCount > 0 && a.totalGrossWin > 0)
    .map((a) => {
      let topGameId = a.topGameId;
      let bestGw = -Infinity;
      for (const [gid, gw] of Object.entries(a.gameGrossWins)) {
        if (gw > bestGw) {
          bestGw = gw;
          topGameId = gid as GameId;
        }
      }
      const profitPercent =
        a.totalStaked > 0 ? Math.round((a.totalProfit / a.totalStaked) * 100) : 0;
      return { ...a, topGameId, profitPercent };
    })
    .sort((a, b) => {
      if (b.totalGrossWin !== a.totalGrossWin) return b.totalGrossWin - a.totalGrossWin;
      if (b.totalProfit !== a.totalProfit) return b.totalProfit - a.totalProfit;
      return b.winsCount - a.winsCount;
    })
    .slice(0, limit)
    .map(({ gameProfits: _gp, gameGrossWins: _gw, ...rest }) => rest);
}

async function enrichWinners(
  ranked: Omit<CasinoTopWinner, 'displayName' | 'avatar'>[],
): Promise<CasinoTopWinner[]> {
  if (ranked.length === 0) return [];
  const users = await getUsers(ranked.map((r) => r.uid));
  return ranked.map((a) => {
    const u = users.get(a.uid);
    return {
      ...a,
      displayName: u?.displayName || 'مستخدم',
      avatar: u?.avatar || 'https://i.pravatar.cc/200?img=12',
    };
  });
}

const PER_GAME_TX_LIMIT = 800;

let sharedQueryUnsubs = 0;
let sharedListeners: Array<(txs: GameTransaction[]) => void> = [];
const sharedUnsubsByGame = new Map<GameId, () => void>();
let sharedTxsByGame = new Map<GameId, GameTransaction[]>();

function mergeSharedTransactions(): GameTransaction[] {
  return CASINO_GAME_IDS.flatMap((id) => sharedTxsByGame.get(id) ?? []);
}

function subscribeCasinoTransactions(listener: (txs: GameTransaction[]) => void): () => void {
  sharedListeners.push(listener);
  sharedQueryUnsubs += 1;

  if (sharedUnsubsByGame.size === 0) {
    for (const gameId of CASINO_GAME_IDS) {
      const q = query(
        collection(firestore, 'gameTransactions'),
        where('gameId', '==', gameId),
        orderBy('createdAt', 'desc'),
        limit(PER_GAME_TX_LIMIT),
      );
      const unsub = onSnapshot(
        q,
        (snap) => {
          sharedTxsByGame.set(gameId, mapDocsToTransactions(snap));
          const merged = mergeSharedTransactions();
          for (const fn of sharedListeners) fn(merged);
        },
        () => {
          sharedTxsByGame.set(gameId, []);
          const merged = mergeSharedTransactions();
          for (const fn of sharedListeners) fn(merged);
        },
      );
      sharedUnsubsByGame.set(gameId, unsub);
    }
  } else {
    listener(mergeSharedTransactions());
  }

  return () => {
    sharedListeners = sharedListeners.filter((fn) => fn !== listener);
    sharedQueryUnsubs -= 1;
    if (sharedQueryUnsubs <= 0) {
      for (const unsub of sharedUnsubsByGame.values()) unsub();
      sharedUnsubsByGame.clear();
      sharedTxsByGame = new Map();
    }
  };
}

export function subscribeToCasinoTopWinners(
  period: CasinoWinnerPeriod,
  callback: (winners: CasinoTopWinner[]) => void,
): () => void {
  let cancelled = false;

  const emit = async (txs: GameTransaction[]) => {
    const ranked = aggregateWinners(txs, period);
    const enriched = await enrichWinners(ranked);
    if (!cancelled) callback(enriched);
  };

  let emitGen = 0;
  const unsub = subscribeCasinoTransactions((txs) => {
    const gen = ++emitGen;
    void (async () => {
      const ranked = aggregateWinners(txs, period);
      const enriched = await enrichWinners(ranked);
      if (!cancelled && gen === emitGen) callback(enriched);
    })();
  });

  return () => {
    cancelled = true;
    unsub();
  };
}

export async function getCasinoTopWinners(
  period: CasinoWinnerPeriod = 'weekly',
  topCount = TOP_CASINO_WINNERS_LIMIT,
): Promise<CasinoTopWinner[]> {
  const snaps = await Promise.all(
    CASINO_GAME_IDS.map((gameId) =>
      getDocs(
        query(
          collection(firestore, 'gameTransactions'),
          where('gameId', '==', gameId),
          orderBy('createdAt', 'desc'),
          limit(PER_GAME_TX_LIMIT),
        ),
      ),
    ),
  );
  const txs = snaps.flatMap((snap) => mapDocsToTransactions(snap));
  const ranked = aggregateWinners(txs, period, topCount);
  return enrichWinners(ranked);
}
