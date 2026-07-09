/**
 * حضور مباشر عبر Realtime Database — presence/{uid}
 */

import {
  ref,
  set,
  onValue,
  off,
  onDisconnect,
  DataSnapshot,
} from 'firebase/database';
import { realtimeDb } from './index';

export type PresenceMap = Record<string, number>;

export const pingUserPresence = async (uid: string): Promise<void> => {
  const presenceRef = ref(realtimeDb, `presence/${uid}`);
  const ts = Date.now();
  await set(presenceRef, ts);
  await onDisconnect(presenceRef).remove();
};

/**
 * ⚠️ لا تُستخدم للعرض العام: تشترك في شجرة presence/ كاملة فيُعاد تنزيل حضور كل المستخدمين
 * على كل تغيير — لا يتوسّع مع آلاف المتصلين. استخدم subscribeToPresenceForUids بدلاً منها.
 */
export const subscribeToPresenceMap = (
  callback: (map: PresenceMap) => void,
): (() => void) => {
  const rootRef = ref(realtimeDb, 'presence');
  const handler = (snap: DataSnapshot) => {
    const raw = snap.val() ?? {};
    const map: PresenceMap = {};
    for (const [uid, value] of Object.entries(raw)) {
      const n = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(n) && n > 0) map[uid] = n;
    }
    callback(map);
  };
  onValue(rootRef, handler);
  return () => off(rootRef, 'value', handler);
};

/**
 * اشتراك انتقائي في حضور مجموعة uids محدّدة فقط (presence/{uid} لكل واحد).
 * كل تغيير يُسلّم قيمة مفتاح واحد صغير بدل الشجرة كاملة — يتوسّع مع آلاف المتصلين.
 * يعيد نفس شكل PresenceMap فيبقى سلوك المستهلكين مطابقاً تماماً.
 */
export const subscribeToPresenceForUids = (
  uids: string[],
  callback: (map: PresenceMap) => void,
): (() => void) => {
  const current: PresenceMap = {};
  const handlers: Array<{
    ref: ReturnType<typeof ref>;
    handler: (snap: DataSnapshot) => void;
  }> = [];
  for (const uid of uids) {
    if (!uid) continue;
    const uidRef = ref(realtimeDb, `presence/${uid}`);
    const handler = (snap: DataSnapshot) => {
      const value = snap.val();
      const n = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(n) && n > 0) current[uid] = n;
      else delete current[uid];
      callback({ ...current });
    };
    onValue(uidRef, handler);
    handlers.push({ ref: uidRef, handler });
  }
  return () => {
    for (const h of handlers) off(h.ref, 'value', h.handler);
  };
};
