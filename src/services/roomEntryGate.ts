import { get, ref } from 'firebase/database';

import { auth, realtimeDb } from '@/services/firebase';
import { normalizeRoomFromRtdb, type Room } from '@/services/firebase/rooms';

const verifiedRoomIds = new Set<string>();

export function markRoomPasswordVerified(roomId: string): void {
  if (roomId) verifiedRoomIds.add(roomId);
}

export function isRoomPasswordVerified(roomId: string): boolean {
  return verifiedRoomIds.has(roomId);
}

export function clearRoomPasswordVerification(roomId: string): void {
  verifiedRoomIds.delete(roomId);
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
  return isRoomPasswordVerified(room.id);
}
