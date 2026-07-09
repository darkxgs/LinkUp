import type { Router } from 'expo-router';

/** مغادرة شاشة المكالمة — مع بديل إذا لا يوجد سجل تنقّل */
export function exitCallScreen(router: Router): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/(tabs)' as any);
}

/** بعد التصغير — العودة للتصفّح داخل التطبيق */
export function exitCallScreenToBrowse(router: Router): void {
  router.replace('/(tabs)' as any);
}
