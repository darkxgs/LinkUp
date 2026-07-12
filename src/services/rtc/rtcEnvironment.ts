/**
 * فحص بيئة RTC — مستقل عن المزوّد
 * (كان منسوخاً من livekitNative.ts — حُذف الأصل مع إزالة LiveKit وهذا هو المرجع الوحيد)
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';

export type RtcEnvironmentKind = 'expo-go' | 'simulator';

/** هل البيئة الحالية لا تدعم WebRTC/الموديولات الأصلية؟ */
export function getRtcEnvironmentKind(): RtcEnvironmentKind | null {
  if (Constants.appOwnership === 'expo') return 'expo-go';
  if (!Device.isDevice) return 'simulator';
  return null;
}
