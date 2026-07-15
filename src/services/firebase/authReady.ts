/**
 * انتظار جاهزية Firebase Auth قبل استعلامات Firestore / Cloud Functions
 * (تجنّب permission-denied و unauthenticated عند تشغيل العمليات قبل اكتمال الجلسة)
 */
import { onAuthStateChanged, type User } from '@firebase/auth';
import { auth } from './index';

export const SESSION_EXPIRED_MSG = 'انتهت جلسة الدخول — سجّل دخولاً مرة أخرى';

/** ترجمة أخطاء httpsCallable إلى رسائل مفهومة للمستخدم */
export function translateCallableError(err: unknown): string {
  const e = err as { code?: string; message?: string };
  const code = e?.code ?? '';
  const msg = String(e?.message ?? '');

  if (
    code === 'functions/unauthenticated' ||
    code === 'functions/permission-denied' ||
    msg === 'unauthenticated' ||
    msg.includes('Forbidden') ||
    msg.includes('يجب تسجيل الدخول')
  ) {
    return SESSION_EXPIRED_MSG;
  }
  if (code === 'functions/failed-precondition') {
    // رسائل تهيئة خدمة الصوت من السيرفر (Agora — و'LiveKit' أثر تاريخي من دوال قديمة)
    if (msg.includes('Agora') || msg.includes('LiveKit')) {
      return 'خدمة المكالمات والغرف الصوتية غير مهيّأة على السيرفر';
    }
    if (msg.includes('لعبت هذه اللعبة اليوم') || msg.includes('رصيد غير كاف')) {
      return msg;
    }
  }
  if (code === 'functions/not-found') {
    if (msg && msg !== 'not-found' && msg !== 'NOT_FOUND') {
      return msg;
    }
    return 'خدمة فتح الرسائل غير متوفرة على السيرفر — حاول لاحقاً أو تواصل مع الدعم';
  }
  if (msg.includes('404') || msg.includes('فشل الاتصال بالسيرفر (404)')) {
    return 'خدمة فتح الرسائل غير متوفرة على السيرفر — حاول لاحقاً أو تواصل مع الدعم';
  }
  // خطأ خادم 5xx بلا مغلّف خطأ (فشل بنية تحتية/إعادة نشر) — رسالة ودّية بدل الرمز الخام «(500)»
  if (/فشل الاتصال بالسيرفر \(5\d\d\)/.test(msg)) {
    return 'تعذّر إتمام العملية الآن — حاول مرة أخرى لاحقاً';
  }
  if (code === 'functions/unavailable' || code === 'functions/deadline-exceeded') {
    if (msg === 'unavailable' || msg.includes('NOT_FOUND') || msg.includes('404')) {
      return 'الخدمة غير متوفرة على السيرفر — حاول لاحقاً أو تواصل مع الدعم';
    }
    return 'تحقق من اتصال الإنترنت وحاول مرة أخرى';
  }
  // خطأ سيرفري غير معالَج (INTERNAL) — لا نعرض للمستخدم الكلمة الحرفية
  // «internal» (كانت تظهر في مطابقة الفيديو وغيرها كرسالة خطأ خام)
  if (
    code === 'functions/internal' ||
    code === 'internal' ||
    msg === 'internal' ||
    msg === 'INTERNAL'
  ) {
    return 'حدث خطأ في الخادم — حاول مرة أخرى لاحقاً';
  }
  return msg || 'حدث خطأ غير متوقع';
}

/** يضمن وجود جلسة Firebase Auth صالحة قبل استدعاء Cloud Functions */
export async function ensureCallableAuth(refreshToken = true): Promise<User> {
  const user = await waitForFirestoreAuth(12_000);
  if (!user) {
    throw new Error(SESSION_EXPIRED_MSG);
  }
  try {
    await user.getIdToken(refreshToken);
  } catch {
    throw new Error(SESSION_EXPIRED_MSG);
  }
  return user;
}

export function waitForFirestoreAuth(timeoutMs = 12_000): Promise<User | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (user: User | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(user);
    };

    const timer = setTimeout(() => finish(auth.currentUser ?? null), timeoutMs);

    void (async () => {
      try {
        // ينتظر اكتمال استعادة الجلسة من AsyncStorage — لا يُكتفي بأول null عابر
        await auth.authStateReady();
      } catch {
        // ignore
      }
      finish(auth.currentUser ?? null);
    })();
  });
}

export function subscribeWhenAuthenticated(
  onUser: (user: User) => void,
  onSignedOut?: () => void,
): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (user) onUser(user);
    else onSignedOut?.();
  });
}
