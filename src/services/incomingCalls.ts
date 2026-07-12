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
  updateDoc,
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

  // (إصلاح الرفض الفوري) مراقبة وثيقة الرنين + دورة حياة المكالمة الصادرة
  watchOutgoingCall(targetUid, callId, channelName);

  return callId;
};

/**
 * مراقبة المكالمة الصادرة عند المتصل — تربط وثيقة الرنين بدورة حياة الجلسة:
 *
 * 1) رفض المستقبِل (status='rejected' عبر rejectCall) يظهر للمتصل فوراً:
 *    قطع الجلسة + رسالة «تم رفض المكالمة» بدل الانتظار حتى نهاية نافذة
 *    الرنين، ثم حذف الوثيقة (تفعيل cancelOutgoingCall الميتة سابقاً).
 * 2) إنهاء المتصل قبل الرد يحذف وثيقة الرنين فيتوقف رنين المستقبِل فوراً.
 * 3) رد المستقبِل يحذف الوثيقة بنفسه (answerCall) — تُفكّ المراقبة بلا تدخل.
 *
 * يخاطب واجهة callSession العامة (Agora) — لا يعتمد على تفاصيل المحرك.
 * ملاحظة قواعد: قراءة المتصل لوثيقة الرنين تتطلب نشر قاعدة القراءة الجديدة —
 * قبل النشر يفشل المستمع بصمت وتبقى بقية الدورة (الإلغاء/التنظيف) عاملة.
 */
function watchOutgoingCall(
  targetUid: string,
  callId: string,
  channelName: string,
): void {
  const callRef = doc(firestore, 'incomingCalls', targetUid, 'calls', callId);
  let settled = false;
  let unsubDoc: (() => void) | null = null;
  let unsubSession: (() => void) | null = null;
  let windowTimer: ReturnType<typeof setTimeout> | null = null;
  /** رفضٌ وصل قبل أن تبدأ جلسة المتصل (رد أسرع من فتح الشاشة) — يُطبَّق عند بدئها */
  let rejectedPending = false;

  const detach = () => {
    if (settled) return;
    settled = true;
    unsubDoc?.();
    unsubDoc = null;
    unsubSession?.();
    unsubSession = null;
    if (windowTimer) {
      clearTimeout(windowTimer);
      windowTimer = null;
    }
  };

  const cleanupDoc = () => {
    void cancelOutgoingCall(targetUid, callId).catch(() => {});
  };

  const applyRejection = async () => {
    try {
      const { callSession } = await import('@/services/callSession');
      const snap = callSession.getSnapshot();
      if (snap.remoteJoined) {
        // رُدّ عليها فعلاً — رفض متأخر من جهاز آخر للمستقبِل مثلاً: تجاهل
        detach();
        return;
      }
      const active =
        snap.channelName === channelName &&
        (snap.callState === 'connecting' || snap.callState === 'connected');
      if (active) {
        detach();
        await callSession.leave(); // قطع + تسجيل «فائتة» في سجل الشات
        callSession.forceError('تم رفض المكالمة');
        cleanupDoc();
        return;
      }
      // الجلسة لم تبدأ بعد — نحذف الوثيقة الآن ونطبّق الرفض فور بدئها
      rejectedPending = true;
      cleanupDoc();
    } catch {
      detach();
    }
  };

  // مستمع جلسة المكالمة: إلغاء المتصل قبل الرد + تطبيق رفضٍ سبق بدء الجلسة
  void import('@/services/callSession')
    .then(({ callSession }) => {
      if (settled) return;
      let sessionSeen = false;
      const evaluate = () => {
        if (settled) return;
        const snap = callSession.getSnapshot();
        if (snap.channelName !== channelName) {
          // جلستنا قامت ثم تبدّلت القناة (مكالمة أخرى) — انتهت المراقبة
          if (sessionSeen) {
            detach();
            cleanupDoc();
          }
          return;
        }
        sessionSeen = true;
        if (
          rejectedPending &&
          !snap.remoteJoined &&
          (snap.callState === 'connecting' || snap.callState === 'connected')
        ) {
          rejectedPending = false;
          void applyRejection();
          return;
        }
        if (snap.remoteJoined) {
          // رد المستقبِل — الوثيقة حذفها answerCall بنفسه
          detach();
          return;
        }
        if (snap.callState === 'ended' || snap.callState === 'error') {
          // المتصل أنهى/فشل قبل الرد — أوقف رنين المستقبِل فوراً
          detach();
          cleanupDoc();
        }
      };
      unsubSession = callSession.subscribe(evaluate);
      evaluate();
    })
    .catch(() => {});

  unsubDoc = onSnapshot(
    callRef,
    (snap) => {
      if (settled) return;
      if (!snap.exists()) {
        // حُذفت: رد المستقبِل (answerCall) أو إلغاء منا — لا رفض هنا؛
        // تبقى مراقبة الجلسة قائمة حتى تُحسم بردٍ أو إنهاء
        unsubDoc?.();
        unsubDoc = null;
        return;
      }
      const status = (snap.data() as { status?: string } | undefined)?.status;
      if (status === 'rejected') void applyRejection();
    },
    () => {
      // قواعد قديمة لا تسمح بقراءة المتصل — الميزة خاملة حتى نشر القواعد
      unsubDoc = null;
    },
  );

  // أمان: انقضاء نافذة الرنين يفكّ المراقبة وينظّف الوثيقة اليتيمة
  windowTimer = setTimeout(() => {
    if (settled) return;
    detach();
    cleanupDoc();
  }, INCOMING_CALL_RING_WINDOW_MS + 5_000);
}

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
 *
 * تحديث الحالة بدل الحذف: الحذف لا يميّز الرفض عن الرد (كلاهما كان يحذف
 * الوثيقة) — أما status='rejected' فيصل للمتصل فوراً عبر مستمع وثيقة
 * الرنين (watchOutgoingCall) فيرى الرفض لحظياً، والمتصل هو من يحذف الوثيقة
 * بعدها (cancelOutgoingCall). مودالات المستقبِل تتجاهلها لأنها ترشّح
 * status === 'ringing' فقط.
 */
export const rejectCall = async (callId: string): Promise<void> => {
  const me = auth.currentUser;
  if (!me) return;
  const ref = doc(firestore, 'incomingCalls', me.uid, 'calls', callId);
  try {
    await updateDoc(ref, { status: 'rejected' });
  } catch {
    // قواعد قديمة لا تسمح بتحديث المستقبِل — نعود للحذف (السلوك السابق)
    await deleteDoc(ref).catch(() => {});
  }
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
