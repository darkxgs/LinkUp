import type { UserDoc } from '@/services/firebase/users';
import { isUserOnline, resolveLastSeenMs } from '@/utils/presence';
import { DISCOVER_AGE_MAX, DISCOVER_AGE_MIN, getUserAge } from '@/utils/userAge';

export type DiscoverUserFilter = {
  onlineOnly: boolean;
  minAge: number;
  maxAge: number;
};

export const DEFAULT_DISCOVER_USER_FILTER: DiscoverUserFilter = {
  onlineOnly: false,
  minAge: DISCOVER_AGE_MIN,
  maxAge: DISCOVER_AGE_MAX,
};

export function isDiscoverFilterActive(filter: DiscoverUserFilter): boolean {
  return (
    filter.onlineOnly
    || filter.minAge > DISCOVER_AGE_MIN
    || filter.maxAge < DISCOVER_AGE_MAX
  );
}

export function userMatchesDiscoverFilter(
  user: UserDoc,
  filter: DiscoverUserFilter,
  presenceMap: Record<string, number | undefined>,
  presenceNow: number,
): boolean {
  if (filter.onlineOnly) {
    const lastSeen = resolveLastSeenMs(user.lastSeen, presenceMap[user.uid]);
    if (!isUserOnline(lastSeen, presenceNow)) return false;
  }

  const age = getUserAge(user);
  if (age == null) {
    return !isDiscoverFilterActive(filter);
  }
  if (age < filter.minAge) return false;
  if (filter.maxAge >= DISCOVER_AGE_MAX) {
    return age >= filter.minAge;
  }
  return age <= filter.maxAge;
}
