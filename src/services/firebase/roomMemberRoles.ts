/**
 * أدوار أعضاء الوكالة في الروم + صلاحيات الإعدادات
 */
import { ref, get, set, update, onValue, off, runTransaction } from 'firebase/database';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { realtimeDb, auth, firestore } from './index';
import { canJoinHostSeat, getRoomCoHosts, type RoomHostSeatAccess } from '@/utils/roomHostSeat';
import { checkUserHasVipFeature } from './vipSystem';
import {
  parseStaffFromUserData,
  staffCanKickOrManageUsers,
  resolveRoomCountry,
  type PlatformStaffUser,
} from '@/types/platformStaff';
import {
  rebuildSeatsForCountChange,
  resolveRoomMaxSeatsCount,
  ALLOWED_SEAT_COUNTS,
  type AllowedSeatCount,
} from './roomSeats';
import {
  AGENCY_THRONE_UNLOCK_LEVEL,
  isAgencyThroneUnlockedByLevel,
  resolveAgencyLevelsConfig,
  resolveSupervisorCapForLevel,
} from '@/services/agencyLevels';
import { getAgencyEffectivePeriodLevel } from '@/services/agencyService';
import { friendlyErrorMessage } from '@/utils/friendlyErrorMessage';

/** @deprecated — استخدم resolveSupervisorCapForLevel حسب مستوى الوكالة */
export const BASE_ROOM_SUPERVISORS_CAP = 5;
/** @deprecated — استخدم resolveSupervisorCapForLevel + vipSupervisorBonus */
export const EXTRA_ROOM_SUPERVISORS_CAP = 15;

export type RoomAgencyMemberRole =
  | 'blue_supervisor'
  | 'yellow_supervisor'
  | 'red_member'
  | 'cancelled';

export type RoomAudienceKind = 'manager' | 'member' | 'guest';

export type RoomFeaturePermission =
  | 'takeMic'
  | 'shareVideo'
  | 'shareMusic'
  | 'inviteToAgency'
  | 'sendRoomInvite'
  | 'inviteToMic';

export interface RoomPermissions {
  guestCanTakeMic: boolean;
  guestCanShareVideo: boolean;
  guestCanShareMusic: boolean;
  guestCanInviteToAgency: boolean;
  guestCanSendRoomInvite: boolean;
  guestCanInviteToMic: boolean;
  memberCanTakeMic: boolean;
  memberCanShareVideo: boolean;
  memberCanShareMusic: boolean;
  memberCanInviteToAgency: boolean;
  memberCanSendRoomInvite: boolean;
  memberCanInviteToMic: boolean;
  showMessageHistory: boolean;
  allowOffMicEmojis: boolean;
  allowOffMicDice: boolean;
  /** صلاحيات مشرفي الإشراف (coHosts / yellow_supervisor) — المضيف دائماً يملك الكل */
  moderatorsCanKickBan: boolean;
  moderatorsCanManageMic: boolean;
  moderatorsCanLockSeats: boolean;
  moderatorsCanReviewVideo: boolean;
  moderatorsCanPinMessages: boolean;
  moderatorsCanManageRoles: boolean;
  moderatorsCanBlockUsers: boolean;
  moderatorsCanResetMicSupport: boolean;
  moderatorsCanManageEffects: boolean;
  moderatorsCanCleanChat: boolean;
  moderatorsCanInviteMic: boolean;
  moderatorsCanCancelMembership: boolean;
  moderatorsCanManageLuckyBags: boolean;
  moderatorsCanChangeSettings: boolean;
  moderatorsCanChangeMode: boolean;
}

export type SupervisorPermissionKey =
  | 'kickBan'
  | 'manageMic'
  | 'lockSeats'
  | 'reviewVideo'
  | 'pinMessages'
  | 'manageRoles'
  | 'blockUsers'
  | 'resetMicSupport'
  | 'manageEffects'
  | 'cleanChat'
  | 'inviteMic'
  | 'cancelMembership'
  | 'manageLuckyBags'
  | 'changeSettings'
  | 'changeMode';

export type ResolvedSupervisorPermissions = Record<SupervisorPermissionKey, boolean>;

const SUPERVISOR_PERMISSION_FIELD: Record<SupervisorPermissionKey, keyof RoomPermissions> = {
  kickBan: 'moderatorsCanKickBan',
  manageMic: 'moderatorsCanManageMic',
  lockSeats: 'moderatorsCanLockSeats',
  reviewVideo: 'moderatorsCanReviewVideo',
  pinMessages: 'moderatorsCanPinMessages',
  manageRoles: 'moderatorsCanManageRoles',
  blockUsers: 'moderatorsCanBlockUsers',
  resetMicSupport: 'moderatorsCanResetMicSupport',
  manageEffects: 'moderatorsCanManageEffects',
  cleanChat: 'moderatorsCanCleanChat',
  inviteMic: 'moderatorsCanInviteMic',
  cancelMembership: 'moderatorsCanCancelMembership',
  manageLuckyBags: 'moderatorsCanManageLuckyBags',
  changeSettings: 'moderatorsCanChangeSettings',
  changeMode: 'moderatorsCanChangeMode',
};

