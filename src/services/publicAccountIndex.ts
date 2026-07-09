/**
 * فهرس المعرّف العام (8 أرقام) → Firebase UID
 * يُحدَّث عند تسجيل الدخول ويُستخدم في دعوة الوكالة
 */
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  documentId,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { firestore } from '@/services/firebase';
import { generatePublicAccountId } from '@/utils/publicAccountId';

export function normalizePublicId(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.length >= 8 ? digits.slice(-8) : digits.padStart(8, '0');
}

export async function syncPublicAccountIndex(publicId: string, uid: string): Promise<void> {
  const id = normalizePublicId(publicId);
  if (!id || !uid) return;
  await setDoc(
    doc(firestore, 'publicAccountIndex', id),
    { uid, updatedAt: Date.now() },
    { merge: true },
  );
}

export async function lookupUidByPublicIndex(publicId: string): Promise<string | null> {
  const id = normalizePublicId(publicId);
  if (!id) return null;
  const snap = await getDoc(doc(firestore, 'publicAccountIndex', id));
  if (snap.exists()) {
    const uid = snap.data()?.uid;
    return typeof uid === 'string' ? uid : null;
  }
  return null;
}

/** بحث في كل المستخدمين عند غياب الفهرس (حسابات قديمة) */
export async function findUidByPublicIdScan(publicId: string): Promise<string | null> {
  const target = normalizePublicId(publicId);
  if (!target) return null;

  const PAGE = 250;
  let last: QueryDocumentSnapshot | undefined;

  for (let page = 0; page < 50; page++) {
    let q = query(collection(firestore, 'users'), orderBy(documentId()), limit(PAGE));
    if (last) {
      q = query(collection(firestore, 'users'), orderBy(documentId()), startAfter(last), limit(PAGE));
    }
    const snap = await getDocs(q);
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const stored =
        data.publicAccountId != null && String(data.publicAccountId).trim() !== ''
          ? normalizePublicId(String(data.publicAccountId))
          : null;
      const effective = stored ?? generatePublicAccountId(docSnap.id);
      if (effective === target) {
        await syncPublicAccountIndex(target, docSnap.id).catch(() => {});
        if (!stored) {
          const { updateDoc } = await import('firebase/firestore');
          await updateDoc(doc(firestore, 'users', docSnap.id), {
            publicAccountId: target,
            updatedAt: Date.now(),
          }).catch(() => {});
        }
        return docSnap.id;
      }
    }

    last = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE) break;
  }

  return null;
}
