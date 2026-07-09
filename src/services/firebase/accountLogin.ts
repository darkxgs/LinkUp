/**
 * تسجيل الدخول بمعرّف الحساب العام (8 أرقام) + كلمة المرور
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';

export async function signInWithPublicAccountId(
  accountId: string,
  password: string,
): Promise<{ email: string }> {
  const fn = httpsCallable<
    { accountId: string; password: string },
    { email: string }
  >(functions, 'signInWithPublicAccountId');
  const res = await fn({ accountId, password });
  const email = res.data?.email?.trim().toLowerCase();
  if (!email) {
    throw new Error('ACCOUNT_NO_EMAIL');
  }
  return { email };
}