export const DEFAULT_ROOM_PERMISSIONS: RoomPermissions = {
  guestCanTakeMic: false,
  guestCanShareVideo: false,
  guestCanShareMusic: false,
  guestCanInviteToAgency: false,
  guestCanSendRoomInvite: false,
  guestCanInviteToMic: false,
  memberCanTakeMic: true,
  memberCanShareVideo: false,
  memberCanShareMusic: false,
  memberCanInviteToAgency: false,
  memberCanSendRoomInvite: true,
  memberCanInviteToMic: false,
  showMessageHistory: false,
  allowOffMicEmojis: true,
  allowOffMicDice: true,
  moderatorsCanKickBan: true,
  moderatorsCanManageMic: true,
  moderatorsCanLockSeats: true,
  moderatorsCanReviewVideo: true,
  moderatorsCanPinMessages: true,
  moderatorsCanManageRoles: true,
  moderatorsCanBlockUsers: true,
  moderatorsCanResetMicSupport: true,
  moderatorsCanManageEffects: true,
  moderatorsCanCleanChat: true,
  moderatorsCanInviteMic: true,
  moderatorsCanCancelMembership: true,
  moderatorsCanManageLuckyBags: true,
  moderatorsCanChangeSettings: true,
  moderatorsCanChangeMode: true,
};

const FEATURE_PERMISSION_KEYS: Record<
  RoomFeaturePermission,
  { guest: keyof RoomPermissions; member: keyof RoomPermissions }
> = {
  takeMic: { guest: 'guestCanTakeMic', member: 'memberCanTakeMic' },
  shareVideo: { guest: 'guestCanShareVideo', member: 'memberCanShareVideo' },
  shareMusic: { guest: 'guestCanShareMusic', member: 'memberCanShareMusic' },
  inviteToAgency: { guest: 'guestCanInviteToAgency', member: 'memberCanInviteToAgency' },
  sendRoomInvite: { guest: 'guestCanSendRoomInvite', member: 'memberCanSendRoomInvite' },
  inviteToMic: { guest: 'guestCanInviteToMic', member: 'memberCanInviteToMic' },
};

export function parseRoomPermissions(raw: Record<string, unknown> | null | undefined): RoomPermissions {
  const p = (raw?.permissions ?? raw?.roomPermissions ?? {}) as Partial<RoomPermissions>;
  return {
    guestCanTakeMic: p.guestCanTakeMic ?? DEFAULT_ROOM_PERMISSIONS.guestCanTakeMic,
    guestCanShareVideo: p.guestCanShareVideo ?? DEFAULT_ROOM_PERMISSIONS.guestCanShareVideo,
    guestCanShareMusic: p.guestCanShareMusic ?? DEFAULT_ROOM_PERMISSIONS.guestCanShareMusic,
    guestCanInviteToAgency:
      p.guestCanInviteToAgency ?? DEFAULT_ROOM_PERMISSIONS.guestCanInviteToAgency,
    guestCanSendRoomInvite:
      p.guestCanSendRoomInvite ?? DEFAULT_ROOM_PERMISSIONS.guestCanSendRoomInvite,
    guestCanInviteToMic: p.guestCanInviteToMic ?? DEFAULT_ROOM_PERMISSIONS.guestCanInviteToMic,
    memberCanTakeMic: p.memberCanTakeMic ?? DEFAULT_ROOM_PERMISSIONS.memberCanTakeMic,
    memberCanShareVideo: p.memberCanShareVideo ?? DEFAULT_ROOM_PERMISSIONS.memberCanShareVideo,
    memberCanShareMusic: p.memberCanShareMusic ?? DEFAULT_ROOM_PERMISSIONS.memberCanShareMusic,
    memberCanInviteToAgency:
      p.memberCanInviteToAgency ?? DEFAULT_ROOM_PERMISSIONS.memberCanInviteToAgency,
    memberCanSendRoomInvite:
      p.memberCanSendRoomInvite ?? DEFAULT_ROOM_PERMISSIONS.memberCanSendRoomInvite,
    memberCanInviteToMic: p.memberCanInviteToMic ?? DEFAULT_ROOM_PERMISSIONS.memberCanInviteToMic,
    showMessageHistory: p.showMessageHistory ?? DEFAULT_ROOM_PERMISSIONS.showMessageHistory,
    allowOffMicEmojis: p.allowOffMicEmojis ?? DEFAULT_ROOM_PERMISSIONS.allowOffMicEmojis,
    allowOffMicDice: p.allowOffMicDice ?? DEFAULT_ROOM_PERMISSIONS.allowOffMicDice,
    moderatorsCanKickBan: p.moderatorsCanKickBan ?? DEFAULT_ROOM_PERMISSIONS.moderatorsCanKickBan,
    moderatorsCanManageMic:
      p.moderatorsCanManageMic ?? DEFAULT_ROOM_PERMISSIONS.moderatorsCanManageMic,
    moderatorsCanLockSeats:
      p.moderatorsCanLockSeats ?? DEFAULT_ROOM_PERMISSIONS.moderatorsCanLockSeats,
    moderatorsCanReviewVideo:
      p.moderatorsCanReviewVideo ?? DEFAULT_ROOM_PERMISSIONS.moderatorsCanReviewVideo,
    moderatorsCanPinMessages:
      p.moderatorsCanPinMessages ?? DEFAULT_ROOM_PERMISSIONS.moderatorsCanPinMessages,
    moderatorsCanManageRoles:
      p.moderatorsCanManageRoles ?? DEFAULT_ROOM_PERMISSIONS.moderatorsCanManageRoles,
    moderatorsCanBlockUsers:
      p.moderatorsCanBlockUsers ?? DEFAULT_ROOM_PERMISSIONS.moderatorsCanBlockUsers,
    moderatorsCanResetMicSupport:
      p.moderatorsCanResetMicSupport ?? DEFAULT_ROOM_PERMISSIONS.moderatorsCanResetMicSupport,
    moderatorsCanManageEffects:
      p.moderatorsCanManageEffects ?? DEFAULT_ROOM_PERMISSIONS.moderatorsCanManageEffects,
    moderatorsCanCleanChat:
      p.moderatorsCanCleanChat ?? DEFAULT_ROOM_PERMISSIONS.moderatorsCanCleanChat,
    moderatorsCanInviteMic:
      p.moderatorsCanInviteMic ?? DEFAULT_ROOM_PERMISSIONS.moderatorsCanInviteMic,
    moderatorsCanCancelMembership:
      p.moderatorsCanCancelMembership ?? DEFAULT_ROOM_PERMISSIONS.moderatorsCanCancelMembership,
    moderatorsCanManageLuckyBags:
      p.moderatorsCanManageLuckyBags ?? DEFAULT_ROOM_PERMISSIONS.moderatorsCanManageLuckyBags,
    moderatorsCanChangeSettings:
      p.moderatorsCanChangeSettings ?? DEFAULT_ROOM_PERMISSIONS.moderatorsCanChangeSettings,
    moderatorsCanChangeMode:
      p.moderatorsCanChangeMode ?? DEFAULT_ROOM_PERMISSIONS.moderatorsCanChangeMode,
  };
}

