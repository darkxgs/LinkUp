/**
 * تسجيل جلسة الدخول — جهاز + موقع → Cloud Function (مع IP من السيرفر)
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import { httpsCallable } from 'firebase/functions';

import { auth, functions } from '@/services/firebase';
import { getOrCreateDeviceId } from '@/services/accountSecurity';
import { hasLocationPermission } from '@/services/locationService';

export type LoginMethod =
  | 'email'
  | 'accountId'
  | 'register'
  | 'google'
  | 'facebook'
  | 'phone';

export type LoginLocationPayload = {
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
};

export type LoginSessionClientPayload = {
  method: LoginMethod;
  deviceId: string;
  deviceName: string;
  platform: string;
  brand?: string;
  model?: string;
  osVersion?: string;
  /** معرّف الجهاز (ليس IMEI الحقيقي — iOS/Android يمنعان الوصول المباشر) */
  deviceIdentifier?: string;
  appVersion?: string;
  location?: LoginLocationPayload;
};

async function readLoginLocation(): Promise<LoginLocationPayload | undefined> {
  try {
    if (!(await hasLocationPermission())) return undefined;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      maximumAge: 120_000,
      timeout: 12_000,
    });
    const { latitude, longitude } = pos.coords;
    let city: string | undefined;
    let region: string | undefined;
    let country: string | undefined;
    try {
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      const p = places[0];
      if (p) {
        city = p.city ?? p.subregion ?? p.district ?? undefined;
        region = p.region ?? undefined;
        country = p.country ?? p.isoCountryCode ?? undefined;
      }
    } catch {
      // ignore geocode
    }
    return { latitude, longitude, city, region, country };
  } catch {
    return undefined;
  }
}

export async function buildLoginSessionPayload(
  method: LoginMethod,
): Promise<LoginSessionClientPayload> {
  const deviceId = await getOrCreateDeviceId();
  const deviceName =
    Constants.deviceName ??
    Device.modelName ??
    (Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android' : Platform.OS);

  const deviceIdentifier =
    Constants.installationId ??
    Constants.sessionId ??
    deviceId;

  const location = await readLoginLocation();

  return {
    method,
    deviceId,
    deviceName: String(deviceName),
    platform: Platform.OS,
    brand: Device.brand ?? undefined,
    model: Device.modelName ?? undefined,
    osVersion: Device.osVersion ?? undefined,
    deviceIdentifier: deviceIdentifier ? String(deviceIdentifier) : undefined,
    appVersion: Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? undefined,
    location,
  };
}

/** يُستدعى بعد كل تسجيل دخول / تسجيل حساب جديد */
export async function recordLoginSession(method: LoginMethod): Promise<void> {
  if (!auth.currentUser?.uid) return;
  try {
    const payload = await buildLoginSessionPayload(method);
    const fn = httpsCallable<LoginSessionClientPayload, { ok: boolean }>(
      functions,
      'recordLoginSession',
    );
    await fn(payload);
  } catch (e) {
    console.warn('[recordLoginSession]', e);
    try {
      const { registerCurrentDevice } = await import('@/services/accountSecurity');
      await registerCurrentDevice(auth.currentUser.uid);
    } catch {
      // ignore
    }
  }
}
