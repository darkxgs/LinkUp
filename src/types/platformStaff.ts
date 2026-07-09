/**
 * موظفو المنصة — مانيجر / سوبر أدمن / أدمن إشراف
 * (حساب تطبيق عادي + حقول staff* على users/{uid})
 */

export type PlatformStaffRole = 'manager' | 'super_admin' | 'admin';

export const PLATFORM_STAFF_ROLES: PlatformStaffRole[] = [
  'manager',
  'super_admin',
  'admin',
];

export interface PlatformStaffFields {
  staffRole?: PlatformStaffRole | null;
  staffCountries?: string[];
  staffFrameUrl?: string | null;
  staffBadgeUrl?: string | null;
  staffEntryVideoUrl?: string | null;
  staffEntryVideoUrlMp4?: string | null;
  staffAgencyId?: string | null;
  staffActive?: boolean;
}

export interface PlatformStaffUser extends PlatformStaffFields {
  uid?: string;
  country?: string;
}

export function normalizeStaffCountry(code?: string | null): string {
  return String(code ?? '').trim().toUpperCase();
}

export function parseStaffFromUserData(
  data: Record<string, unknown> | null | undefined,
): Required<Pick<PlatformStaffFields, 'staffRole' | 'staffCountries' | 'staffActive'>> &
  PlatformStaffFields {
  const roleRaw = data?.staffRole;
  const staffRole =
    roleRaw === 'manager' || roleRaw === 'super_admin' || roleRaw === 'admin'
      ? roleRaw
      : null;
  const staffCountries = Array.isArray(data?.staffCountries)
    ? (data!.staffCountries as string[]).map(normalizeStaffCountry).filter(Boolean)
    : [];
  return {
    staffRole,
    staffCountries,
    staffFrameUrl: data?.staffFrameUrl != null ? String(data.staffFrameUrl) : null,
    staffBadgeUrl: data?.staffBadgeUrl != null ? String(data.staffBadgeUrl) : null,
    staffEntryVideoUrl: data?.staffEntryVideoUrl != null ? String(data.staffEntryVideoUrl) : null,
    staffEntryVideoUrlMp4:
      data?.staffEntryVideoUrlMp4 != null ? String(data.staffEntryVideoUrlMp4) : null,
    staffAgencyId: data?.staffAgencyId != null ? String(data.staffAgencyId) : null,
    staffActive: data?.staffActive !== false,
  };
}

export function isPlatformStaffActive(user: PlatformStaffUser | null | undefined): boolean {
  if (!user?.staffRole) return false;
  return user.staffActive !== false;
}

export function isPlatformManager(user: PlatformStaffUser | null | undefined): boolean {
  return isPlatformStaffActive(user) && user!.staffRole === 'manager';
}

export function isPlatformSuperAdmin(user: PlatformStaffUser | null | undefined): boolean {
  return isPlatformStaffActive(user) && user!.staffRole === 'super_admin';
}

export function isPlatformSupervisorAdmin(user: PlatformStaffUser | null | undefined): boolean {
  return isPlatformStaffActive(user) && user!.staffRole === 'admin';
}

/** أي موظف منصة نشط */
export function isAnyPlatformStaff(user: PlatformStaffUser | null | undefined): boolean {
  return isPlatformStaffActive(user);
}

export function staffHasCountryAccess(
  user: PlatformStaffUser | null | undefined,
  roomCountry?: string | null,
): boolean {
  if (!isPlatformStaffActive(user)) return false;
  if (user!.staffRole === 'manager') return true;
  const cc = normalizeStaffCountry(roomCountry);
  if (!cc || cc === 'WW') return true;
  const countries = (user!.staffCountries ?? []).map(normalizeStaffCountry);
  return countries.includes(cc);
}

export function resolveRoomCountry(
  room?: { country?: string; agencyId?: string } | null,
  agencyCountry?: string | null,
): string {
  const fromRoom = normalizeStaffCountry(room?.country);
  if (fromRoom && fromRoom !== 'WW') return fromRoom;
  const fromAgency = normalizeStaffCountry(agencyCountry);
  if (fromAgency && fromAgency !== 'WW') return fromAgency;
  return fromRoom || fromAgency || 'PS';
}

/** دخول الروم / الوكالة */
export function staffCanEnterRoom(
  user: PlatformStaffUser | null | undefined,
  roomCountry?: string | null,
): boolean {
  return staffHasCountryAccess(user, roomCountry);
}

/** طرد / إزالة من المايك / حظر */
export function staffCanKickOrManageUsers(
  user: PlatformStaffUser | null | undefined,
  roomCountry?: string | null,
): boolean {
  if (!isPlatformStaffActive(user)) return false;
  if (user!.staffRole === 'admin') return false;
  return staffHasCountryAccess(user, roomCountry);
}

/** مقعد المضيف (0) — كرسي الإشراف الكامل */
export function staffCanUseHostSeat(
  user: PlatformStaffUser | null | undefined,
  roomCountry?: string | null,
): boolean {
  if (!isPlatformStaffActive(user)) return false;
  if (user!.staffRole === 'admin') return false;
  return staffHasCountryAccess(user, roomCountry);
}

/** مراجعة فيديو/PK — أدمن الإشراف */
export function staffCanReviewRoom(
  user: PlatformStaffUser | null | undefined,
  roomCountry?: string | null,
): boolean {
  return staffHasCountryAccess(user, roomCountry);
}

/** إعفاء من رسوم المايك + تجاوز طلب العضوية */
export function staffMicFeeExempt(user: PlatformStaffUser | null | undefined): boolean {
  return isPlatformStaffActive(user);
}

/** دمج صلاحيات الموظف مع صلاحيات المضيف/المشرف */
export function effectiveCanJoinHostSeat(
  room: { hostUid?: string; coHosts?: string[] } | null | undefined,
  uid: string | null | undefined,
  staff: PlatformStaffUser | null | undefined,
  roomCountry?: string | null,
): boolean {
  if (staffCanUseHostSeat(staff, roomCountry)) return true;
  if (!room || !uid) return false;
  const hostUid = String(room.hostUid ?? '');
  if (!hostUid) return false;
  if (uid === hostUid) return true;
  const coHosts = Array.isArray(room.coHosts)
    ? room.coHosts.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
  return coHosts.includes(uid);
}

export function effectiveCanManageRoomUsers(
  room: { hostUid?: string; coHosts?: string[] } | null | undefined,
  uid: string | null | undefined,
  staff: PlatformStaffUser | null | undefined,
  roomCountry?: string | null,
): boolean {
  if (staffCanKickOrManageUsers(staff, roomCountry)) return true;
  return effectiveCanJoinHostSeat(room, uid, null, roomCountry);
}

export function effectiveCanOccupyHostSeat(
  room: { hostUid?: string; coHosts?: string[]; agencyId?: string; isAgencyRoom?: boolean } | null | undefined,
  uid: string | null | undefined,
  staff: PlatformStaffUser | null | undefined,
  roomCountry?: string | null,
): boolean {
  if (staffCanUseHostSeat(staff, roomCountry)) {
    return effectiveCanJoinHostSeat(room, uid, staff, roomCountry);
  }
  return effectiveCanJoinHostSeat(room, uid, null, roomCountry);
}

export function staffRoleLabelAr(role: PlatformStaffRole): string {
  switch (role) {
    case 'manager':
      return 'مانيجر';
    case 'super_admin':
      return 'سوبر أدمن';
    case 'admin':
      return 'أدمن إشراف';
    default:
      return role;
  }
}
