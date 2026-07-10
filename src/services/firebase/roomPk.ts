/**
 * Room PK — تحديات داخل الغرفة وبين الغرف
 * - in-room: فريق أزرق vs أحمر على المقاعد
 * - cross-room: غرفتان تتنافسان على إجمالي الهدايا
 * نقاط PK = قيمة الهدية بالعملات (1:1)، بدون هدايا للنفس
 */

import {
  ref,
  get,
  set,
  update,
  remove,
  onValue,
  off,
  runTransaction,
  type DataSnapshot,
} from 'firebase/database';
import { realtimeDb, auth } from './index';
import { findMySeatInRoom } from './rooms';

export type PkMode = 'in_room' | 'cross_room';
export type PkStatus = 'idle' | 'active' | 'ended';
export type PkDuration = 5 | 15 | 30;
export type PkTeam = 'blue' | 'red';

export interface PkGifter {
  uid: string;
  name: string;
  avatar: string;
  score: number;
}

export interface RoomPkCrossRoom {
  opponentRoomId: string;
  opponentRoomName: string;
}

export interface RoomPkState {
  status: PkStatus;
  mode?: PkMode;
  durationMinutes?: PkDuration;
  startedAt?: number;
  endsAt?: number;
  blueScore: number;
  redScore: number;
  blueTopGifters?: PkGifter[];
  redTopGifters?: PkGifter[];
  crossRoom?: RoomPkCrossRoom;
  winner?: PkTeam | 'draw';
  endedAt?: number;
}

const EMPTY_PK: RoomPkState = { status: 'idle', blueScore: 0, redScore: 0 };

function pkRef(roomId: string) {
  return ref(realtimeDb, `rooms/${roomId}/pk`);
}

export { pkRef };

export function normalizePkState(raw: unknown): RoomPkState {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_PK };
  const o = raw as Record<string, unknown>;
  return {
    status: (o.status as PkStatus) ?? 'idle',
    mode: o.mode as PkMode | undefined,
    durationMinutes: o.durationMinutes as PkDuration | undefined,
    startedAt: typeof o.startedAt === 'number' ? o.startedAt : undefined,
    endsAt: typeof o.endsAt === 'number' ? o.endsAt : undefined,
    blueScore: Number(o.blueScore) || 0,
    redScore: Number(o.redScore) || 0,
    blueTopGifters: Array.isArray(o.blueTopGifters) ? (o.blueTopGifters as PkGifter[]) : [],
    redTopGifters: Array.isArray(o.redTopGifters) ? (o.redTopGifters as PkGifter[]) : [],
    crossRoom: o.crossRoom as RoomPkCrossRoom | undefined,
    winner: o.winner as RoomPkState['winner'],
    endedAt: typeof o.endedAt === 'number' ? o.endedAt : undefined,
  };
}

/** توزيع المقاعد على الفريقين (مطابق لتصميم PK الكلاسيكي) */
export function getPkTeamForSeat(seatIndex: number): PkTeam | null {
  if (seatIndex === 0) return 'blue';
  const blue = new Set([1, 2, 5, 6]);
  const red = new Set([3, 4, 7, 8]);
  if (blue.has(seatIndex)) return 'blue';
  if (red.has(seatIndex)) return 'red';
  return seatIndex % 2 === 1 ? 'blue' : 'red';
}

export function isPkActive(pk: RoomPkState | null | undefined): boolean {
  if (!pk || pk.status !== 'active') return false;
  if (pk.endsAt && Date.now() >= pk.endsAt) return false;
  return true;
}

