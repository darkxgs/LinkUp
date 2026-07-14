/**
 * يمنع إفراغ المقعد/الحضور أثناء منتقي الموسيقى/الفيديو ورفع الملفات.
 *
 * فتح المنتقي يُرسل التطبيق للخلفية فينقطع RTDB وتنطلق onDisconnect
 * (حذف الحضور + علامة انقطاع المقعد) فيُفرَّغ المقعد على أجهزة البقية —
 * «تغادر المايك فجأة» عند كل إضافة أغنية. الحل:
 *  1) تعليق onDisconnect قبل فتح المنتقي (وليس عند حدث الخلفية — سباق خاسر أحياناً)
 *  2) إبقاء الحارس نشطاً طوال الرفع وفترة سماح بعده — تغطي «عُد وأضف أغنية ثانية»
 *  3) بعد آخر عملية + فترة السماح: استعادة الحضور/المقعد وإعادة ربط onDisconnect
 */
let pickerDepth = 0;
let graceUntil = 0;
let recoveryTimer: ReturnType<typeof setTimeout> | null = null;

/** فترة سماح بعد آخر عملية محروسة — إضافة أغنية أخرى خلالها لا تمرّ بنافذة خطر */
const PICKER_GUARD_GRACE_MS = 12_000;
/** أثناء تبديل مقطع موسيقى (advance) — نفس حماية المقعد */
const MUSIC_ADVANCE_GUARD_MS = 8_000;

async function resolveActiveRoomId(): Promise<string | null> {
  try {
    const [{ getRoomVoiceSession }, { useRoomSessionStore }] = await Promise.all([
      import('@/utils/roomVoiceSessionGuard'),
      import('@/stores/roomSessionStore'),
    ]);
    return (
      getRoomVoiceSession().roomId ?? useRoomSessionStore.getState().roomId ?? null
    );
  } catch {
    return null;
  }
}

/** تعليق onDisconnect للحضور والمقعد قبل ذهاب التطبيق للخلفية */
async function suspendActiveRoomPresence(): Promise<void> {
  const roomId = await resolveActiveRoomId();
  if (!roomId) return;
  try {
    const { suspendRoomOnDisconnectForBackground } = await import(
      '@/services/firebase/rooms'
    );
    await suspendRoomOnDisconnectForBackground(roomId);
  } catch {
    // ignore — الحارس تحسين أمان وليس شرط نجاح العملية
  }
}

/** بعد آخر عملية + فترة السماح — استعادة الحضور/المقعد وإعادة ربط onDisconnect */
function scheduleGuardRecovery(): void {
  if (recoveryTimer) clearTimeout(recoveryTimer);
  recoveryTimer = setTimeout(() => {
    recoveryTimer = null;
    if (pickerDepth > 0) return;
    void (async () => {
      try {
        const { recoverRoomPresenceAfterRtdbReconnect } = await import(
          '@/services/firebase/rooms'
        );
        await recoverRoomPresenceAfterRtdbReconnect();
      } catch {
        // ignore
      }
    })();
  }, PICKER_GUARD_GRACE_MS);
}

export async function withRoomMediaPickerGuard<T>(fn: () => Promise<T>): Promise<T> {
  pickerDepth += 1;
  if (recoveryTimer) {
    clearTimeout(recoveryTimer);
    recoveryTimer = null;
  }
  // التعليق قبل فتح المنتقي — انتظار حدث الخلفية كان يخسر السباق أحياناً
  await suspendActiveRoomPresence();
  try {
    return await fn();
  } finally {
    pickerDepth = Math.max(0, pickerDepth - 1);
    graceUntil = Date.now() + PICKER_GUARD_GRACE_MS;
    if (pickerDepth === 0) scheduleGuardRecovery();
  }
}

export function isRoomMediaPickerGuardActive(): boolean {
  return pickerDepth > 0 || Date.now() < graceUntil;
}

/** يمدّد حارس المقعد أثناء انتقال الطابور لمقطع تالٍ — يمنع «نزول المايك» عند نهاية الأغنية */
export function extendRoomMediaPickerGuard(ms = MUSIC_ADVANCE_GUARD_MS): void {
  graceUntil = Math.max(graceUntil, Date.now() + ms);
}
