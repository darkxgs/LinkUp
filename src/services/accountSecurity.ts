/**
 * أمن الحساب — Firestore + الأجهزة المسجّلة
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, firestore, isFirebaseReady } from '@/services/firebase';
import { generatePublicAccountId } from '@/utils/publicAccountId';
import { normalizePublicId } from '@/services/publicAccountIndex';

const DEVICE_ID_KEY = '@linkup:device_id';

export class DeviceRevokedError extends Error {
  constructor() {
    super('DEVICE_REVOKED');
    this.name = 'DeviceRevokedError';
  }
}

export type AccountStatus = 'active' | 'pending_deletion';

export interface RegisteredDevice {
  id: string;
  name: string;
  platform: string;
  lastActiveAt: number;
  isCurrent?: boolean;
  brand?: string;
  model?: string;
  osVersion?: string;
  deviceIdentifier?: string;
  lastIp?: string;
  lastLocation?: {
    latitude: number;
    longitude: number;
    city?: string;
    region?: string;
    country?: string;
  };
  loginCount?: number;
}

export interface SecurityProfile {
  publicAccountId: string;
  phoneNumber?: string;
  linkedTiktok?: boolean;
  accountStatus?: AccountStatus;
  deletionRequestedAt?: number;
}

export async function getOrCreateDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export async function ensurePublicAccountId(uid: string): Promise<string> {
  if (!isFirebaseReady()) return generatePublicAccountId(uid);
  const ref = doc(firestore, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return generatePublicAccountId(uid);
  const data = snap.data();
  if (data.publicAccountId != null && String(data.publicAccountId).trim() !== '') {
    return normalizePublicId(String(data.publicAccountId));
  }
  const publicAccountId = generatePublicAccountId(uid);
  await updateDoc(ref, { publicAccountId });
  return publicAccountId;
}

export async function getSecurityProfile(uid: string): Promise<SecurityProfile> {
  const fallback: SecurityProfile = {
    publicAccountId: generatePublicAccountId(uid),
  };
  if (!isFirebaseReady()) return fallback;

  const snap = await getDoc(doc(firestore, 'users', uid));
  if (!snap.exists()) return fallback;
  const d = snap.data();
  return {
    publicAccountId:
      d.publicAccountId != null && String(d.publicAccountId).trim() !== ''
        ? normalizePublicId(String(d.publicAccountId))
        : generatePublicAccountId(uid),
    phoneNumber: d.phoneNumber ?? '',
    linkedTiktok: Boolean(d.linkedTiktok),
    accountStatus: d.accountStatus ?? 'active',
    deletionRequestedAt: d.deletionRequestedAt,
  };
}

export async function updatePhoneNumber(uid: string, phoneNumber: string): Promise<void> {
  if (!isFirebaseReady()) throw new Error('Firebase غير جاهز');
  await updateDoc(doc(firestore, 'users', uid), {
    phoneNumber: phoneNumber.trim(),
    updatedAt: Date.now(),
  });
}

export async function isCurrentDeviceRevoked(uid: string): Promise<boolean> {
  if (!isFirebaseReady()) return false;
  const deviceId = await getOrCreateDeviceId();
  const snap = await getDoc(doc(firestore, 'users', uid));
  const revoked = (snap.data()?.revokedDeviceIds as string[]) ?? [];
  return revoked.includes(deviceId);
}

/** إزالة جهاز من الحساب — لا يستطيع الدخول مجدداً من هذا الجهاز */
export async function revokeRegisteredDevice(uid: string, deviceIdToRevoke: string): Promise<void> {
  if (!isFirebaseReady()) throw new Error('Firebase غير جاهز');
  const me = auth.currentUser?.uid;
  if (!me || me !== uid) throw new Error('غير مصرح');

  try {
    const { httpsCallable } = await import('firebase/functions');
    const { functions } = await import('@/services/firebase');
    const fn = httpsCallable<{ deviceId: string }, { ok: boolean }>(
      functions,
      'revokeRegisteredDevice',
    );
    await fn({ deviceId: deviceIdToRevoke });
    return;
  } catch (e: unknown) {
    const code = String((e as { code?: string })?.code ?? '');
    if (!code.includes('not-found') && !code.includes('unavailable')) {
      throw e;
    }
  }

  const userRef = doc(firestore, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('المستخدم غير موجود');

  const data = snap.data();
  const devices = (data.registeredDevices as RegisteredDevice[]) ?? [];
  const revoked = new Set<string>((data.revokedDeviceIds as string[]) ?? []);
  revoked.add(deviceIdToRevoke);

  await updateDoc(userRef, {
    registeredDevices: devices.filter((d) => d.id !== deviceIdToRevoke),
    revokedDeviceIds: Array.from(revoked),
    updatedAt: Date.now(),
  });
}

export async function registerCurrentDevice(uid: string): Promise<void> {
  if (!isFirebaseReady()) return;
  const deviceId = await getOrCreateDeviceId();

  const userRef = doc(firestore, 'users', uid);
  const snap = await getDoc(userRef);
  const revoked = (snap.data()?.revokedDeviceIds as string[]) ?? [];
  if (revoked.includes(deviceId)) {
    throw new DeviceRevokedError();
  }

  const name =
    Constants.deviceName ??
    (Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android' : Platform.OS);
  const entry: RegisteredDevice = {
    id: deviceId,
    name,
    platform: Platform.OS,
    lastActiveAt: Date.now(),
    isCurrent: true,
  };
  const devices: RegisteredDevice[] = snap.exists()
    ? ((snap.data()?.registeredDevices as RegisteredDevice[]) ?? [])
    : [];
  const others = devices
    .filter((d) => d.id !== deviceId)
    .map((d) => ({ ...d, isCurrent: false }));
  await setDoc(
    userRef,
    {
      registeredDevices: [...others, entry],
      lastSeen: Date.now(),
    },
    { merge: true },
  );
}

export async function getRegisteredDevices(uid: string): Promise<RegisteredDevice[]> {
  if (!isFirebaseReady()) {
    const id = await getOrCreateDeviceId();
    return [
      {
        id,
        name: Constants.deviceName ?? Platform.OS,
        platform: Platform.OS,
        lastActiveAt: Date.now(),
        isCurrent: true,
      },
    ];
  }
  const snap = await getDoc(doc(firestore, 'users', uid));
  const revoked = new Set<string>((snap.data()?.revokedDeviceIds as string[]) ?? []);
  const devices = ((snap.data()?.registeredDevices as RegisteredDevice[]) ?? []).filter(
    (d) => !revoked.has(d.id),
  );
  const deviceId = await getOrCreateDeviceId();
  if (devices.length === 0) {
    if (revoked.has(deviceId)) return [];
    return [
      {
        id: deviceId,
        name: Constants.deviceName ?? Platform.OS,
        platform: Platform.OS,
        lastActiveAt: Date.now(),
        isCurrent: true,
      },
    ];
  }
  return devices.map((d) => ({ ...d, isCurrent: d.id === deviceId }));
}

export async function requestAccountDeletion(uid: string): Promise<void> {
  if (!isFirebaseReady()) throw new Error('Firebase غير جاهز');
  await updateDoc(doc(firestore, 'users', uid), {
    accountStatus: 'pending_deletion',
    deletionRequestedAt: Date.now(),
    updatedAt: Date.now(),
  });
  await setDoc(
    doc(firestore, 'accountDeletionRequests', uid),
    {
      uid,
      requestedAt: serverTimestamp(),
      status: 'pending',
    },
    { merge: true },
  );
}

export async function cancelAccountDeletion(uid: string): Promise<void> {
  if (!isFirebaseReady()) return;
  await updateDoc(doc(firestore, 'users', uid), {
    accountStatus: 'active',
    deletionRequestedAt: null,
    updatedAt: Date.now(),
  });
  await setDoc(
    doc(firestore, 'accountDeletionRequests', uid),
    { status: 'cancelled', cancelledAt: serverTimestamp() },
    { merge: true },
  );
}

export function getAuthProviderStatus(): {
  password: boolean;
  google: boolean;
  facebook: boolean;
  apple: boolean;
} {
  const providers = auth.currentUser?.providerData.map((p) => p.providerId) ?? [];
  return {
    password: providers.includes('password'),
    google: providers.includes('google.com'),
    facebook: providers.includes('facebook.com'),
    apple: providers.includes('apple.com'),
  };
}
