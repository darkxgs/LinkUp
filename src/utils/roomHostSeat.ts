/**
 * صلاحيات مقعد المضيف (seat_0)
 * — صاحب الغرفة/الوكالة أو المشرفون (coHosts) فقط
 */

export type RoomHostSeatAccess = {
  hostUid?: string;
  agencyId?: string;
  isAgencyRoom?: boolean;
  coHosts?: string[];
};

export function getRoomCoHosts(room: RoomHostSeatAccess | null | undefined): string[] {
  const raw = (room as { coHosts?: unknown } | null | undefined)?.coHosts;
  if (!raw) return [];
  // RTDB قد يعيد القائمة كمصفوفة أو ككائن ({idx: uid} أو {uid: true}) —
  // التقييد بـ Array.isArray كان يُسقط صلاحيات المشرفين بصمت («بعضها يعمل وبعضها لا»)
  let list: unknown[];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'object') {
    list = Object.entries(raw as Record<string, unknown>).map(([key, val]) =>
      typeof val === 'string' ? val : val === true ? key : '',
    );
  } else {
    return [];
  }
  return list.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/** هل يمكن للمستخدم الجلوس على مقعد المضيف (0)؟ */
export function canJoinHostSeat(
  room: RoomHostSeatAccess | null | undefined,
  uid: string | null | undefined,
): boolean {
  if (!room || !uid) return false;
  const hostUid = String(room.hostUid ?? '');
  if (!hostUid) return false;
  if (uid === hostUid) return true;
  return getRoomCoHosts(room).includes(uid);
}

export function isAgencyHostSeatRoom(room: RoomHostSeatAccess | null | undefined): boolean {
  return !!(room && (room.isAgencyRoom === true || !!room.agencyId));
}

/**
 * من يمكنه شغل مقعد المضيف (0)؟
 * — صاحب الغرفة + المشرفون (coHosts) في كل الغرف بما فيها الوكالة
 */
export function canOccupyHostSeat(
  room: RoomHostSeatAccess | null | undefined,
  uid: string | null | undefined,
): boolean {
  if (!room || !uid) return false;
  const hostUid = String(room.hostUid ?? '');
  if (!hostUid) return false;
  return canJoinHostSeat(room, uid);
}
