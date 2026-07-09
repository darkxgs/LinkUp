/**
 * Room Throne — عرش الغرفة (بجانب المضيف)
 * يشغله من تجاوز قيمة هداياه المرسلة في الروم الحد المُحدَّد من لوحة التحكم.
 */
import { ref, set, onValue, off, runTransaction, get } from 'firebase/database';
import { realtimeDb } from './firebase/index';

export interface ThroneContributor {
  uid: string;
  name: string;
  avatar?: string;
  coins: number;
  level?: number;
  vipLevel?: number;
}

export interface RoomThroneState {
  occupantUid: string | null;
  occupantName: string;
  occupantAvatar?: string;
  occupantLevel?: number;
  occupantVipLevel?: number;
  occupantCoins: number;
  updatedAt: number;
}

const EMPTY_THRONE: RoomThroneState = {
  occupantUid: null,
  occupantName: '',
  occupantCoins: 0,
  updatedAt: Date.now(),
};

function pickTopEligible(
  contributors: Record<string, ThroneContributor>,
  minRequired: number,
): ThroneContributor | null {
  const eligible = Object.values(contributors).filter((c) => c.coins >= minRequired);
  if (!eligible.length) return null;
  return eligible.sort((a, b) => b.coins - a.coins)[0]!;
}

async function syncThroneOccupant(
  roomId: string,
  minRequired: number,
): Promise<void> {
  const contribRef = ref(realtimeDb, `rooms/${roomId}/throneContributions`);
  const throneRef = ref(realtimeDb, `rooms/${roomId}/throne`);

  const [contribSnap, throneSnap] = await Promise.all([get(contribRef), get(throneRef)]);
  const contributors = (contribSnap.val() as Record<string, ThroneContributor>) ?? {};
  const top = pickTopEligible(contributors, minRequired);

  if (!top) {
    const current = throneSnap.val() as RoomThroneState | null;
    if (current?.occupantUid) {
      await set(throneRef, { ...EMPTY_THRONE, updatedAt: Date.now() });
    }
    return;
  }

  const current = (throneSnap.val() as RoomThroneState | null) ?? EMPTY_THRONE;
  if (current.occupantUid === top.uid && current.occupantCoins === top.coins) return;

  await set(throneRef, {
    occupantUid: top.uid,
    occupantName: top.name,
    occupantAvatar: top.avatar ?? '',
    occupantLevel: top.level,
    occupantVipLevel: top.vipLevel,
    occupantCoins: top.coins,
    updatedAt: Date.now(),
  });
}

/** تسجيل هدية مرسلة في الروم + تحديث العرش */
export async function recordThroneGiftContribution(
  roomId: string,
  contributor: ThroneContributor,
  minRequired: number,
): Promise<void> {
  if (!roomId || contributor.coins <= 0) return;

  const contribRef = ref(realtimeDb, `rooms/${roomId}/throneContributions/${contributor.uid}`);
  await runTransaction(contribRef, (raw) => {
    const prev = raw as ThroneContributor | null;
    return {
      ...contributor,
      coins: (prev?.coins ?? 0) + contributor.coins,
    };
  });

  await syncThroneOccupant(roomId, minRequired);
}

/** محاولة شغل العرش يدوياً (بعد التحقق من المساهمة) */
export async function claimRoomThrone(
  roomId: string,
  uid: string,
  minRequired: number,
): Promise<void> {
  const contribRef = ref(realtimeDb, `rooms/${roomId}/throneContributions/${uid}`);
  const snap = await get(contribRef);
  const data = snap.val() as ThroneContributor | null;
  if (!data || data.coins < minRequired) {
    throw new Error(`تحتاج ${minRequired.toLocaleString()} كوين من الهدايا المرسلة`);
  }
  await syncThroneOccupant(roomId, minRequired);
}

/** إخلاء العرش — للمضيف / مدير الوكالة */
export async function vacateRoomThrone(roomId: string): Promise<void> {
  await set(ref(realtimeDb, `rooms/${roomId}/throne`), {
    ...EMPTY_THRONE,
    updatedAt: Date.now(),
  });
}

export function subscribeToRoomThrone(
  roomId: string,
  callback: (state: RoomThroneState) => void,
): () => void {
  const throneRef = ref(realtimeDb, `rooms/${roomId}/throne`);
  const handler = onValue(throneRef, (snap) => {
    if (!snap.exists()) {
      callback(EMPTY_THRONE);
      return;
    }
    const raw = snap.val();
    callback({
      occupantUid: raw.occupantUid ?? null,
      occupantName: raw.occupantName ?? '',
      occupantAvatar: raw.occupantAvatar,
      occupantLevel: raw.occupantLevel,
      occupantVipLevel: raw.occupantVipLevel,
      occupantCoins: Number(raw.occupantCoins) || 0,
      updatedAt: Number(raw.updatedAt) || Date.now(),
    });
  });
  return () => off(throneRef, 'value', handler);
}

export function subscribeToMyThroneContribution(
  roomId: string,
  uid: string,
  callback: (coins: number) => void,
): () => void {
  if (!uid) {
    callback(0);
    return () => {};
  }
  const contribRef = ref(realtimeDb, `rooms/${roomId}/throneContributions/${uid}/coins`);
  const handler = onValue(contribRef, (snap) => {
    callback(Number(snap.val()) || 0);
  });
  return () => off(contribRef, 'value', handler);
}