/** مشرف إشراف (أصفر) — موجود في coHosts */
export function isRoomYellowSupervisor(
  room: RoomHostSeatAccess | null | undefined,
  uid: string | undefined,
): boolean {
  if (!room || !uid) return false;
  if (String(room.hostUid ?? '') === uid) return false;
  return getRoomCoHosts(room).includes(uid);
}

function allSupervisorPermissionsGranted(): ResolvedSupervisorPermissions {
  return Object.fromEntries(
    (Object.keys(SUPERVISOR_PERMISSION_FIELD) as SupervisorPermissionKey[]).map((k) => [k, true]),
  ) as ResolvedSupervisorPermissions;
}

function noSupervisorPermissions(): ResolvedSupervisorPermissions {
  return Object.fromEntries(
    (Object.keys(SUPERVISOR_PERMISSION_FIELD) as SupervisorPermissionKey[]).map((k) => [k, false]),
  ) as ResolvedSupervisorPermissions;
}

export function hasSupervisorPermission(
  room: Record<string, unknown> | null | undefined,
  uid: string | undefined,
  permission: SupervisorPermissionKey,
  staff?: PlatformStaffUser | null,
  roomCountry?: string | null,
  memberRoles?: Record<string, RoomAgencyMemberRole>,
): boolean {
  return resolveSupervisorPermissions(room, uid, staff, roomCountry, memberRoles)[permission];
}

export function resolveSupervisorPermissions(
  room: Record<string, unknown> | null | undefined,
  uid: string | undefined,
  staff?: PlatformStaffUser | null,
  roomCountry?: string | null,
  memberRoles?: Record<string, RoomAgencyMemberRole>,
): ResolvedSupervisorPermissions {
  if (!room || !uid) return noSupervisorPermissions();
  if (String(room.hostUid ?? '') === uid) return allSupervisorPermissionsGranted();
  if (staffCanKickOrManageUsers(staff, roomCountry)) return allSupervisorPermissionsGranted();
  // مشرف عبر coHosts أو عبر memberRoles — تفادي فقدان الصلاحيات عند تأخر مزامنة coHosts
  const isSupervisor =
    isRoomYellowSupervisor(room, uid) || memberRoles?.[uid] === 'yellow_supervisor';
  if (!isSupervisor) return noSupervisorPermissions();
  const perms = parseRoomPermissions(room);
  const resolved = noSupervisorPermissions();
  for (const key of Object.keys(SUPERVISOR_PERMISSION_FIELD) as SupervisorPermissionKey[]) {
    const field = SUPERVISOR_PERMISSION_FIELD[key];
    resolved[key] = Boolean(perms[field]);
  }
  return resolved;
}

export function resolveRoomAudienceKind(
  room: RoomHostSeatAccess | null | undefined,
  uid: string | undefined,
  isAgencyMember: boolean,
): RoomAudienceKind {
  if (!uid || !room) return 'guest';
  if (canJoinHostSeat(room, uid)) return 'manager';
  if (isAgencyMember) return 'member';
  return 'guest';
}

export function hasRoomFeaturePermission(
  perms: RoomPermissions,
  feature: RoomFeaturePermission,
  audience: RoomAudienceKind,
): boolean {
  if (audience === 'manager') return true;
  const keys = FEATURE_PERMISSION_KEYS[feature];
  const key = audience === 'member' ? keys.member : keys.guest;
  return Boolean(perms[key]);
}

export function canTakeMicSeat(
  isManager: boolean,
  memberRole: RoomAgencyMemberRole | null,
  perms: RoomPermissions,
  isAgencyMember: boolean,
): boolean {
  if (isManager) return true;
  if (memberRole === 'cancelled') return false;
  // أي دور مسجّل في الغرفة (عضو أزرق/إشراف أصفر/عضو أحمر) يتجاوز بوابة الضيف —
  // مشرف الوكالة كان يُطالَب بشراء عضوية عندما لا يكون في coHosts ولا في
  // agencyMembers (تأخّر مزامنة أو تعيين عبر memberRoles فقط) رغم أن قواعد
  // RTDB تسمح له بالمقعد («لا يمكن رفع مايك في بعض الوكالات رغم وجود إشراف»)
  if (
    memberRole === 'yellow_supervisor' ||
    memberRole === 'blue_supervisor' ||
    memberRole === 'red_member'
  ) {
    return true;
  }
  const audience = isAgencyMember ? 'member' : 'guest';
  return hasRoomFeaturePermission(perms, 'takeMic', audience);
}

