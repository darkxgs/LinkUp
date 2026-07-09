/**
 * تتبّع أعضاء الوكالة — من في روم الوكالة الآن؟ (مستمع أو على مقعد)
 */
import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { firestore } from '@/services/firebase';
import {
  subscribeToUserPresence,
  isTrackableAgencyPresence,
  type UserPresence,
} from '@/services/roomFeatures';
import { useAuth } from '@/hooks/useAuth';

async function loadAgencyMemberUids(agencyId: string): Promise<Set<string>> {
  const uids = new Set<string>();
  try {
    const agencySnap = await getDoc(doc(firestore, 'agencies', agencyId));
    if (agencySnap.exists()) {
      const owner = agencySnap.data()?.ownerUid;
      if (owner) uids.add(String(owner));
    }
  } catch {
    // ignore
  }

  try {
    const snap = await getDocs(
      query(
        collection(firestore, 'agencyMembers'),
        where('agencyId', '==', agencyId),
        limit(200),
      ),
    );
    snap.docs.forEach((d) => {
      const uid = d.data()?.uid;
      if (uid) uids.add(String(uid));
    });
  } catch {
    // ignore
  }

  return uids;
}

async function resolveMyAgencyId(
  uid: string,
  profileAgencyId?: string | null,
): Promise<string | null> {
  if (profileAgencyId) return profileAgencyId;
  if (!uid) return null;

  try {
    const ownerSnap = await getDocs(
      query(collection(firestore, 'agencies'), where('ownerUid', '==', uid), limit(1)),
    );
    if (!ownerSnap.empty) return ownerSnap.docs[0]!.id;
  } catch {
    // ignore
  }

  try {
    const memberSnap = await getDocs(
      query(collection(firestore, 'agencyMembers'), where('uid', '==', uid), limit(1)),
    );
    if (!memberSnap.empty) {
      const agencyId = memberSnap.docs[0]!.data()?.agencyId;
      if (agencyId) return String(agencyId);
    }
  } catch {
    // ignore
  }

  return null;
}

export function useAgencyRoomTracking(extraPeerUids: readonly string[] = []) {
  const { user } = useAuth();
  const myUid = user?.uid;

  const [agencyId, setAgencyId] = useState<string | null>(user?.agencyId ?? null);
  const [memberUids, setMemberUids] = useState<Set<string>>(new Set());
  const [presenceByUid, setPresenceByUid] = useState<Record<string, UserPresence>>({});

  const trackedUids = useMemo(() => {
    const set = new Set(memberUids);
    for (const uid of extraPeerUids) {
      const id = String(uid ?? '').trim();
      if (id && id !== myUid) set.add(id);
    }
    return set;
  }, [memberUids, extraPeerUids, myUid]);
  useEffect(() => {
    if (!myUid) {
      setAgencyId(null);
      return;
    }
    let alive = true;
    void resolveMyAgencyId(myUid, user?.agencyId).then((id) => {
      if (alive) setAgencyId(id);
    });
    return () => {
      alive = false;
    };
  }, [myUid, user?.agencyId]);

  useEffect(() => {
    if (!agencyId) {
      setMemberUids(new Set());
      return;
    }
    let alive = true;
    void loadAgencyMemberUids(agencyId).then((uids) => {
      if (alive) setMemberUids(uids);
    });
    return () => {
      alive = false;
    };
  }, [agencyId]);

  useEffect(() => {
    if (trackedUids.size === 0) {
      setPresenceByUid({});
      return;
    }

    const unsubs: (() => void)[] = [];
    for (const uid of trackedUids) {
      if (uid === myUid) continue;
      unsubs.push(
        subscribeToUserPresence(uid, (presence) => {
          setPresenceByUid((prev) => {
            if (!isTrackableAgencyPresence(presence)) {
              if (!prev[uid]) return prev;
              const next = { ...prev };
              delete next[uid];
              return next;
            }
            return { ...prev, [uid]: presence! };
          });
        }),
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [trackedUids, myUid]);

  const isAgencyMember = useMemo(
    () => (uid: string) => memberUids.has(uid),
    [memberUids],
  );

  const getMemberRoom = useMemo(
    () => (uid: string): UserPresence | null => presenceByUid[uid] ?? null,
    [presenceByUid],
  );

  const isInRoom = useMemo(
    () => (uid: string) => isTrackableAgencyPresence(presenceByUid[uid]),
    [presenceByUid],
  );

  return {
    agencyId,
    memberUids,
    presenceByUid,
    isAgencyMember,
    getMemberRoom,
    isInRoom,
  };
}
