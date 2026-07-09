/**
 * دعوات المايك في غرفة الوكالة — قبول/رفض عبر مودال داخل الروم (RTDB)
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
import { acceptInvitedMicSeat } from './rooms';

export type RoomMicInviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface RoomMicInvite {
  id: string;
  targetUid: string;
  targetName: string;
  inviterUid: string;
  inviterName: string;
  inviterAvatar?: string;
  roomId: string;
  roomName: string;
  /** -1 = أي مقعد فارغ */
  seatIdx: number;
  includeMembership: boolean;
  status: RoomMicInviteStatus;
  createdAt: number;
  expiresAt: number;
}

const INVITE_TTL_MS = 15 * 60 * 1000;

export async function sendRoomMicInvite(input: {
  targetUid: string;
  targetName: string;
  roomId: string;
  roomName: string;
  seatIdx?: number;
  includeMembership?: boolean;
  inviterName?: string;
  inviterAvatar?: string;
}): Promise<RoomMicInvite> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  if (user.uid === input.targetUid) throw new Error('لا يمكن دعوة نفسك');

  const inviteRef = push(ref(realtimeDb, `roomMicInvites/${input.targetUid}`));
  const id = inviteRef.key!;
  const now = Date.now();

  const invite: RoomMicInvite = {
    id,
    targetUid: input.targetUid,
    targetName: input.targetName,
    inviterUid: user.uid,
    inviterName: input.inviterName?.trim() || 'مدير الوكالة',
    inviterAvatar: input.inviterAvatar,
    roomId: input.roomId,
    roomName: input.roomName,
    seatIdx: input.seatIdx ?? -1,
    includeMembership: input.includeMembership === true,
    status: 'pending',
    createdAt: now,
    expiresAt: now + INVITE_TTL_MS,
  };

  await set(inviteRef, invite);

  const { createNotification } = await import('@/services/firebase/notifications');
  await createNotification({
    uid: input.targetUid,
    type: 'system',
    fromUid: user.uid,
    fromName: invite.inviterName,
    fromAvatar: input.inviterAvatar,
    message: `${invite.inviterName} يدعوك للانضمام على المايك في غرفة "${input.roomName}"`,
    data: {
      type: 'mic_invite',
      title: 'دعوة للمايك',
      body: `${invite.inviterName} يدعوك للانضمام على المايك`,
      roomId: input.roomId,
      seatIdx: invite.seatIdx,
      inviteId: id,
      fromUid: user.uid,
      fromName: invite.inviterName,
      fromAvatar: input.inviterAvatar,
    },
    isRead: false,
  }).catch(() => {});

  return invite;
}

export async function resolveRoomMicInvite(
  targetUid: string,
  inviteId: string,
  status: Exclude<RoomMicInviteStatus, 'pending'>,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  await update(ref(realtimeDb, `roomMicInvites/${targetUid}/${inviteId}`), { status });
}

export function subscribePendingRoomMicInvites(
  targetUid: string,
  cb: (invites: RoomMicInvite[]) => void,
): () => void {
  const r = ref(realtimeDb, `roomMicInvites/${targetUid}`);
  const handler = (snap: DataSnapshot) => {
    const now = Date.now();
    const invites: RoomMicInvite[] = Object.entries(snap.val() ?? {})
      .map(([id, raw]) => ({ id, ...(raw as Omit<RoomMicInvite, 'id'>) }))
      .filter((i) => i.status === 'pending' && i.expiresAt > now)
      .sort((a, b) => b.createdAt - a.createdAt);
    cb(invites);
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

export async function getRoomMicInvite(
  targetUid: string,
  inviteId: string,
): Promise<RoomMicInvite | null> {
  const snap = await get(ref(realtimeDb, `roomMicInvites/${targetUid}/${inviteId}`));
  if (!snap.exists()) return null;
  return { id: inviteId, ...(snap.val() as Omit<RoomMicInvite, 'id'>) };
}

export async function clearRoomMicInvite(targetUid: string, inviteId: string): Promise<void> {
  await remove(ref(realtimeDb, `roomMicInvites/${targetUid}/${inviteId}`));
}

export async function acceptRoomMicInvite(invite: RoomMicInvite): Promise<number> {
  const user = auth.currentUser;
  if (!user || user.uid !== invite.targetUid) throw new Error('غير مصرح');
  if (invite.status !== 'pending' || invite.expiresAt < Date.now()) {
    throw new Error('انتهت صلاحية الدعوة');
  }

  const seatIdx = await acceptInvitedMicSeat(invite.roomId, {
    seatIdx: invite.seatIdx >= 0 ? invite.seatIdx : undefined,
    includeMembership: invite.includeMembership,
  });

  await resolveRoomMicInvite(invite.targetUid, invite.id, 'accepted');
  await clearRoomMicInvite(invite.targetUid, invite.id);
  return seatIdx;
}