export function roleLabel(role: RoomAgencyMemberRole | undefined, isAr: boolean): string {
  // أزرق = عضو · أصفر = إشراف · أحمر = ملغي العضوية
  const map: Record<RoomAgencyMemberRole, [string, string]> = {
    blue_supervisor: ['عضو', 'Member'],
    yellow_supervisor: ['إشراف', 'Supervisor'],
    red_member: ['عضو', 'Member'], // مهجور — يُعامل كعضو
    cancelled: ['ملغي العضوية', 'Cancelled'],
  };
  if (!role) return isAr ? 'عضو' : 'Member';
  return isAr ? map[role][0] : map[role][1];
}

export function roleColor(role: RoomAgencyMemberRole | undefined): string {
  switch (role) {
    case 'blue_supervisor': // عضو
      return '#ED4444';
    case 'yellow_supervisor': // إشراف
      return '#EAB308';
    case 'red_member': // مهجور
      return '#ED4444';
    case 'cancelled': // ملغي العضوية
      return '#EF4444';
    default:
      return '#6B7280';
  }
}

/** أدوار الأعضاء من لقطة الغرفة نفسها — بدون قراءة إضافية */
function memberRolesFromRoomData(
  roomData: Record<string, unknown>,
): Record<string, RoomAgencyMemberRole> {
  const raw = (roomData.memberRoles ?? {}) as Record<string, string>;
  const roles: Record<string, RoomAgencyMemberRole> = {};
  for (const [uid, role] of Object.entries(raw)) {
    if (
      role === 'blue_supervisor' ||
      role === 'yellow_supervisor' ||
      role === 'red_member' ||
      role === 'cancelled'
    ) {
      roles[uid] = role;
    }
  }
  return roles;
}

async function assertRoomHostOrStaff(roomId: string): Promise<{
  roomData: Record<string, unknown>;
  uid: string;
  isHost: boolean;
  isStaff: boolean;
}> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  const snap = await get(ref(realtimeDb, `rooms/${roomId}`));
  if (!snap.exists()) throw new Error('الغرفة غير موجودة');
  const roomData = snap.val() as Record<string, unknown>;
  const isHost = roomData.hostUid === user.uid;
  if (isHost) return { roomData, uid: user.uid, isHost: true, isStaff: false };

  const userSnap = await getDoc(doc(firestore, 'users', user.uid));
  const staff = parseStaffFromUserData(userSnap.exists() ? userSnap.data() : null);
  const roomCountry = resolveRoomCountry(roomData as any, null);
  if (staffCanKickOrManageUsers(staff, roomCountry)) {
    return { roomData, uid: user.uid, isHost: false, isStaff: true };
  }
  // مشرف عبر coHosts أو memberRoles — لا تسقط صلاحياته عند تأخر مزامنة coHosts
  if (
    canJoinHostSeat(roomData, user.uid) ||
    isAgencyRoomSupervisorUid(user.uid, roomData, memberRolesFromRoomData(roomData))
  ) {
    return { roomData, uid: user.uid, isHost: false, isStaff: false };
  }
  throw new Error('ليس لديك صلاحية إدارة الغرفة');
}

/** مشرف فعّال (coHosts أو memberRoles) — للاستخدام في فحوص الصلاحيات الداخلية */
function isEffectiveSupervisor(roomData: Record<string, unknown>, uid: string): boolean {
  return (
    isRoomYellowSupervisor(roomData as RoomHostSeatAccess, uid) ||
    isAgencyRoomSupervisorUid(uid, roomData, memberRolesFromRoomData(roomData))
  );
}

async function assertCanManageRoomRoles(roomId: string): Promise<Record<string, unknown>> {
  const { roomData, uid, isHost, isStaff } = await assertRoomHostOrStaff(roomId);
  if (isHost || isStaff) return roomData;
  const perms = parseRoomPermissions(roomData);
  if (isEffectiveSupervisor(roomData, uid) && perms.moderatorsCanManageRoles) return roomData;
  throw new Error('ليس لديك صلاحية إدارة الأعضاء');
}

async function assertCanEditRoomSettings(roomId: string): Promise<Record<string, unknown>> {
  const { roomData, uid, isHost, isStaff } = await assertRoomHostOrStaff(roomId);
  if (isHost || isStaff) return roomData;
  const perms = parseRoomPermissions(roomData);
  if (isEffectiveSupervisor(roomData, uid) && perms.moderatorsCanChangeSettings) return roomData;
  throw new Error('المشرفون غير مسموح لهم بتغيير الإعدادات');
}

/**
 * إدارة توزيع/عدد المايكات — المضيف/الإدارة، أو مشرف يملك إدارة المايكات
 * أو تغيير الإعدادات (#6: صلاحية إدارة الغرفة تمنح التحكم الكامل بالمايكات).
 */
async function assertCanManageSeatLayout(roomId: string): Promise<Record<string, unknown>> {
  const { roomData, uid, isHost, isStaff } = await assertRoomHostOrStaff(roomId);
  if (isHost || isStaff) return roomData;
  const perms = parseRoomPermissions(roomData);
  if (
    isEffectiveSupervisor(roomData, uid) &&
    (perms.moderatorsCanManageMic || perms.moderatorsCanChangeSettings)
  ) {
    return roomData;
  }
  throw new Error('ليس لديك صلاحية إدارة المايكات');
}

