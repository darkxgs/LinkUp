/**
 * ترتيب اللاعبين النشطين — شحن + لعب (ريل تايم)
 */

import type { CasinoActivityItem } from './casinoLiveActivity';
import type { GameId } from './gameTransactions';

export const LIVE_RANKING_WINDOW_MS = 30 * 60 * 1000;
export const LIVE_PLAYING_WINDOW_MS = 10 * 60 * 1000;

export type CasinoLivePlayer = {
  uid: string;
  displayName: string;
  avatar: string;
  lastActiveAt: number;
  totalRecharge: number;
  totalBet: number;
  totalWon: number;
  betCount: number;
  /** آخر رهان أُدخل — يُعرض مباشرة على البطاقة */
  lastBetStake: number;
  lastBetAt: number;
  lastGameId?: GameId;
  isPlayingNow: boolean;
};

export function buildCasinoLiveRankings(items: CasinoActivityItem[]): CasinoLivePlayer[] {
  const now = Date.now();
  const cutoff = now - LIVE_RANKING_WINDOW_MS;
  const playingCutoff = now - LIVE_PLAYING_WINDOW_MS;
  const map = new Map<string, CasinoLivePlayer>();

  for (const item of items) {
    if (!item.uid || item.createdAt < cutoff) continue;

    let row = map.get(item.uid);
    if (!row) {
      row = {
        uid: item.uid,
        displayName: item.displayName,
        avatar: item.avatar,
        lastActiveAt: 0,
        totalRecharge: 0,
        totalBet: 0,
        totalWon: 0,
        betCount: 0,
        lastBetStake: 0,
        lastBetAt: 0,
        isPlayingNow: false,
      };
      map.set(item.uid, row);
    }

    row.displayName = item.displayName || row.displayName;
    row.avatar = item.avatar || row.avatar;
    row.lastActiveAt = Math.max(row.lastActiveAt, item.createdAt);

    if (item.type === 'recharge') {
      row.totalRecharge += Math.max(0, item.stake);
    } else if (item.type === 'bet') {
      const stake = Math.max(0, item.stake);
      row.totalBet += stake;
      row.betCount += 1;
      if (item.gameId) row.lastGameId = item.gameId;
      if (item.createdAt >= row.lastBetAt) {
        row.lastBetAt = item.createdAt;
        row.lastBetStake = stake;
        if (item.gameId) row.lastGameId = item.gameId;
      }
    } else if (item.type === 'win') {
      row.totalWon += Math.max(0, (item.winAmount ?? 0) - item.stake);
      if (item.gameId) row.lastGameId = item.gameId;
    }

    if (item.type === 'bet' && item.createdAt >= playingCutoff) {
      row.isPlayingNow = true;
    }
  }

  return [...map.values()]
    .filter((p) => p.lastActiveAt >= cutoff)
    .sort((a, b) => {
      const aLiveBet = a.lastBetAt >= playingCutoff ? a.lastBetAt : 0;
      const bLiveBet = b.lastBetAt >= playingCutoff ? b.lastBetAt : 0;
      if (bLiveBet !== aLiveBet) return bLiveBet - aLiveBet;
      if (b.lastBetStake !== a.lastBetStake) return b.lastBetStake - a.lastBetStake;
      if (b.totalRecharge !== a.totalRecharge) return b.totalRecharge - a.totalRecharge;
      if (b.totalBet !== a.totalBet) return b.totalBet - a.totalBet;
      return b.lastActiveAt - a.lastActiveAt;
    });
}
