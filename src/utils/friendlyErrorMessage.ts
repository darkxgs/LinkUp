/**
 * ترجمة أخطاء Firebase/الشبكة الخام إلى رسائل عربية مفهومة —
 * «PERMISSION_DENIED: Permission denied» لا تفيد المستخدم بشيء.
 */
export function friendlyErrorMessage(e: unknown, fallback = 'حدث خطأ غير متوقع — أعد المحاولة'): string {
  const raw = e instanceof Error ? e.message : String(e ?? '');
  if (!raw) return fallback;
  const msg = raw.toUpperCase();
  if (msg.includes('PERMISSION_DENIED') || msg.includes('PERMISSION DENIED')) {
    return 'لا تملك صلاحية هذا الإجراء — إن كنت ترى أن لديك الصلاحية فأعد المحاولة بعد لحظات';
  }
  if (msg.includes('NETWORK') || msg.includes('UNAVAILABLE') || msg.includes('TIMEOUT') || msg.includes('DEADLINE')) {
    return 'الشبكة ضعيفة أو منقطعة — تحقق من الاتصال وأعد المحاولة';
  }
  if (msg.includes('UNAUTHENTICATED')) {
    return 'انتهت جلستك — أعد تسجيل الدخول';
  }
  // الرسائل العربية المكتوبة يدوياً تمر كما هي
  if (/[؀-ۿ]/.test(raw)) return raw;
  return fallback;
}
