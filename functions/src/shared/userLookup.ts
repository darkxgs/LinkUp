/**
 * حل معرّف المستخدم (UID / publicAccountId) — مشترك بين Cloud Functions
 */
import * as admin from 'firebase-admin';

function getDb() {
  return admin.firestore();
}

export function normalizePublicAccountId(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.length >= 8 ? digits.slice(-8) : digits.padStart(8, '0');
}

export function generatePublicAccountId(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) {
    h = (Math.imul(31, h) + uid.charCodeAt(i)) >>> 0;
  }
  return String(h % 100_000_000).padStart(8, '0');
}

function normalizeStoredPublicAccountId(value: unknown): string {
  if (value == null || String(value).trim() === '') return '';
  return normalizePublicAccountId(String(value));
}

async function syncPublicAccountIndexForUid(publicId: string, uid: string): Promise<void> {
  await getDb().collection('publicAccountIndex').doc(publicId).set({ uid, updatedAt: Date.now() }, { merge: true });
}

async function queryUidByPublicAccountIdField(publicId: string): Promise<string | null> {
  const candidates = new Set<string>([publicId, publicId.padStart(8, '0')]);
  const stripped = publicId.replace(/^0+/, '');
  if (stripped) {
    candidates.add(stripped);
    candidates.add(stripped.padStart(8, '0'));
  }

  for (const candidate of candidates) {
    const q = await getDb().collection('users').where('publicAccountId', '==', candidate).limit(1).get();
    if (!q.empty) return q.docs[0].id;
  }

  for (const candidate of candidates) {
    const num = Number(candidate);
    if (!Number.isFinite(num)) continue;
    const qNum = await getDb().collection('users').where('publicAccountId', '==', num).limit(1).get();
    if (!qNum.empty) return qNum.docs[0].id;
  }
  return null;
}

async function resolveUidByLegacyPublicId(publicId: string): Promise<string | null> {
  const PAGE = 400;
  let lastId: string | undefined;
  for (let page = 0; page < 30; page++) {
    let q = getDb().collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
    if (lastId) q = q.startAfter(lastId);
    const snap = await q.get();
    if (snap.empty) break;
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const stored =
        data.publicAccountId != null && String(data.publicAccountId).trim() !== ''
          ? normalizeStoredPublicAccountId(data.publicAccountId)
          : null;
      const effective = stored ?? generatePublicAccountId(docSnap.id);
      if (effective === publicId) {
        if (!stored) {
          await docSnap.ref.update({
            publicAccountId: publicId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        await syncPublicAccountIndexForUid(publicId, docSnap.id);
        return docSnap.id;
      }
    }
    lastId = snap.docs[snap.docs.length - 1]?.id;
    if (snap.size < PAGE) break;
  }
  return null;
}

/** يحلّ UID من Firebase UID أو publicAccountId (8 أرقام) */
export async function resolveUserUid(raw: string): Promise<string | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9]{20,}$/.test(trimmed)) {
    const snap = await getDb().collection('users').doc(trimmed).get();
    if (snap.exists) return snap.id;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  const publicId = normalizePublicAccountId(digits);

  const indexSnap = await getDb().collection('publicAccountIndex').doc(publicId).get();
  if (indexSnap.exists) {
    const indexedUid = String(indexSnap.data()?.uid ?? '');
    if (indexedUid) {
      const userExists = await getDb().collection('users').doc(indexedUid).get();
      if (userExists.exists) return indexedUid;
    }
  }

  const fromField = await queryUidByPublicAccountIdField(publicId);
  if (fromField) {
    await syncPublicAccountIndexForUid(publicId, fromField);
    return fromField;
  }

  return resolveUidByLegacyPublicId(publicId);
}

export function pickCoinsBalance(data: FirebaseFirestore.DocumentData): number {
  return pickBalanceField(data, 'coins');
}

export function pickPearlsBalance(data: FirebaseFirestore.DocumentData): number {
  return pickBalanceField(data, 'pearls');
}

function pickBalanceField(
  data: FirebaseFirestore.DocumentData,
  key: 'coins' | 'pearls',
): number {
  const stats = data.stats as Record<string, unknown> | undefined;
  const toNum = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.floor(v);
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Math.floor(Number(v) || 0);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };
  const nested = toNum(stats?.[key]);
  const flat = toNum(data[key]);
  if (nested !== null && flat !== null) return Math.max(0, Math.max(nested, flat));
  return Math.max(0, nested ?? flat ?? 0);
}

export type AccountDisableReason = 'banned' | 'auth_disabled' | 'pending_deletion';

export async function getAccountDisableReason(
  uid: string,
  userData: FirebaseFirestore.DocumentData,
): Promise<AccountDisableReason | null> {
  if (userData.isBanned === true) return 'banned';
  if (userData.accountStatus === 'pending_deletion') return 'pending_deletion';
  try {
    const authUser = await admin.auth().getUser(uid);
    if (authUser.disabled) return 'auth_disabled';
  } catch {
    /* قد لا يوجد في Auth */
  }
  return null;
}

export function formatPublicAccountId(value: unknown, uid: string): string {
  if (value != null && String(value).trim() !== '') {
    return normalizePublicAccountId(String(value));
  }
  return generatePublicAccountId(uid);
}
