/**
 * طلبات مشاركة الفيديو — تمرّ بموافقة الإشراف/الوكالة قبل البث
 *
 * RTDB: rooms/{roomId}/videoRequests/{requestId}
 */

import {
  ref,
  push,
  set,
  update,
  get,
  onValue,
  off,
} from 'firebase/database';
import { realtimeDb, auth } from './firebase/index';
import { parseVideoUrl, type VideoSourceType } from '@/utils/videoUrlParser';
import { publishRoomVideo } from './roomVideo';

export type RoomVideoRequestStatus = 'pending' | 'approved' | 'rejected';

export interface RoomVideoRequest {
  id: string;
  url: string;
  sourceType: VideoSourceType;
  youtubeId?: string;
  title?: string;
  /** صورة معاينة للمشرف قبل الموافقة (تُولَّد من الفيديو أو من يوتيوب) */
  thumbnailUrl?: string;
  requestedBy: string;
  requestedByName: string;
  requestedByAvatar?: string;
  requestedAt: number;
  status: RoomVideoRequestStatus;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: number;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  Object.keys(out).forEach((k) => {
    if (out[k] === undefined) delete out[k];
  });
  return out;
}

async function loadUserProfile(uid: string) {
  const user = auth.currentUser;
  let userName = user?.displayName ?? 'مستخدم';
  let userAvatar = user?.photoURL ?? '';
  try {
    const { getUser } = await import('./firebase/users');
    const u = await getUser(uid);
    if (u) {
      userName = u.displayName ?? userName;
      userAvatar = u.avatar ?? userAvatar;
    }
  } catch {
    // ignore
  }
  return { userName, userAvatar };
}

async function hasPendingRequest(roomId: string, uid: string): Promise<boolean> {
  const snap = await get(ref(realtimeDb, `rooms/${roomId}/videoRequests`));
  if (!snap.exists()) return false;
  const all = snap.val() as Record<string, Omit<RoomVideoRequest, 'id'>>;
  return Object.values(all).some(
    (r) => r.requestedBy === uid && (r.status === 'pending' || !r.status),
  );
}

/** إزالة طلب معلّق للمستخدم (لإرسال طلب جديد) */
export async function cancelMyPendingVideoRequest(roomId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const snap = await get(ref(realtimeDb, `rooms/${roomId}/videoRequests`));
  if (!snap.exists()) return;

  const all = snap.val() as Record<string, Omit<RoomVideoRequest, 'id'>>;
  const updates: Record<string, null> = {};
  for (const [id, r] of Object.entries(all)) {
    if (r.requestedBy === user.uid && (r.status === 'pending' || !r.status)) {
      updates[id] = null;
    }
  }
  if (Object.keys(updates).length === 0) return;
  await update(ref(realtimeDb, `rooms/${roomId}/videoRequests`), updates);
}

/** إرسال طلب مشاركة فيديو (لا يُبث حتى الموافقة) */
export async function submitRoomVideoRequest(
  roomId: string,
  url: string,
  title?: string,
  thumbnailUrl?: string,
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  if (await hasPendingRequest(roomId, user.uid)) {
    await cancelMyPendingVideoRequest(roomId);
  }

  const parsed = parseVideoUrl(url);
  if (!parsed.isValid) {
    throw new Error(parsed.error ?? 'رابط غير صالح');
  }

  // معاينة تلقائية لروابط يوتيوب — صورة الفيديو الرسمية
  const resolvedThumbnail =
    thumbnailUrl?.trim() ||
    (parsed.youtubeId ? `https://img.youtube.com/vi/${parsed.youtubeId}/hqdefault.jpg` : undefined);

  const { userName, userAvatar } = await loadUserProfile(user.uid);
  const requestsRef = ref(realtimeDb, `rooms/${roomId}/videoRequests`);
  const newRef = push(requestsRef);
  const requestId = newRef.key!;
  const payload = stripUndefined({
    url: parsed.url,
    sourceType: parsed.type === 'unknown' ? 'mp4' : parsed.type,
    youtubeId: parsed.youtubeId,
    title: title?.trim() || undefined,
    thumbnailUrl: resolvedThumbnail,
    requestedBy: user.uid,
    requestedByName: userName,
    requestedByAvatar: userAvatar,
    requestedAt: Date.now(),
    status: 'pending' as const,
  });

  await set(newRef, payload);
  return requestId;
}

