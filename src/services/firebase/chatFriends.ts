/**
 * أصدقاء الشات — متابعون متبادلون أو أعضاء بنفس الوكالة
 */
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  getDoc,
} from 'firebase/firestore';
import { firestore } from './index';
import { getFollowing, getFollowers } from './follow';

async function getUserAgencyIds(uid: string): Promise<string[]> {
  const agencyIds = new Set<string>();

  try {
    const userSnap = await getDoc(doc(firestore, 'users', uid));
    const agencyId = userSnap.data()?.agencyId;
    if (agencyId) agencyIds.add(String(agencyId));
  } catch {
    /* ignore */
  }

  try {
    const owned = await getDocs(
      query(collection(firestore, 'agencies'), where('ownerUid', '==', uid), limit(3)),
    );
    owned.docs.forEach((d) => agencyIds.add(d.id));
  } catch {
    /* ignore */
  }

  try {
    const member = await getDocs(
      query(collection(firestore, 'agencyMembers'), where('uid', '==', uid), limit(5)),
    );
    member.docs.forEach((d) => {
      const aid = d.data()?.agencyId;
      if (aid) agencyIds.add(String(aid));
    });
  } catch {
    /* ignore */
  }

  return [...agencyIds];
}

async function getAgencyMemberUids(agencyIds: string[]): Promise<string[]> {
  if (agencyIds.length === 0) return [];

  const uids = new Set<string>();

  for (const agencyId of agencyIds) {
    try {
      const snap = await getDocs(
        query(
          collection(firestore, 'agencyMembers'),
          where('agencyId', '==', agencyId),
          limit(300),
        ),
      );
      snap.docs.forEach((d) => {
        const memberUid = d.data()?.uid;
        if (memberUid) uids.add(String(memberUid));
      });
    } catch {
      /* ignore */
    }

    try {
      const agencySnap = await getDoc(doc(firestore, 'agencies', agencyId));
      const ownerUid = agencySnap.data()?.ownerUid;
      if (ownerUid) uids.add(String(ownerUid));
    } catch {
      /* ignore */
    }
  }

  return [...uids];
}

/** UIDs: متابعون متبادلون + أعضاء الوكالة/الوكالات المشتركة */
export async function getChatFriendUids(uid: string): Promise<Set<string>> {
  const friends = new Set<string>();

  const [following, followers, agencyIds] = await Promise.all([
    getFollowing(uid, 500),
    getFollowers(uid, 500),
    getUserAgencyIds(uid),
  ]);

  const followerSet = new Set(followers);
  for (const followedUid of following) {
    if (followedUid !== uid && followerSet.has(followedUid)) {
      friends.add(followedUid);
    }
  }

  if (agencyIds.length > 0) {
    const members = await getAgencyMemberUids(agencyIds);
    for (const memberUid of members) {
      if (memberUid !== uid) friends.add(memberUid);
    }
  }

  return friends;
}
