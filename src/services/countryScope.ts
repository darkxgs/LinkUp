/**
 * نطاق دول مشرف الدولة — فلترة كل محتوى اللوحة
 */
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';

export type CountryScopeProfile = {
  role: 'super' | 'country';
  countries: string[];
} | null;

let scopeProfile: CountryScopeProfile = null;
const userCountryCache = new Map<string, string>();

export function setCountryScopeProfile(profile: CountryScopeProfile): void {
  scopeProfile = profile;
  userCountryCache.clear();
}

export function isSuperCountryScope(): boolean {
  return !scopeProfile || scopeProfile.role === 'super';
}

export function getScopedCountryCodes(): string[] {
  if (isSuperCountryScope()) return [];
  return scopeProfile?.countries ?? [];
}

export function normalizeCountryCode(country?: string | null): string {
  if (country == null || country === '') return '';
  const c = String(country).trim().toUpperCase();
  if (c === '—' || c === 'UNKNOWN' || c === 'N/A') return '';
  return c;
}

/** هل العنصر ضمن دول المشرف الحالي؟ */
export function isInAdminCountryScope(country?: string | null): boolean {
  if (isSuperCountryScope()) return true;
  const list = getScopedCountryCodes();
  if (list.length === 0) return false;
  const code = normalizeCountryCode(country);
  if (!code) return false;
  return list.includes(code);
}

export function countryFromUserDoc(data: Record<string, unknown> | undefined): string {
  if (!data) return '';
  const lastLoginLoc = data.lastLoginLocation as Record<string, unknown> | undefined;
  return normalizeCountryCode(
    (data.ipCountry as string) ??
    (lastLoginLoc?.country as string) ??
    (data.country as string) ??
    (data.countryCode as string)
  );
}

export function getCachedUserCountry(uid: string): string {
  return userCountryCache.get(uid) ?? '';
}

export async function getUserCountry(uid: string): Promise<string> {
  if (!uid) return '';
  if (userCountryCache.has(uid)) return userCountryCache.get(uid)!;
  try {
    const snap = await getDoc(doc(firestore, 'users', uid));
    const code = snap.exists() ? countryFromUserDoc(snap.data() as Record<string, unknown>) : '';
    userCountryCache.set(uid, code);
    return code;
  } catch {
    userCountryCache.set(uid, '');
    return '';
  }
}

export async function preloadUserCountries(uids: string[]): Promise<void> {
  const missing = [...new Set(uids.filter((id) => id && !userCountryCache.has(id)))];
  const chunk = 20;
  for (let i = 0; i < missing.length; i += chunk) {
    await Promise.all(missing.slice(i, i + chunk).map((uid) => getUserCountry(uid)));
  }
}

export async function isUidInAdminCountryScope(uid: string): Promise<boolean> {
  if (isSuperCountryScope()) return true;
  return isInAdminCountryScope(await getUserCountry(uid));
}

/** علاقة تظهر إذا أحد الطرفين من دول المشرف */
export async function isRelationshipInScope(
  user1Uid: string,
  user2Uid: string,
): Promise<boolean> {
  if (isSuperCountryScope()) return true;
  await preloadUserCountries([user1Uid, user2Uid]);
  return (
    isInAdminCountryScope(userCountryCache.get(user1Uid)) ||
    isInAdminCountryScope(userCountryCache.get(user2Uid))
  );
}

export function assertCountryAccess(country?: string | null): void {
  if (!isInAdminCountryScope(country)) {
    throw new Error('هذا المحتوى خارج نطاق دولك');
  }
}

/** مستخدم التطبيق ضمن دول المشرف */
export async function assertUidInAdminCountryScope(uid: string): Promise<void> {
  if (isSuperCountryScope() || !uid) return;
  assertCountryAccess(await getUserCountry(uid));
}

/** حد جلب أوسع قبل الفلترة لمشرف الدولة */
export function scopedFetchLimit(requested: number, multiplier = 5): number {
  if (isSuperCountryScope()) return requested;
  return Math.min(requested * multiplier, 500);
}
