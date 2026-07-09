/**
 * مساهمات الهدايا في الروم — ترتيب يومي / أسبوعي حسب قيمة الكوينز المرسلة.
 */
import { ref, onValue, off, runTransaction, set } from 'firebase/database';

import { realtimeDb } from '@/services/firebase';

export type RoomContributionEntry = {
  uid: string;
  name: string;
  avatar: string;
  level?: number;
  vipLevel?: number;
  dailyCoins: number;
  weeklyCoins: number;
  dailyKey: string;
  weeklyKey: string;
  /** قيمة الفترة المعروضة (يُعبّأ عند الاشتراك) */
  coins: number;
};

export type ContributionPeriod = 'daily' | 'weekly';

export function getContributionDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** بداية الأسبوع (الأحد) بصيغة YYYY-MM-DD */
export function getContributionWeekKey(date = new Date()): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export async function recordRoomGiftContribution(
  roomId: string,
  contributor: {
    uid: string;
    name: string;
    avatar: string;
    coins: number;
    level?: number;
    vipLevel?: number;
  },
): Promise<void> {
  if (!roomId || contributor.coins <= 0) return;

  const dayKey = getContributionDayKey();
  const weekKey = getContributionWeekKey();
  const userRef = ref(realtimeDb, `rooms/${roomId}/giftContributors/${contributor.uid}`);

  await runTransaction(userRef, (raw) => {
    const prev = raw as Partial<RoomContributionEntry> | null;
    let dailyCoins = prev?.dailyKey === dayKey ? (prev?.dailyCoins ?? 0) : 0;
    let weeklyCoins = prev?.weeklyKey === weekKey ? (prev?.weeklyCoins ?? 0) : 0;

    dailyCoins += contributor.coins;
    weeklyCoins += contributor.coins;

    return {
      uid: contributor.uid,
      name: contributor.name,
      avatar: contributor.avatar,
      level: contributor.level,
      vipLevel: contributor.vipLevel,
      dailyCoins,
      weeklyCoins,
      dailyKey: dayKey,
      weeklyKey: weekKey,
    };
  });
}

function mapContributors(
  raw: Record<string, Partial<RoomContributionEntry>> | null,
  period: ContributionPeriod,
): RoomContributionEntry[] {
  const dayKey = getContributionDayKey();
  const weekKey = getContributionWeekKey();

  return Object.values(raw ?? {})
    .map((row) => {
      const dailyCoins = row.dailyKey === dayKey ? Number(row.dailyCoins) || 0 : 0;
      const weeklyCoins = row.weeklyKey === weekKey ? Number(row.weeklyCoins) || 0 : 0;
      const coins = period === 'daily' ? dailyCoins : weeklyCoins;
      return {
        uid: row.uid ?? '',
        name: row.name ?? '',
        avatar: row.avatar ?? '',
        level: row.level,
        vipLevel: row.vipLevel,
        dailyCoins,
        weeklyCoins,
        dailyKey: row.dailyKey ?? '',
        weeklyKey: row.weeklyKey ?? '',
        coins,
      };
    })
    .filter((r) => r.uid && r.coins > 0)
    .sort((a, b) => b.coins - a.coins);
}

export function subscribeToRoomContributions(
  roomId: string,
  period: ContributionPeriod,
  onData: (entries: RoomContributionEntry[]) => void,
): () => void {
  const listRef = ref(realtimeDb, `rooms/${roomId}/giftContributors`);
  const handler = (snap: { val: () => Record<string, Partial<RoomContributionEntry>> | null }) => {
    onData(mapContributors(snap.val(), period));
  };
  onValue(listRef, handler);
  return () => off(listRef, 'value', handler);
}

/** دعم مستلم على المقعد — مجموع قيمة الهدايا الواصلة للشخص في هذه الغرفة */
export async function recordRoomGiftSupportReceived(
  roomId: string,
  recipientUid: string,
  coins: number,
): Promise<void> {
  if (!roomId || !recipientUid || coins <= 0) return;
  const coinsRef = ref(realtimeDb, `rooms/${roomId}/seatSupport/${recipientUid}/coins`);
  await runTransaction(coinsRef, (cur) => (Number(cur) || 0) + coins);
}

export function subscribeToRoomSeatSupport(
  roomId: string,
  onData: (byUid: Record<string, number>) => void,
): () => void {
  const listRef = ref(realtimeDb, `rooms/${roomId}/seatSupport`);
  const handler = (snap: { val: () => Record<string, { coins?: number } | number> | null }) => {
    const raw = snap.val() ?? {};
    const map: Record<string, number> = {};
    Object.entries(raw).forEach(([uid, row]) => {
      const coins =
        typeof row === 'number'
          ? row
          : Number((row as { coins?: number })?.coins) || 0;
      if (coins > 0) map[uid] = coins;
    });
    onData(map);
  };
  onValue(listRef, handler);
  return () => off(listRef, 'value', handler);
}

/** تصفير أرقام الدعم تحت المقاعد (ترقيم) — الكل */
export async function clearRoomSeatSupport(roomId: string): Promise<void> {
  if (!roomId) return;
  await set(ref(realtimeDb, `rooms/${roomId}/seatSupport`), null);
}

/** تصفير دعم أشخاص محدّدين على المقاعد */
export async function clearRoomSeatSupportForUsers(
  roomId: string,
  uids: string[],
): Promise<void> {
  if (!roomId || uids.length === 0) return;
  await Promise.all(
    uids.map((uid) => set(ref(realtimeDb, `rooms/${roomId}/seatSupport/${uid}`), null)),
  );
}
