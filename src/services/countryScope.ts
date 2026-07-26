/**
 * نطاق دول مشرف الدولة — فلترة كل محتوى اللوحة
 */
import { v2 } from '@/lib/v2Api';

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
  const profile = data.profile as Record<string, unknown> | undefined;
  return normalizeCountryCode(
    (profile?.country as string) ?? (data.country as string) ?? (data.countryCode as string),
  );
}

export function getCachedUserCountry(uid: string): string {
  return userCountryCache.get(uid) ?? '';
}

/**
 * دولة حساب واحد — من `POST /admin/users/countries` (نفس النقطة الجماعية بطلب
 * لعنصر واحد)، فلا تبقى صلاحية «مشرف الدولة» معلّقة على قراءة Firestore.
 *
 * الفشل يُخزَّن كسلسلة فارغة، و«بلا دولة» تعني **خارج النطاق** لمشرف دولة
 * (`isInAdminCountryScope` أعلاه) — أي أن انقطاع الشبكة يُضيّق الصلاحية ولا
 * يوسّعها. الاتجاه الآمن هو المقصود.
 */
export async function getUserCountry(uid: string): Promise<string> {
  if (!uid) return '';
  if (userCountryCache.has(uid)) return userCountryCache.get(uid)!;
  await preloadUserCountries([uid]);
  return userCountryCache.get(uid) ?? '';
}

export async function preloadUserCountries(uids: string[]): Promise<void> {
  const missing = [...new Set(uids.filter((id) => id && !userCountryCache.has(id)))];
  if (missing.length === 0) return;
  // The server resolves a batch in one query; 200 ids a request keeps the URL and
  // the SQL bounded on a big list.
  const chunk = 200;
  for (let i = 0; i < missing.length; i += chunk) {
    const slice = missing.slice(i, i + chunk);
    try {
      const map = await v2.post<Record<string, string>>('/admin/users/countries', {
        uids: slice,
      });
      slice.forEach((uid) => {
        userCountryCache.set(uid, normalizeCountryCode(map?.[uid]));
      });
    } catch {
      // A failed lookup caches «unknown», which reads as out-of-scope.
      slice.forEach((uid) => userCountryCache.set(uid, ''));
    }
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
