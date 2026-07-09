/**
 * دعوات ألعاب الروم — بوب أب للشخص المحدد فقط (RTDB)
 */
import {
  ref,
  push,
  set,
  update,
  onValue,
  off,
  get,
  remove,
  type DataSnapshot,
} from 'firebase/database';
import { realtimeDb, auth } from './index';
import type { RoomFreeGameId } from '@/constants/roomFreeGames';

export type RoomGameInviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface RoomGameInvite {
  id: string;
  targetUid: string;
  targetName: string;
  hostUid: string;
  hostName: string;
  roomId: string;
  sessionId: string;
  gameId: RoomFreeGameId;
  gameName: string;
  gameEmoji: string;
  joinCode: string;
  status: RoomGameInviteStatus;
  createdAt: number;
  expiresAt: number;
}

const INVITE_TTL_MS = 10 * 60 * 1000;

export async function sendTargetedRoomGameInvite(input: {
  targetUid: string;
  targetName: string;
  roomId: string;
  sessionId: string;
  gameId: RoomFreeGameId;
  gameName: string;
  gameEmoji: string;
  joinCode: string;
  hostName: string;
}): Promise<RoomGameInvite> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  if (user.uid === input.targetUid) throw new Error('لا يمكن دعوة نفسك');

  const inviteRef = push(ref(realtimeDb, `roomGameInvites/${input.targetUid}`));
  const id = inviteRef.key!;
  const now = Date.now();

  const invite: RoomGameInvite = {
    id,
    targetUid: input.targetUid,
    targetName: input.targetName,
    hostUid: user.uid,
    hostName: input.hostName,
    roomId: input.roomId,
    sessionId: input.sessionId,
    gameId: input.gameId,
    gameName: input.gameName,
    gameEmoji: input.gameEmoji,
    joinCode: input.joinCode,
    status: 'pending',
    createdAt: now,
    expiresAt: now + INVITE_TTL_MS,
  };

  await set(inviteRef, invite);
  return invite;
}

export async function resolveRoomGameInvite(
  targetUid: string,
  inviteId: string,
  status: Exclude<RoomGameInviteStatus, 'pending'>,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  await update(ref(realtimeDb, `roomGameInvites/${targetUid}/${inviteId}`), { status });
}

export async function cancelRoomGameInvite(targetUid: string, inviteId: string): Promise<void> {
  await resolveRoomGameInvite(targetUid, inviteId, 'cancelled');
}

export function subscribePendingRoomGameInvites(
  targetUid: string,
  cb: (invites: RoomGameInvite[]) => void,
): () => void {
  const r = ref(realtimeDb, `roomGameInvites/${targetUid}`);
  const handler = (snap: DataSnapshot) => {
    const now = Date.now();
    const invites: RoomGameInvite[] = Object.entries(snap.val() ?? {})
      .map(([id, raw]) => ({ id, ...(raw as Omit<RoomGameInvite, 'id'>) }))
      .filter((i) => i.status === 'pending' && i.expiresAt > now)
      .sort((a, b) => b.createdAt - a.createdAt);
    cb(invites);
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

export async function getRoomGameInvite(
  targetUid: string,
  inviteId: string,
): Promise<RoomGameInvite | null> {
  const snap = await get(ref(realtimeDb, `roomGameInvites/${targetUid}/${inviteId}`));
  if (!snap.exists()) return null;
  return { id: inviteId, ...(snap.val() as Omit<RoomGameInvite, 'id'>) };
}

/** تنظيف دعوة منتهية */
export async function clearRoomGameInvite(targetUid: string, inviteId: string): Promise<void> {
  await remove(ref(realtimeDb, `roomGameInvites/${targetUid}/${inviteId}`));
}
