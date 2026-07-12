/**
 * فحص بيئة RTC — مستقل عن المزوّد (LiveKit/Agora)
 * منسوخ من livekitNative.ts تمهيداً للترحيل (الأصل يُحذف في مرحلة لاحقة)
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
