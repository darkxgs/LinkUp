/**
 * مطابقة PK بين الوكالات — طلب → دعوة للمشرفين/مدير الوكالة → قبول/رفض → بدء التحدي
 *
 * RTDB:
 *   pkMatchRequests/{fromRoomId}
 *   pkAgencyInvites/{toRoomId}/{inviteId}
 */

import {
  ref,
  get,
  set,
  update,
  onValue,
  off,
  push,
  type DataSnapshot,
} from 'firebase/database';
import { realtimeDb, auth } from './index';
import { activateCrossRoomPK, isPkActive, normalizePkState, pkRef } from './roomPk';
import type { PkDuration } from './roomPk';
import { isAgencyLiveRoom, subscribeToRooms, type Room } from './rooms';

export type PkMatchRequestStatus = 'searching' | 'matched' | 'cancelled' | 'expired';
export type PkAgencyInviteStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

export interface PkMatchRequest {
  fromRoomId: string;
  fromRoomName: string;
  fromAgencyId?: string;
  fromAgencyName?: string;
  durationMinutes: PkDuration;
  status: PkMatchRequestStatus;
  createdAt: number;
  expiresAt: number;
  createdByUid: string;
  createdByName: string;
  matchedRoomId?: string;
  matchedRoomName?: string;
  matchedAt?: number;
}

export interface PkAgencyInvite {
  id: string;
  fromRoomId: string;
  fromRoomName: string;
  fromAgencyId?: string;
  fromAgencyName?: string;
  toRoomId: string;
  toRoomName?: string;
  toAgencyName?: string;
  durationMinutes: PkDuration;
  status: PkAgencyInviteStatus;
  createdAt: number;
  expiresAt: number;
  createdByUid: string;
  createdByName: string;
  respondedByUid?: string;
  respondedByName?: string;
  respondedAt?: number;
}

const MATCH_TTL_MS = 15 * 60 * 1000;

function matchRequestRef(fromRoomId: string) {
  return ref(realtimeDb, `pkMatchRequests/${fromRoomId}`);
}

function invitesRef(toRoomId: string) {
  return ref(realtimeDb, `pkAgencyInvites/${toRoomId}`);
}

async function loadUserName(uid: string): Promise<string> {
  const user = auth.currentUser;
  let name = user?.displayName ?? 'مستخدم';
  try {
    const { getUser } = await import('./users');
    const u = await getUser(uid);
    if (u?.displayName) name = u.displayName;
  } catch {
    // ignore
  }
  return name;
}

async function fetchActiveAgencyRooms(excludeRoomId: string): Promise<Room[]> {
  return new Promise((resolve) => {
    const unsub = subscribeToRooms((list) => {
      unsub();
      resolve(
        list.filter(
          (r) =>
            r.id !== excludeRoomId &&
            isAgencyLiveRoom(r) &&
            r.isActive !== false &&
            r.hostUid,
        ),
      );
    }, 80);
  });
}

async function roomHasActivePk(roomId: string): Promise<boolean> {
  const snap = await get(pkRef(roomId));
  return isPkActive(normalizePkState(snap.val()));
}

/** بدء مطابقة — يُرسل دعوة لكل وكالة نشطة */
export async function startPkAgencyMatchSearch(
  fromRoomId: string,
  durationMinutes: PkDuration,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const roomSnap = await get(ref(realtimeDb, `rooms/${fromRoomId}`));
  if (!roomSnap.exists()) throw new Error('الغرفة غير موجودة');
  const room = roomSnap.val() as Record<string, unknown>;
  const hostUid = String(room.hostUid ?? '');
  const isYellowSupervisor =
    (room.memberRoles as Record<string, string> | undefined)?.[user.uid] ===
    'yellow_supervisor';
  if (hostUid !== user.uid && !isYellowSupervisor) {
    throw new Error('بدء المطابقة لمدير الوكالة أو مشرفي الإشراف فقط');
  }
  if (!isAgencyLiveRoom({ isAgencyRoom: room.isAgencyRoom === true, agencyId: room.agencyId as string })) {
    throw new Error('المطابقة بين الوكالات متاحة لغرف الوكالات فقط');
  }
  if (await roomHasActivePk(fromRoomId)) {
    throw new Error('يوجد تحدٍ نشط في غرفتك');
  }

  const existing = await get(matchRequestRef(fromRoomId));
  if (existing.exists()) {
    const cur = existing.val() as PkMatchRequest;
    if (cur.status === 'searching' && cur.expiresAt > Date.now()) {
      throw new Error('لديك مطابقة جارية بالفعل');
    }
  }

  const userName = await loadUserName(user.uid);
  const now = Date.now();
  const fromAgencyId = room.agencyId ? String(room.agencyId) : undefined;
  const request: PkMatchRequest = {
    fromRoomId,
    fromRoomName: String(room.name ?? 'غرفة'),
    fromAgencyId,
    fromAgencyName: String(room.name ?? 'وكالة'),
    durationMinutes,
    status: 'searching',
    createdAt: now,
    expiresAt: now + MATCH_TTL_MS,
    createdByUid: user.uid,
    createdByName: userName,
  };

  await set(matchRequestRef(fromRoomId), request);

  const targets = await fetchActiveAgencyRooms(fromRoomId);
  const fromAgency = fromAgencyId ?? '';

  await Promise.all(
    targets
      .filter((t) => (t.agencyId ?? '') !== fromAgency)
      .map(async (target) => {
        if (await roomHasActivePk(target.id)) return;
        const inviteRef = push(invitesRef(target.id));
        const invite: Omit<PkAgencyInvite, 'id'> = {
          fromRoomId,
          fromRoomName: request.fromRoomName,
          fromAgencyId: request.fromAgencyId,
          fromAgencyName: request.fromAgencyName,
          toRoomId: target.id,
          toRoomName: target.name,
          toAgencyName: target.name,
          durationMinutes,
          status: 'pending',
          createdAt: now,
          expiresAt: now + MATCH_TTL_MS,
          createdByUid: user.uid,
          createdByName: userName,
        };
        await set(inviteRef, invite);
      }),
  );
}