function supervisorUids(roles: Record<string, RoomAgencyMemberRole>): string[] {
  // الإشراف (الأصفر) فقط هو من يحصل على صلاحيات co-host. الأزرق = عضو عادي بلا صلاحيات.
  return Object.entries(roles)
    .filter(([, r]) => r === 'yellow_supervisor')
    .map(([uid]) => uid);
}

async function syncCoHostsFromRoles(roomId: string, roles: Record<string, RoomAgencyMemberRole>): Promise<void> {
  const coHosts = supervisorUids(roles);
  await update(ref(realtimeDb, `rooms/${roomId}`), {
    coHosts,
    updatedAt: Date.now(),
  });
}

export function subscribeToRoomMemberRoles(
  roomId: string,
  callback: (roles: Record<string, RoomAgencyMemberRole>) => void,
): () => void {
  const rolesRef = ref(realtimeDb, `rooms/${roomId}/memberRoles`);
  const handler = (snap: { exists: () => boolean; val: () => unknown }) => {
    if (!snap.exists()) {
      callback({});
      return;
    }
    const raw = snap.val() as Record<string, string>;
    const roles: Record<string, RoomAgencyMemberRole> = {};
    for (const [uid, role] of Object.entries(raw)) {
      if (
        role === 'blue_supervisor' ||
        role === 'yellow_supervisor' ||
        role === 'red_member' ||
        role === 'cancelled'
      ) {
        roles[uid] = role;
      }
    }
    callback(roles);
  };
  onValue(rolesRef, handler);
  return () => off(rolesRef, 'value', handler);
}

export async function getRoomMemberRoles(roomId: string): Promise<Record<string, RoomAgencyMemberRole>> {
  const snap = await get(ref(realtimeDb, `rooms/${roomId}/memberRoles`));
  if (!snap.exists()) return {};
  const raw = snap.val() as Record<string, string>;
  const roles: Record<string, RoomAgencyMemberRole> = {};
  for (const [uid, role] of Object.entries(raw)) {
    if (
      role === 'blue_supervisor' ||
      role === 'yellow_supervisor' ||
      role === 'red_member' ||
      role === 'cancelled'
    ) {
      roles[uid] = role;
    }
  }
  return roles;
}

export type AgencyManageAction =
  | 'kick'
  | 'block'
  | 'removeMic'
  | 'mute'
  | 'cancelMembership'
  | 'assignRole';

/** وكيل الوكالة — hostUid في غرفة الوكالة */
export function isAgencyRoomAgent(
  roomData: Record<string, unknown>,
  uid: string,
): boolean {
  return String(roomData.hostUid ?? '') === uid;
}

/** مشرف إشراف (أصفر) في غرفة الوكالة */
export function isAgencyRoomSupervisorUid(
  uid: string,
  roomData: Record<string, unknown>,
  memberRoles: Record<string, RoomAgencyMemberRole> = {},
): boolean {
  if (!uid || isAgencyRoomAgent(roomData, uid)) return false;
  if (memberRoles[uid] === 'yellow_supervisor') return true;
  return isRoomYellowSupervisor(roomData as RoomHostSeatAccess, uid);
}

function isAgencyManagedRoom(roomData: Record<string, unknown>): boolean {
  // الغرفة المميزة (premiumStyle) تُدار بنفس هرمية إشراف غرف الوكالة —
  // مظهر ومزايا فقط؛ لا اقتصاد وكالة (لا agencyId على عقدتها)
  return Boolean(roomData.agencyId || roomData.isAgencyRoom || roomData.premiumStyle === true);
}

/** سبب الرفض بالعربية — null = مسموح */
export function getAgencyManageTargetDenial(
  params: {
    roomData: Record<string, unknown>;
    actorUid: string;
    targetUid: string;
    action: AgencyManageAction;
    memberRoles?: Record<string, RoomAgencyMemberRole>;
    newRole?: RoomAgencyMemberRole;
  },
): string | null {
  const { roomData, actorUid, targetUid, action } = params;
  // صاحب الغرفة غير قابل للكتم/الإدارة من أحد سواه — في كل أنواع الغرف
  // (يجب أن يسبق فحص غرف الوكالة وإلا صار المشرف يكتم المالك في الغرف الشخصية)
  if (String(roomData.hostUid ?? '') === targetUid && actorUid !== targetUid) return 'لا يمكن كتم أو إدارة صاحب الغرفة';
  if (!isAgencyManagedRoom(roomData)) return null;
  if (!actorUid || !targetUid || actorUid === targetUid) {
    return 'لا يمكن تنفيذ هذا الإجراء على نفسك';
  }

  const memberRoles = params.memberRoles ?? {};
  const targetIsAgent = isAgencyRoomAgent(roomData, targetUid);
  const targetIsSupervisor = isAgencyRoomSupervisorUid(targetUid, roomData, memberRoles);
  const actorIsAgent = isAgencyRoomAgent(roomData, actorUid);
  const actorIsSupervisor = isAgencyRoomSupervisorUid(actorUid, roomData, memberRoles);

  if (targetIsAgent) {
    return 'لا يمكن طرد أو إدارة الوكيل';
  }

  if (actorIsSupervisor && !actorIsAgent) {
    if (targetIsSupervisor) {
      return 'لا يمكن طرد أو إدارة مشرف إشراف آخر';
    }
    if (action === 'assignRole' && params.newRole === 'yellow_supervisor') {
      return 'فقط الوكيل يمكن تعيين صلاحية الإشراف';
    }
    return null;
  }

  if (actorIsAgent && targetIsSupervisor) {
    // #1: الوكيل والمشرف لا يكتمان بعضهما — كتم الوكيل للمشرف ممنوع
    // (كتم المشرف للوكيل ممنوع أصلاً عبر فرع targetIsAgent أعلاه).
    if (action === 'mute') {
      return 'لا يمكن كتم مشرف الإشراف';
    }
    const mustDemoteFirst =
      action === 'kick'
      || action === 'block'
      || action === 'removeMic'
      || action === 'cancelMembership'
      || (action === 'assignRole' && params.newRole === 'cancelled');
    if (mustDemoteFirst) {
      return 'يجب تنزيل المشرف إلى عضو أولاً قبل إنهاء عضويته أو طرده';
    }
    return null;
  }

  if (targetIsSupervisor && !actorIsAgent) {
    return 'فقط الوكيل يمكن إدارة مشرفي الإشراف';
  }

  if (action === 'assignRole' && params.newRole === 'yellow_supervisor' && !actorIsAgent) {
    return 'فقط الوكيل يمكن تعيين صلاحية الإشراف';
  }

  return null;
}

