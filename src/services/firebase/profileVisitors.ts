/**
 * زيارات الملف الشخصي — Firestore + Cloud Function
 */
import {
  collection,
  query,
  orderBy,
  where,
  limit,
  getDocs,
  getCountFromServer,
  getDoc,
  updateDoc,
  onSnapshot,
  doc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestore, functions } from './index';
import { buildSocialFirestoreUpdate, statsFromFirestoreDoc } from '@/utils/userBalance';
import { patchLocalSocialStats } from './follow';

export interface ProfileVisit {
  visitorUid: string;
  visitedAt: number;
  displayName: string;
  avatar: string;
  country: string;
  level: number;
  isVIP?: boolean;
}

export interface ProfileVisitorStats {
  /** زوار فريدون — كل الحسابات التي زارت الملف */
  total: number;
  /** زوار فريدون زاروا خلال آخر 7 أيام (آخر زيارة لكل حساب) */
  thisWeek: number;
  /** من زوار هذا الأسبوع — VIP */
  vipThisWeek: number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const VISITS_LIST_LIMIT = 200;

function visitsCollection(profileUid: string) {
  return collection(firestore, 'profileVisitors', profileUid, 'visits');
}

export function computeVisitorStatsFromVisits(visits: ProfileVisit[]): ProfileVisitorStats {
  const weekStart = Date.now() - WEEK_MS;
  const thisWeekVisits = visits.filter((v) => v.visitedAt >= weekStart);
  return {
    total: visits.length,
    thisWeek: thisWeekVisits.length,
    vipThisWeek: thisWeekVisits.filter((v) => v.isVIP === true).length,
  };
}

/** عدّاد دقيق من Firestore + مزامنة stats.visitors على وثيقة المستخدم */
export async function reconcileVisitorCount(uid: string): Promise<number> {
  try {
    const countSnap = await getCountFromServer(visitsCollection(uid));
    const total = countSnap.data().count;
    const userRef = doc(firestore, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const stats = statsFromFirestoreDoc(userSnap.data() as Record<string, unknown>);
      if (stats.visitors !== total) {
        await updateDoc(userRef, buildSocialFirestoreUpdate({ visitors: total }));
      }
    }
    patchLocalSocialStats(uid, { visitors: total });
    return total;
  } catch (e) {
    console.warn('reconcileVisitorCount:', e);
    return 0;
  }
}

/** اشتراك لحظي بعدد الزوار الحقيقي من سجل الزيارات */
export function subscribeToProfileVisitorCount(
  profileUid: string,
  callback: (total: number) => void,
): () => void {
  let debounce: ReturnType<typeof setTimeout> | null = null;

  const emitCount = () => {
    void getCountFromServer(visitsCollection(profileUid))
      .then((snap) => {
        const total = snap.data().count;
        callback(total);
        patchLocalSocialStats(profileUid, { visitors: total });
        void reconcileVisitorCount(profileUid).catch(() => {});
      })
      .catch(() => callback(0));
  };

  const q = query(
    visitsCollection(profileUid),
    orderBy('visitedAt', 'desc'),
    limit(VISITS_LIST_LIMIT),
  );

  const unsub = onSnapshot(
    q,
    () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(emitCount, 250);
    },
    () => callback(0),
  );

  emitCount();
  return () => {
    unsub();
    if (debounce) clearTimeout(debounce);
  };
}

export async function fetchProfileVisitorStats(profileUid: string): Promise<ProfileVisitorStats> {
  try {
    const weekStart = Date.now() - WEEK_MS;
    const col = visitsCollection(profileUid);
    const [totalSnap, weekSnap, weekDocsSnap] = await Promise.all([
      getCountFromServer(col),
      getCountFromServer(query(col, where('visitedAt', '>=', weekStart))),
      getDocs(query(col, where('visitedAt', '>=', weekStart), limit(200))),
    ]);
    const vipThisWeek = weekDocsSnap.docs.filter(
      (d) => (d.data() as ProfileVisit).isVIP === true,
    ).length;
    return {
      total: totalSnap.data().count,
      thisWeek: weekSnap.data().count,
      vipThisWeek,
    };
  } catch (e) {
    console.warn('fetchProfileVisitorStats:', e);
    try {
      const rows = await getProfileVisitors(profileUid, 200);
      const computed = computeVisitorStatsFromVisits(rows);
      return { ...computed, total: computed.total };
    } catch {
      return { total: 0, thisWeek: 0, vipThisWeek: 0 };
    }
  }
}

/** تسجيل زيارة (سيرفر — dedupe + إشعار + عدّاد) */
export async function recordProfileVisit(profileUid: string): Promise<void> {
  try {
    const fn = httpsCallable<{ profileUid: string }, { ok?: boolean }>(
      functions,
      'recordProfileVisit',
    );
    await fn({ profileUid });
  } catch (e) {
    console.warn('recordProfileVisit:', e);
  }
}

export async function getProfileVisitors(
  profileUid: string,
  max = VISITS_LIST_LIMIT,
): Promise<ProfileVisit[]> {
  try {
    const q = query(
      visitsCollection(profileUid),
      orderBy('visitedAt', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as ProfileVisit);
  } catch (e) {
    console.warn('getProfileVisitors:', e);
    return [];
  }
}

export function subscribeProfileVisitors(
  profileUid: string,
  callback: (visits: ProfileVisit[]) => void,
  max = VISITS_LIST_LIMIT,
): () => void {
  const q = query(
    visitsCollection(profileUid),
    orderBy('visitedAt', 'desc'),
    limit(max),
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => d.data() as ProfileVisit));
    },
    () => callback([]),
  );
}
