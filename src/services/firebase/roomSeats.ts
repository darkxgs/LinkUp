/**
 * منطق مشترك لعدد المقاعد/المايكات في غرف RTDB
 */

export const ALLOWED_SEAT_COUNTS = [9, 11, 16, 19, 21] as const;
export type AllowedSeatCount = (typeof ALLOWED_SEAT_COUNTS)[number];

export interface RoomSeatRecord {
  uid: string;
  displayName?: string;
  avatar?: string;
  isMuted?: boolean;
  /** من نفّذ الكتم الإداري — المكتوم لا يفكّ كتم نفسه ما دامت موجودة */
  mutedBy?: string;
  /** علامة انقطاع RTDB العابر — المقعد يُفرَّغ بعد مهلة سماح لا فوراً */
  disconnectedAt?: number;
  isSpeaking?: boolean;
  isVIP?: boolean;
  vipLevel?: number;
  level?: number;
  coins?: number;
  joinedAt?: number;
}

function buildSeatsForHost(
  seatsCount: number,
  hostUid: string,
  hostName: string,
  hostAvatar: string,
  hostCoins = 0,
  hostLevel = 1,
  hostIsVIP = false,
  hostVipLevel = 0,
): Record<string, RoomSeatRecord> {
  const seats: Record<string, RoomSeatRecord> = {};
  for (let i = 0; i < seatsCount; i++) {
    if (i === 0) {
      seats[`seat_${i}`] = {
        uid: hostUid,
        displayName: hostName,
        avatar: hostAvatar,
        isMuted: false,
        coins: hostCoins,
        level: hostLevel,
        isVIP: hostIsVIP,
        vipLevel: hostVipLevel,
        joinedAt: Date.now(),
      };
    } else {
      seats[`seat_${i}`] = { uid: '' };
    }
  }
  return seats;
}

/**
 * يوسّع/يقلّص مقاعد RTDB مع الحفاظ على الجالسين الحاليين.
 * عند التقليص لا يُحذف من مقعده رقمه ≥ العدد الجديد — بل يُعاد ترصيفه على أقرب
 * مقعد فارغ (#7)؛ ولا يُنزَل إلا الفائض عن المقاعد المتاحة (الأحدث انضماماً أولاً).
 */
export function rebuildSeatsForCountChange(
  roomData: Record<string, unknown>,
  newSeatsCount: number,
): Record<string, RoomSeatRecord> {
  const hostUid = String(roomData.hostUid ?? '');
  const prevSeats = (roomData.seats ?? {}) as Record<string, RoomSeatRecord>;
  const hostSeat = prevSeats.seat_0;
  const seats = buildSeatsForHost(
    newSeatsCount,
    hostUid,
    hostSeat?.displayName ?? String(roomData.hostName ?? 'مضيف'),
    hostSeat?.avatar ?? String(roomData.hostAvatar ?? ''),
    typeof hostSeat?.coins === 'number' ? hostSeat.coins : 0,
    hostSeat?.level ?? 1,
    Boolean(hostSeat?.isVIP),
    hostSeat?.vipLevel ?? 0,
  );
  const displaced: RoomSeatRecord[] = [];
  for (const [key, seat] of Object.entries(prevSeats)) {
    const idx = parseInt(String(key).replace('seat_', ''), 10);
    // 50 = مقعد المدير الثاني (SECOND_HOST_SEAT_INDEX) — يُحفظ دائماً ولا يتبع عدد المقاعد
    const isSecondHostSeat = idx === 50;
    if (idx === 0 || Number.isNaN(idx)) continue;
    if (!seat?.uid || seat.uid === '') continue;
    if (isSecondHostSeat || idx < newSeatsCount) {
      seats[key] = { ...seat };
      continue;
    }
    displaced.push({ ...seat });
  }
  // الأقدم انضماماً يحصل على المقاعد المتبقية أولاً
  displaced.sort((a, b) => (Number(a.joinedAt) || 0) - (Number(b.joinedAt) || 0));
  for (const seat of displaced) {
    for (let i = 1; i < newSeatsCount; i++) {
      const key = `seat_${i}`;
      if ((seats[key]?.uid ?? '') === '' && !isSeatLocked(roomData, i)) {
        seats[key] = seat;
        break;
      }
    }
    // لا مقعد فارغاً — الفائض فقط هو من يُنزَل
  }
  return seats;
}