export function canAgencyManageTarget(
  roomData: Record<string, unknown> | null | undefined,
  actorUid: string | undefined,
  targetUid: string,
  action: AgencyManageAction,
  memberRoles?: Record<string, RoomAgencyMemberRole>,
  staff?: PlatformStaffUser | null,
  roomCountry?: string | null,
  newRole?: RoomAgencyMemberRole,
): boolean {
  if (!roomData || !actorUid || !targetUid) return false;
  if (staffCanKickOrManageUsers(staff, roomCountry)) return true;
  return getAgencyManageTargetDenial({
    roomData,
    actorUid,
    targetUid,
    action,
    memberRoles,
    newRole,
  }) === null;
}

export async function assertAgencyManageTargetAllowed(
  roomId: string,
  targetUid: string,
  action: AgencyManageAction,
  roomData?: Record<string, unknown>,
  extra?: { newRole?: RoomAgencyMemberRole; memberRoles?: Record<string, RoomAgencyMemberRole> },
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  let data = roomData;
  if (!data) {
    const snap = await get(ref(realtimeDb, `rooms/${roomId}`));
    if (!snap.exists()) throw new Error('الغرفة غير موجودة');
    data = snap.val() as Record<string, unknown>;
  }

  const userSnap = await getDoc(doc(firestore, 'users', user.uid));
  const staff = parseStaffFromUserData(userSnap.exists() ? userSnap.data() : null);
  const roomCountry = resolveRoomCountry(data as { country?: string; agencyId?: string }, null);
  if (staffCanKickOrManageUsers(staff, roomCountry)) return;

  const memberRoles = extra?.memberRoles ?? await getRoomMemberRoles(roomId);
  const denial = getAgencyManageTargetDenial({
    roomData: data,
    actorUid: user.uid,
    targetUid,
    action,
    memberRoles,
    newRole: extra?.newRole,
  });
  if (denial) throw new Error(denial);
}

async function resolveAgencyRoomSupervisorCap(
  roomData: Record<string, unknown>,
): Promise<{ cap: number; agencyLevel: number }> {
  const agencyId = String(roomData.agencyId ?? '').trim();
  let agencyLevel = Number(roomData.agencyPeriodLevel) || 0;
  if (agencyId) {
    agencyLevel = await getAgencyEffectivePeriodLevel(agencyId);
  }
  agencyLevel = Math.max(1, agencyLevel || 1);

  const levelsSnap = await getDoc(doc(firestore, 'config', 'agencyLevels'));
  const levelsCfg = resolveAgencyLevelsConfig(
    levelsSnap.exists() ? (levelsSnap.data() as Record<string, unknown>) : null,
  );

  const hostUid = String(roomData.hostUid ?? '');
  const hostHasExtra = hostUid
    ? await checkUserHasVipFeature(hostUid, 'extraRoomAdmins')
    : false;
  const cap = resolveSupervisorCapForLevel(agencyLevel, levelsCfg, { vipExtra: hostHasExtra });
  return { cap, agencyLevel };
}

export async function setRoomAgencyMemberRole(
  roomId: string,
  targetUid: string,
  role: RoomAgencyMemberRole,
): Promise<void> {
  const roomData = await assertCanManageRoomRoles(roomId);
  const memberRoles = await getRoomMemberRoles(roomId);
  await assertAgencyManageTargetAllowed(roomId, targetUid, 'assignRole', roomData, {
    newRole: role,
    memberRoles,
  });

  if (role === 'yellow_supervisor') {
    const otherSupervisors = supervisorUids(memberRoles).filter((u) => u !== targetUid).length;
    const { cap, agencyLevel } = await resolveAgencyRoomSupervisorCap(roomData);
    if (otherSupervisors + 1 > cap) {
      throw new Error(
        `بلغت الحد الأقصى لمشرفي الإشراف (${cap}) لمستوى الوكالة الحالي (LV.${agencyLevel})`,
      );
    }
  }

  const rolesRef = ref(realtimeDb, `rooms/${roomId}/memberRoles`);
  try {
    await runTransaction(rolesRef, (current) => {
      const roles = (current as Record<string, string> | null) ?? {};
      roles[targetUid] = role;
      return roles;
    });

    const all = await getRoomMemberRoles(roomId);
    await syncCoHostsFromRoles(roomId, all);
  } catch (e) {
    // قواعد RTDB قد ترفض مشرفاً موجوداً في coHosts دون memberRoles —
    // رسالة عربية مفهومة بدل PERMISSION_DENIED الخام (#84)
    throw new Error(friendlyErrorMessage(e));
  }
}

