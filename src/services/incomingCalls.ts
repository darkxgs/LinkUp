/**
 * Incoming Call Service — مكالمات واردة عبر Firestore
 *
 * البنية:
 *   incomingCalls/{userId}/calls/{callId} → {
 *     from, fromName, fromAvatar, type, channelName, createdAt, status
 *   }
 *
 * المستقبِل يستمع real-time للوثائق في مساره → modal يظهر.
 * بعد الرد/الرفض، يحذف الوثيقة.
 *
 * ملاحظة: Push للمكالمات عند إغلاق التطبيق عبر pushOnIncomingCallCreated + FCM.
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore, auth } from './firebase/index';

export interface IncomingCall {
  id: string;
  from: string;
  fromName: string;
  fromAvatar: string;
  type: 'voice' | 'video';
  channelName: string;
  createdAt: number;
  status: 'ringing' | 'answered' | 'rejected' | 'missed';
}

/**
 * إنشاء مكالمة واردة لشخص معيّن
 * نجلب الاسم/الأفاتار من وثيقة المستخدم في Firestore (أدق من auth)
 */
export const ringUser = async (
  targetUid: string,
  type: 'voice' | 'video',
  channelName: string,
): Promise<string> => {
  const me = auth.currentUser;
  if (!me) throw new Error('يجب تسجيل الدخول');
  if (targetUid === me.uid) throw new Error('لا يمكنك الاتصال بنفسك');

  const callId = `${me.uid}_${Date.now()}`;
  const callRef = doc(firestore, 'incomingCalls', targetUid, 'calls', callId);

  // ⚡ رنين فوري: اكتب الوثيقة فوراً بهوية auth المتاحة (يرنّ المستقبل بأسرع ما يمكن)
  //    دون انتظار جلب وثيقة المستخدم من Firestore (كان يضيف جولة شبكة قبل الرنين).
  await setDoc(callRef, {
    from: me.uid,
    fromName: me.displayName || 'مستخدم',
    fromAvatar: me.photoURL || '',
    type,
    channelName,
    createdAt: Date.now(),
    status: 'ringing',
  });

  // إثراء الاسم/الأفاتار من Firestore بعد الرنين (لا يؤخّره) — يصل للمستقبل عبر onSnapshot
  void (async () => {
    try {
      const meDoc = await getDoc(doc(firestore, 'users', me.uid));
      if (!meDoc.exists()) return;
      const data = meDoc.data() as any;
      const fromName = data.profile?.displayName ?? data.displayName;
      const fromAvatar = data.profile?.avatar ?? data.avatar;
      if (fromName || fromAvatar) {
        await setDoc(
          callRef,
          {
            ...(fromName ? { fromName } : {}),
            ...(fromAvatar ? { fromAvatar } : {}),
          },
          { merge: true },
        );
      }
    } catch {
      // ignore — الهوية الاحتياطية كافية
    }
  })();

  return callId;
};

/**
 * الاستماع للمكالمات الواردة لي
 */
export const subscribeToIncomingCalls = (
  callback: (calls: IncomingCall[]) => void,
): (() => void) => {
  const me = auth.currentUser;
  if (!me) {
    callback([]);
    return () => {};
  }

  // نستمع فقط للمكالمات التي ما زالت ترنّ (آخر 60 ثانية)
  const ref = query(
    collection(firestore, 'incomingCalls', me.uid, 'calls'),
    orderBy('createdAt', 'desc'),
    limit(5),
  );

  return onSnapshot(
    ref,
    (snap) => {
      const now = Date.now();
      const calls = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as IncomingCall))
        // فقط المكالمات الترنّ + آخر 60 ثانية (تجاهل القديمة)
        .filter((c) => c.status === 'ringing' && now - c.createdAt < 60_000);
      callback(calls);
    },
    () => callback([]),
  );
};

/**
 * الرد على مكالمة
 */
export const answerCall = async (callId: string): Promise<void> => {
  const me = auth.currentUser;
  if (!me) return;
  const ref = doc(firestore, 'incomingCalls', me.uid, 'calls', callId);
  await deleteDoc(ref); // الحذف يكفي — المستقبل في الـ channelName نفسه
};

/**
 * رفض مكالمة
 */
export const rejectCall = async (callId: string): Promise<void> => {
  const me = auth.currentUser;
  if (!me) return;
  const ref = doc(firestore, 'incomingCalls', me.uid, 'calls', callId);
  await deleteDoc(ref);
};

/**
 * إلغاء مكالمة من المرسل (لو ألغى قبل ما يرد المستقبل)
 */
export const cancelOutgoingCall = async (
  targetUid: string,
  callId: string,
): Promise<void> => {
  const ref = doc(firestore, 'incomingCalls', targetUid, 'calls', callId);
  await deleteDoc(ref);
};