export function resolveRoomMaxSeatsCount(
  room: Record<string, unknown> | null | undefined,
  agencyMaxSeats?: number | null,
): number {
  const isAgencyRoom = Boolean(room?.agencyId || room?.isAgencyRoom);
  const roomMax = Number(room?.maxSeatsCount);
  const agencyMax = Number(agencyMaxSeats);

  if (!isAgencyRoom) {
    if (ALLOWED_SEAT_COUNTS.includes(roomMax as AllowedSeatCount)) return roomMax;
    return 21;
  }

  let effective = 9;
  if (ALLOWED_SEAT_COUNTS.includes(roomMax as AllowedSeatCount)) {
    effective = roomMax;
  }
  if (ALLOWED_SEAT_COUNTS.includes(agencyMax as AllowedSeatCount)) {
    effective = Math.max(effective, agencyMax);
  }
  return effective;
}

export function buildInitialSeatsForHost(
  seatsCount: number,
  hostUid: string,
  hostName: string,
  hostAvatar: string,
  hostCoins = 0,
  hostLevel = 1,
  hostIsVIP = false,
  hostVipLevel = 0,
): Record<string, RoomSeatRecord> {
  return buildSeatsForHost(
    seatsCount,
    hostUid,
    hostName,
    hostAvatar,
    hostCoins,
    hostLevel,
    hostIsVIP,
    hostVipLevel,
  );
}

export function isSeatLocked(
  room: Record<string, unknown> | null | undefined,
  seatIdx: number,
): boolean {
  const lockedSeats = (room?.lockedSeats ?? {}) as Record<string, boolean>;
  return lockedSeats[`seat_${seatIdx}`] === true;
}

export function parseLockedSeats(
  raw: Record<string, unknown> | null | undefined,
): Record<string, boolean> {
  const locked = (raw?.lockedSeats ?? {}) as Record<string, boolean>;
  const result: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(locked)) {
    if (val === true) result[key] = true;
  }
  return result;
}

/** مقعد المدير الثاني — خارج شبكة المقاعد العادية */
export const SECOND_HOST_SEAT_INDEX = 50;

export function parseSecondHostAllowedUids(
  raw: Record<string, unknown> | null | undefined,
): Record<string, true> {
  const src = raw?.secondHostAllowedUids;
  if (!src || typeof src !== 'object') return {};
  const out: Record<string, true> = {};
  for (const [uid, val] of Object.entries(src as Record<string, unknown>)) {
    if (val === true && uid) out[uid] = true;
  }
  return out;
}

/**
 * من يمكنه الجلوس على مقعد المدير الثاني؟
 * — مدير الوكالة (hostUid) أو مشرف الإشراف (أصفر) فقط — وليس الأعضاء.
 */
export function canOccupySecondHostSeat(
  room: Record<string, unknown> | null | undefined,
  uid: string | null | undefined,
  memberRole: string | null | undefined,
  isHostOrCoHost = false,
): boolean {
  if (!room || !uid) return false;
  if (room.secondHostMic !== true) return false;
  const hostUid = String(room.hostUid ?? '');
  if (hostUid && uid === hostUid) return true;
  if (memberRole === 'yellow_supervisor') return true;
  if (isHostOrCoHost) return true;
  return false;
}

/** هل يمكن تعيين مستخدم على مقعد المدير الثاني؟ (للدعوة من المدير) */
export function canAssignUserToSecondHostSeat(
  room: Record<string, unknown> | null | undefined,
  targetUid: string,
  memberRole: string | null | undefined,
): boolean {
  if (!room || !targetUid) return false;
  const hostUid = String(room.hostUid ?? '');
  if (hostUid && targetUid === hostUid) return true;
  return memberRole === 'yellow_supervisor';
}
