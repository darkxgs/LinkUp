/**
 * Follow Service — منطق المتابعة الحقيقي
 *
 * البنية في Firestore:
 *   follows/{followerUid}_{followedUid} → { follower, followed, createdAt }
 *   users/{uid}.followers  → عدّاد المتابِعين
 *   users/{uid}.following  → عدّاد المتابَعين
 *
 * (نستخدم وثيقة follow منفصلة بدل مصفوفة، ليتحمّل آلاف المتابعين)
 */

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  getCountFromServer,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { firestore, auth } from './index';
import { useAuthStore } from '@/stores/authStore';
import {
  buildSocialIncrementPatch,
  buildSocialFirestoreUpdate,
  statsFromFirestoreDoc,
} from '@/utils/userBalance';

const followId = (follower: string, followed: string) => `${follower}_${followed}`;

export type SocialCounts = { followers: number; following: number; visitors: number };

export function patchLocalSocialStats(uid: string, partial: Partial<SocialCounts>): void {
  const current = useAuthStore.getState().user;
  if (!current || current.uid !== uid) return;
  useAuthStore.setState({
    user: {
      ...current,
      stats: { ...current.stats, ...partial },
    },
  });
}

/** اشتراك لحظي بعدّادات المتابعة والزوار من وثيقة المستخدم */
export function subscribeToSocialCounts(
  uid: string,
  cb?: (counts: SocialCounts) => void,
): () => void {
  return onSnapshot(
    doc(firestore, 'users', uid),
    (snap) => {
      if (!snap.exists()) return;
      const merged = statsFromFirestoreDoc(snap.data() as Record<string, unknown>);
      const counts: SocialCounts = {
        followers: merged.followers,
        following: merged.following,
        visitors: merged.visitors,
      };
      patchLocalSocialStats(uid, counts);
      cb?.(counts);
    },
    (err) => console.warn('subscribeToSocialCounts:', err),
  );
}

export type FollowListType = 'followers' | 'following';

/** اشتراك لحظي بمعرّفات المتابعين أو من أتابعهم */
export function subscribeToFollowUserIds(
  uid: string,
  type: FollowListType,
  cb: (ids: string[]) => void,
): () => void {
  const q = query(
    collection(firestore, 'follows'),
    where(type === 'followers' ? 'followed' : 'follower', '==', uid),
    limit(120),
  );
  return onSnapshot(
    q,
    (snap) => {
      const ids = snap.docs
        .map((d) => {
          const data = d.data();
          return (type === 'followers' ? data.follower : data.followed) as string;
        })
        .filter(Boolean);
      cb(ids);
    },
    (err) => {
      console.warn('subscribeToFollowUserIds:', err);
      cb([]);
    },
  );
}

/** اشتراك لحظي بقائمة من أتابعهم (لحالة أزرار المتابعة) */
export function subscribeToMyFollowingIds(
  uid: string,
  cb: (ids: Set<string>) => void,
): () => void {
  const q = query(
    collection(firestore, 'follows'),
    where('follower', '==', uid),
    limit(300),
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(new Set(snap.docs.map((d) => d.data().followed as string).filter(Boolean)));
    },
    (err) => {
      console.warn('subscribeToMyFollowingIds:', err);
      cb(new Set());
    },
  );
}

/**
 * هل أتابع هذا الشخص؟
 */
export const isFollowing = async (followedUid: string): Promise<boolean> => {
  const me = auth.currentUser?.uid;
  if (!me || me === followedUid) return false;
  try {
    const snap = await getDoc(doc(firestore, 'follows', followId(me, followedUid)));
    return snap.exists();
  } catch {
    return false;
  }
};

/**
 * متابعة شخص — يكتب وثيقة follow + يزيد العدّادات
 */
export const followUser = async (followedUid: string): Promise<void> => {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error('يجب تسجيل الدخول');
  if (me === followedUid) throw new Error('لا يمكنك متابعة نفسك');

  const fid = followId(me, followedUid);
  const ref = doc(firestore, 'follows', fid);

  // لو متابِع أصلاً، لا تكرّر
  const existing = await getDoc(ref);
  if (existing.exists()) return;

  // 1) أنشئ وثيقة المتابعة
  await setDoc(ref, {
    follower: me,
    followed: followedUid,
    createdAt: Date.now(),
  });

  // 2) حدّث العدّادات (ذرّياً — stats + الجذر) بلا حجب الواجهة: كتابة عدّاد
  //    المتابَع تكتب على مستند مستخدم آخر وقد لا تُصدّق فوراً (بلا persistence
  //    تُحلّ الوعود عند تصديق الخادم فقط)، فكان await يُعلّق زر المتابعة إلى
  //    الأبد. العدّاد المحلي + مستمع subscribeToSocialCounts يبقيان العدّ صحيحاً.
  const prevFollowing = useAuthStore.getState().user?.stats.following ?? 0;
  patchLocalSocialStats(me, { following: prevFollowing + 1 });
  void Promise.all([
    updateDoc(doc(firestore, 'users', me), buildSocialIncrementPatch('following', 1)),
    updateDoc(doc(firestore, 'users', followedUid), buildSocialIncrementPatch('followers', 1)),
  ]).catch((e) => console.warn('follow counters:', e));

  const { notifyNewFollower } = await import('./activityNotifications');
  void notifyNewFollower(followedUid);
};