/** إلغاء البحث عن مطابقة */
export async function cancelPkAgencyMatchSearch(fromRoomId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const reqSnap = await get(matchRequestRef(fromRoomId));
  if (!reqSnap.exists()) return;
  const req = reqSnap.val() as PkMatchRequest;
  if (req.createdByUid !== user.uid && req.fromRoomId !== fromRoomId) {
    const roomSnap = await get(ref(realtimeDb, `rooms/${fromRoomId}`));
    const hostUid = String(roomSnap.val()?.hostUid ?? '');
    if (hostUid !== user.uid) throw new Error('غير مصرّح');
  }

  await update(matchRequestRef(fromRoomId), { status: 'cancelled' });

  const allInvitesSnap = await get(ref(realtimeDb, 'pkAgencyInvites'));
  if (!allInvitesSnap.exists()) return;
  const updates: Record<string, unknown> = {};
  for (const [toRoomId, invites] of Object.entries(allInvitesSnap.val() as Record<string, Record<string, PkAgencyInvite>>)) {
    for (const [inviteId, inv] of Object.entries(invites)) {
      if (inv.fromRoomId === fromRoomId && inv.status === 'pending') {
        updates[`pkAgencyInvites/${toRoomId}/${inviteId}/status`] = 'cancelled';
      }
    }
  }
  if (Object.keys(updates).length) await update(ref(realtimeDb), updates);
}

/** قبول دعوة PK — للمشرفين ومدير الوكالة فقط */
export async function acceptPkAgencyInvite(
  toRoomId: string,
  inviteId: string,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const inviteSnap = await get(ref(realtimeDb, `pkAgencyInvites/${toRoomId}/${inviteId}`));
  if (!inviteSnap.exists()) throw new Error('الدعوة غير موجودة');
  const invite = { id: inviteId, ...(inviteSnap.val() as Omit<PkAgencyInvite, 'id'>) };

  if (invite.status !== 'pending') throw new Error('تمت معالجة الدعوة');
  if (invite.expiresAt <= Date.now()) throw new Error('انتهت صلاحية الدعوة');

  const roomSnap = await get(ref(realtimeDb, `rooms/${toRoomId}`));
  if (!roomSnap.exists()) throw new Error('غرفتك غير موجودة');
  const room = roomSnap.val() as Record<string, unknown>;
  const hostUid = String(room.hostUid ?? '');
  const coHosts = (room.coHosts as string[] | undefined) ?? [];

  let role: string | null = null;
  try {
    const roleSnap = await get(ref(realtimeDb, `rooms/${toRoomId}/memberRoles/${user.uid}`));
    role = roleSnap.val() as string | null;
  } catch {
    // ignore
  }

  const canAccept =
    hostUid === user.uid ||
    coHosts.includes(user.uid) ||
    role === 'yellow_supervisor';

  if (!canAccept) {
    throw new Error('فقط مدير الوكالة أو الإشراف يمكنه قبول التحدي');
  }

  if (await roomHasActivePk(toRoomId)) throw new Error('غرفتك في تحدٍ آخر');
  if (await roomHasActivePk(invite.fromRoomId)) throw new Error('الغرفة المنافسة في تحدٍ آخر');

  const reqSnap = await get(matchRequestRef(invite.fromRoomId));
  if (!reqSnap.exists()) throw new Error('طلب المطابقة غير موجود');
  const req = reqSnap.val() as PkMatchRequest;
  if (req.status !== 'searching') throw new Error('انتهى البحث عن مطابقة');

  const userName = await loadUserName(user.uid);
  const now = Date.now();

  await activateCrossRoomPK(invite.fromRoomId, toRoomId, invite.durationMinutes);

  await update(ref(realtimeDb, `pkAgencyInvites/${toRoomId}/${inviteId}`), {
    status: 'accepted',
    respondedByUid: user.uid,
    respondedByName: userName,
    respondedAt: now,
  });

  await update(matchRequestRef(invite.fromRoomId), {
    status: 'matched',
    matchedRoomId: toRoomId,
    matchedRoomName: String(room.name ?? 'غرفة'),
    matchedAt: now,
  });

  await cancelSiblingInvites(invite.fromRoomId, toRoomId, inviteId);
}

