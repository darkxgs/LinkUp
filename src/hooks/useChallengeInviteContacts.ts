/**
 * جهات اتصال دعوة التحدي — أصدقاء (متابعة متبادلة) + متابعون + أتابع
 * مع حالة اتصال حقيقية من Firestore lastSeen + RTDB presence
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getFollowing, getFollowers } from '@/services/firebase/follow';
import { getUser } from '@/services/firebase/users';
import { useAuth } from '@/hooks/useAuth';
import { usePresenceForUids } from '@/hooks/usePresence';
import { isUserOnline, resolveLastSeenMs } from '@/utils/presence';

export type ChallengeInviteRelation = 'friend' | 'follower' | 'following';

export type ChallengeInviteContact = {
  uid: string;
  name: string;
  avatar: string;
  level: number;
  lastSeen: number;
  isOnline: boolean;
  relation: ChallengeInviteRelation;
};

export type ChallengeInviteContactFilter = 'all' | 'friends' | 'followers' | 'following';

async function fetchContactProfiles(
  myUid: string,
): Promise<Omit<ChallengeInviteContact, 'isOnline'>[]> {
  const [following, followers] = await Promise.all([
    getFollowing(myUid, 200),
    getFollowers(myUid, 200),
  ]);

  const followerSet = new Set(followers);
  const followingSet = new Set(following);

  const entries: { uid: string; relation: ChallengeInviteRelation }[] = [];
  const seen = new Set<string>();

  const push = (uid: string, relation: ChallengeInviteRelation) => {
    if (!uid || uid === myUid || seen.has(uid)) return;
    seen.add(uid);
    entries.push({ uid, relation });
  };

  for (const uid of following) {
    if (followerSet.has(uid)) push(uid, 'friend');
  }
  for (const uid of followers) {
    if (!followingSet.has(uid)) push(uid, 'follower');
  }
  for (const uid of following) {
    if (!followerSet.has(uid)) push(uid, 'following');
  }

  const profiles = await Promise.all(entries.map((e) => getUser(e.uid)));
  const contacts: Omit<ChallengeInviteContact, 'isOnline'>[] = [];

  for (let i = 0; i < entries.length; i += 1) {
    const profile = profiles[i];
    const entry = entries[i];
    if (!profile || !entry) continue;
    contacts.push({
      uid: profile.uid,
      name: profile.displayName || 'مستخدم',
      avatar: profile.avatar || '',
      level: profile.level ?? 1,
      lastSeen: profile.lastSeen ?? 0,
      relation: entry.relation,
    });
  }

  return contacts;
}

export function useChallengeInviteContacts(enabled: boolean) {
  const { user } = useAuth();
  const [rawContacts, setRawContacts] = useState<Omit<ChallengeInviteContact, 'isOnline'>[]>([]);
  const { presenceMap, now } = usePresenceForUids(
    useMemo(() => rawContacts.map((c) => c.uid), [rawContacts]),
  );
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<ChallengeInviteContactFilter>('all');

  const load = useCallback(async () => {
    const uid = user?.uid;
    if (!uid) {
      setRawContacts([]);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchContactProfiles(uid);
      setRawContacts(list);
    } catch (e) {
      console.error('useChallengeInviteContacts:', e);
      setRawContacts([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  const contacts = useMemo(() => {
    const withOnline: ChallengeInviteContact[] = rawContacts.map((c) => {
      const lastSeenMs = resolveLastSeenMs(c.lastSeen, presenceMap[c.uid]);
      return {
        ...c,
        lastSeen: lastSeenMs,
        isOnline: isUserOnline(lastSeenMs, now),
      };
    });

    let list = withOnline;
    if (filter === 'friends') list = list.filter((c) => c.relation === 'friend');
    else if (filter === 'followers') list = list.filter((c) => c.relation === 'follower');
    else if (filter === 'following') list = list.filter((c) => c.relation === 'following');

    return [...list].sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return a.name.localeCompare(b.name, 'ar');
    });
  }, [rawContacts, presenceMap, now, filter]);

  const counts = useMemo(
    () => ({
      all: rawContacts.length,
      friends: rawContacts.filter((c) => c.relation === 'friend').length,
      followers: rawContacts.filter((c) => c.relation === 'follower').length,
      following: rawContacts.filter((c) => c.relation === 'following').length,
      online: rawContacts.filter((c) =>
        isUserOnline(resolveLastSeenMs(c.lastSeen, presenceMap[c.uid]), now),
      ).length,
    }),
    [rawContacts, presenceMap, now],
  );

  return { contacts, loading, filter, setFilter, counts, refresh: load };
}
