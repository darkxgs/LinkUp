/**
 * حل معرّف المستخدم — Firebase UID أو publicAccountId (8 أرقام)
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { firestore } from '@/services/firebase';
import { generatePublicAccountId } from '@/utils/publicAccountId';
import {
  lookupUidByPublicIndex,
  findUidByPublicIdScan,
  normalizePublicId,
  syncPublicAccountIndex,
} from '@/services/publicAccountIndex';

const FIREBASE_UID_PATTERN = /^[a-zA-Z0-9]{20,}$/;

export function formatPublicAccountId(value: string | undefined, uid?: string): string {
  if (value) return normalizePublicId(String(value));
  if (uid) return generatePublicAccountId(uid);
  return '--------';
}

/** يعرض في الملف الشخصي — الرقم العام الثابت */
export function getDisplayAccountId(
  publicAccountId: string | undefined,
  uid: string,
): string {
  return formatPublicAccountId(publicAccountId, uid);
}

/**
 * يحوّل ما يلصقه المستخدم (UID كامل أو ID من الملف) إلى Firebase UID
 */
export async function resolveUserIdentifier(raw: string): Promise<string | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (FIREBASE_UID_PATTERN.test(trimmed)) {
    const snap = await getDoc(doc(firestore, 'users', trimmed));
    if (snap.exists()) return snap.id;
  }

  const publicId = normalizePublicId(trimmed);
  if (!publicId) return null;

  const fromIndex = await lookupUidByPublicIndex(publicId);
  if (fromIndex) {
    const exists = await getDoc(doc(firestore, 'users', fromIndex));
    if (exists.exists()) return fromIndex;
  }

  const q = query(
    collection(firestore, 'users'),
    where('publicAccountId', '==', publicId),
    limit(1),
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    const uid = snap.docs[0]?.id ?? null;
    if (uid) await syncPublicAccountIndex(publicId, uid).catch(() => {});
    return uid;
  }

  const asNumber = Number(publicId);
  if (Number.isFinite(asNumber)) {
    const qNum = query(
      collection(firestore, 'users'),
      where('publicAccountId', '==', asNumber),
      limit(1),
    );
    const snapNum = await getDocs(qNum);
    if (!snapNum.empty) {
      const uid = snapNum.docs[0]?.id ?? null;
      if (uid) await syncPublicAccountIndex(publicId, uid).catch(() => {});
      return uid;
    }
  }

  const scanned = await findUidByPublicIdScan(publicId);
  if (scanned) return scanned;

  try {
    const { lookupUserForBd } = await import('@/services/agencyService');
    const remote = await lookupUserForBd(trimmed);
    if (remote?.uid) {
      await syncPublicAccountIndex(publicId, remote.uid).catch(() => {});
      return remote.uid;
    }
  } catch {
    /* optional cloud fallback */
  }

  return null;
}

export async function resolveUserIdentifiers(rawList: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const raw of rawList) {
    const uid = await resolveUserIdentifier(raw);
    if (uid) map.set(raw.trim(), uid);
  }
  return map;
}
