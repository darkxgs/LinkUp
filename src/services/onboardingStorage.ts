/**
 * Onboarding / welcome — يُعرض مرة واحدة ثم يُتخطّى لشاشة تسجيل الدخول.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_SEEN_KEY = '@linkup_onboarding_seen_v1';

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_SEEN_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, '1');
  } catch {
    // ignore
  }
}

/** مسار الدخول للمستخدم غير المسجّل بعد اكتمال التحقّق من الجلسة */
export async function resolveUnauthenticatedEntryRoute(): Promise<'/(auth)/welcome' | '/(auth)/login'> {
  const seen = await hasSeenOnboarding();
  return seen ? '/(auth)/login' : '/(auth)/welcome';
}