export async function updateRoomPermissions(
  roomId: string,
  updates: Partial<RoomPermissions>,
): Promise<void> {
  const roomData = await assertCanEditRoomSettings(roomId);
  const user = auth.currentUser!;
  const isHost = roomData.hostUid === user.uid;
  const perms = parseRoomPermissions(roomData);
  if (!isHost && !perms.moderatorsCanChangeSettings) {
    throw new Error('المشرفون غير مسموح لهم بتغيير الإعدادات');
  }
  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) patch[`permissions/${k}`] = v;
  }
  await update(ref(realtimeDb, `rooms/${roomId}`), patch);
}

async function readAgencyMaxSeatsCount(agencyId: string): Promise<number | undefined> {
  if (!agencyId) return undefined;
  try {
    const snap = await getDoc(doc(firestore, 'agencies', agencyId));
    if (!snap.exists()) return undefined;
    const max = Number(snap.data()?.maxSeatsCount);
    return ALLOWED_SEAT_COUNTS.includes(max as AllowedSeatCount) ? max : undefined;
  } catch {
    return undefined;
  }
}

/** الحد الفعّال = الأعلى بين غرفة RTDB ووثيقة الوكالة */
export async function resolveEffectiveMaxSeatsCount(
  roomData: Record<string, unknown>,
): Promise<number> {
  const agencyId = String(roomData.agencyId ?? '');
  const agencyMax = agencyId ? await readAgencyMaxSeatsCount(agencyId) : undefined;
  return resolveRoomMaxSeatsCount(roomData, agencyMax);
}

/** يزامن maxSeatsCount على الغرفة من حد الوكالة إن كان أعلى */
export async function syncAgencyMaxSeatsToRoom(
  roomId: string,
  agencyId: string,
): Promise<number> {
  const agencyMax = await readAgencyMaxSeatsCount(agencyId);
  const roomRef = ref(realtimeDb, `rooms/${roomId}`);
  const roomSnap = await get(roomRef);
  if (!roomSnap.exists()) {
    return resolveRoomMaxSeatsCount(null, agencyMax);
  }
  const roomData = roomSnap.val() as Record<string, unknown>;
  const effective = resolveRoomMaxSeatsCount(roomData, agencyMax);
  const roomMax = Number(roomData.maxSeatsCount) || 0;
  if (effective > roomMax && ALLOWED_SEAT_COUNTS.includes(effective as AllowedSeatCount)) {
    await update(roomRef, { maxSeatsCount: effective, updatedAt: Date.now() });
  }
  return effective;
}

/** مدير الوكالة أو مشرف الإشراف (الأصفر) — يفعّل 9/11/16/19/21 مباشرة دون طلب الإدارة */
export function canDirectlySetAgencySeatLimit(
  roomData: Record<string, unknown> | null | undefined,
  uid: string | undefined,
): boolean {
  if (!uid || !roomData) return false;
  const isAgency = Boolean(roomData.agencyId || roomData.isAgencyRoom);
  if (!isAgency) return false;
  return (
    canJoinHostSeat(roomData as RoomHostSeatAccess, uid) ||
    isEffectiveSupervisor(roomData, uid)
  );
}

/** رفع حد المايكات وتطبيق العدد — للوكالة فقط (مدير/إشراف) */
export async function applyAgencySeatsDirectly(
  roomId: string,
  agencyId: string,
  seatsCount: AllowedSeatCount,
): Promise<void> {
  // إدارة توزيع المايكات تكفيها صلاحية إدارة المايكات (وليس تغيير الإعدادات فقط)
  const roomData = await assertCanManageSeatLayout(roomId);
  const user = auth.currentUser!;
  if (!canDirectlySetAgencySeatLimit(roomData, user.uid)) {
    throw new Error('غير مسموح بتغيير عدد المايكات مباشرة');
  }
  if (!ALLOWED_SEAT_COUNTS.includes(seatsCount)) {
    throw new Error('عدد المايكات غير مدعوم');
  }

  const currentRoomMax = Number(roomData.maxSeatsCount) || 9;
  const newRoomMax = Math.max(currentRoomMax, seatsCount);

  const isOwner = String(roomData.hostUid ?? '') === user.uid;
  if (isOwner && agencyId) {
    try {
      const agencyRef = doc(firestore, 'agencies', agencyId);
      const agencySnap = await getDoc(agencyRef);
      if (agencySnap.exists()) {
        const agencyMax = Number(agencySnap.data()?.maxSeatsCount) || 9;
        if (seatsCount > agencyMax) {
          await updateDoc(agencyRef, { maxSeatsCount: seatsCount, updatedAt: Date.now() });
        }
      }
    } catch {
      /* غرفة RTDB تكفي إن فشل تحديث الوكالة */
    }
  }

  const patch: Record<string, unknown> = {
    updatedAt: Date.now(),
    maxSeatsCount: newRoomMax,
    seatsCount,
  };
  const currentCount = Number(roomData.seatsCount) || 9;
  if (seatsCount !== currentCount) {
    patch.seats = rebuildSeatsForCountChange(roomData, seatsCount);
  }
  await update(ref(realtimeDb, `rooms/${roomId}`), patch);
}