/** رفض دعوة PK */
export async function rejectPkAgencyInvite(
  toRoomId: string,
  inviteId: string,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const inviteRef = ref(realtimeDb, `pkAgencyInvites/${toRoomId}/${inviteId}`);
  const inviteSnap = await get(inviteRef);
  if (!inviteSnap.exists()) throw new Error('الدعوة غير موجودة');
  const invite = inviteSnap.val() as Omit<PkAgencyInvite, 'id'>;

  if (invite.status !== 'pending') throw new Error('تمت معالجة الدعوة');

  const roomSnap = await get(ref(realtimeDb, `rooms/${toRoomId}`));
  const room = roomSnap.val() as Record<string, unknown>;
  const hostUid = String(room?.hostUid ?? '');
  const coHosts = (room?.coHosts as string[] | undefined) ?? [];
  let role: string | null = null;
  try {
    const roleSnap = await get(ref(realtimeDb, `rooms/${toRoomId}/memberRoles/${user.uid}`));
    role = roleSnap.val() as string | null;
  } catch {
    // ignore
  }
  const canRespond =
    hostUid === user.uid ||
    coHosts.includes(user.uid) ||
    role === 'yellow_supervisor';
  if (!canRespond) throw new Error('فقط مدير الوكالة أو الإشراف يمكنه الرد');

  const userName = await loadUserName(user.uid);
  await update(inviteRef, {
    status: 'rejected',
    respondedByUid: user.uid,
    respondedByName: userName,
    respondedAt: Date.now(),
  });
}

async function cancelSiblingInvites(
  fromRoomId: string,
  acceptedToRoomId: string,
  acceptedInviteId: string,
): Promise<void> {
  const allSnap = await get(ref(realtimeDb, 'pkAgencyInvites'));
  if (!allSnap.exists()) return;
  const updates: Record<string, unknown> = {};
  for (const [toRoomId, invites] of Object.entries(allSnap.val() as Record<string, Record<string, PkAgencyInvite>>)) {
    for (const [inviteId, inv] of Object.entries(invites)) {
      if (
        inv.fromRoomId === fromRoomId &&
        inv.status === 'pending' &&
        !(toRoomId === acceptedToRoomId && inviteId === acceptedInviteId)
      ) {
        updates[`pkAgencyInvites/${toRoomId}/${inviteId}/status`] = 'cancelled';
      }
    }
  }
  if (Object.keys(updates).length) await update(ref(realtimeDb), updates);
}

/** اشتراك بطلب المطابقة (للمرسل) */
export function subscribeToPkMatchRequest(
  fromRoomId: string,
  cb: (req: PkMatchRequest | null) => void,
): () => void {
  const r = matchRequestRef(fromRoomId);
  const handler = (snap: DataSnapshot) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    const req = snap.val() as PkMatchRequest;
    if (req.status === 'searching' && req.expiresAt <= Date.now()) {
      cb({ ...req, status: 'expired' });
      return;
    }
    cb(req);
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

/** دعوات واردة لغرفة — للعرض في قائمة التحديات */
export function subscribeToRoomPkInvites(
  toRoomId: string,
  cb: (invites: PkAgencyInvite[]) => void,
): () => void {
  const r = invitesRef(toRoomId);
  const handler = (snap: DataSnapshot) => {
    const now = Date.now();
    const list: PkAgencyInvite[] = Object.entries(snap.val() ?? {})
      .map(([id, raw]) => ({ id, ...(raw as Omit<PkAgencyInvite, 'id'>) }))
      .filter((i) => i.expiresAt > now || i.status === 'accepted')
      .sort((a, b) => b.createdAt - a.createdAt);
    cb(list);
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

/** دعوات مرسلة من غرفة — لقائمة المطابقة */
export function subscribeToSentPkInvites(
  fromRoomId: string,
  cb: (invites: PkAgencyInvite[]) => void,
): () => void {
  const r = ref(realtimeDb, 'pkAgencyInvites');
  const handler = (snap: DataSnapshot) => {
    const now = Date.now();
    const list: PkAgencyInvite[] = [];
    for (const invites of Object.values(snap.val() ?? {}) as Record<string, Omit<PkAgencyInvite, 'id'>>[]) {
      for (const [id, raw] of Object.entries(invites)) {
        if (raw.fromRoomId === fromRoomId && raw.expiresAt > now) {
          list.push({ id, ...raw });
        }
      }
    }
    list.sort((a, b) => {
      const order = { pending: 0, accepted: 1, rejected: 2, cancelled: 3, expired: 4 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9) || b.createdAt - a.createdAt;
    });
    cb(list);
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

/** أول دعوة معلّقة — للبوب أب */
export function subscribeToPendingPkInvitePopup(
  toRoomId: string,
  cb: (invite: PkAgencyInvite | null) => void,
): () => void {
  return subscribeToRoomPkInvites(toRoomId, (invites) => {
    const pending = invites.find((i) => i.status === 'pending');
    cb(pending ?? null);
  });
}