/**
 * إلغاء المتابعة
 */
export const unfollowUser = async (followedUid: string): Promise<void> => {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error('يجب تسجيل الدخول');

  const fid = followId(me, followedUid);
  const ref = doc(firestore, 'follows', fid);

  const existing = await getDoc(ref);
  if (!existing.exists()) return; // غير متابِع أصلاً

  // 1) احذف وثيقة المتابعة
  await deleteDoc(ref);

  // 2) أنقص العدّادات بلا حجب الواجهة (نفس علة followUser: كتابة عدّاد المتابَع
  //    على مستند مستخدم آخر كانت تُعلّق زر «إلغاء المتابعة» على «...» للأبد).
  const prevFollowing = useAuthStore.getState().user?.stats.following ?? 0;
  patchLocalSocialStats(me, { following: Math.max(0, prevFollowing - 1) });
  void Promise.all([
    updateDoc(doc(firestore, 'users', me), buildSocialIncrementPatch('following', -1)),
    updateDoc(doc(firestore, 'users', followedUid), buildSocialIncrementPatch('followers', -1)),
  ]).catch((e) => console.warn('unfollow counters:', e));
};

/**
 * تبديل المتابعة (متابعة ↔ إلغاء) — يُرجع الحالة الجديدة
 */
export const toggleFollow = async (followedUid: string): Promise<boolean> => {
  const currently = await isFollowing(followedUid);
  if (currently) {
    await unfollowUser(followedUid);
    return false;
  } else {
    await followUser(followedUid);
    return true;
  }
};

/**
 * إزالة متابِع — يحذف وثيقة follows وينقص العدّادات (لصاحب الحساب فقط)
 */
export const removeFollower = async (followerUid: string): Promise<void> => {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error('يجب تسجيل الدخول');
  if (me === followerUid) return;

  const ref = doc(firestore, 'follows', followId(followerUid, me));
  const existing = await getDoc(ref);
  if (!existing.exists()) return;

  await deleteDoc(ref);
  const prevFollowers = useAuthStore.getState().user?.stats.followers ?? 0;
  await Promise.all([
    updateDoc(doc(firestore, 'users', followerUid), buildSocialIncrementPatch('following', -1)),
    updateDoc(doc(firestore, 'users', me), buildSocialIncrementPatch('followers', -1)),
  ]);
  patchLocalSocialStats(me, { followers: Math.max(0, prevFollowers - 1) });
};

/**
 * مزامنة عدّاد followers/following مع وثائق follows الفعلية — يصلّح الانحراف
 */
export async function reconcileSocialCounts(
  uid: string,
): Promise<{ followers: number; following: number }> {
  const [followersCountSnap, followingCountSnap, userSnap] = await Promise.all([
    getCountFromServer(query(collection(firestore, 'follows'), where('followed', '==', uid))),
    getCountFromServer(query(collection(firestore, 'follows'), where('follower', '==', uid))),
    getDoc(doc(firestore, 'users', uid)),
  ]);

  const followers = followersCountSnap.data().count;
  const following = followingCountSnap.data().count;

  if (userSnap.exists()) {
    const stats = statsFromFirestoreDoc(userSnap.data() as Record<string, unknown>);
    if (stats.followers !== followers || stats.following !== following) {
      await updateDoc(
        doc(firestore, 'users', uid),
        buildSocialFirestoreUpdate({ followers, following }),
      );
    }
  }

  return { followers, following };
}

/**
 * قائمة من أتابعهم
 */
export const getFollowing = async (uid: string, max = 100): Promise<string[]> => {
  try {
    const q = query(
      collection(firestore, 'follows'),
      where('follower', '==', uid),
      limit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data().followed);
  } catch {
    return [];
  }
};

/**
 * قائمة المتابِعين لي
 */
export const getFollowers = async (uid: string, max = 100): Promise<string[]> => {
  try {
    const q = query(
      collection(firestore, 'follows'),
      where('followed', '==', uid),
      limit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data().follower);
  } catch {
    return [];
  }
};
