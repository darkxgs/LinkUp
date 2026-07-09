/**
 * نشاط الكازينو المباشر — رهانات ودخول الألعاب (لشاشة الإشعارات)
 */

import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { firestore, auth } from './index';
import { CASINO_FEATURED_GAME_IDS } from '@/constants/casinoGames';
import type { GameId } from './gameTransactions';
import { getUser } from './users';

export type CasinoActivityType = 'bet' | 'win' | 'recharge';

export type CasinoActivityItem = {
  id: string;
  uid: string;
  displayName: string;
  avatar: string;
  gameId?: GameId;
  type: CasinoActivityType;
  stake: number;
  winAmount?: number;
  multiplier?: number;
  createdAt: number;
};

const CASINO_IDS = new Set<string>(CASINO_FEATURED_GAME_IDS);

async function resolvePlayerProfile(uid: string) {
  const u = await getUser(uid);
  return {
    displayName: u?.displayName || 'مستخدم',
    avatar: u?.avatar || 'https://i.pravatar.cc/200?img=12',
  };
}

export async function logCasinoBetActivity(gameId: GameId, stake: number): Promise<void> {
  const user = auth.currentUser;
  if (!user || !CASINO_IDS.has(gameId)) return;

  const amount = Math.floor(stake);
  if (!amount || amount <= 0) return;

  const profile = await resolvePlayerProfile(user.uid);
  await addDoc(collection(firestore, 'casinoLiveActivity'), {
    uid: user.uid,
    displayName: profile.displayName,
    avatar: profile.avatar,
    gameId,
    type: 'bet',
    stake: amount,
    createdAt: Date.now(),
  });
}

export async function logCasinoRechargeActivity(amount: number): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const coins = Math.floor(amount);
  if (coins <= 0) return;

  const profile = await resolvePlayerProfile(user.uid);
  await addDoc(collection(firestore, 'casinoLiveActivity'), {
    uid: user.uid,
    displayName: profile.displayName,
    avatar: profile.avatar,
    type: 'recharge',
    stake: coins,
    createdAt: Date.now(),
  });
}

export async function logCasinoWinActivity(
  gameId: GameId,
  stake: number,
  winAmount: number,
  multiplier: number,
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !CASINO_IDS.has(gameId)) return;
  if (winAmount <= 0) return;

  const profile = await resolvePlayerProfile(user.uid);
  await addDoc(collection(firestore, 'casinoLiveActivity'), {
    uid: user.uid,
    displayName: profile.displayName,
    avatar: profile.avatar,
    gameId,
    type: 'win',
    stake: Math.floor(stake),
    winAmount: Math.floor(winAmount),
    multiplier,
    createdAt: Date.now(),
  });
}

function mapSnapshot(snap: QuerySnapshot<DocumentData>): CasinoActivityItem[] {
  return snap.docs
    .map((d) => {
      const data = d.data();
      const typeRaw = String(data.type ?? 'bet');
      const type: CasinoActivityType =
        typeRaw === 'win' ? 'win' : typeRaw === 'recharge' ? 'recharge' : 'bet';
      return {
        id: d.id,
        uid: String(data.uid ?? ''),
        displayName: String(data.displayName ?? 'مستخدم'),
        avatar: String(data.avatar ?? ''),
        gameId: data.gameId ? (data.gameId as GameId) : undefined,
        type,
        stake: Number(data.stake) || 0,
        winAmount: data.winAmount != null ? Number(data.winAmount) : undefined,
        multiplier: data.multiplier != null ? Number(data.multiplier) : undefined,
        createdAt: Number(data.createdAt) || 0,
      };
    })
    .filter((item) => item.type === 'recharge' || (item.gameId && CASINO_IDS.has(item.gameId)))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** بث مباشر لدخول اللاعبين ورهاناتهم وأرباحهم */
export function subscribeToCasinoLiveActivity(
  callback: (items: CasinoActivityItem[]) => void,
): () => void {
  const q = query(
    collection(firestore, 'casinoLiveActivity'),
    orderBy('createdAt', 'desc'),
    limit(120),
  );
  return onSnapshot(
    q,
    (snap) => callback(mapSnapshot(snap)),
    () => callback([]),
  );
}
