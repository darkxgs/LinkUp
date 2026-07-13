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
  connectionType?: string;
};

type RegisteredDeviceEntry = {
  id: string;
  name: string;
  platform: string;
  lastActiveAt: number;
  brand?: string | null;
  model?: string | null;
  osVersion?: string | null;
  deviceIdentifier?: string | null;
  lastIp?: string | null;
  lastLocation?: LoginSessionPayload['location'] | null;
  loginCount?: number;
  connectionType?: string | null;
};

/** نافذة الاشتباه بتغيّر الدولة بين تسجيلي دخول متتاليين */
const SUSPICIOUS_COUNTRY_CHANGE_WINDOW_MS = 2 * 60 * 60 * 1000;

async function detectSuspiciousLogin(
  uid: string,
  countryNow: string | undefined,
  now: number,
): Promise<boolean> {
  if (!countryNow) return false;
  const prevSnap = await db
    .collection('users')
    .doc(uid)
    .collection('loginSessions')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  if (prevSnap.empty) return false;
  const prev = prevSnap.docs[0].data();
  const prevCountry = prev.location?.country as string | undefined;
  const prevCreatedAt = Number(prev.createdAt) || 0;
  if (!prevCountry || !prevCreatedAt) return false;
  if (now - prevCreatedAt > SUSPICIOUS_COUNTRY_CHANGE_WINDOW_MS) return false;
  return prevCountry.trim().toLowerCase() !== countryNow.trim().toLowerCase();
}

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
    brand: payload.brand ?? prev?.brand ?? null,
    model: payload.model ?? prev?.model ?? null,
    osVersion: payload.osVersion ?? prev?.osVersion ?? null,
    deviceIdentifier: payload.deviceIdentifier ?? prev?.deviceIdentifier ?? null,
    lastIp: ip || (prev?.lastIp ?? null),
    lastLocation: payload.location ?? prev?.lastLocation ?? null,
    loginCount: (Number(prev?.loginCount) || 0) + 1,
    connectionType: payload.connectionType ?? prev?.connectionType ?? null,
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

  const flaggedSuspicious = await detectSuspiciousLogin(uid, payload.location?.country, now);

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
    connectionType: payload.connectionType?.trim() || '',
    location: payload.location ?? null,
    createdAt: now,
    ...(flaggedSuspicious ? { flaggedSuspicious: true } : {}),
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

  // تعليق مؤقت للحساب — يمنع تسجيل الدخول حتى انتهاء المدة أو رفع التعليق يدوياً
  if (data.isSuspended === true) {
    const suspendedUntil = Number(data.suspendedUntil) || 0;
    if (!suspendedUntil || suspendedUntil > now) {
      throw new HttpsError('permission-denied', 'ACCOUNT_SUSPENDED');
    }
    // انتهت مدة التعليق تلقائياً — نرفعه الآن حتى لا يُحظر الدخول لاحقاً بالخطأ
    await userRef.set(
      { isSuspended: false, suspendedUntil: admin.firestore.FieldValue.delete(), suspendReason: admin.firestore.FieldValue.delete() },
      { merge: true },
    );
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
