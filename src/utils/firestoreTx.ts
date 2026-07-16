/**
 * مساعد معاملات Firestore مقاوم لتعارض النسخة التفاؤلي (OCC) على مستند «ساخن»
 * مثل users/{uid} — عدّة كتّاب يلمسونه لحظة فتح البروفايل/المحفظة، فتخسر المعاملة
 * السباق وترمي الرسالة الخام:
 *   "the stored version (…) does not match the required base version (…)".
 * كانت معاملات المحفظة العارية (تحويل/سحب/لآلئ) تُظهرها خاماً وتُخرج المستخدم من
 * التطبيق. نلفّها هنا بإعادة محاولة قصيرة (نفس منطق runGiftTransaction في shop.ts).
 */
import { runTransaction, type Transaction } from 'firebase/firestore';
import { firestore } from '@/services/firebase';

const DEFAULT_MAX_ATTEMPTS = 6;

/** هل الخطأ تعارض نسخة Firestore عابر (يستحقّ إعادة المحاولة)؟ */
export function isFirestoreVersionConflict(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? '';
  const msg = String((err as { message?: string })?.message ?? '');
  return (
    code === 'aborted' ||
    code === 'failed-precondition' ||
    /does not match the required base version/i.test(msg)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ينفّذ معاملة مع إعادة المحاولة على تعارض النسخة فقط (backoff تصاعدي بسيط).
 * أي خطأ آخر يُمرَّر فوراً بلا إعادة محاولة.
 */
export async function runTxWithRetry<T>(
  operation: (tx: Transaction) => Promise<T>,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await runTransaction(firestore, operation);
    } catch (err) {
      lastError = err;
      if (!isFirestoreVersionConflict(err) || attempt >= maxAttempts - 1) {
        throw err;
      }
      await sleep(40 * (attempt + 1));
    }
  }
  throw lastError;
}
