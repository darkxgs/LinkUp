/**
 * تسجيل جلسات الدخول — IP من السيرفر + بيانات الجهاز من التطبيق
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();
const MAX_SESSIONS = 80;

export type LoginSessionPayload = {
  method?: string;
  deviceId: string;
  deviceName?: string;
  platform?: string;
  brand?: string;
  model?: string;
  osVersion?: string;
  deviceIdentifier?: string;
  appVersion?: string;
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
    region?: string;
    country?: string;
  };
};

type RegisteredDeviceEntry = {
  id: string;
  name: string;
  platform: string;
  lastActiveAt: number;
  brand?: string;
  model?: string;
  osVersion?: string;
  deviceIdentifier?: string;
  lastIp?: string;
  lastLocation?: LoginSessionPayload['location'];
  loginCount?: number;
};

function extractClientIp(rawRequest: { headers?: Record<string, string | string[] | undefined>; ip?: string } | undefined): string {
  if (!rawRequest) return '';
  const forwarded = rawRequest.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(',')[0].trim();
  }
  const realIp = rawRequest.headers?.['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  return rawRequest.ip ?? '';
}

function mergeRegisteredDevice(
  devices: RegisteredDeviceEntry[],
  payload: LoginSessionPayload,
  ip: string,
  now: number,
): RegisteredDeviceEntry[] {
  const id = payload.deviceId.trim();
  const others = devices.filter((d) => d?.id && d.id !== id);
  const prev = devices.find((d) => d?.id === id);
  const entry: RegisteredDeviceEntry = {
    id,
    name: payload.deviceName?.trim() || prev?.name || 'جهاز',
    platform: payload.platform?.trim() || prev?.platform || 'unknown',
    lastActiveAt: now,
    brand: payload.brand ?? prev?.brand,
    model: payload.model ?? prev?.model,
    osVersion: payload.osVersion ?? prev?.osVersion,
    deviceIdentifier: payload.deviceIdentifier ?? prev?.deviceIdentifier,
    lastIp: ip || prev?.lastIp,
    lastLocation: payload.location ?? prev?.lastLocation,
    loginCount: (Number(prev?.loginCount) || 0) + 1,
  };
  return [entry, ...others].slice(0, 20);
}

async function trimOldSessions(uid: string): Promise<void> {
  const col = db.collection('users').doc(uid).collection('loginSessions');
  const snap = await col.orderBy('createdAt', 'desc').offset(MAX_SESSIONS).limit(20).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

export const recordLoginSession = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const payload = request.data as LoginSessionPayload;
  if (!payload?.deviceId?.trim()) {
    throw new HttpsError('invalid-argument', 'deviceId مطلوب');
  }

  const ip = extractClientIp(request.rawRequest as { headers?: Record<string, string | string[] | undefined>; ip?: string });
  const now = Date.now();
  const sessionId = `sess_${now}_${Math.random().toString(36).slice(2, 9)}`;

  const sessionDoc = {
    id: sessionId,
    deviceId: payload.deviceId.trim(),
    method: payload.method?.trim() || 'unknown',
    ip,
    deviceName: payload.deviceName?.trim() || '',
    platform: payload.platform?.trim() || '',
    brand: payload.brand?.trim() || '',
    model: payload.model?.trim() || '',
    osVersion: payload.osVersion?.trim() || '',
    deviceIdentifier: payload.deviceIdentifier?.trim() || '',
    appVersion: payload.appVersion?.trim() || '',
    location: payload.location ?? null,
    createdAt: now,
  };

  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  const data = snap.data() ?? {};
  const devices = Array.isArray(data.registeredDevices)
    ? (data.registeredDevices as RegisteredDeviceEntry[])
    : [];
  const revoked = new Set<string>(
    Array.isArray(data.revokedDeviceIds) ? data.revokedDeviceIds.map(String) : [],
  );
  if (revoked.has(payload.deviceId.trim())) {
    throw new HttpsError('permission-denied', 'DEVICE_REVOKED');
  }

  const mergedDevices = mergeRegisteredDevice(devices, payload, ip, now);

  await userRef.set(
    {
      registeredDevices: mergedDevices,
      lastLoginAt: now,
      lastLoginIp: ip,
      lastLoginLocation: payload.location ?? null,
      lastLoginDeviceId: payload.deviceId.trim(),
      lastLoginMethod: payload.method?.trim() || 'unknown',
      lastSeen: now,
      updatedAt: now,
    },
    { merge: true },
  );

  await userRef.collection('loginSessions').doc(sessionId).set(sessionDoc);
  void trimOldSessions(uid).catch(() => undefined);

  return { ok: true, sessionId };
});
