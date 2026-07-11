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
import { subscribeWhenAuthenticated } from './firebase/authReady';

/** نافذة الرنين — بعدها تُعتبر المكالمة فائتة ويُخفى مودال الرد */
export const INCOMING_CALL_RING_WINDOW_MS = 60_000;

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

  // ⚡ رنين فوري: اكتب الوثيقة فوراً — بالاسم من بروفايل التطبيق المخزّن محلياً
  //    (متزامن بلا شبكة). كان يُكتب اسم حساب Auth/جوجل الحقيقي («مريم سعود»)
  //    فيظهر في إشعار المكالمة اسم غير اسم البروفايل (miral^^^).
  const { useAuthStore } = await import('@/stores/authStore');
  const localProfile = useAuthStore.getState().user as unknown as {
    profile?: { displayName?: string; avatar?: string };
    displayName?: string;
    avatar?: string;
  } | null;
  const profileName =
    localProfile?.profile?.displayName?.trim() ||
    localProfile?.displayName?.trim() ||
    me.displayName ||
    'مستخدم';
  const profileAvatar =
    localProfile?.profile?.avatar || localProfile?.avatar || me.photoURL || '';
  await setDoc(callRef, {
    from: me.uid,
    fromName: profileName,
    fromAvatar: profileAvatar,
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

function attachIncomingCallsListener(
  uid: string,
  callback: (calls: IncomingCall[]) => void,
): () => void {
  // نستمع فقط للمكالمات التي ما زالت ترنّ (ضمن نافذة الرنين)
  const ref = query(
    collection(firestore, 'incomingCalls', uid, 'calls'),
    orderBy('createdAt', 'desc'),
    limit(5),
  );

  return onSnapshot(
    ref,
    (snap) => {
      const now = Date.now();
      const calls = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as IncomingCall))
        // فقط المكالمات الترنّ + ضمن النافذة (تجاهل القديمة)
        .filter((c) => c.status === 'ringing' && now - c.createdAt < INCOMING_CALL_RING_WINDOW_MS);
      callback(calls);
    },
    () => callback([]),
  );
}

/**
 * الاستماع للمكالمات الواردة لي
 * نفس إصلاح سباق الإقلاع في chat.ts: قراءة auth.currentUser لحظة الاستدعاء كانت
 * تُرجع noop إذا رُكِّب المستمع قبل اكتمال استعادة الجلسة (المودال يُركَّب في
 * _layout مع مستخدم الكاش المحلي) — فلا يرنّ الهاتف إطلاقاً طوال الجلسة
 * ويصل المستقبِل «مكالمة فائتة» فقط بعد أن يقفل المتصل.
 */
export const subscribeToIncomingCalls = (
  callback: (calls: IncomingCall[]) => void,
): (() => void) => {
  let fsUnsub: (() => void) | null = null;
  let attachedUid: string | null = null;
  let disposed = false;

  const authUnsub = subscribeWhenAuthenticated(
    (user) => {
      if (disposed || attachedUid === user.uid) return;
      fsUnsub?.();
      attachedUid = user.uid;
      fsUnsub = attachIncomingCallsListener(user.uid, callback);
    },
    () => {
      if (disposed) return;
      fsUnsub?.();
      fsUnsub = null;
      attachedUid = null;
      callback([]);
    },
  );

  return () => {
    disposed = true;
    authUnsub();
    fsUnsub?.();
    fsUnsub = null;
  };
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
