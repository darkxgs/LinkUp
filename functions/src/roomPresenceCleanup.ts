/**
 * تنظيف المقاعد عند مغادرة الحضور — يمنع بقاء أشخاص على المايك بعد إغلاق التطبيق.
 *
 * مهلة سماح لإعادة الاتصال: الانقطاعات اللحظية (تبديل شبكة، ضعف إشارة) تُسقط
 * onDisconnect فتُحذف roomAudience/userPresence رغم أن المستخدم ما زال في الروم —
 * كان هذا يُخرج الجالس على المايك فوراً. الآن: من يملك roomSeatHold (جالس على مقعد)
 * يُمهَل RECONNECT_GRACE_MS ثم يُفحص إن عاد قبل الإفراغ.
 */
import { onValueDeleted } from 'firebase-functions/v2/database';
import * as admin from 'firebase-admin';

const rtdb = admin.database();

const RECONNECT_GRACE_MS = 95_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function vacateSeatsForUid(roomId: string, uid: string): Promise<void> {
  const seatsSnap = await rtdb.ref(`rooms/${roomId}/seats`).once('value');
  if (!seatsSnap.exists()) return;
  const seats = seatsSnap.val() as Record<string, { uid?: string }>;
  const updates: Record<string, unknown> = {};
  for (const [key, seat] of Object.entries(seats)) {
    if (seat?.uid === uid) updates[key] = { uid: '' };
  }
  if (Object.keys(updates).length > 0) {
    await rtdb.ref(`rooms/${roomId}/seats`).update(updates);
  }
}

/** هل يجلس المستخدم على مقعد محجوز بـ hold؟ (العميل يزيله عند المغادرة الصريحة فقط) */
async function userHoldsSeat(roomId: string, uid: string): Promise<boolean> {
  const holdSnap = await rtdb.ref(`roomSeatHold/${roomId}/${uid}`).once('value');
  return holdSnap.exists();
}

/** بعد مهلة السماح: هل عاد المستخدم للروم؟ (الحضور أو presence أُعيدا عند إعادة الاتصال) */
async function isStillInRoom(roomId: string, uid: string): Promise<boolean> {
  const [audSnap, presSnap] = await Promise.all([
    rtdb.ref(`roomAudience/${roomId}/${uid}`).once('value'),
    rtdb.ref(`userPresence/${uid}`).once('value'),
  ]);
  if (audSnap.exists()) return true;
  return String(presSnap.val()?.currentRoomId ?? '') === roomId;
}

/** إفراغ نهائي بعد التأكد من الانقطاع الحقيقي */
async function vacateAfterConfirmedGone(roomId: string, uid: string): Promise<void> {
  await vacateSeatsForUid(roomId, uid);
  await rtdb.ref(`roomSeatHold/${roomId}/${uid}`).remove().catch(() => {});
  await rtdb.ref(`roomAudience/${roomId}/${uid}`).remove().catch(() => {});
}

async function clearPresenceIfInRoom(roomId: string, uid: string): Promise<void> {
  const presRef = rtdb.ref(`userPresence/${uid}`);
  const presSnap = await presRef.once('value');
  if (presSnap.exists()) {
    const currentRoomId = String(presSnap.val()?.currentRoomId ?? '');
    if (currentRoomId === roomId) {
      await presRef.remove().catch(() => {});
    }
  }
}

/** عند حذف roomAudience/{roomId}/{uid} — أفرغ مقعده بعد مهلة السماح إن كان جالساً */
export const onRoomAudienceRemoved = onValueDeleted(
  { ref: '/roomAudience/{roomId}/{uid}', timeoutSeconds: 180 },
  async (event) => {
    const roomId = String(event.params.roomId ?? '');
    const uid = String(event.params.uid ?? '');
    if (!roomId || !uid) return;

    if (await userHoldsSeat(roomId, uid)) {
      // جالس على مقعد — انقطاع لحظي محتمل: امهله قبل الإفراغ
      await sleep(RECONNECT_GRACE_MS);
      if (await isStillInRoom(roomId, uid)) return;
      await vacateAfterConfirmedGone(roomId, uid);
      await clearPresenceIfInRoom(roomId, uid);
      return;
    }

    await vacateSeatsForUid(roomId, uid);
    await clearPresenceIfInRoom(roomId, uid);
  },
);

/** عند حذف userPresence/{uid} — أفرغ مقعده بعد مهلة السماح إن كان جالساً */
export const onUserPresenceRemoved = onValueDeleted(
  { ref: '/userPresence/{uid}', timeoutSeconds: 180 },
  async (event) => {
    const uid = String(event.params.uid ?? '');
    if (!uid) return;

    const snap = event.data;
    const roomId = String(snap?.val()?.currentRoomId ?? '');
    if (!roomId) return;

    if (await userHoldsSeat(roomId, uid)) {
      // جالس على مقعد — انقطاع لحظي محتمل: امهله قبل الإفراغ
      await sleep(RECONNECT_GRACE_MS);
      if (await isStillInRoom(roomId, uid)) return;
      await vacateAfterConfirmedGone(roomId, uid);
      return;
    }

    await vacateSeatsForUid(roomId, uid);
    await rtdb.ref(`roomAudience/${roomId}/${uid}`).remove().catch(() => {});
  },
);

/**
 * عند فقدان roomSeatHold — الآن يُزال فقط عند المغادرة الصريحة أو تنظيف ما بعد المهلة.
 * نفرّغ مقاعد المستخدم فقط، ولا نلمس الحضور — قد يبقى مستمعاً بعد نزوله عن المايك.
 */
export const onRoomSeatHoldRemoved = onValueDeleted(
  '/roomSeatHold/{roomId}/{uid}',
  async (event) => {
    const roomId = String(event.params.roomId ?? '');
    const uid = String(event.params.uid ?? '');
    if (!roomId || !uid) return;

    await vacateSeatsForUid(roomId, uid);
  },
);