export function subscribeToRoomPk(
  roomId: string,
  callback: (pk: RoomPkState) => void,
): () => void {
  const r = pkRef(roomId);
  const handler = (snap: DataSnapshot) => {
    callback(normalizePkState(snap.val()));
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

async function assertHostCanStart(roomId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  const snap = await get(ref(realtimeDb, `rooms/${roomId}`));
  if (!snap.exists()) throw new Error('الغرفة غير موجودة');
  const roomData = snap.val() ?? {};
  const hostUid = String(roomData.hostUid ?? '');
  // المضيف أو مشرف الإشراف (الأصفر) — طلب العميل: الإشراف يبدأ التحدي أيضاً
  const isYellowSupervisor =
    (roomData.memberRoles as Record<string, string> | undefined)?.[user.uid] ===
    'yellow_supervisor';
  if (hostUid !== user.uid && !isYellowSupervisor) {
    throw new Error('تحدي PK للمضيف أو مشرفي الإشراف فقط');
  }
  const pkSnap = await get(pkRef(roomId));
  const pk = normalizePkState(pkSnap.val());
  if (pk.status === 'active' && pk.endsAt && Date.now() >= pk.endsAt) {
    await update(pkRef(roomId), { status: 'ended', endedAt: Date.now() });
    return;
  }
  if (pk.status === 'ended') {
    await remove(pkRef(roomId));
    return;
  }
  if (isPkActive(pk)) throw new Error('يوجد تحدٍ نشط بالفعل');
}

function buildPkPayload(
  mode: PkMode,
  durationMinutes: PkDuration,
  crossRoom?: RoomPkCrossRoom,
): RoomPkState {
  const startedAt = Date.now();
  const payload: RoomPkState = {
    status: 'active',
    mode,
    durationMinutes,
    startedAt,
    endsAt: startedAt + durationMinutes * 60 * 1000,
    blueScore: 0,
    redScore: 0,
    blueTopGifters: [],
    redTopGifters: [],
  };
  // RTDB يرفض undefined — لا نُدرج crossRoom إلا في وضع cross_room
  if (crossRoom) payload.crossRoom = crossRoom;
  return payload;
}

export async function startInRoomPK(
  roomId: string,
  durationMinutes: PkDuration,
): Promise<void> {
  await assertHostCanStart(roomId);
  const payload = buildPkPayload('in_room', durationMinutes);
  await update(ref(realtimeDb, `rooms/${roomId}`), {
    pk: payload,
    updatedAt: Date.now(),
  });
}

export async function startCrossRoomPK(
  roomId: string,
  opponentRoomId: string,
  durationMinutes: PkDuration,
): Promise<void> {
  await assertHostCanStart(roomId);
  await activateCrossRoomPK(roomId, opponentRoomId, durationMinutes);
}

/** تفعيل PK بين غرفتين بعد قبول مطابقة — بدون فحص المضيف */
export async function activateCrossRoomPK(
  roomId: string,
  opponentRoomId: string,
  durationMinutes: PkDuration,
): Promise<void> {
  if (roomId === opponentRoomId) throw new Error('اختر غرفة أخرى');

  const oppSnap = await get(ref(realtimeDb, `rooms/${opponentRoomId}`));
  if (!oppSnap.exists()) throw new Error('الغرفة المنافسة غير موجودة');
  const opp = oppSnap.val();
  if (opp.isArchived === true || opp.isActive === false) {
    throw new Error('الغرفة المنافسة غير متاحة');
  }

  const oppPkSnap = await get(pkRef(opponentRoomId));
  if (isPkActive(normalizePkState(oppPkSnap.val()))) {
    throw new Error('الغرفة المنافسة في تحدٍ آخر');
  }

  const myPkSnap = await get(pkRef(roomId));
  if (isPkActive(normalizePkState(myPkSnap.val()))) {
    throw new Error('يوجد تحدٍ نشط بالفعل');
  }

  const mySnap = await get(ref(realtimeDb, `rooms/${roomId}`));
  const myName = String(mySnap.val()?.name ?? 'غرفة');

  const crossMine: RoomPkCrossRoom = {
    opponentRoomId,
    opponentRoomName: String(opp.name ?? 'غرفة'),
  };
  const crossOpp: RoomPkCrossRoom = {
    opponentRoomId: roomId,
    opponentRoomName: myName,
  };

  const base = (mode: PkMode, cross: RoomPkCrossRoom) =>
    buildPkPayload(mode, durationMinutes, cross);

  await update(ref(realtimeDb, `rooms/${roomId}`), {
    pk: base('cross_room', crossMine),
    updatedAt: Date.now(),
  });
  await update(ref(realtimeDb, `rooms/${opponentRoomId}`), {
    pk: base('cross_room', crossOpp),
    updatedAt: Date.now(),
  });
}

function upsertTopGifter(list: PkGifter[], entry: PkGifter): PkGifter[] {
  const next = [...list];
  const idx = next.findIndex((g) => g.uid === entry.uid);
  const existing = idx >= 0 ? next[idx] : undefined;
  if (existing) {
    next[idx] = { ...existing, score: existing.score + entry.score };
  } else {
    next.push(entry);
  }
  return next.sort((a, b) => b.score - a.score).slice(0, 3);
}

export async function recordPKGift(
  roomId: string,
  giftValue: number,
  fromUid: string,
  toUid: string,
  gifterName: string,
  gifterAvatar: string,
): Promise<void> {
  if (!giftValue || giftValue <= 0) return;
  if (fromUid === toUid) return;

  const pkSnap = await get(pkRef(roomId));
  const pk = normalizePkState(pkSnap.val());
  if (!isPkActive(pk)) return;

  let team: PkTeam | null = null;

  if (pk.mode === 'cross_room') {
    team = 'blue';
  } else {
    const seatIdx = await findMySeatInRoom(roomId);
    const recipientSeat = await findSeatIndexForUid(roomId, toUid);
    const idx = recipientSeat ?? seatIdx;
    if (idx === null) return;
    team = getPkTeamForSeat(idx);
  }

  if (!team) return;

  const gifterEntry: PkGifter = {
    uid: fromUid,
    name: gifterName,
    avatar: gifterAvatar,
    score: giftValue,
  };

  const blueRef = ref(realtimeDb, `rooms/${roomId}/pk/blueScore`);
  const redRef = ref(realtimeDb, `rooms/${roomId}/pk/redScore`);

  if (team === 'blue') {
    await runTransaction(blueRef, (cur) => (Number(cur) || 0) + giftValue);
    const topSnap = await get(ref(realtimeDb, `rooms/${roomId}/pk/blueTopGifters`));
    const top = upsertTopGifter(
      (topSnap.val() as PkGifter[]) ?? [],
      gifterEntry,
    );
    await set(ref(realtimeDb, `rooms/${roomId}/pk/blueTopGifters`), top);
  } else {
    await runTransaction(redRef, (cur) => (Number(cur) || 0) + giftValue);
    const topSnap = await get(ref(realtimeDb, `rooms/${roomId}/pk/redTopGifters`));
    const top = upsertTopGifter(
      (topSnap.val() as PkGifter[]) ?? [],
      gifterEntry,
    );
    await set(ref(realtimeDb, `rooms/${roomId}/pk/redTopGifters`), top);
  }

  if (pk.mode === 'cross_room' && pk.crossRoom?.opponentRoomId) {
    const oppId = pk.crossRoom.opponentRoomId;
    const oppRedRef = ref(realtimeDb, `rooms/${oppId}/pk/redScore`);
    await runTransaction(oppRedRef, (cur) => (Number(cur) || 0) + giftValue);
    const oppTopSnap = await get(ref(realtimeDb, `rooms/${oppId}/pk/redTopGifters`));
    const oppTop = upsertTopGifter(
      (oppTopSnap.val() as PkGifter[]) ?? [],
      gifterEntry,
    );
    await set(ref(realtimeDb, `rooms/${oppId}/pk/redTopGifters`), oppTop);
  }
}

async function findSeatIndexForUid(
  roomId: string,
  uid: string,
): Promise<number | null> {
  const snap = await get(ref(realtimeDb, `rooms/${roomId}/seats`));
  if (!snap.exists()) return null;
  for (const [key, s] of Object.entries(snap.val() as Record<string, { uid?: string }>)) {
    if (s?.uid === uid) {
      return parseInt(key.replace('seat_', ''), 10);
    }
  }
  return null;
}

export async function endRoomPK(roomId: string, force = false): Promise<RoomPkState | null> {
  const user = auth.currentUser;
  const pkSnap = await get(pkRef(roomId));
  const pk = normalizePkState(pkSnap.val());
  if (pk.status !== 'active' && !force) return null;

  const roomSnap = await get(ref(realtimeDb, `rooms/${roomId}`));
  const roomVal = roomSnap.val() ?? {};
  const hostUid = roomVal.hostUid;
  const isYellowSupervisor =
    user != null &&
    (roomVal.memberRoles as Record<string, string> | undefined)?.[user.uid] ===
      'yellow_supervisor';
  if (user && hostUid !== user.uid && !isYellowSupervisor && !force) {
    throw new Error('تحدي PK للمضيف أو مشرفي الإشراف فقط');
  }

  let winner: RoomPkState['winner'] = 'draw';
  if (pk.blueScore > pk.redScore) winner = 'blue';
  else if (pk.redScore > pk.blueScore) winner = 'red';

  const ended: RoomPkState = {
    ...pk,
    status: 'ended',
    winner,
    endedAt: Date.now(),
  };

  await update(pkRef(roomId), {
    status: 'ended',
    winner,
    endedAt: ended.endedAt,
  });

  if (pk.mode === 'cross_room' && pk.crossRoom?.opponentRoomId) {
    const oppId = pk.crossRoom.opponentRoomId;
    const oppSnap = await get(pkRef(oppId));
    const oppPk = normalizePkState(oppSnap.val());
    let oppWinner: RoomPkState['winner'] = 'draw';
    if (oppPk.blueScore > oppPk.redScore) oppWinner = 'blue';
    else if (oppPk.redScore > oppPk.blueScore) oppWinner = 'red';
    await update(pkRef(oppId), {
      status: 'ended',
      winner: oppWinner,
      endedAt: Date.now(),
    });
  }


  return ended;
}

export async function clearRoomPK(roomId: string): Promise<void> {
  await set(pkRef(roomId), EMPTY_PK);
}
