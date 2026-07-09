/**
 * Room Pinned Messages Service
 * تثبيت حتى 3 رسائل في الروم
 *
 * البنية في RTDB:
 *   rooms/{roomId}/pins/{pinId} = {
 *     id: pinId,
 *     text: string,
 *     fromUid: string,     // كاتب النص الأصلي
 *     fromName: string,
 *     fromAvatar?: string,
 *     pinnedBy: string,    // من ثبّتها (مدير الروم)
 *     pinnedByName: string,
 *     pinnedAt: number,
 *     messageId?: string,  // معرّف الرسالة الأصلية في chat
 *   }
 */

import {
  ref,
  set,
  push,
  remove,
  onValue,
  off,
  get,
} from 'firebase/database';
import { realtimeDb, auth } from './firebase/index';
import { hasSupervisorPermission } from './firebase/roomMemberRoles';

export const MAX_PINNED_MESSAGES = 3;

async function assertCanManageRoomPins(roomId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  const roomSnap = await get(ref(realtimeDb, `rooms/${roomId}`));
  if (!roomSnap.exists()) throw new Error('الغرفة غير موجودة');
  const roomData = roomSnap.val() as Record<string, unknown>;
  if (!hasSupervisorPermission(roomData, user.uid, 'pinMessages')) {
    throw new Error('فقط مدير الوكالة أو مشرف الإشراف يمكنه إدارة الرسائل المثبتة');
  }
}

export interface PinnedMessage {
  id: string;
  text: string;
  fromUid: string;
  fromName: string;
  fromAvatar?: string;
  pinnedBy: string;
  pinnedByName: string;
  pinnedAt: number;
  messageId?: string;
}

/**
 * تثبيت رسالة جديدة
 * - يتأكد من عدم تجاوز الحد (3)
 * - إذا تجاوز: يرفض ويطلب من المستخدم حذف رسالة أولاً
 */
export const pinMessage = async (
  roomId: string,
  data: {
    text: string;
    fromUid: string;
    fromName: string;
    fromAvatar?: string;
    messageId?: string;
  },
): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  await assertCanManageRoomPins(roomId);

  if (!data.text?.trim()) {
    throw new Error('نص الرسالة فارغ');
  }

  // اقرأ الرسائل المثبتة الحالية للتحقق من الحد
  const pinsRef = ref(realtimeDb, `rooms/${roomId}/pins`);
  const snap = await get(pinsRef);
  const current = snap.exists() ? Object.keys(snap.val()).length : 0;

  if (current >= MAX_PINNED_MESSAGES) {
    throw new Error(
      `الحد الأقصى للرسائل المثبتة هو ${MAX_PINNED_MESSAGES}. احذف رسالة أولاً.`,
    );
  }

  // اجلب اسم المُثبّت
  let pinnedByName = user.displayName ?? 'مدير';
  try {
    const { getUser } = await import('./firebase/users');
    const u = await getUser(user.uid);
    if (u?.displayName) pinnedByName = u.displayName;
  } catch {}

  const newRef = push(pinsRef);
  const pinId = newRef.key!;

  const pin: PinnedMessage = {
    id: pinId,
    text: data.text.trim().slice(0, 500),
    fromUid: data.fromUid,
    fromName: data.fromName,
    fromAvatar: data.fromAvatar,
    pinnedBy: user.uid,
    pinnedByName,
    pinnedAt: Date.now(),
    messageId: data.messageId,
  };

  // إزالة undefined
  Object.keys(pin).forEach((k) => {
    if ((pin as any)[k] === undefined) delete (pin as any)[k];
  });

  await set(newRef, pin);
  return pinId;
};

/**
 * إزالة رسالة مثبتة
 */
export const unpinMessage = async (
  roomId: string,
  pinId: string,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  await assertCanManageRoomPins(roomId);
  await remove(ref(realtimeDb, `rooms/${roomId}/pins/${pinId}`));
};

/**
 * Subscribe للرسائل المثبتة (real-time)
 */
export const subscribeToPinnedMessages = (
  roomId: string,
  callback: (pins: PinnedMessage[]) => void,
): (() => void) => {
  const pinsRef = ref(realtimeDb, `rooms/${roomId}/pins`);
  const handler = onValue(pinsRef, (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const val = snap.val() as Record<string, PinnedMessage>;
    const list = Object.values(val).sort((a, b) => (a.pinnedAt ?? 0) - (b.pinnedAt ?? 0));
    callback(list);
  });
  return () => off(pinsRef, 'value', handler);
};

/**
 * تثبيت رسالة سريعة (نص فقط) دون أن تكون من شات أصلاً
 * يستخدمه المدير لإرسال إعلان مخصص
 */
export const pinCustomNotice = async (
  roomId: string,
  text: string,
): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  let userName = user.displayName ?? 'الإدارة';
  let userAvatar = user.photoURL ?? undefined;
  try {
    const { getUser } = await import('./firebase/users');
    const u = await getUser(user.uid);
    if (u) {
      userName = u.displayName ?? userName;
      userAvatar = u.avatar ?? userAvatar;
    }
  } catch {}

  return pinMessage(roomId, {
    text,
    fromUid: user.uid,
    fromName: userName,
    fromAvatar: userAvatar,
  });
};

/**
 * هل يستطيع هذا المستخدم تثبيت/إزالة رسائل؟
 * — مضيف الغرفة / مدير الوكالة / مشرف الإشراف (coHost) مع صلاحية pinMessages
 */
export const canManagePins = (
  userUid: string | null | undefined,
  room: Record<string, unknown> | null | undefined,
): boolean => {
  if (!userUid || !room) return false;
  return hasSupervisorPermission(room, userUid, 'pinMessages');
};