export async function updateRoomManagedSettings(
  roomId: string,
  updates: {
    name?: string;
    welcomeMessage?: string;
    mode?: 'public' | 'friend' | 'locked';
    isPrivate?: boolean;
    password?: string | null;
    seatsCount?: AllowedSeatCount;
    seatFee?: number;
    announcement?: { title: string; content: string; autoShow: boolean };
    throneEnabled?: boolean;
    secondHostMic?: boolean;
  },
): Promise<void> {
  // تعديل عدد/توزيع المايكات فقط؟ تكفيه صلاحية إدارة المايكات (#6)
  const micLayoutOnly =
    updates.seatsCount != null &&
    updates.name == null &&
    updates.welcomeMessage == null &&
    updates.mode == null &&
    updates.isPrivate == null &&
    updates.password === undefined &&
    updates.seatFee == null &&
    updates.announcement == null &&
    updates.throneEnabled == null &&
    updates.secondHostMic == null;
  const roomData = micLayoutOnly
    ? await assertCanManageSeatLayout(roomId)
    : await assertCanEditRoomSettings(roomId);
  const user = auth.currentUser!;
  const isHost = roomData.hostUid === user.uid;
  const perms = parseRoomPermissions(roomData);

  if (!micLayoutOnly && !isHost && !perms.moderatorsCanChangeSettings) {
    throw new Error('المشرفون غير مسموح لهم بتغيير الإعدادات');
  }
  if (updates.mode != null && !isHost && !perms.moderatorsCanChangeMode) {
    throw new Error('المشرفون غير مسموح لهم بتغيير وضع الغرفة');
  }
  if (updates.throneEnabled != null && !isHost) {
    throw new Error('فقط صاحب الوكالة يمكنه تفعيل العرش');
  }
  if (updates.secondHostMic != null && !isHost) {
    throw new Error('فقط صاحب الوكالة يمكنه التحكم بمايك المدير الثاني');
  }
  const patch: Record<string, unknown> = { updatedAt: Date.now() };

  if (updates.throneEnabled === true) {
    let level = Number(roomData.agencyPeriodLevel) || 0;
    if (!isAgencyThroneUnlockedByLevel(level)) {
      const agencyId = String(roomData.agencyId ?? '');
      level = agencyId
        ? await getAgencyEffectivePeriodLevel(agencyId)
        : 0;
      patch.agencyPeriodLevel = level;
    }
    if (!isAgencyThroneUnlockedByLevel(level)) {
      throw new Error(`كرسي العرش يفتح عند مستوى الوكالة ${AGENCY_THRONE_UNLOCK_LEVEL}`);
    }
  }
  if (updates.name != null) patch.name = updates.name;
  if (updates.welcomeMessage != null) patch.welcomeMessage = updates.welcomeMessage;
  if (updates.mode != null) {
    patch.mode = updates.mode;
    patch.isPrivate = updates.mode === 'locked';
  }
  if (updates.password !== undefined) patch.password = updates.password ?? '';
  // غرفة مقفلة بلا كلمة مرور تتجاوزها بوابة الدخول — نرفض الحفظ
  if (updates.mode === 'locked') {
    const finalPassword = String(
      updates.password !== undefined ? updates.password ?? '' : roomData.password ?? '',
    ).trim();
    if (!finalPassword) {
      throw new Error('يجب تعيين كلمة مرور للغرفة المقفلة');
    }
  }
  if (updates.seatsCount != null) {
    const maxAllowed = await resolveEffectiveMaxSeatsCount(roomData);
    if (updates.seatsCount > maxAllowed) {
      throw new Error(`الحد الأقصى المسموح ${maxAllowed} مايك — تواصل مع الإدارة لزيادة الحد`);
    }
    patch.seatsCount = updates.seatsCount;
    const currentCount = Number(roomData.seatsCount) || 9;
    if (updates.seatsCount !== currentCount) {
      patch.seats = rebuildSeatsForCountChange(roomData, updates.seatsCount);
    }
  }
  if (updates.seatFee != null) {
    // #16: بلا سقف منتج — فقط حماية نوع البيانات (أقصى عدد صحيح آمن)
    patch.seatFee = Math.min(
      Number.MAX_SAFE_INTEGER,
      Math.max(0, Math.floor(Number(updates.seatFee) || 0)),
    );
  }
  if (updates.announcement != null) patch.announcement = updates.announcement;
  if (updates.throneEnabled != null) patch.throneEnabled = updates.throneEnabled;
  if (updates.secondHostMic != null) {
    const owned =
      roomData.secondHostMicOwned === true || roomData.secondHostMic === true;
    if (!owned) {
      throw new Error('يجب شراء مايك المدير الثاني أولاً');
    }
    patch.secondHostMic = updates.secondHostMic;
    patch.secondHostMicOwned = true;
  }

  await update(ref(realtimeDb, `rooms/${roomId}`), patch);
}

export function canUserManageRoomSettings(
  room: Record<string, unknown> | null | undefined,
  uid: string | undefined,
): boolean {
  if (!room || !uid) return false;
  if (!canJoinHostSeat(room, uid)) return false;
  if (room.hostUid === uid) return true;
  const perms = parseRoomPermissions(room);
  return perms.moderatorsCanChangeSettings;
}

/** إزالة حظر/طرد من الغرفة — الوكيل أو مشرف بصلاحية طرد/حظر */
export function canUserManageRoomBlocks(
  room: Record<string, unknown> | null | undefined,
  uid: string | undefined,
): boolean {
  if (!room || !uid) return false;
  if (!canJoinHostSeat(room, uid)) return false;
  if (String(room.hostUid ?? '') === uid) return true;
  const perms = parseRoomPermissions(room);
  return perms.moderatorsCanKickBan || perms.moderatorsCanBlockUsers;
}

/** عرض معلومات الغرفة (Profile/Member) — صاحب الوكالة أو مشرف (إشراف أزرق/أصفر) فقط */
export function canViewRoomInformation(
  room: Record<string, unknown> | null | undefined,
  uid: string | undefined,
): boolean {
  return canJoinHostSeat(room, uid);
}
