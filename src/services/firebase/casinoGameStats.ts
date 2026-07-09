/**
 * إحصائيات لعب الكازينو — لشارات الرواج والأكثر لعباً
 */

import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { firestore } from './index';
import { CASINO_FEATURED_GAME_IDS } from '@/constants/casinoGames';
import type { GameId, GameTransaction } from './gameTransactions';

const CASINO_GAME_IDS = [...CASINO_FEATURED_GAME_IDS] as GameId[];

export type CasinoGameStats = {
  allTime: Record<string, number>;
  last24h: Record<string, number>;
};

function mapDocs(snap: QuerySnapshot<DocumentData>): GameTransaction[] {
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as GameTransaction);
}

function aggregate(transactions: GameTransaction[]): CasinoGameStats {
  const allTime: Record<string, number> = {};
  const last24h: Record<string, number> = {};
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

  for (const tx of transactions) {
    if (!CASINO_GAME_IDS.includes(tx.gameId)) continue;
    if (tx.payoutType && tx.payoutType !== 'casinoCoins') continue;

    allTime[tx.gameId] = (allTime[tx.gameId] ?? 0) + 1;
    if (tx.createdAt >= dayAgo) {
      last24h[tx.gameId] = (last24h[tx.gameId] ?? 0) + 1;
    }
  }

  return { allTime, last24h };
}

let listenerCount = 0;
let sharedUnsub: (() => void) | null = null;
let sharedStats: CasinoGameStats = { allTime: {}, last24h: {} };
const listeners = new Set<(s: CasinoGameStats) => void>();

export function subscribeCasinoTransactionsForStats(
  callback: (stats: CasinoGameStats) => void,
): () => void {
  listeners.add(callback);
  listenerCount += 1;

  if (!sharedUnsub) {
    const q = query(
      collection(firestore, 'gameTransactions'),
      where('gameId', 'in', CASINO_GAME_IDS),
    );
    sharedUnsub = onSnapshot(
      q,
      (snap) => {
        sharedStats = aggregate(mapDocs(snap));
        for (const fn of listeners) fn(sharedStats);
      },
      () => {
        sharedStats = { allTime: {}, last24h: {} };
        for (const fn of listeners) fn(sharedStats);
      },
    );
  } else {
    callback(sharedStats);
  }

  return () => {
    listeners.delete(callback);
    listenerCount -= 1;
    if (listenerCount <= 0 && sharedUnsub) {
      sharedUnsub();
      sharedUnsub = null;
    }
  };
}
