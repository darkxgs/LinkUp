/**
 * حظر المستخدمين — Firestore: users/{myUid}/blocked/{blockedUid}
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { firestore, auth } from './index';
import { getUser } from './users';
import { resolveDisplayName } from '@/utils/displayName';

export interface BlockedEntry {
  blockedUid: string;
  blockedAt: number;
  reason?: string;
}

export interface BlockedUserView {
  uid: string;
  name: string;
  avatar: string;
  country: string;
  blockedAt: number;
  reason?: string;
}

function blockedCol(myUid: string) {
  return collection(firestore, 'users', myUid, 'blocked');
}

export async function blockUser(blockedUid: string, reason?: string): Promise<void> {
  const me = auth.currentUser;
  if (!me) throw new Error('غير مسجل');
  if (me.uid === blockedUid) throw new Error('لا يمكنك حظر نفسك');

  await setDoc(doc(firestore, 'users', me.uid, 'blocked', blockedUid), {
    blockedUid,
    blockedAt: Date.now(),
    ...(reason?.trim() ? { reason: reason.trim() } : {}),
  });
}

export async function unblockUser(blockedUid: string): Promise<void> {
  const me = auth.currentUser;
  if (!me) throw new Error('غير مسجل');
  await deleteDoc(doc(firestore, 'users', me.uid, 'blocked', blockedUid));
}

export async function isBlocked(blockerUid: string, blockedUid: string): Promise<boolean> {
  if (!blockerUid || !blockedUid || blockerUid === blockedUid) return false;
  try {
    const snap = await getDoc(doc(firestore, 'users', blockerUid, 'blocked', blockedUid));
    return snap.exists();
  } catch {
    // صلاحيات ناقصة على قواعد قديمة — نعتبر غير محظور لتجنّب كسر الشات
    return false;
  }
}

/** هل أحد الطرفين حظر الآخر؟ */
export async function isBlockedBetween(uidA: string, uidB: string): Promise<boolean> {
  const [aBlocksB, bBlocksA] = await Promise.all([
    isBlocked(uidA, uidB),
    isBlocked(uidB, uidA),
  ]);
  return aBlocksB || bBlocksA;
}

export function subscribeBlockedEntries(
  callback: (entries: BlockedEntry[]) => void,
): () => void {
  const me = auth.currentUser;
  if (!me) {
    callback([]);
    return () => {};
  }

  return onSnapshot(
    blockedCol(me.uid),
    (snap) => {
      const entries = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            blockedUid: d.id,
            blockedAt: (data.blockedAt as number) ?? 0,
            reason: data.reason as string | undefined,
          };
        })
        .sort((a, b) => b.blockedAt - a.blockedAt);
      callback(entries);
    },
    (err) => {
      console.warn('subscribeBlockedEntries:', err);
      callback([]);
    },
  );
}

export async function enrichBlockedUsers(entries: BlockedEntry[]): Promise<BlockedUserView[]> {
  const views: BlockedUserView[] = [];
  for (const e of entries) {
    const profile = await getUser(e.blockedUid);
    views.push({
      uid: e.blockedUid,
      name: profile
        ? resolveDisplayName({
            displayName: profile.displayName,
            email: profile.email,
          })
        : 'مستخدم',
      avatar: profile?.avatar ?? '',
      country: profile?.country ?? 'PS',
      blockedAt: e.blockedAt,
      reason: e.reason,
    });
  }
  return views;
}

export async function getMyBlockedUsers(): Promise<BlockedUserView[]> {
  const me = auth.currentUser;
  if (!me) return [];
  const snap = await getDocs(blockedCol(me.uid));
  const entries = snap.docs
    .map((d) => ({
      blockedUid: d.id,
      blockedAt: (d.data().blockedAt as number) ?? 0,
      reason: d.data().reason as string | undefined,
    }))
    .sort((a, b) => b.blockedAt - a.blockedAt);
  return enrichBlockedUsers(entries);
}
