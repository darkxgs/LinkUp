import { get, ref } from 'firebase/database';

import { auth, realtimeDb } from '@/services/firebase';
import { normalizeRoomFromRtdb, type Room } from '@/services/firebase/rooms';

// roomId → كلمة المرور التي جرى التحقق مقابلها — تخزين القيمة (لا مجرد العلم)
// يجعل تغيير المضيف للرمز يُبطل التحقق تلقائياً ويعيد تحدي من تحقق سابقاً (b18)
const verifiedRoomPasswords = new Map<string, string>();

export function markRoomPasswordVerified(roomId: string, password?: string): void {
  if (roomId) verifiedRoomPasswords.set(roomId, String(password ?? ''));
}

export function isRoomPasswordVerified(roomId: string, currentPassword?: string): boolean {
  if (!verifiedRoomPasswords.has(roomId)) return false;
  if (currentPassword !== undefined) {
    return verifiedRoomPasswords.get(roomId) === String(currentPassword ?? '');
  }
  return true;
}

export function clearRoomPasswordVerification(roomId: string): void {
  verifiedRoomPasswords.delete(roomId);
}

export function resolveRoomAccessMode(
  room: Pick<Room, 'mode' | 'isPrivate'>,
): 'public' | 'friend' | 'locked' {
  return room.mode ?? (room.isPrivate ? 'locked' : 'public');
}

export function roomRequiresPassword(
  room: Pick<Room, 'mode' | 'isPrivate' | 'password' | 'hostUid' | 'coHosts'>,
  myUid?: string | null,
): boolean {
  if (!myUid) return true;
  if (room.hostUid === myUid) return false;
  if (room.coHosts?.includes(myUid)) return false;
  const mode = resolveRoomAccessMode(room);
  return mode === 'locked' && Boolean(room.password);
}

export function verifyRoomPassword(room: Pick<Room, 'password'>, input: string): boolean {
  return input.trim() === String(room.password ?? '');
}

export async function fetchRoomForEntry(roomId: string): Promise<Room | null> {
  const trimmed = roomId?.trim();
  if (!trimmed) return null;
  try {
    const snap = await get(ref(realtimeDb, `rooms/${trimmed}`));
    if (!snap.exists()) return null;
    const room = normalizeRoomFromRtdb(trimmed, snap.val() as Record<string, unknown>);
    if (room.isActive === false) return null;
    return room;
  } catch {
    return null;
  }
}

export function canEnterRoomWithoutPrompt(room: Room): boolean {
  const myUid = auth.currentUser?.uid;
  if (!roomRequiresPassword(room, myUid)) return true;
  return isRoomPasswordVerified(room.id, room.password ?? '');
}
