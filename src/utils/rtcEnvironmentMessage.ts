import { getRtcEnvironmentKind, type RtcEnvironmentKind } from '@/services/rtc/rtcEnvironment';

export const RTC_ENV_EXPO_GO = 'RTC_ENV_EXPO_GO';
export const RTC_ENV_SIMULATOR = 'RTC_ENV_SIMULATOR';

/** يحدّد إن كان الخطأ بسبب بيئة (Expo Go / محاكي) وليس مشكلة شبكة */
export function resolveRtcEnvironmentKind(
  error: string | null | undefined,
): RtcEnvironmentKind | null {
  if (error === RTC_ENV_EXPO_GO) return 'expo-go';
  if (error === RTC_ENV_SIMULATOR) return 'simulator';
  if (error?.includes('Expo Go') || error?.includes('expo go')) return 'expo-go';
  if (error?.includes('Development Build') && error?.includes('Expo Go')) return 'expo-go';
  return getRtcEnvironmentKind();
}

export function isRtcEnvironmentError(error: string | null | undefined): boolean {
  return resolveRtcEnvironmentKind(error) !== null;
}

export function rtcNoticeI18nKeys(kind: RtcEnvironmentKind): {
  title: string;
  message: string;
  hint: string;
} {
  if (kind === 'expo-go') {
    return {
      title: 'call.rtcExpoGoTitle',
      message: 'call.rtcExpoGoMessage',
      hint: 'call.rtcExpoGoHint',
    };
  }
  return {
    title: 'call.rtcSimulatorTitle',
    message: 'call.rtcSimulatorMessage',
    hint: 'call.rtcSimulatorHint',
  };
}
