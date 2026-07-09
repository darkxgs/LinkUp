/**
 * شارات تمييز ألعاب الكازينو — رواج / لعب / استرداد
 */

import { useEffect, useMemo, useState } from 'react';
import { CASINO_FEATURED_GAME_IDS, type CasinoFeaturedGameId } from '@/constants/casinoGames';
import type { GameConfig } from '@/services/firebase/gamesConfig';
import {
  subscribeCasinoTransactionsForStats,
  type CasinoGameStats,
} from '@/services/firebase/casinoGameStats';

export type CasinoHighlightKind = 'trending' | 'mostPlayed' | 'highestRtp';

export type CasinoGameHighlights = Record<CasinoFeaturedGameId, CasinoHighlightKind[]>;

function emptyHighlights(): CasinoGameHighlights {
  return CASINO_FEATURED_GAME_IDS.reduce((acc, id) => {
    acc[id] = [];
    return acc;
  }, {} as CasinoGameHighlights);
}

const FALLBACK: CasinoGameHighlights = {
  ...emptyHighlights(),
  plinko: ['mostPlayed'],
  'crash-rocket': ['trending'],
  mines: ['highestRtp'],
};

function rankGames(counts: Record<string, number>): CasinoFeaturedGameId[] {
  return [...CASINO_FEATURED_GAME_IDS]
    .map((id) => ({ id, n: counts[id] ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((x) => x.id);
}

function pickTopGame(counts: Record<string, number>): CasinoFeaturedGameId | null {
  return rankGames(counts)[0] ?? null;
}

function pickHighestRtp(gamesConfig: GameConfig[]): CasinoFeaturedGameId | null {
  let best: CasinoFeaturedGameId | null = null;
  let bestRtp = -1;
  for (const id of CASINO_FEATURED_GAME_IDS) {
    const cfg = gamesConfig.find((g) => g.id === id);
    const rtp = cfg?.rtp ?? 0;
    if (rtp > bestRtp) {
      bestRtp = rtp;
      best = id;
    }
  }
  return best;
}

export function buildCasinoHighlights(
  stats: CasinoGameStats,
  gamesConfig: GameConfig[],
): CasinoGameHighlights {
  const result: CasinoGameHighlights = emptyHighlights();

  const trending = pickTopGame(stats.last24h);
  const playedRank = rankGames(stats.allTime);
  let mostPlayed = playedRank[0] ?? null;
  if (mostPlayed && trending && mostPlayed === trending) {
    mostPlayed = playedRank.find((id) => id !== trending) ?? mostPlayed;
  }
  const highestRtp = pickHighestRtp(gamesConfig);

  if (trending) result[trending].push('trending');
  if (mostPlayed) result[mostPlayed].push('mostPlayed');
  if (highestRtp) result[highestRtp].push('highestRtp');

  const any = Object.values(result).some((a) => a.length > 0);
  if (!any) return { ...FALLBACK };

  return result;
}

export function useCasinoGameHighlights(gamesConfig: GameConfig[]) {
  const [stats, setStats] = useState<CasinoGameStats>({ allTime: {}, last24h: {} });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = subscribeCasinoTransactionsForStats((s) => {
      setStats(s);
      setReady(true);
    });
    return unsub;
  }, []);

  const highlights = useMemo(
    () => buildCasinoHighlights(stats, gamesConfig),
    [stats, gamesConfig],
  );

  return { highlights, ready };
}
