/**
 * تحميل آمن لـ @livekit/react-native (لا يعمل في Expo Go بدون native build)
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { RTC_ENV_EXPO_GO, RTC_ENV_SIMULATOR } from '@/utils/rtcEnvironmentMessage';

let globalsRegistered = false;
let nativeModule: typeof import('@livekit/react-native') | null = null;

export type RtcEnvironmentKind = 'expo-go' | 'simulator';

const NATIVE_REQUIRED_MSG =
  'مكالمات الفيديو/الصوت تحتاج Development Build (EAS) وليس Expo Go. أعد بناء التطبيق بعد تثبيت LiveKit.';

/** هل البيئة الحالية لا تدعم WebRTC/LiveKit؟ */
export function getRtcEnvironmentKind(): RtcEnvironmentKind | null {
  if (Constants.appOwnership === 'expo') return 'expo-go';
  if (!Device.isDevice) return 'simulator';
  return null;
}

/** @deprecated استخدم getRtcEnvironmentKind */
export function getRtcEnvironmentIssue(): string | null {
  const kind = getRtcEnvironmentKind();
  if (kind === 'expo-go') {
    return 'أنت تستخدم Expo Go — لا يدعم LiveKit/WebRTC.';
  }
  if (kind === 'simulator') {
    return 'المكالمات لا تعمل على المحاكي — استخدم جهازاً حقيقياً.';
  }
  return null;
}

function nativeRequiredError(cause?: string): Error {
  const kind = getRtcEnvironmentKind();
  if (kind === 'expo-go') return new Error(RTC_ENV_EXPO_GO);
  if (kind === 'simulator') return new Error(RTC_ENV_SIMULATOR);
  if (cause && !NATIVE_REQUIRED_MSG.includes(cause)) {
    return new Error(`${NATIVE_REQUIRED_MSG}\n(${cause})`);
  }
  return new Error(NATIVE_REQUIRED_MSG);
}

export async function getLiveKitNativeModule() {
  if (nativeModule) return nativeModule;
  try {
    const mod = await import('@livekit/react-native');
    if (!mod?.registerGlobals) {
      throw nativeRequiredError('registerGlobals غير متوفر');
    }
    nativeModule = mod;
    return mod;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === RTC_ENV_EXPO_GO || msg === RTC_ENV_SIMULATOR) throw e;
    if (msg.includes("doesn't seem to be linked") || msg.includes('WebRTC native')) {
      throw nativeRequiredError(msg);
    }
    if (getRtcEnvironmentKind()) throw nativeRequiredError();
    throw e instanceof Error ? e : nativeRequiredError(msg);
  }
}

export async function ensureLiveKitGlobals() {
  const mod = await getLiveKitNativeModule();
  if (!globalsRegistered) {
    try {
      mod.registerGlobals({
        autoConfigureAudioSession: false,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes('non-object') ||
        msg.includes('defineProperty') ||
        msg.includes("doesn't seem to be linked") ||
        msg.includes('WebRTC')
      ) {
        throw nativeRequiredError();
      }
      throw e instanceof Error ? e : nativeRequiredError(msg);
    }
    globalsRegistered = true;
  }
  const AudioSession = mod.AudioSession;
  if (!AudioSession?.configureAudio) {
    throw nativeRequiredError('AudioSession غير متوفر');
  }
  return AudioSession;
}

export function isLiveKitGlobalsReady() {
  return globalsRegistered;
}