/**
 * نشر فيديو مباشرة بدون مراجعة — لمدير الوكالة/الإشراف فقط.
 * (يُستخدم بدل submitRoomVideoRequest عندما يكون المستخدم مديراً أو مشرفاً)
 */
export async function publishRoomVideoDirect(
  roomId: string,
  url: string,
  title?: string,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const parsed = parseVideoUrl(url);
  if (!parsed.isValid) {
    throw new Error(parsed.error ?? 'رابط غير صالح');
  }

  const { userName, userAvatar } = await loadUserProfile(user.uid);

  await publishRoomVideo(roomId, {
    url: parsed.url,
    sourceType: parsed.type === 'unknown' ? 'mp4' : parsed.type,
    youtubeId: parsed.youtubeId,
    title: title?.trim() || undefined,
    addedBy: user.uid,
    addedByName: userName,
    addedByAvatar: userAvatar,
  });
}

/** موافقة الإشراف — ينشر الفيدio للجميع */
export async function approveRoomVideoRequest(
  roomId: string,
  requestId: string,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const reqRef = ref(realtimeDb, `rooms/${roomId}/videoRequests/${requestId}`);
  const snap = await get(reqRef);
  if (!snap.exists()) throw new Error('الطلب غير موجود');

  const req = snap.val() as Omit<RoomVideoRequest, 'id'>;
  if (req.status !== 'pending') throw new Error('تمت معالجة الطلب مسبقاً');

  const { userName } = await loadUserProfile(user.uid);

  await publishRoomVideo(roomId, {
    url: req.url,
    sourceType: req.sourceType,
    youtubeId: req.youtubeId,
    title: req.title,
    addedBy: req.requestedBy,
    addedByName: req.requestedByName,
    addedByAvatar: req.requestedByAvatar,
  });

  await update(reqRef, {
    status: 'approved',
    reviewedBy: user.uid,
    reviewedByName: userName,
    reviewedAt: Date.now(),
  });
}

/** رفض طلب الفيدio */
export async function rejectRoomVideoRequest(
  roomId: string,
  requestId: string,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const reqRef = ref(realtimeDb, `rooms/${roomId}/videoRequests/${requestId}`);
  const snap = await get(reqRef);
  if (!snap.exists()) throw new Error('الطلب غير موجود');

  const req = snap.val() as Omit<RoomVideoRequest, 'id'>;
  if (req.status !== 'pending') throw new Error('تمت معالجة الطلب مسبقاً');

  const { userName } = await loadUserProfile(user.uid);

  await update(reqRef, {
    status: 'rejected',
    reviewedBy: user.uid,
    reviewedByName: userName,
    reviewedAt: Date.now(),
  });
}

/** طلبات معلّقة — للمشرفين */
export function subscribeToPendingVideoRequests(
  roomId: string,
  callback: (requests: RoomVideoRequest[]) => void,
): () => void {
  const requestsRef = ref(realtimeDb, `rooms/${roomId}/videoRequests`);
  const handler = onValue(requestsRef, (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const raw = snap.val() as Record<string, Omit<RoomVideoRequest, 'id'>>;
    const pending = Object.entries(raw)
      .map(([id, v]) => ({ id, ...v }))
      .filter((r) => r.status === 'pending')
      .sort((a, b) => a.requestedAt - b.requestedAt);
    callback(pending);
  });
  return () => off(requestsRef, 'value', handler);
}

/** آخر طلب للمستخدم — لإشعاره بالموافقة/الرفض */
export function subscribeToMyLatestVideoRequest(
  roomId: string,
  uid: string,
  callback: (request: RoomVideoRequest | null) => void,
): () => void {
  const requestsRef = ref(realtimeDb, `rooms/${roomId}/videoRequests`);
  const handler = onValue(requestsRef, (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    const raw = snap.val() as Record<string, Omit<RoomVideoRequest, 'id'>>;
    const mine = Object.entries(raw)
      .map(([id, v]) => ({ id, ...v }))
      .filter((r) => r.requestedBy === uid)
      .sort((a, b) => b.requestedAt - a.requestedAt);
    callback(mine[0] ?? null);
  });
  return () => off(requestsRef, 'value', handler);
}
