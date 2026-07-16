/**
 * LinkUp App — Rooms Service
 * إدارة الغرف الصوتية باستخدام Firebase Realtime Database
 */

import {
  ref,
  set,
  get,
  push,
  update,
  remove,
  onValue,
  off,
  onChildAdded,
  onChildRemoved,
  query,
  orderByChild,
  limitToLast,
  limitToFirst,
  equalTo,
  endAt,
  serverTimestamp,
  onDisconnect,
  runTransaction,
  DataSnapshot,
} from 'firebase/database';
import { doc, getDoc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { realtimeDb, auth, firestore, functions } from './index';
import { resolveDisplayName } from '@/utils/displayName';
import { resolveOfficialUserAvatar } from '@/utils/userAvatar';
import { prefetchAvatarUris } from '@/utils/imageConfig';
import { buildSeatPublicData } from '@/utils/privacyDisplay';
import { toSafeInt } from '@/utils/safeNumber';
import { buildBalanceIncrementPatch, buildSocialIncrementPatch, getUserCoins } from '@/utils/userBalance';
import { clearUserFromRoom } from '@/services/roomFeatures';
import { useRoomSessionStore } from '@/stores/roomSessionStore';
import { getRoomVoiceSession } from '@/utils/roomVoiceSessionGuard';
import { canJoinHostSeat, canOccupyHostSeat } from '@/utils/roomHostSeat';
import {
  parseStaffFromUserData,
  staffCanEnterRoom,
  staffHasCountryAccess,
  staffMicFeeExempt,
  staffCanKickOrManageUsers,
  resolveRoomCountry,
  effectiveCanManageRoomUsers,
  effectiveCanOccupyHostSeat,
  type PlatformStaffUser,
} from '@/types/platformStaff';
import {
  parseRoomPermissions,
  canTakeMicSeat,
  assertAgencyManageTargetAllowed,
  type RoomPermissions,
} from './roomMemberRoles';
import { isUidAgencyMember } from '@/services/agencyService';
import { checkUserHasVipFeature, getEffectiveVipLevel } from './vipSystem';
import {
  getPrivacyConfigOnce,
  resolvePrivacyFeatures,
  canUsePrivacyFeature,
  type PrivacyFeatureKey,
} from './privacySettings';
import { readAristocracyState, isAristocracyActive } from './aristocracySystem';
import type { UserDoc } from './users';
import {
  ALLOWED_SEAT_COUNTS,
  rebuildSeatsForCountChange,
  resolveRoomMaxSeatsCount,
  buildInitialSeatsForHost,
  isSeatLocked,
  parseLockedSeats,
  SECOND_HOST_SEAT_INDEX,
  canOccupySecondHostSeat,
  canAssignUserToSecondHostSeat,
  parseSecondHostAllowedUids,
  type AllowedSeatCount,
} from './roomSeats';
import { resolveEffectiveMaxSeatsCount } from './roomMemberRoles';
export {
  ALLOWED_SEAT_COUNTS,
  rebuildSeatsForCountChange,
  resolveRoomMaxSeatsCount,
  isSeatLocked,
  SECOND_HOST_SEAT_INDEX,
  canOccupySecondHostSeat,
  type AllowedSeatCount,
} from './roomSeats';
import {
  computeBlockedUntil,
  formatBlockRemaining,
  isRoomBlockActive,
  type RoomBlockDuration,
} from '@/utils/roomBlockDuration';

/** آخر مقعد سُجّل له onDisconnect على هذا الجهاز */
let seatDisconnectBound: { roomId: string; seatIdx: number } | null = null;

async function cancelSeatOnDisconnect(roomId: string, seatIdx: number): Promise<void> {
  try {
    await onDisconnect(ref(realtimeDb, `rooms/${roomId}/seats/seat_${seatIdx}`)).cancel();
  } catch {
    // ignore
  }
}

async function loadStaffFieldsForUid(uid: string): Promise<PlatformStaffUser> {
  const snap = await getDoc(doc(firestore, 'users', uid));
  return parseStaffFromUserData(snap.exists() ? snap.data() : null);
}

async function resolveRoomCountryForRoomId(roomId: string): Promise<string> {
  const roomSnap = await get(ref(realtimeDb, `rooms/${roomId}`));
  const room = (roomSnap.val() ?? {}) as { country?: string; agencyId?: string };
  let agencyCountry: string | undefined;
  const agencyId = String(room.agencyId ?? '');
  if (agencyId) {
    const agencySnap = await getDoc(doc(firestore, 'agencies', agencyId));
    if (agencySnap.exists()) {
      agencyCountry = String(agencySnap.data()?.country ?? '');
    }
  }
  return resolveRoomCountry(room, agencyCountry);
}

async function assertStaffCanEnterRoom(roomId: string, uid: string): Promise<void> {
  const staff = await loadStaffFieldsForUid(uid);
  if (!staff.staffRole || staff.staffRole === 'manager') return;
  const roomCountry = await resolveRoomCountryForRoomId(roomId);
  if (!staffCanEnterRoom(staff, roomCountry)) {
    throw new Error('هذه الغرفة خارج نطاق دولتك');
  }
}

/** إفراغ المقعد تلقائياً عند قطع اتصال RTDB */
async function bindSeatOnDisconnect(roomId: string, seatIdx: number): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  if (
    seatDisconnectBound &&
    (seatDisconnectBound.roomId !== roomId || seatDisconnectBound.seatIdx !== seatIdx)
  ) {
    await cancelSeatOnDisconnect(seatDisconnectBound.roomId, seatDisconnectBound.seatIdx);
  }

  const seatRef = ref(realtimeDb, `rooms/${roomId}/seats/seat_${seatIdx}`);
  // لا نُفرّغ المقعد فوراً عند انقطاع RTDB العابر (شبكة تتذبذب والمستخدم يتحدث عبر
  // جلسة الصوت على اتصال مستقل!) — نضع علامة انقطاع فقط، والمقعد يُفرَّغ بعد مهلة سماح
  // في pruneStaleRoomSeats إن لم يعُد. هذا يمنع «النزول التلقائي من المايك بدون سبب».
  await onDisconnect(seatRef).update({ disconnectedAt: serverTimestamp() });
  // عدنا متصلين الآن — امسح أي علامة انقطاع سابقة
  await update(seatRef, { disconnectedAt: null }).catch(() => {});

  const holdRef = ref(realtimeDb, `roomSeatHold/${roomId}/${user.uid}`);
  await set(holdRef, { seatIdx, at: Date.now() });
  await onDisconnect(holdRef).remove();

  seatDisconnectBound = { roomId, seatIdx };
}

/** إيجاد مقعد المستخدم الحالي في غرفة محددة */
export async function findMySeatInRoom(
  roomId: string,
): Promise<number | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await get(ref(realtimeDb, `rooms/${roomId}/seats`));
  if (!snap.exists()) return null;
  const seats = snap.val() as Record<string, { uid?: string; joinedAt?: number }>;
  let bestKey: string | null = null;
  let bestJoined = -1;
  for (const [key, s] of Object.entries(seats)) {
    if (s?.uid !== user.uid) continue;
    const joined = Number(s.joinedAt) || 0;
    if (bestKey == null || joined >= bestJoined) {
      bestKey = key;
      bestJoined = joined;
    }
  }
  if (bestKey == null) return null;
  return parseInt(bestKey.replace('seat_', ''), 10);
}

/**
 * هل المستخدم جالس على أي مقعد في الغرفة الآن؟ — قراءة لحظية من RTDB
 * (نافذة موافقة الفيديو تتحقق أن الطالب ما زال على المايك لحظة العرض)
 */
export async function isUserOnRoomSeat(roomId: string, uid: string): Promise<boolean> {
  if (!roomId || !uid) return false;
  const snap = await get(ref(realtimeDb, `rooms/${roomId}/seats`));
  if (!snap.exists()) return false;
  const seats = snap.val() as Record<string, { uid?: string }>;
  return Object.values(seats).some((s) => s?.uid === uid);
}

/**
 * «ابقَ في الروم» — إلغاء onDisconnect مؤقتاً حتى لا يُفرَّغ المقعد عند انقطاع RTDB العابر
 * (تنقّل داخل التطبيق، هدايا، موسيقى، خلفية).
 */
export async function pinRoomSession(roomId: string): Promise<void> {
  await suspendRoomOnDisconnectForBackground(roomId);
}

/** إعادة ربط onDisconnect بعد العودة من التصغير لشاشة الروم */
export async function rebindRoomOnDisconnectHandlers(roomId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const audienceRef = ref(realtimeDb, `roomAudience/${roomId}/${user.uid}`);
  const audSnap = await get(audienceRef);
  if (audSnap.exists()) {
    await onDisconnect(audienceRef).remove();
  }

  const seatIdx = await findMySeatInRoom(roomId);
  if (seatIdx !== null) {
    await bindSeatOnDisconnect(roomId, seatIdx);
  }
}

let rtdbRecoveryInstalled = false;
let rtdbRecoveryInFlight: Promise<void> | null = null;
let lastRtdbRecoveryAt = 0;

/** يستعيد الحضور والمقعد بعد انقطاع RTDB العابر — يُستدعى عند `.info/connected` */
export async function recoverRoomPresenceAfterRtdbReconnect(): Promise<void> {
  const now = Date.now();
  if (rtdbRecoveryInFlight && now - lastRtdbRecoveryAt < 2000) {
    return rtdbRecoveryInFlight;
  }
  lastRtdbRecoveryAt = now;
  rtdbRecoveryInFlight = doRecoverRoomPresenceAfterRtdbReconnect().finally(() => {
    rtdbRecoveryInFlight = null;
  });
  return rtdbRecoveryInFlight;
}

async function doRecoverRoomPresenceAfterRtdbReconnect(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const vs = getRoomVoiceSession();
  const session = useRoomSessionStore.getState();
  const roomId = vs.roomId ?? session.roomId;
  if (!roomId) return;
  if (!vs.active && !session.audioPinned && !(session.roomId === roomId && session.canPublish)) return;

  await joinAudience(roomId).catch(() => {});

  const currentSeat = await findMySeatInRoom(roomId);
  if (currentSeat !== null) {
    // عدنا خلال مهلة السماح — امسح علامة الانقطاع حتى لا يُفرّغنا pruneStaleRoomSeats
    await update(ref(realtimeDb, `rooms/${roomId}/seats/seat_${currentSeat}`), {
      disconnectedAt: null,
    }).catch(() => {});
    if (session.canPublish || vs.canSpeak) {
      await suspendRoomOnDisconnectForBackground(roomId);
    } else {
      await bindSeatOnDisconnect(roomId, currentSeat);
    }
    return;
  }

  if (session.canPublish || vs.canSpeak) {
    const preferredIdx = session.micSeatIndex;
    if (preferredIdx != null) {
      await restoreMicSeatAfterDisconnect(roomId, preferredIdx).catch(() => {});
      return;
    }
    await ensureHostOnSeat(roomId).catch(() => {});
    return;
  }

  await rebindRoomOnDisconnectHandlers(roomId).catch(() => {});
}

/** استعادة مقعد فارغ بعد إفراغه بسبب onDisconnect — بدون رسم دخول جديد */
async function restoreMicSeatAfterDisconnect(
  roomId: string,
  seatIdx: number,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const managedMicLock = await getManagedMicSeatLock(roomId, user.uid);
  if (managedMicLock?.active && managedMicLock.seatIdx === seatIdx) {
    // المايك المقيّد لا يستعيد نفسه تلقائياً بعد الانقطاع.
    await setManagedMicSeatLock(roomId, user.uid, seatIdx, false).catch(() => {});
    return;
  }

  const existing = await findMySeatInRoom(roomId);
  if (existing !== null) {
    await bindSeatOnDisconnect(roomId, existing);
    return;
  }

  const seatRef = ref(realtimeDb, `rooms/${roomId}/seats/seat_${seatIdx}`);
  const seatSnap = await get(seatRef);
  const occupant = (seatSnap.val() as { uid?: string } | null)?.uid;
  if (occupant && occupant !== '' && occupant !== user.uid) {
    await ensureHostOnSeat(roomId).catch(() => {});
    return;
  }

  const roomSnap = await get(ref(realtimeDb, `rooms/${roomId}`));
  if (!roomSnap.exists()) return;
  const roomData = roomSnap.val() as Record<string, unknown>;

  const { getUser } = await import('./users');
  const userData = await getUser(user.uid);
  const displayName = resolveDisplayName(
    {
      displayName:
        userData?.displayName ?? user.displayName,
      email: userData?.email ?? user.email ?? undefined,
    },
    String(roomData.hostName ?? 'مستخدم'),
  );
  const avatar =
    resolveOfficialUserAvatar((userData ?? {}) as Record<string, unknown>, user.uid)
    || user.photoURL
    || String(roomData.hostAvatar ?? 'https://i.pravatar.cc/200?img=12');

  // مضيف الغرفة يستعيد مقعده — حدّث لقطة الغرفة باسمه/صورته الطازجين (b10)
  if (String(roomData.hostUid ?? '') === user.uid) {
    void refreshRoomHostSnapshot(roomId, roomData, displayName, avatar);
  }

  const seatPayload = buildSeatPublicData(
    (userData ?? {}) as Record<string, unknown>,
    user.uid,
    displayName,
    avatar,
    userData ? getUserCoinsFromData(userData) : 0,
  );

  await joinAudience(roomId).catch(() => {});
  await transactionAssignSeat(roomId, seatIdx, user.uid, {
    ...seatPayload,
    joinedAt: Date.now(),
  });
  await bindSeatOnDisconnect(roomId, seatIdx);
  await reconcileAudienceCount(roomId);
}

/** مستمع عام — يُثبَّت مرة واحدة من RoomBackgroundKeepAlive */
export function installRoomRtdbReconnectRecovery(): void {
  if (rtdbRecoveryInstalled) return;
  rtdbRecoveryInstalled = true;
  const connRef = ref(realtimeDb, '.info/connected');
  onValue(connRef, (snap) => {
    if (snap.val() !== true) return;
    void recoverRoomPresenceAfterRtdbReconnect().catch(() => {});
  });
}

/** إلغاء onDisconnect مؤقتاً عند إرسال التطبيق للخلفية — يمنع إفراغ المقعد/الحضور عند انقطاع RTDB العابر */
export async function suspendRoomOnDisconnectForBackground(roomId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !roomId) return;

  const audienceRef = ref(realtimeDb, `roomAudience/${roomId}/${user.uid}`);
  try {
    await onDisconnect(audienceRef).cancel();
  } catch {
    // ignore
  }

  const seatIdx = await findMySeatInRoom(roomId);
  if (seatIdx === null) return;
  await cancelSeatOnDisconnect(roomId, seatIdx);
  // أبقِ roomSeatHold درعاً أثناء التعليق — onDisconnect كان يحذفه عند أي
  // انقطاع بالخلفية فيمسح الكنّاس المقعد رغم أن الغياب مقصود ومؤقت.
  // يُعاد ربطه في bindSeatOnDisconnect عند العودة (rebind/recover).
  try {
    await onDisconnect(ref(realtimeDb, `roomSeatHold/${roomId}/${user.uid}`)).cancel();
  } catch {
    // ignore
  }
  if (
    seatDisconnectBound?.roomId === roomId &&
    seatDisconnectBound.seatIdx === seatIdx
  ) {
    seatDisconnectBound = null;
  }
}

/**
 * مغادرة المقعد + الجمهور + presence — عند الخروج أو إغلاق التطبيق
 * (لا يُستدعى أثناء «ابقَ في الروم» — audioPinned)
 */
export async function releaseRoomMembership(roomId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const audienceRef = ref(realtimeDb, `roomAudience/${roomId}/${user.uid}`);

  await Promise.all([
    (async () => {
      const seatIdx = await findMySeatInRoom(roomId);
      if (seatIdx === null) return;
      await cancelSeatOnDisconnect(roomId, seatIdx);
      await remove(ref(realtimeDb, `roomSeatHold/${roomId}/${user.uid}`)).catch(() => {});
      if (
        seatDisconnectBound?.roomId === roomId &&
        seatDisconnectBound.seatIdx === seatIdx
      ) {
        seatDisconnectBound = null;
      }
      await set(ref(realtimeDb, `rooms/${roomId}/seats/seat_${seatIdx}`), { uid: '' });
      const managedMicLock = await getManagedMicSeatLock(roomId, user.uid);
      if (managedMicLock?.active && managedMicLock.seatIdx === seatIdx) {
        await setManagedMicSeatLock(roomId, user.uid, seatIdx, false).catch(() => {});
      }
    })(),
    (async () => {
      try {
        await onDisconnect(audienceRef).cancel();
      } catch {
        // ignore
      }
      await remove(audienceRef).catch(() => {});
    })(),
    vacateSeatsForUid(roomId, user.uid).catch(() => {}),
    clearUserFromRoom().catch(() => {}),
    set(ref(realtimeDb, `rooms/${roomId}/seatSupport/${user.uid}`), null).catch(() => {}),
  ]);

  scheduleReconcileAudienceCount(roomId);
}

/**
 * يضع المضيف على مقعد 0 فقط إذا لم يكن على أي مقعد — لا يُجبره على العودة للوسط
 */
/**
 * تحديث لقطة hostName/hostAvatar على مستوى الغرفة عند الاختلاف — كانت تُكتب
 * عند الإنشاء فقط فتبقى بطاقات الغرف تعرض اسماً/صورة قديمين بعد تغيير الملف.
 * كتابة خفيفة فقط عند تغيّر فعلي، من بيانات مستخدم مجلوبة أصلاً (صفر قراءات إضافية).
 */
async function refreshRoomHostSnapshot(
  roomId: string,
  roomData: Record<string, unknown>,
  freshName?: string,
  freshAvatar?: string,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (freshName && freshName !== String(roomData.hostName ?? '')) patch.hostName = freshName;
  if (freshAvatar && freshAvatar !== String(roomData.hostAvatar ?? '')) patch.hostAvatar = freshAvatar;
  if (Object.keys(patch).length === 0) return;
  patch.updatedAt = Date.now();
  await update(ref(realtimeDb, `rooms/${roomId}`), patch).catch(() => {});
}

export async function ensureHostOnSeat(roomId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const roomSnap = await get(ref(realtimeDb, `rooms/${roomId}`));
  if (!roomSnap.exists()) return;
  const room = roomSnap.val() as Record<string, unknown>;
  if (room.hostUid !== user.uid) return;
  if (!canOccupyHostSeat(room, user.uid)) return;

  const mySeatIdx = await findMySeatInRoom(roomId);
  if (mySeatIdx !== null) {
    await bindSeatOnDisconnect(roomId, mySeatIdx);
    return;
  }

  const { getUser } = await import('./users');
  const userData = await getUser(user.uid);
  const displayName = resolveDisplayName(
    {
      displayName: userData?.displayName ?? user.displayName,
      email: userData?.email ?? user.email ?? undefined,
    },
    String(room.hostName ?? 'مضيف'),
  );
  const avatar = resolveOfficialUserAvatar(
    (userData ?? {}) as Record<string, unknown>,
    user.uid,
  ) || user.photoURL || String(room.hostAvatar ?? 'https://i.pravatar.cc/200?img=12');

  // مزامنة لقطة الغرفة مع اسم/صورة المضيف الطازجين (b10)
  void refreshRoomHostSnapshot(roomId, room, displayName, avatar);

  const seatPayload = buildSeatPublicData(
    (userData ?? {}) as Record<string, unknown>,
    user.uid,
    displayName,
    avatar,
    userData ? getUserCoinsFromData(userData) : 0,
  );
  await transactionAssignSeat(roomId, 0, user.uid, { ...seatPayload });

  await bindSeatOnDisconnect(roomId, 0);
  await reconcileAudienceCount(roomId);
}

/** تطبيع غرفة من Realtime DB — يمنع NaN في الواجهة */
export function normalizeRoomFromRtdb(id: string, raw: Record<string, unknown>): Room {
  const seats = (raw.seats as Room['seats']) ?? {};
  return {
    id,
    name: String(raw.name ?? 'غرفة'),
    hostUid: String(raw.hostUid ?? ''),
    hostName: String(raw.hostName ?? 'مضيف'),
    hostAvatar: String(raw.hostAvatar ?? ''),
    country: String(raw.country ?? 'WW'),
    category: (raw.category as Room['category']) ?? 'general',
    banner: raw.banner ? String(raw.banner) : undefined,
    isPrivate: Boolean(raw.isPrivate),
    password: raw.password ? String(raw.password) : undefined,
    seatsCount: toSafeInt(raw.seatsCount, 9),
    seats,
    lockedSeats: parseLockedSeats(raw),
    audienceCount: toSafeInt(raw.audienceCount),
    audience: raw.audience as Room['audience'],
    totalGifts: toSafeInt(raw.totalGifts),
    createdAt: toSafeInt(raw.createdAt),
    updatedAt: toSafeInt(raw.updatedAt),
    isActive: raw.isActive !== false,
    agencyId: raw.agencyId ? String(raw.agencyId) : undefined,
    isAgencyRoom: raw.isAgencyRoom === true || !!raw.agencyId,
    premiumStyle: raw.premiumStyle === true,
    coHosts: Array.isArray(raw.coHosts)
      ? (raw.coHosts as unknown[]).map((id) => String(id)).filter(Boolean)
      : [],
    background: raw.background ? String(raw.background) : undefined,
    frameId: raw.frameId ? String(raw.frameId) : undefined,
    mode: (raw.mode as Room['mode']) ?? undefined,
    welcomeMessage: raw.welcomeMessage ? String(raw.welcomeMessage) : undefined,
    announcement: (raw.announcement as Room['announcement']) ?? undefined,
    seatFee: typeof raw.seatFee === 'number' ? raw.seatFee : undefined,
    permissions: parseRoomPermissions(raw),
    throneEnabled: raw.throneEnabled === true,
    secondHostMic: raw.secondHostMic === true,
    secondHostMicOwned: raw.secondHostMicOwned === true || raw.secondHostMic === true,
    secondHostAllowedUids: parseSecondHostAllowedUids(raw),
    agencyPeriodLevel: Number(raw.agencyPeriodLevel) > 0 ? Number(raw.agencyPeriodLevel) : undefined,
    maxSeatsCount: ALLOWED_SEAT_COUNTS.includes(Number(raw.maxSeatsCount) as AllowedSeatCount)
      ? (Number(raw.maxSeatsCount) as AllowedSeatCount)
      : undefined,
    vanityId: raw.vanityId ? String(raw.vanityId) : undefined,
    chatMutedUsers: parseChatMutedUsers(raw),
  };
}

export function parseChatMutedUsers(
  raw: Record<string, unknown>,
): Record<string, RoomChatMutedEntry> | undefined {
  const map = raw.chatMutedUsers as Record<string, unknown> | undefined;
  if (!map || typeof map !== 'object') return undefined;
  const out: Record<string, RoomChatMutedEntry> = {};
  for (const [uid, entry] of Object.entries(map)) {
    if (entry === true) {
      out[uid] = { mutedAt: Date.now() };
    } else if (entry && typeof entry === 'object') {
      out[uid] = entry as RoomChatMutedEntry;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export function isRoomChatMuted(
  room: Pick<Room, 'chatMutedUsers'> | null | undefined,
  uid: string,
): boolean {
  if (!uid || !room?.chatMutedUsers) return false;
  return Boolean(room.chatMutedUsers[uid]);
}

async function assertUserCanSendRoomChat(roomId: string, uid: string): Promise<void> {
  const snap = await get(ref(realtimeDb, `rooms/${roomId}/chatMutedUsers/${uid}`));
  if (snap.exists()) {
    throw new Error('تم إيقاف الكتابة والتعليقات لك في هذه الغرفة');
  }
}

/**
 * تعيين معرّف غرفة مميز (vanity) — امتياز SVIP «أيدي غرفة مميز».
 * يتطلب أن يكون المستخدم مالك الغرفة وأن يملك الامتياز.
 */
export const setRoomVanityId = async (roomId: string, vanityId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  const id = vanityId.trim().replace(/[^0-9]/g, '').slice(0, 9);
  if (id.length < 4) throw new Error('المعرّف يجب أن يكون 4 أرقام على الأقل');
  const roomData = await assertCanManageRoom(roomId);
  if (String(roomData.hostUid ?? '') !== user.uid) {
    throw new Error('فقط مالك الغرفة يمكنه تعيين المعرّف');
  }
  if (!(await checkUserHasVipFeature(user.uid, 'specialRoomId'))) {
    throw new Error('هذا الامتياز حصري لأعضاء SVIP المؤهّلين');
  }
  await update(ref(realtimeDb, `rooms/${roomId}`), { vanityId: id, updatedAt: Date.now() });
};

export function isAgencyLiveRoom(room: Pick<Room, 'isAgencyRoom' | 'agencyId'> | null | undefined): boolean {
  return !!room && (room.isAgencyRoom === true || !!room.agencyId);
}

/** غرفة مميزة: شكل/مزايا غرفة الوكالة بلا أي اقتصاد وكالة (لا agencyId إطلاقاً —
 *  كل مسارات الدعم/المحفظة/اللآلئ تُقفل من عدم وجوده). تُمنح من لوحة التحكم فقط
 *  (premiumStyle:true على عقدة الغرفة؛ قرار المالك 2026-07-16). */
export function isPremiumStyleRoom(
  room: Pick<Room, 'isAgencyRoom' | 'agencyId' | 'premiumStyle'> | null | undefined,
): boolean {
  return !!room && room.premiumStyle === true && !isAgencyLiveRoom(room);
}

/** «مظهر غرفة الوكالة» — وكالة حقيقية أو غرفة مميزة (بوابات الشكل فقط، لا الاقتصاد) */
export function hasAgencyRoomLook(
  room: Pick<Room, 'isAgencyRoom' | 'agencyId' | 'premiumStyle'> | null | undefined,
): boolean {
  return isAgencyLiveRoom(room) || isPremiumStyleRoom(room);
}

/** غرفة مضيف شخصية — ليست غرفة وكالة */
export function isPersonalHostRoom(
  room: Pick<Room, 'isAgencyRoom' | 'agencyId'> | null | undefined,
): boolean {
  return !!room && !isAgencyLiveRoom(room);
}

function isPersonalHostRoomRaw(raw: Record<string, unknown>): boolean {
  if (raw.isAgencyRoom === true) return false;
  if (String(raw.agencyId ?? '').trim()) return false;
  return true;
}

function pickPreferredPersonalHostRoom(current: Room | null, candidate: Room): Room {
  if (!current) return candidate;
  const currentPrivate = current.isPrivate ? 1 : 0;
  const candidatePrivate = candidate.isPrivate ? 1 : 0;
  if (candidatePrivate > currentPrivate) return candidate;
  if (candidatePrivate < currentPrivate) return current;
  return (candidate.updatedAt ?? 0) > (current.updatedAt ?? 0) ? candidate : current;
}

/** عدد المقاعد المشغولة في الغرفة */
export function countFilledSeats(room: Room): number {
  return Object.values(room.seats ?? {}).filter((s) => {
    const uid = s?.uid;
    return typeof uid === 'string' && uid.length > 0;
  }).length;
}

export function isRoomLive(room: Room): boolean {
  return toSafeInt(room.audienceCount) > 0 || countFilledSeats(room) > 0;
}

/** اسم المستخدم الحالي من Firestore (ليس إيميل Auth) */
async function getCurrentUserDisplayName(fallback = 'مستخدم'): Promise<string> {
  const profile = await resolveSenderProfile();
  return profile.name || fallback;
}

export type RoomSenderProfile = { name: string; avatar: string };

let cachedSenderProfile: { uid: string; profile: RoomSenderProfile; at: number } | null = null;
const SENDER_PROFILE_TTL_MS = 60_000;

/** تجهيز كاش المرسل من authStore — يُسرّع شات/هدية الروم دون قراءة Firestore */
export function primeRoomSenderProfile(name: string, avatar: string): void {
  const user = auth.currentUser;
  if (!user || !name.trim()) return;
  cachedSenderProfile = {
    uid: user.uid,
    profile: { name: name.trim(), avatar: avatar ?? '' },
    at: Date.now(),
  };
}

async function resolveSenderProfile(override?: RoomSenderProfile): Promise<RoomSenderProfile> {
  if (override?.name?.trim()) {
    return { name: override.name.trim(), avatar: override.avatar ?? '' };
  }
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const now = Date.now();
  if (
    cachedSenderProfile?.uid === user.uid &&
    now - cachedSenderProfile.at < SENDER_PROFILE_TTL_MS
  ) {
    return cachedSenderProfile.profile;
  }

  const { getUser } = await import('./users');
  const me = await getUser(user.uid);
  const profile: RoomSenderProfile = {
    name: resolveDisplayName(
      {
        displayName: me?.displayName ?? user.displayName,
        email: me?.email ?? user.email ?? undefined,
      },
      'مستخدم',
    ),
    avatar: resolveOfficialUserAvatar(
      (me ?? {}) as unknown as Record<string, unknown>,
      user.uid,
    ) || user.photoURL || '',
  };
  cachedSenderProfile = { uid: user.uid, profile, at: now };
  return profile;
}

export interface RoomSeat {
  uid: string | null;
  displayName?: string;
  avatar?: string;
  isMuted?: boolean;
  isSpeaking?: boolean; // للموجات الصوتية
  isVIP?: boolean;
  vipLevel?: number;
  level?: number;
  /** رصيد العملات عند الجلوس على المقعد */
  coins?: number;
  joinedAt?: number;
}

function getUserCoinsFromData(userData: Record<string, unknown> | UserDoc): number {
  return getUserCoins(userData as Record<string, unknown>);
}

export interface Room {
  id: string;
  name: string;
  hostUid: string;
  hostName: string;
  hostAvatar: string;
  country: string;
  category: 'general' | 'music' | 'gaming' | 'study' | 'dating' | 'arabic';
  banner?: string;
  isPrivate: boolean;
  password?: string;
  seatsCount: number; // 9, 11, 16, or 19
  seats: Record<string, RoomSeat>;
  /** مقاعد مقفلة يدوياً — seat_N: true */
  lockedSeats?: Record<string, boolean>;
  audienceCount: number;
  audience?: Record<string, { uid: string; name: string; avatar: string }>;
  totalGifts: number;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
  /** غرفة البث الرسمية لوكالة */
  agencyId?: string;
  isAgencyRoom?: boolean;
  /** غرفة مميزة — مظهر غرفة الوكالة بلا اقتصادها (تُمنح من لوحة التحكم) */
  premiumStyle?: boolean;
  /** مشرفو الغرفة — يُسمح لهم بمقعد المضيف مع صاحب الغرفة/الوكالة */
  coHosts?: string[];
  /** تخصيص: خلفية الروم (رابط صورة) */
  background?: string;
  /** تخصيص: معرّف الإطار المفعّل */
  frameId?: string;
  /** وضع الروم: عام/أصدقاء/مقفل */
  mode?: 'public' | 'friend' | 'locked';
  /** رسالة الترحيب */
  welcomeMessage?: string;
  /** إعلان الروم */
  announcement?: { title: string; content: string; autoShow: boolean };
  /** رسوم دخول المقعد (عملات) */
  seatFee?: number;
  /** صلاحيات الغرفة */
  permissions?: RoomPermissions;
  /** تفعيل كرسي العرش — غرف الوكالة فقط، يفعّله صاحب الوكالة بعد مستوى 15 */
  throneEnabled?: boolean;
  /** مقعد مدير ثانٍ — يشتريه صاحب الوكالة، يظهر جنب مقعد المضيف بصلاحيات المدير */
  secondHostMic?: boolean;
  /** تم شراء مايك المدير الثاني — يبقى true حتى بعد الإيقاف المؤقت */
  secondHostMicOwned?: boolean;
  /** من عيّنهم مدير الوكالة للجلوس على مقعد المدير الثاني */
  secondHostAllowedUids?: Record<string, true>;
  /** مستوى الوكالة للفترة الحالية — يُحدَّث من الوكيل عند دخول الغرفة */
  agencyPeriodLevel?: number;
  /** الحد الأقصى للمايكات — يُحدّده الأدمن لوكالات */
  maxSeatsCount?: AllowedSeatCount;
  /** معرّف غرفة مميز (vanity) — امتياز SVIP «أيدي غرفة مميز» */
  vanityId?: string;
  /** منع الكتابة والتعليقات في شات الغرفة */
  chatMutedUsers?: Record<string, RoomChatMutedEntry | boolean>;
}

export type RoomChatMutedEntry = {
  mutedAt?: number;
  mutedBy?: string;
};

export interface RoomMessage {
  id: string;
  uid: string;
  name: string;
  avatar: string;
  text?: string;
  type: 'text' | 'gift' | 'system' | 'emoji' | 'room_game_invite' | 'agency_entry';
  emoji?: string;
  giftId?: string;
  giftName?: string;
  giftValue?: number;
  giftQuantity?: number;
  imageUrl?: string;
  animationUrl?: string;
  soundUrl?: string;
  videoUrl?: string;
  toUid?: string;
  toName?: string;
  /** دعوة لعبة روم مجانية */
  inviteSessionId?: string;
  inviteGameId?: string;
  inviteGameName?: string;
  inviteJoinCode?: string;
  inviteTargetUid?: string;
  inviteTargetName?: string;
  /** هدية جماعية — رسالة واحدة في الشات بدل رسالة لكل مستلم */
  isGroupGift?: boolean;
  recipientCount?: number;
  createdAt: number;
}

/** مدة بقاء رسائل شات الغرفة في DB — بعدها تُحذف تلقائياً */
export const ROOM_CHAT_TTL_MS = 30 * 60 * 1000;

export type RoomMessagesSubscribeOptions = {
  limit?: number;
  /** لا تُعرض رسائل أقدم من وقت دخول المستخدم للغرفة */
  sinceMs?: number;
};

export function resolveRoomMessageCreatedAt(createdAt: unknown): number {
  if (typeof createdAt === 'number' && Number.isFinite(createdAt)) return createdAt;
  return Date.now();
}

/** فلترة رسائل الشات: TTL + رسائل بعد وقت الدخول فقط */
export function filterRoomMessagesForViewer(
  msgs: RoomMessage[],
  options?: { sinceMs?: number; ttlMs?: number },
): RoomMessage[] {
  const ttlMs = options?.ttlMs ?? ROOM_CHAT_TTL_MS;
  const sinceMs = options?.sinceMs;
  const ttlCutoff = Date.now() - ttlMs;
  return msgs.filter((m) => {
    const ts = resolveRoomMessageCreatedAt(m.createdAt);
    if (ts < ttlCutoff) return false;
    if (sinceMs != null && ts < sinceMs) return false;
    return true;
  });
}

let pruneMessagesDebounce: ReturnType<typeof setTimeout> | null = null;
let pruneMessagesRoomId: string | null = null;

function schedulePruneExpiredRoomMessages(roomId: string): void {
  if (pruneMessagesDebounce && pruneMessagesRoomId === roomId) {
    clearTimeout(pruneMessagesDebounce);
  }
  pruneMessagesRoomId = roomId;
  pruneMessagesDebounce = setTimeout(() => {
    pruneMessagesDebounce = null;
    pruneMessagesRoomId = null;
    pruneExpiredRoomMessages(roomId).catch(() => {});
  }, 2000);
}

/** حذف رسائل أقدم من ROOM_CHAT_TTL_MS من Firebase */
export async function pruneExpiredRoomMessages(roomId: string): Promise<void> {
  if (!roomId) return;
  const cutoff = Date.now() - ROOM_CHAT_TTL_MS;
  const messagesRef = ref(realtimeDb, `roomMessages/${roomId}`);
  const oldQ = query(messagesRef, orderByChild('createdAt'), endAt(cutoff));
  const snap = await get(oldQ);
  if (!snap.exists()) return;
  const updates: Record<string, null> = {};
  snap.forEach((child) => {
    if (child.key) updates[child.key] = null;
  });
  if (Object.keys(updates).length > 0) {
    await update(messagesRef, updates);
  }
}

/** وقت دخول المستخدم الحالي للغرفة (لإخفاء الشات السابق) */
export async function getMyRoomAudienceJoinedAt(roomId: string): Promise<number | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await get(ref(realtimeDb, `roomAudience/${roomId}/${user.uid}`));
  if (!snap.exists()) return null;
  const joinedAt = (snap.val() as { joinedAt?: unknown })?.joinedAt;
  return typeof joinedAt === 'number' && Number.isFinite(joinedAt) ? joinedAt : null;
}

// ==================== CREATE ROOM ====================
export const createRoom = async (data: {
  name: string;
  category: Room['category'];
  seatsCount: 9 | 11 | 16 | 19 | 21;
  isPrivate: boolean;
  password?: string;
  banner?: string;
  country: string;
  hostName?: string;
  hostAvatar?: string;
}): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  // الحصول على بيانات المستخدم من Firestore
  const { getUser } = await import('./users');
  const userData = await getUser(user.uid);

  const hostName =
    data.hostName ??
    resolveDisplayName(
      {
        displayName: userData?.displayName ?? user.displayName,
        email: userData?.email ?? user.email ?? undefined,
      },
      'مضيف',
    );
  const hostAvatar = data.hostAvatar ?? userData?.avatar ?? user.photoURL ?? 'https://i.pravatar.cc/200?img=12';
  const hostCoins = userData ? getUserCoinsFromData(userData) : 0;

  const roomsRef = ref(realtimeDb, 'rooms');
  const newRoomRef = push(roomsRef);
  const roomId = newRoomRef.key!;

  // Init seats (host on seat 0)
  const seats: Record<string, any> = {};
  for (let i = 0; i < data.seatsCount; i++) {
    if (i === 0) {
      // المضيف في المقعد الأول
      seats[`seat_${i}`] = {
        uid: user.uid,
        displayName: hostName,
        avatar: hostAvatar,
        isMuted: false,
        coins: hostCoins,
        level: userData?.level ?? 1,
        isVIP: Boolean(userData?.isVIP),
        vipLevel: getEffectiveVipLevel(userData),
        joinedAt: Date.now(),
      };
    } else {
      // مقاعد فارغة - استخدم empty string بدل null لتجنب undefined
      seats[`seat_${i}`] = {
        uid: '',
      };
    }
  }

  // بناء object الغرفة مع إزالة كل القيم undefined
  const roomName = resolveDisplayName({ displayName: data.name }, `غرفة ${hostName}`);

  const room: any = {
    name: roomName,
    hostUid: user.uid,
    hostName,
    hostAvatar,
    country: data.country,
    category: data.category,
    banner: data.banner ?? 'https://picsum.photos/seed/' + roomId + '/400/200',
    isPrivate: data.isPrivate,
    password: data.password ?? '', // empty string بدل undefined
    seatsCount: data.seatsCount,
    seats,
    audienceCount: 0,
    totalGifts: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isActive: true,
  };

  // التأكد من إزالة أي قيم undefined
  Object.keys(room).forEach((key) => {
    if (room[key] === undefined) {
      delete room[key];
    }
  });

  await set(newRoomRef, room);

  await saveHostPrivateRoomId(roomId);

  try {
    await updateDoc(doc(firestore, 'users', user.uid), buildSocialIncrementPatch('totalRoomsCreated', 1));
  } catch (e) {
    console.warn('createRoom: totalRoomsCreated increment failed', e);
  }

  return roomId;
};

/** إنشاء غرفة خاصة أو العودة لغرفة المضيف الشخصية (ليست غرفة وكالة) */
export const quickCreateRoom = async (): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const existing = await findMyPrivateHostRoom();
  const { getUser } = await import('./users');
  const userData = await getUser(user.uid);
  const hostName = resolveDisplayName(
    {
      displayName: userData?.displayName ?? user.displayName,
      email: userData?.email ?? user.email ?? undefined,
    },
    'مضيف',
  );

  if (existing?.id) {
    const patch: Record<string, unknown> = {
      isActive: true,
      isArchived: false,
      isPrivate: true,
      updatedAt: Date.now(),
    };
    // تحديث لقطة اسم/صورة المضيف عند إعادة التفعيل — كانت تُكتب عند الإنشاء
    // فقط فتعرض بطاقة الغرفة اسماً قديماً بعد تغيير المضيف لملفه
    const freshAvatar = userData?.avatar ?? user.photoURL ?? '';
    if (hostName !== 'مضيف' && hostName !== existing.hostName) patch.hostName = hostName;
    if (freshAvatar && freshAvatar !== existing.hostAvatar) patch.hostAvatar = freshAvatar;
    await update(ref(realtimeDb, `rooms/${existing.id}`), patch);
    await saveHostPrivateRoomId(existing.id);
    return existing.id;
  }

  const country = userData?.country ?? 'PS';

  return createRoom({
    name: `غرفة ${hostName}`,
    category: 'general',
    seatsCount: 9,
    isPrivate: true,
    country,
    banner: `https://picsum.photos/seed/${user.uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'room'}/400/200`,
  });
};

/** حفظ معرّف غرفة المضيف — تظهر أولاً في القائمة ويُعاد استخدامها */
async function saveHostPrivateRoomId(roomId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const userRef = doc(firestore, 'users', user.uid);
    await setDoc(
      userRef,
      { hostPrivateRoomId: roomId, updatedAt: Date.now() },
      { merge: true },
    );
  } catch (e) {
    console.warn('saveHostPrivateRoomId:', e);
  }
}


/** غرفة المضيف المحفوظة (عامة أو خاصة) — للعرض أولاً وإعادة الدخول */
export async function findMyPrivateHostRoom(): Promise<Room | null> {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const profileSnap = await getDoc(doc(firestore, 'users', user.uid));
    const savedId = profileSnap.data()?.hostPrivateRoomId as string | undefined;
    if (savedId) {
      const rsnap = await get(ref(realtimeDb, `rooms/${savedId}`));
      if (rsnap.exists()) {
        const raw = rsnap.val() as Record<string, unknown>;
        if (
          raw.hostUid === user.uid &&
          raw.isArchived !== true &&
          isPersonalHostRoomRaw(raw)
        ) {
          return normalizeRoomFromRtdb(savedId, raw);
        }
      }
    }
  } catch {
    // fallback للمسح
  }

  const allSnap = await get(ref(realtimeDb, 'rooms'));
  if (!allSnap.exists()) return null;

  let best: Room | null = null;
  for (const [id, raw] of Object.entries(allSnap.val() as Record<string, Record<string, unknown>>)) {
    if (raw.hostUid !== user.uid || raw.isArchived === true) continue;
    if (!isPersonalHostRoomRaw(raw)) continue;
    const room = normalizeRoomFromRtdb(id, raw);
    best = pickPreferredPersonalHostRoom(best, room);
  }

  if (best) await saveHostPrivateRoomId(best.id);
  return best;
}

/** تحديث الغرفة الخاصة الحالية أو إنشاؤها — لا ينشئ غرفة جديدة كل مرة */
export async function savePrivateHostRoom(data: {
  name: string;
  category: Room['category'];
  seatsCount: 9 | 11 | 16 | 19 | 21;
  password?: string;
  banner?: string;
  country: string;
}): Promise<{ roomId: string; isNew: boolean }> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const { getUser } = await import('./users');
  const userData = await getUser(user.uid);
  const hostName = resolveDisplayName(
    {
      displayName: userData?.displayName ?? user.displayName,
      email: userData?.email ?? user.email ?? undefined,
    },
    'مضيف',
  );
  const hostAvatar = userData?.avatar ?? user.photoURL ?? 'https://i.pravatar.cc/200?img=12';
  const roomName = resolveDisplayName({ displayName: data.name }, `غرفة ${hostName}`);

  const existing = await findMyPrivateHostRoom();
  if (existing) {
    const roomRef = ref(realtimeDb, `rooms/${existing.id}`);
    const patch: Record<string, unknown> = {
      name: roomName,
      category: data.category,
      banner: data.banner ?? existing.banner,
      password: data.password ?? '',
      country: data.country,
      isPrivate: true,
      isActive: true,
      isArchived: false,
      // تحديث لقطة اسم/صورة المضيف من البيانات الطازجة — كانت لقطة إنشاء لا تُحدَّث
      hostName,
      hostAvatar,
      updatedAt: Date.now(),
    };
    if (data.seatsCount !== existing.seatsCount) {
      patch.seatsCount = data.seatsCount;
      patch.seats = buildInitialSeatsForHost(
        data.seatsCount,
        user.uid,
        hostName,
        hostAvatar,
        userData ? getUserCoinsFromData(userData) : 0,
        userData?.level ?? 1,
        Boolean(userData?.isVIP),
        getEffectiveVipLevel(userData),
      );
    }
    await update(roomRef, patch);
    await saveHostPrivateRoomId(existing.id);
    return { roomId: existing.id, isNew: false };
  }

  const roomId = await createRoom({
    ...data,
    isPrivate: true,
    hostName,
    hostAvatar,
  });
  return { roomId, isNew: true };
}

/** اشتراك مباشر بغرفة المضيف الخاصة — تظهر في القائمة حتى لو ليست ضمن آخر N غرفة */
export function subscribeToHostPrivateRoom(
  callback: (room: Room | null) => void,
): () => void {
  const user = auth.currentUser;
  if (!user) {
    callback(null);
    return () => {};
  }

  let roomOff: (() => void) | null = null;

  const stopRoomListen = () => {
    if (roomOff) {
      roomOff();
      roomOff = null;
    }
  };

  const userUnsub = onSnapshot(
    doc(firestore, 'users', user.uid),
    (snap) => {
      stopRoomListen();
      const roomId = snap.data()?.hostPrivateRoomId as string | undefined;
      if (!roomId) {
        void findMyPrivateHostRoom().then((legacy) => callback(legacy));
        return;
      }
      const roomRef = ref(realtimeDb, `rooms/${roomId}`);
      roomOff = onValue(roomRef, (rsnap) => {
        if (!rsnap.exists()) {
          callback(null);
          return;
        }
        const raw = rsnap.val() as Record<string, unknown>;
        if (raw.hostUid !== user.uid || raw.isArchived === true) {
          callback(null);
          return;
        }
        callback(normalizeRoomFromRtdb(roomId, raw));
      });
    },
    () => callback(null),
  );

  return () => {
    userUnsub();
    stopRoomListen();
  };
}

// ==================== GET ROOMS LIST ====================
export const subscribeToRooms = (
  callback: (rooms: Room[]) => void,
  limit: number = 20,
): (() => void) => {
  const roomsRef = query(
    ref(realtimeDb, 'rooms'),
    orderByChild('createdAt'),
    limitToLast(limit),
  );

  const handler = (snapshot: DataSnapshot) => {
    const data = snapshot.val() ?? {};
    const rooms: Room[] = Object.entries(data)
      .map(([id, room]) => normalizeRoomFromRtdb(id, room as Record<string, unknown>))
      .filter((r) => r.isActive)
      .sort((a, b) => b.createdAt - a.createdAt);
    callback(rooms);
  };

  onValue(roomsRef, handler);
  return () => off(roomsRef, 'value', handler);
};

/** بحث غرفة بكود vanityId أو معرّف RTDB — استعلام مباشر خارج قائمة الـ 60 الأخيرة */
export async function findRoomByCode(code: string): Promise<Room | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  const keys = [...new Set([trimmed, digits].filter(Boolean))];

  for (const key of keys) {
    try {
      const snap = await get(
        query(ref(realtimeDb, 'rooms'), orderByChild('vanityId'), equalTo(key), limitToFirst(8)),
      );
      if (snap.exists()) {
        for (const [id, raw] of Object.entries(snap.val() as Record<string, unknown>)) {
          const room = normalizeRoomFromRtdb(id, raw as Record<string, unknown>);
          if (room.isActive !== false && (raw as Record<string, unknown>).isArchived !== true) return room;
        }
      }
    } catch (e) {
      console.warn('findRoomByCode:', e);
    }
  }

  try {
    const direct = await get(ref(realtimeDb, `rooms/${trimmed}`));
    if (direct.exists()) {
      const room = normalizeRoomFromRtdb(trimmed, direct.val() as Record<string, unknown>);
      if (room.isActive !== false) return room;
    }
  } catch {
    // ignore
  }

  return null;
}

// ==================== GET ROOM BY HOST UID ====================
export async function getRoomByHostUid(hostUid: string): Promise<Room | null> {
  try {
    const roomsRef = query(
      ref(realtimeDb, 'rooms'),
      orderByChild('hostUid'),
      equalTo(hostUid),
      limitToLast(1),
    );
    const snap = await get(roomsRef);
    if (!snap.exists()) return null;
    const data = snap.val() as Record<string, unknown>;
    const entries = Object.entries(data);
    for (const [id, raw] of entries) {
      const room = normalizeRoomFromRtdb(id, raw as Record<string, unknown>);
      if (room.isActive) return room;
    }
    for (const [id, raw] of entries) {
      return normalizeRoomFromRtdb(id, raw as Record<string, unknown>);
    }
    return null;
  } catch {
    return null;
  }
}

// ==================== GET SINGLE ROOM ====================
// ⚡ محسّن: نشترك فقط في الحقول الخفيفة (المقاعد، العدادات، الحالة)
// الرسائل والحضور لهما اشتراكات منفصلة لتجنّب إعادة الرسم الثقيلة.
export const subscribeToRoom = (
  roomId: string,
  callback: (room: Room | null) => void,
): (() => void) => {
  const roomRef = ref(realtimeDb, `rooms/${roomId}`);

  let lastHash = '';
  let repairScheduled = false;
  const handler = (snapshot: DataSnapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    const raw = snapshot.val();
    // نستبعد messages و audience الثقيلين من بيانات الغرفة الأساسية
    const { messages, audience, ...light } = raw;
    const seatsRaw = light.seats as SeatMap | undefined;
    if (seatsRaw && seatMapHasDuplicateUids(seatsRaw) && !repairScheduled) {
      repairScheduled = true;
      void repairDuplicateRoomSeats(roomId).finally(() => {
        repairScheduled = false;
      });
    }
    const room = normalizeRoomFromRtdb(roomId, light as Record<string, unknown>);
    // نتجنّب callback إن لم يتغيّر شيء فعلي (يمنع إعادة رسم لا لزوم لها)
    const hash = JSON.stringify({
      seats: light.seats,
      lockedSeats: light.lockedSeats,
      audienceCount: light.audienceCount,
      totalGifts: light.totalGifts,
      isActive: light.isActive,
      hostUid: light.hostUid,
      name: light.name,
      background: light.background ?? '',
      frameId: light.frameId ?? '',
      banner: light.banner ?? '',
      chatMutedUsers: light.chatMutedUsers ?? null,
    });
    if (hash === lastHash) return;
    lastHash = hash;
    callback(room);
  };

  onValue(roomRef, handler);
  return () => off(roomRef, 'value', handler);
};

/** قراءة الغرفة مرة واحدة (بدون اشتراك حيّ) — مناسبة لشاشات النماذج كالإعدادات */
export async function fetchRoomOnce(roomId: string): Promise<Room | null> {
  const snapshot = await get(ref(realtimeDb, `rooms/${roomId}`));
  if (!snapshot.exists()) return null;
  const { messages, audience, ...light } = snapshot.val();
  return normalizeRoomFromRtdb(roomId, light as Record<string, unknown>);
}

/** يُرمى عندما يحتاج الضيف لشراء عضوية الغرفة لأخذ المايك */
export const GUEST_MIC_MEMBERSHIP_REQUIRED = 'GUEST_MIC_MEMBERSHIP_REQUIRED';

export type JoinSeatOptions = {
  /** من مودال شراء المايك — يسمح بالدفع والانضمام حتى لو guestCanTakeMic معطّل */
  purchaseMembership?: boolean;
};

async function getRoomMicMemberRole(
  roomId: string,
  uid: string,
): Promise<'red_member' | 'blue_supervisor' | 'yellow_supervisor' | null> {
  const snap = await get(ref(realtimeDb, `rooms/${roomId}/memberRoles/${uid}`));
  const role = snap.val();
  if (role === 'red_member' || role === 'blue_supervisor' || role === 'yellow_supervisor') {
    return role;
  }
  return null;
}

type ManagedMicSeatLock = {
  seatIdx: number;
  active: boolean;
};

async function getManagedMicSeatLock(
  roomId: string,
  uid: string,
): Promise<ManagedMicSeatLock | null> {
  const snap = await get(ref(realtimeDb, `rooms/${roomId}/managedMicLocks/${uid}`));
  const raw = snap.val() as { seatIdx?: unknown; active?: unknown } | null;
  if (!raw) return null;
  const seatIdx = Number(raw.seatIdx);
  if (!Number.isFinite(seatIdx)) return null;
  return {
    seatIdx: Math.max(0, Math.floor(seatIdx)),
    active: raw.active === true,
  };
}

async function setManagedMicSeatLock(
  roomId: string,
  uid: string,
  seatIdx: number,
  active: boolean,
): Promise<void> {
  await set(ref(realtimeDb, `rooms/${roomId}/managedMicLocks/${uid}`), {
    seatIdx,
    active,
    updatedAt: Date.now(),
  });
}

// ==================== JOIN SEAT ====================
export const joinSeat = async (
  roomId: string,
  seatIdx: number,
  options?: JoinSeatOptions,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  // قراءة المقاعد + الروم + وثيقة المستخدم بالتوازي (كانت 4 رحلات متتابعة → الآن دفعة واحدة)
  // هذا أكبر سبب لتأخّر ظهور أخذ المايك عند الجميع على الشبكات الضعيفة.
  const fsMod = import('firebase/firestore');
  const userDocRefPromise = fsMod.then(({ doc: fsDoc }) =>
    fsDoc(firestore, 'users', user.uid),
  );
  const [allSeatsSnap, roomSnap, fs, userDocRef] = await Promise.all([
    get(ref(realtimeDb, `rooms/${roomId}/seats`)),
    get(ref(realtimeDb, `rooms/${roomId}`)),
    fsMod,
    userDocRefPromise,
  ]);

  const { getDoc, doc: fsDoc, updateDoc, addDoc, collection, increment: fsIncrement } = await fs;
  const userSnap = await getDoc(userDocRef);
  if (!userSnap.exists()) throw new Error('المستخدم غير موجود');
  const userData = userSnap.data();
  const staffFields = parseStaffFromUserData(userData);
  const roomData = roomSnap.val() ?? {};
  let agencyCountry: string | undefined;
  const agencyIdForCountry = String(roomData.agencyId ?? '');
  if (agencyIdForCountry) {
    const agencySnap = await getDoc(fsDoc(firestore, 'agencies', agencyIdForCountry));
    if (agencySnap.exists()) {
      agencyCountry = String(agencySnap.data()?.country ?? '');
    }
  }
  const roomCountry = resolveRoomCountry(roomData, agencyCountry);
  // فحص نطاق دولة الموظف من البيانات المحمَّلة أعلاه مباشرة —
  // assertStaffCanEnterRoom كانت تعيد جلب وثيقة المستخدم والغرفة من الشبكة
  // (رحلتان زائدتان تبطئان أخذ المايك)
  if (
    staffFields.staffRole &&
    staffFields.staffRole !== 'manager' &&
    !staffCanEnterRoom(staffFields, roomCountry)
  ) {
    throw new Error('هذه الغرفة خارج نطاق دولتك');
  }
  const managedMicLock = await getManagedMicSeatLock(roomId, user.uid);
  // المدير والمشرفون (أزرق/أصفر) لا يخضعون لقيد «الإضافة من المدير» إطلاقاً —
  // كان مشرف معه إشراف يُمنع من أخذ المايك بسبب قفل قديم من دعوة سابقة
  const myMemberRoleForLock = String(
    (roomData as Record<string, any>)?.memberRoles?.[user.uid] ?? '',
  );
  const exemptFromManagedLock =
    canJoinHostSeat(roomData, user.uid) ||
    myMemberRoleForLock === 'blue_supervisor' ||
    myMemberRoleForLock === 'yellow_supervisor';
  // القفل يقيّد فقط وهو نشط (مثبّت على مقعد بإضافة المدير) — سجلّ قديم غير نشط
  // (نزل من المايك سابقاً) كان يمنع المضيفة من أخذ أي مايك مرة أخرى للأبد
  if (
    !exemptFromManagedLock &&
    managedMicLock?.active &&
    managedMicLock.seatIdx !== seatIdx
  ) {
    throw new Error('لا يمكنك الصعود للمايك إلا بإضافة من مدير الوكالة');
  }
  if (managedMicLock && (!managedMicLock.active || exemptFromManagedLock)) {
    void set(ref(realtimeDb, `rooms/${roomId}/managedMicLocks/${user.uid}`), null).catch(() => {});
  }

  // فحص أن المقعد المطلوب فارغ + أن المستخدم ليس على مقعد آخر (من نفس القراءة)
  if (allSeatsSnap.exists()) {
    const seats = allSeatsSnap.val();
    const target = seats[`seat_${seatIdx}`];
    if (target?.uid && target.uid !== '' && target.uid !== user.uid) {
      throw new Error('المقعد محجوز');
    }
    for (const [key, s] of Object.entries(seats)) {
      if ((s as any).uid === user.uid && key !== `seat_${seatIdx}`) {
        throw new Error('أنت على مقعد آخر — استخدم تغيير المقعد');
      }
    }
  }

  // ===== رسم دخول للمقعد =====
  // seatFee = العدد المطلوب لدخول كل مقعد (يضعه المضيف) أو seatFees لكل مقعد
  // فحصا الحظر مستقلان — بالتوازي بدل التسلسل (أسرع على الشبكات الضعيفة)
  await Promise.all([
    assertNotBlockedFromRoom(roomId, user.uid),
    assertNotBlockedFromAgencyRoom(roomId, user.uid, roomData as Record<string, unknown>),
  ]);
  if (seatIdx === 0 && !effectiveCanOccupyHostSeat(roomData, user.uid, staffFields, roomCountry)) {
    throw new Error('مقعد المضيف محجوز لصاحب الغرفة');
  }
  const isManager = effectiveCanManageRoomUsers(roomData, user.uid, staffFields, roomCountry);
  const isSecondHostSeat = seatIdx === SECOND_HOST_SEAT_INDEX;
  if (isSecondHostSeat) {
    if (roomData?.secondHostMic !== true) throw new Error('مقعد المدير الثاني غير مفعّل');
    if (isSeatLocked(roomData, seatIdx)) throw new Error('المقعد مقفل — اطلب من مدير الوكالة فتحه');
    const memberRoleEarly = await getRoomMicMemberRole(roomId, user.uid);
    if (!canOccupySecondHostSeat(roomData, user.uid, memberRoleEarly, isManager)) {
      throw new Error('هذا المقعد للإشراف فقط — لا يمكن للأعضاء الجلوس عليه');
    }
  }
  // مشرف الإشراف (أصفر) عبر memberRoles يعامَل كمدير للقفل — قواعد RTDB تمنحه
  // إدارة lockedSeats أصلاً؛ حصر الاستثناء بـ coHosts كان يمنع مشرفي بعض
  // الوكالات (المسجّلين في memberRoles فقط) من أخذ المايك في الغرف المقفلة
  if (
    seatIdx > 0 &&
    !isSecondHostSeat &&
    isSeatLocked(roomData, seatIdx) &&
    !isManager &&
    myMemberRoleForLock !== 'yellow_supervisor'
  ) {
    throw new Error('المقعد مقفل');
  }
  const roomPerms = parseRoomPermissions(roomData);
  const agencyId = String(roomData.agencyId ?? '');
  // قراءتان مستقلتان — بالتوازي (كانتا متسلسلتين فتبطئان أخذ المايك)
  const [memberRole, isAgencyMember] = await Promise.all([
    getRoomMicMemberRole(roomId, user.uid),
    agencyId ? isUidAgencyMember(agencyId, user.uid) : Promise.resolve(false),
  ]);
  const hasMicAccess =
    canTakeMicSeat(isManager, memberRole, roomPerms, isAgencyMember) ||
    (staffMicFeeExempt(staffFields) && staffHasCountryAccess(staffFields, roomCountry));
  if (seatIdx > 0 && !isSecondHostSeat && !hasMicAccess) {
    if (options?.purchaseMembership) {
      // يُكمل الدفع ثم يُسجَّل كعضو
    } else {
      throw new Error(GUEST_MIC_MEMBERSHIP_REQUIRED);
    }
  }
  const isHost = roomData?.hostUid === user.uid;
  const staffMicFree =
    staffMicFeeExempt(staffFields) && staffHasCountryAccess(staffFields, roomCountry);
  // المضيف معفي. الأعضاء المسجّلون وموظفو المنصة لا يدفعون
  let seatFee = 0;
  if (!isHost && !memberRole && !staffMicFree && !isSecondHostSeat) {
    // النزول عن المايك ثم إعادة الصعود لا يعيد خصم الرسم — علم دفع دائم لكل (غرفة, مستخدم)
    const paidSnap = await get(ref(realtimeDb, `rooms/${roomId}/seatFeePaid/${user.uid}`));
    const alreadyPaidSeatFee = paidSnap.exists() && !!paidSnap.val();
    if (!alreadyPaidSeatFee) {
      const perSeatFee = roomData?.seatFees?.[`seat_${seatIdx}`];
      seatFee = typeof perSeatFee === 'number'
        ? perSeatFee
        : (typeof roomData?.seatFee === 'number' ? roomData.seatFee : 0);
    }
  }

  const displayName = resolveDisplayName(
    {
      displayName:
        userData.profile?.displayName ?? userData.displayName ?? user.displayName,
      email: userData.email ?? user.email ?? undefined,
    },
    'مستخدم',
  );
  const avatar =
    resolveOfficialUserAvatar(userData as Record<string, unknown>, user.uid)
    || user.photoURL
    || 'https://i.pravatar.cc/200?img=12';
  let coinsBalance = getUserCoinsFromData(userData);

  // فحص الرصيد + خصم لو فيه رسم
  if (seatFee > 0) {
    const balance = coinsBalance;
    if (balance < seatFee) {
      throw new Error(`رسم دخول المقعد ${seatFee} عملة — رصيدك غير كافٍ`);
    }

    // خصم من المستخدم (atomic)
    await updateDoc(userDocRef, buildBalanceIncrementPatch('coins', -seatFee));

    // إضافة للمضيف
    const hostShare = roomData?.hostUid ? Math.floor(seatFee * 0.5) : 0;
    if (roomData?.hostUid && hostShare > 0) {
      const hostRef = fsDoc(firestore, 'users', roomData.hostUid);
      await updateDoc(hostRef, buildBalanceIncrementPatch('coins', hostShare));
      await addDoc(collection(firestore, 'transactions'), {
        uid: roomData.hostUid,
        type: 'seat_fee_received',
        amount: hostShare,
        currency: 'coins',
        roomId,
        seatIdx,
        fromUid: user.uid,
        status: 'completed',
        createdAt: Date.now(),
      });
    }

    // تسجيل المعاملة
    await addDoc(collection(firestore, 'transactions'), {
      uid: user.uid,
      type: 'seat_fee',
      amount: -seatFee,
      currency: 'coins',
      roomId,
      seatIdx,
      status: 'completed',
      createdAt: Date.now(),
    });
    coinsBalance -= seatFee;
    // سجّل الدفع لهذه الغرفة حتى لا يُخصم الرسم ثانيةً عند إعادة الصعود على المايك
    await set(ref(realtimeDb, `rooms/${roomId}/seatFeePaid/${user.uid}`), Date.now());
  }

  if (
    options?.purchaseMembership &&
    !memberRole &&
    !hasMicAccess &&
    seatIdx > 0
  ) {
    await set(ref(realtimeDb, `rooms/${roomId}/memberRoles/${user.uid}`), 'red_member');
  }

  // تأكد من وجود المستخدم في الحضور قبل كتابة المقعد — يمنع prune من إفراغه عند الآخرين
  await joinAudience(roomId).catch(() => {});

  const seatPayload = buildSeatPublicData(
    userData as Record<string, unknown>,
    user.uid,
    displayName,
    avatar,
    Math.max(0, coinsBalance),
  );
  prefetchAvatarUris([avatar]);
  await transactionAssignSeat(roomId, seatIdx, user.uid, {
    ...seatPayload,
    paidFee: seatFee,
  });

  // بالخلفية: لا نُؤخّر ظهور المقعد عند الجميع
  void bindSeatOnDisconnect(roomId, seatIdx);
  void reconcileAudienceCount(roomId);
};

/**
 * تغيير المقعد — ينقل المستخدم من مقعده الحالي لمقعد فارغ
 * بدون دفع رسم جديد لو دفع سابقاً (في نفس الجلسة)
 */
export const changeSeat = async (
  roomId: string,
  toSeatIdx: number,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  // قراءة المقاعد والروم بالتوازي (أسرع على الشبكات الضعيفة)
  const [allSeatsSnap, roomSnap] = await Promise.all([
    get(ref(realtimeDb, `rooms/${roomId}/seats`)),
    get(ref(realtimeDb, `rooms/${roomId}`)),
  ]);
  if (!allSeatsSnap.exists()) throw new Error('لا توجد مقاعد');

  let seats = allSeatsSnap.val();
  let currentSeatKey: string | null = null;
  let currentSeatData: any = null;
  for (const [key, s] of Object.entries(seats)) {
    if ((s as any).uid === user.uid) {
      currentSeatKey = key;
      currentSeatData = s;
      break;
    }
  }
  if (!currentSeatKey) {
    // «أنت لست على مقعد» مباشرة بعد أخذ المقعد — كتابة المقعد قد لا تكون
    // انتشرت بعد؛ مهلة سماح قصيرة ثم قراءة ثانية قبل الفشل
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const retrySnap = await get(ref(realtimeDb, `rooms/${roomId}/seats`));
    const retrySeats = (retrySnap.val() ?? {}) as Record<string, any>;
    for (const [key, s] of Object.entries(retrySeats)) {
      if ((s as any).uid === user.uid) {
        currentSeatKey = key;
        currentSeatData = s;
        break;
      }
    }
    if (currentSeatKey) seats = retrySeats;
  }
  if (!currentSeatKey) throw new Error('أنت لست على مقعد');
  const currentSeatIdx = parseInt(String(currentSeatKey).replace('seat_', ''), 10);
  const managedMicLock = await getManagedMicSeatLock(roomId, user.uid);
  const roomDataForLock = (roomSnap.val() ?? {}) as Record<string, any>;
  const myRoleForLock = String(roomDataForLock?.memberRoles?.[user.uid] ?? '');
  const exemptFromManagedLock =
    canJoinHostSeat(roomDataForLock, user.uid) ||
    myRoleForLock === 'blue_supervisor' ||
    myRoleForLock === 'yellow_supervisor';
  if (managedMicLock?.active && !exemptFromManagedLock) {
    // مثبّت على مقعد بإضافة المدير — لا يغيّر مقعده بنفسه
    if (toSeatIdx !== managedMicLock.seatIdx || toSeatIdx !== currentSeatIdx) {
      throw new Error('لا يمكنك تغيير مقعدك — فقط إدارة الغرفة تستطيع نقلك');
    }
  } else if (managedMicLock && (!managedMicLock.active || exemptFromManagedLock)) {
    // سجلّ قفل قديم غير نشط أو صاحبه مشرف/مدير — يُنظَّف ولا يقيّد
    void set(ref(realtimeDb, `rooms/${roomId}/managedMicLocks/${user.uid}`), null).catch(() => {});
  }

  const roomData = roomSnap.val() ?? {};

  const toKey = `seat_${toSeatIdx}`;
  if (toSeatIdx === 0 && !canOccupyHostSeat(roomData, user.uid)) {
    throw new Error('مقعد المضيف محجوز لصاحب الغرفة');
  }
  if (toSeatIdx === SECOND_HOST_SEAT_INDEX) {
    if (roomData?.secondHostMic !== true) throw new Error('مقعد المدير الثاني غير مفعّل');
    if (isSeatLocked(roomData, toSeatIdx)) throw new Error('المقعد مقفل — اطلب من مدير الوكالة فتحه');
    const memberRole = await getRoomMicMemberRole(roomId, user.uid);
    const isManager = canJoinHostSeat(roomData, user.uid);
    if (!canOccupySecondHostSeat(roomData, user.uid, memberRole, isManager)) {
      throw new Error('هذا المقعد للإشراف فقط — لا يمكن للأعضاء الجلوس عليه');
    }
  }
  if (
    toSeatIdx > 0 &&
    toSeatIdx !== SECOND_HOST_SEAT_INDEX &&
    isSeatLocked(roomData, toSeatIdx) &&
    !canJoinHostSeat(roomData, user.uid) &&
    // مشرف الإشراف عبر memberRoles يدير lockedSeats بقواعد RTDB — نفس استثناء joinSeat
    myRoleForLock !== 'yellow_supervisor'
  ) {
    throw new Error('المقعد مقفل');
  }
  if (currentSeatKey === toKey) {
    const hasDuplicates = Object.entries(seats).some(
      ([key, s]) => (s as { uid?: string }).uid === user.uid && key !== toKey,
    );
    if (!hasDuplicates) return;
  } else {
    const targetSeat = seats[toKey];
    if (targetSeat?.uid && targetSeat.uid !== '' && targetSeat.uid !== user.uid) {
      throw new Error('المقعد محجوز');
    }
  }

  const seatsRef = ref(realtimeDb, `rooms/${roomId}/seats`);
  const tx = await runSeatsTransactionWithRetry(seatsRef, (current) => {
    const map = (current ?? {}) as SeatMap;
    const toKeyTx = `seat_${toSeatIdx}`;
    let source: SeatMap[string] | null = null;
    for (const s of Object.values(map)) {
      if (s?.uid === user.uid) {
        source = s;
        break;
      }
    }
    if (!source) return undefined;
    const target = map[toKeyTx];
    if (target?.uid && target.uid !== '' && target.uid !== user.uid) {
      return undefined;
    }
    for (const key of Object.keys(map)) {
      if (map[key]?.uid === user.uid && key !== toKeyTx) {
        map[key] = { uid: '' };
      }
    }
    map[toKeyTx] = { ...source, isMuted: source.isMuted ?? false };
    return map;
  });
  if (!tx.committed) throw new Error('المقعد محجوز');
  // ربط onDisconnect + موازنة العدّ بالخلفية (لا نُعطّل ظهور الانتقال)
  void bindSeatOnDisconnect(roomId, toSeatIdx);
  void reconcileAudienceCount(roomId);
};

/**
 * تحديد سعر مقعد محدّد (للمضيف)
 */
export const setSeatFee = async (
  roomId: string,
  seatIdx: number | 'all',
  fee: number,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  const roomSnap = await get(ref(realtimeDb, `rooms/${roomId}`));
  const roomData = roomSnap.val() ?? {};
  if (!canJoinHostSeat(roomData, user.uid)) {
    throw new Error('ليس لديك صلاحية تحديد رسوم المقاعد');
  }
  if (seatIdx === 'all') {
    // رسم موحّد لكل المقاعد
    await update(ref(realtimeDb, `rooms/${roomId}`), { seatFee: Math.max(0, fee) });
  } else {
    await update(ref(realtimeDb, `rooms/${roomId}/seatFees`), {
      [`seat_${seatIdx}`]: Math.max(0, fee),
    });
  }
};

/**
 * البحث: أي روم فيها هذا المستخدم على مقعد (live presence)
 * يُستخدم لعرض "X موجود في غرفة Y" في البروفايل وقائمة الأصدقاء
 */
export const findUserCurrentRoom = async (
  uid: string,
): Promise<{ roomId: string; roomName: string; seatIdx: number } | null> => {
  const allRoomsSnap = await get(ref(realtimeDb, 'rooms'));
  if (!allRoomsSnap.exists()) return null;
  const all = allRoomsSnap.val() as Record<string, any>;
  for (const [roomId, room] of Object.entries(all)) {
    if (!room.isActive) continue;
    // فحص أن المستخدم على مقعد
    const seats = room.seats ?? {};
    for (const [key, s] of Object.entries(seats)) {
      if ((s as any).uid === uid) {
        const seatIdx = parseInt(key.replace('seat_', ''), 10);
        return { roomId, roomName: room.name ?? 'غرفة', seatIdx };
      }
    }
    // أو في الجمهور
    if (room.hostUid === uid) {
      return { roomId, roomName: room.name ?? 'غرفة', seatIdx: -1 }; // -1 = مضيف
    }
  }
  return null;
};

// ==================== LEAVE SEAT ====================
export const leaveSeat = async (
  roomId: string,
  seatIdx: number,
): Promise<void> => {
  const user = auth.currentUser;

  if (
    seatDisconnectBound?.roomId === roomId &&
    seatDisconnectBound.seatIdx === seatIdx
  ) {
    seatDisconnectBound = null;
  }
  const seatRef = ref(realtimeDb, `rooms/${roomId}/seats/seat_${seatIdx}`);
  // إفراغ المقعد فوراً وبالتوازي مع بقية التنظيف — كان تسلسل 4 رحلات شبكة
  // يؤخّر النزول المرئي من المايك عند الجميع (بطء أخذ/ترك المقعد)
  // استخدم empty string بدل null لتجنب مشاكل undefined
  await Promise.all([
    set(seatRef, { uid: '' }),
    cancelSeatOnDisconnect(roomId, seatIdx),
    user
      ? remove(ref(realtimeDb, `roomSeatHold/${roomId}/${user.uid}`)).catch(() => {})
      : Promise.resolve(),
    user
      ? set(ref(realtimeDb, `rooms/${roomId}/seatSupport/${user.uid}`), null).catch(() => {})
      : Promise.resolve(),
  ]);
  if (user) {
    // تنظيف قفل «الإضافة من المدير» بالخلفية — لا يؤخّر ظهور النزول
    void (async () => {
      const managedMicLock = await getManagedMicSeatLock(roomId, user.uid);
      if (managedMicLock?.active && managedMicLock.seatIdx === seatIdx) {
        await setManagedMicSeatLock(roomId, user.uid, seatIdx, false).catch(() => {});
      }
    })().catch(() => {});
  }
  scheduleReconcileAudienceCount(roomId);
};

// ==================== TOGGLE MUTE ====================
export const toggleMute = async (
  roomId: string,
  seatIdx: number,
  isMuted?: boolean, // optional - لو ما متمرر يقرأ القيمة الحالية ويعكسها
): Promise<void> => {
  const me = auth.currentUser?.uid;
  const seatRef = ref(realtimeDb, `rooms/${roomId}/seats/seat_${seatIdx}`);
  const seatSnap = await get(seatRef);
  const seat = (seatSnap.val() ?? {}) as {
    uid?: string;
    isMuted?: boolean;
    mutedBy?: string;
  };
  const seatUid = seat.uid ? String(seat.uid) : '';

  let newValue: boolean;
  if (typeof isMuted === 'boolean') {
    newValue = isMuted;
  } else {
    newValue = !(seat.isMuted === true);
  }

  // كتم إداري (mutedBy) — المكتوم لا يفكّ كتم نفسه؛ يفكّه من كتمه أو الإدارة.
  // استثناء: المدير والمشرفون (حسابات غير عادية) يفكّون كتم أنفسهم دائماً.
  if (newValue === false && seat.mutedBy && seatUid && seatUid === me && seat.mutedBy !== me) {
    const roomForMuteSnap = await get(ref(realtimeDb, `rooms/${roomId}`));
    const roomForMute = (roomForMuteSnap.val() ?? {}) as Record<string, any>;
    const myRole = String(roomForMute?.memberRoles?.[me] ?? '');
    const privileged =
      canJoinHostSeat(roomForMute, me) ||
      myRole === 'blue_supervisor' ||
      myRole === 'yellow_supervisor';
    if (!privileged) {
      throw new Error('كتمك أحد المشرفين — لا يمكنك فتح المايك بنفسك');
    }
  }

  // امتياز SVIP «ضد التصميت»: لا يمكن كتم عضو يملكه (إلا كتم النفس)
  if (newValue === true && seatUid && seatUid !== me) {
    if (await checkUserHasVipFeature(seatUid, 'antiMute')) {
      throw new Error('لا يمكن كتم هذا العضو — امتياز SVIP «ضد التصميت»');
    }
  }

  const isAdminMute = newValue === true && !!me && !!seatUid && seatUid !== me;
  await update(seatRef, {
    isMuted: newValue,
    // نسجّل من كتم — لمنع فك الكتم الذاتي؛ كتم النفس/فك الكتم يمسح العلامة
    mutedBy: isAdminMute ? me : null,
    ...(newValue === true ? { isSpeaking: false } : {}),
  });
};

// ==================== SET SPEAKING STATE ====================
/**
 * تحديد ما إذا كان المستخدم يتكلم حالياً (للموجات الصوتية)
 * يُستخدم من جلسة الصوت عبر isSpeaking / audioLevel
 */
export const setSeatSpeaking = async (
  roomId: string,
  seatIdx: number,
  isSpeaking: boolean,
): Promise<void> => {
  const speakingRef = ref(realtimeDb, `rooms/${roomId}/seats/seat_${seatIdx}/isSpeaking`);
  await set(speakingRef, isSpeaking);
};

export type RoomAudienceMember = {
  uid: string;
  name: string;
  avatar: string;
  joinedAt?: number;
  isVIP?: boolean;
  level?: number;
  vipLevel?: number;
  hiddenInRoom?: boolean;
};

/** مفاتيح حضور حقيقية فقط — uid واحد = مستخدم واحد */
function parseRoomAudienceSnapshot(snap: DataSnapshot): RoomAudienceMember[] {
  if (!snap.exists()) return [];
  const data = snap.val() as Record<string, Record<string, unknown>>;
  const byUid = new Map<string, RoomAudienceMember>();
  for (const [key, row] of Object.entries(data)) {
    if (key.endsWith('_left')) continue;
    const uid = String(row?.uid ?? key);
    if (!uid || uid.endsWith('_left')) continue;
    byUid.set(uid, {
      uid,
      name: String(row?.name ?? 'مستخدم'),
      avatar: String(row?.avatar ?? ''),
      joinedAt: typeof row?.joinedAt === 'number' ? row.joinedAt : undefined,
      isVIP: row?.isVIP === true,
      level: typeof row?.level === 'number' ? row.level : undefined,
      hiddenInRoom: row?.hiddenInRoom === true,
    });
  }
  return Array.from(byUid.values());
}

/** uids فريدة: جمهور + مقاعد + مضيف */
function collectPresenceUids(
  audience: RoomAudienceMember[],
  seats: Room['seats'] | undefined,
): Set<string> {
  const uids = new Set<string>();
  for (const a of audience) {
    if (a.uid) uids.add(a.uid);
  }
  for (const s of Object.values(seats ?? {})) {
    const uid = s?.uid;
    if (typeof uid === 'string' && uid.length > 0) uids.add(uid);
  }
  return uids;
}

/** عدّ الحضور من roomAudience فقط */
export async function countRoomAudience(roomId: string): Promise<number> {
  const snap = await get(ref(realtimeDb, `roomAudience/${roomId}`));
  return parseRoomAudienceSnapshot(snap).length;
}

/** عدّ الحضور الكامل (جمهور + مقاعد + مضيف) — uid واحد = 1 */
export async function countRoomPresence(roomId: string): Promise<number> {
  const [audSnap, roomSnap] = await Promise.all([
    get(ref(realtimeDb, `roomAudience/${roomId}`)),
    get(ref(realtimeDb, `rooms/${roomId}`)),
  ]);
  const audience = parseRoomAudienceSnapshot(audSnap);
  const raw = roomSnap.exists() ? (roomSnap.val() as Record<string, unknown>) : {};
  const seats = (raw.seats as Room['seats']) ?? {};
  return collectPresenceUids(audience, seats).size;
}

/** للواجهة: حضور حقيقي — جمهور + مقاعد + مضيف (uid فريد) */
export function derivePresenceCount(
  room: Pick<Room, 'seats' | 'hostUid' | 'audienceCount'> | null | undefined,
  audience: RoomAudienceMember[],
  audienceUids?: Set<string>,
): number {
  if (audienceUids) {
    const uids = new Set(audienceUids);
    for (const s of Object.values(room?.seats ?? {})) {
      const uid = s?.uid;
      if (typeof uid === 'string' && uid.length > 0) uids.add(uid);
    }
    return uids.size;
  }
  if (!room) return audience.length;
  return collectPresenceUids(audience, room.seats).size;
}

let reconcileDebounce: ReturnType<typeof setTimeout> | null = null;
let reconcileRoomId: string | null = null;

function scheduleReconcileAudienceCount(roomId: string): void {
  if (reconcileDebounce && reconcileRoomId === roomId) {
    clearTimeout(reconcileDebounce);
  }
  reconcileRoomId = roomId;
  reconcileDebounce = setTimeout(() => {
    reconcileDebounce = null;
    reconcileRoomId = null;
    reconcileAudienceCount(roomId).catch(() => {});
  }, 80);
}

/** مزامنة audienceCount مع الحضور الفعلي (uid فريد) */
export async function reconcileAudienceCount(roomId: string): Promise<number> {
  const count = await countRoomPresence(roomId);
  await set(ref(realtimeDb, `rooms/${roomId}/audienceCount`), count);
  return count;
}

/** إفراغ كل مقاعد مستخدم عند مغادرة الغرفة/الجمهور + تصفير دعمه */
async function vacateSeatsForUid(roomId: string, uid: string): Promise<void> {
  if (!uid) return;
  const seatsSnap = await get(ref(realtimeDb, `rooms/${roomId}/seats`));
  if (!seatsSnap.exists()) return;
  const seats = seatsSnap.val() as Record<string, { uid?: string }>;
  const updates: Record<string, unknown> = {};
  for (const [key, seat] of Object.entries(seats)) {
    if (seat?.uid === uid) updates[key] = { uid: '' };
  }
  if (Object.keys(updates).length > 0) {
    await update(ref(realtimeDb, `rooms/${roomId}/seats`), updates);
    await set(ref(realtimeDb, `rooms/${roomId}/seatSupport/${uid}`), null).catch(() => {});
  }
}

type SeatMap = Record<string, { uid?: string; joinedAt?: number; isMuted?: boolean; [k: string]: unknown }>;

/**
 * معاملة مقاعد مع إعادة محاولة — عقدة المقاعد تتغير كثيراً في الغرف المزدحمة
 * فيرمي SDK خطأ «maxretry» الخام بعد استنفاد محاولاته الداخلية.
 * نعيد المحاولة بمهلة متزايدة، وإن فشلت كلها نعرض رسالة عربية مفهومة.
 */
async function runSeatsTransactionWithRetry(
  seatsRef: ReturnType<typeof ref>,
  updater: (current: any) => any,
  attempts = 3,
): Promise<{ committed: boolean }> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await runTransaction(seatsRef, updater);
    } catch (e: any) {
      const msg = String(e?.message ?? e).toLowerCase();
      if (!msg.includes('maxretry')) throw e;
      if (i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, 250 + i * 350));
    }
  }
  throw new Error('الغرفة مزدحمة حالياً — حاول مرة أخرى بعد لحظات');
}

function seatMapHasDuplicateUids(map: SeatMap): boolean {
  const seen = new Set<string>();
  for (const s of Object.values(map)) {
    const uid = s?.uid;
    if (!uid) continue;
    if (seen.has(uid)) return true;
    seen.add(uid);
  }
  return false;
}

/** يُصلح DB إذا ظهر نفس uid على أكثر من مقعد — يُبقي الأحدث joinedAt */
export async function repairDuplicateRoomSeats(roomId: string): Promise<void> {
  const seatsRef = ref(realtimeDb, `rooms/${roomId}/seats`);
  await runTransaction(seatsRef, (current) => {
    const map = (current ?? {}) as SeatMap;
    const byUid = new Map<string, string[]>();
    for (const [key, s] of Object.entries(map)) {
      const uid = s?.uid;
      if (!uid) continue;
      const list = byUid.get(uid) ?? [];
      list.push(key);
      byUid.set(uid, list);
    }
    let changed = false;
    for (const keys of byUid.values()) {
      if (keys.length <= 1) continue;
      keys.sort((a, b) => {
        const ja = Number(map[a]?.joinedAt) || 0;
        const jb = Number(map[b]?.joinedAt) || 0;
        return jb - ja;
      });
      for (let i = 1; i < keys.length; i++) {
        map[keys[i]!] = { uid: '' };
        changed = true;
      }
    }
    return changed ? map : undefined;
  });
}

/** كتابة مقعد واحد + إفراغ أي مقاعد أخرى لنفس uid في معاملة واحدة */
async function transactionAssignSeat(
  roomId: string,
  seatIdx: number,
  uid: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const toKey = `seat_${seatIdx}`;
  const seatsRef = ref(realtimeDb, `rooms/${roomId}/seats`);
  const tx = await runSeatsTransactionWithRetry(seatsRef, (current) => {
    const map = (current ?? {}) as SeatMap;
    const target = map[toKey];
    if (target?.uid && target.uid !== '' && target.uid !== uid) {
      return undefined;
    }
    for (const key of Object.keys(map)) {
      if (key !== toKey && map[key]?.uid === uid) {
        map[key] = { uid: '' };
      }
    }
    map[toKey] = payload as SeatMap[string];
    return map;
  });
  if (!tx.committed) throw new Error('المقعد محجوز');
}

/** يحدّث مستوى الثروة على مقعد RTDB بعد هدية أو ترقية — ليعكس Lv الحالي */
export async function syncUserSeatLevelInRoom(
  roomId: string,
  uid: string,
  level: number,
): Promise<void> {
  if (!roomId || !uid) return;
  const nextLevel = Math.max(1, Math.floor(Number(level) || 1));
  const seatsRef = ref(realtimeDb, `rooms/${roomId}/seats`);
  await runTransaction(seatsRef, (current) => {
    const map = (current ?? {}) as SeatMap;
    let changed = false;
    for (const key of Object.keys(map)) {
      const seat = map[key];
      if (seat?.uid === uid) {
        map[key] = { ...seat, level: nextLevel };
        changed = true;
      }
    }
    return changed ? map : undefined;
  });
}

function collectAudienceUids(snap: DataSnapshot): Set<string> {
  const uids = new Set<string>();
  if (!snap.exists()) return uids;
  snap.forEach((child) => {
    const uid = (child.val() as { uid?: string } | null)?.uid ?? child.key;
    if (uid) uids.add(uid);
  });
  return uids;
}

/**
 * يُزيل «الأشباح» من المقاعد — uid على مقعد لكنه ليس في roomAudience.
 * لا نعتمد على userPresence لأنه قد يتأخر بعد حذف الحضور فيُبقي الشبح على المقعد.
 */
export async function pruneStaleRoomSeats(roomId: string): Promise<number> {
  try {
    const { isRoomMediaPickerGuardActive } = await import('@/utils/roomMediaPickerGuard');
    if (isRoomMediaPickerGuardActive()) return 0;
  } catch {
    // ignore
  }

  const [audSnap, seatsSnap, holdSnap, roomSnap] = await Promise.all([
    get(ref(realtimeDb, `roomAudience/${roomId}`)),
    get(ref(realtimeDb, `rooms/${roomId}/seats`)),
    get(ref(realtimeDb, `roomSeatHold/${roomId}`)),
    get(ref(realtimeDb, `rooms/${roomId}`)),
  ]);
  if (!seatsSnap.exists()) return 0;

  const audienceUids = collectAudienceUids(audSnap);
  const heldUids = new Set(Object.keys((holdSnap.val() ?? {}) as Record<string, unknown>));
  const roomData = (roomSnap.val() ?? {}) as { hostUid?: string; coHosts?: unknown[] };
  const protectedUids = new Set<string>();
  const hostUid = String(roomData.hostUid ?? '');
  if (hostUid) protectedUids.add(hostUid);
  if (Array.isArray(roomData.coHosts)) {
    for (const id of roomData.coHosts) {
      if (id) protectedUids.add(String(id));
    }
  }
  const seats = seatsSnap.val() as Record<
    string,
    { uid?: string; joinedAt?: number; hiddenInRoom?: boolean; disconnectedAt?: number }
  >;
  const updates: Record<string, unknown> = {};
  let cleared = 0;
  const now = Date.now();
  const SEAT_AUDIENCE_GRACE_MS = 120_000;
  // مهلة سماح بعد انقطاع RTDB — onDisconnect يضع علامة disconnectedAt بدل الإفراغ
  // الفوري؛ من عاد خلال المهلة يبقى على مايكه (اتصال جلسة الصوت مستقل عن RTDB).
  // رُفعت 60ث → 180ث: الدقيقة الواحدة كانت تُنزِل متحدثين نشطين من المايك عند
  // تقطع شبكة أطول قليلاً بينما صوتهم عبر جلسة الصوت ما زال شغالاً (نزول ذاتي مفاجئ)
  const SEAT_DISCONNECT_GRACE_MS = 180_000;

  for (const [key, seat] of Object.entries(seats)) {
    const uid = seat?.uid;
    if (!uid) continue;
    // مقعد عليه علامة انقطاع تجاوزت مهلة السماح — صاحبه لم يعُد فعلاً
    const disconnectedAt =
      typeof seat.disconnectedAt === 'number' ? seat.disconnectedAt : 0;
    if (disconnectedAt > 0 && now - disconnectedAt > SEAT_DISCONNECT_GRACE_MS) {
      if (!protectedUids.has(uid)) {
        updates[key] = { uid: '' };
        cleared += 1;
        continue;
      }
    }
    // علامة انقطاع حديثة ضمن المهلة — للمقعد دورة حياته الخاصة (180ث) فعلاً:
    // بدون هذا الـcontinue كان يسقط لقاعدة عضوية الجمهور بالأسفل فيُمسح بعد
    // ~ثانيتين من أي تقطع شبكة عابر (onDisconnect حذف audience+hold لحظياً)
    if (disconnectedAt > 0 && now - disconnectedAt <= SEAT_DISCONNECT_GRACE_MS) continue;
    if (audienceUids.has(uid)) continue;
    if (heldUids.has(uid)) continue;
    if (protectedUids.has(uid)) continue;
    // تواجد خفي أو مقعد جديد قبل اكتمال joinAudience — لا نُفرّغه فوراً
    if (seat.hiddenInRoom === true) continue;
    // انقطاع RTDB حقيقي يترك علامة disconnectedAt (الفرع الأعلى يعالجها بمهلة 60ث).
    // هنا (بلا علامة): بقايا قديمة فقط — القاعدة السابقة بمهلة 120ث من الانضمام.
    const joinedAt = typeof seat.joinedAt === 'number' ? seat.joinedAt : 0;
    if (joinedAt > 0 && now - joinedAt < SEAT_AUDIENCE_GRACE_MS) continue;
    updates[key] = { uid: '' };
    cleared += 1;
  }

  if (cleared > 0) {
    await update(ref(realtimeDb, `rooms/${roomId}/seats`), updates);
    await reconcileAudienceCount(roomId);
  }
  return cleared;
}

let pruneDebounce: ReturnType<typeof setTimeout> | null = null;
let pruneRoomId: string | null = null;

function schedulePruneStaleRoomSeats(roomId: string): void {
  if (pruneDebounce && pruneRoomId === roomId) clearTimeout(pruneDebounce);
  pruneRoomId = roomId;
  pruneDebounce = setTimeout(() => {
    pruneDebounce = null;
    pruneRoomId = null;
    pruneStaleRoomSeats(roomId).catch(() => {});
  }, 2000);
}

/**
 * اشتراك كامل في uids الحضور — تحديث فوري عند child_added / child_removed.
 */
export function subscribeToRoomAudienceUids(
  roomId: string,
  callback: (uids: Set<string>) => void,
): () => void {
  const audRef = ref(realtimeDb, `roomAudience/${roomId}`);
  let current = new Set<string>();
  let seeded = false;

  const emit = () => {
    callback(new Set(current));
  };

  const valueHandler = (snap: DataSnapshot) => {
    current = collectAudienceUids(snap);
    seeded = true;
    emit();
    schedulePruneStaleRoomSeats(roomId);
  };

  const addedHandler = (snap: DataSnapshot) => {
    const uid = (snap.val() as { uid?: string } | null)?.uid ?? snap.key;
    if (!uid) return;
    if (!current.has(uid)) {
      current.add(uid);
      if (seeded) emit();
    }
  };

  const removedHandler = (snap: DataSnapshot) => {
    const uid = snap.key;
    if (!uid || !current.has(uid)) return;
    current.delete(uid);
    if (seeded) emit();
    schedulePruneStaleRoomSeats(roomId);
  };

  onValue(audRef, valueHandler);
  onChildAdded(audRef, addedHandler);
  onChildRemoved(audRef, removedHandler);

  return () => {
    off(audRef, 'value', valueHandler);
    off(audRef, 'child_added', addedHandler);
    off(audRef, 'child_removed', removedHandler);
  };
}

// ==================== JOIN AUDIENCE ====================
// ⚡ الحضور في مسار جذري منفصل roomAudience/{roomId}/{uid} — مفتاح واحد لكل مستخدم

/** هل يستوفي المستخدم شرط ميزة خصوصية حسب إعداد الأدمن (config/privacy)؟ */
async function userMeetsPrivacyRequirement(
  userData: Record<string, unknown> | null | undefined,
  key: PrivacyFeatureKey,
): Promise<boolean> {
  if (!userData) return false;
  try {
    const cfg = await getPrivacyConfigOnce();
    const feature = resolvePrivacyFeatures(cfg).find((f) => f.key === key);
    if (!feature) return false;
    const aristo = readAristocracyState(userData);
    return canUsePrivacyFeature(feature, {
      vipLevel: getEffectiveVipLevel(userData),
      aristocracyLevel: isAristocracyActive(aristo) ? aristo.level : 0,
    });
  } catch {
    return false;
  }
}

async function enrichAudienceAfterJoin(
  roomId: string,
  uid: string,
  audienceRef: ReturnType<typeof ref>,
  isFirstJoin: boolean,
  fallbackName: string,
  fallbackAvatar: string,
): Promise<void> {
  try {
    const { getUser } = await import('./users');
    const me = await getUser(uid);
    const privacy = (me as unknown as { privacySettings?: Record<string, unknown> } | null)
      ?.privacySettings;
    const hideInRoom = privacy?.hideInRoom === true;
    // البوابة نفسها التي تفتح المفتاح في شاشة الخصوصية (config/privacy) —
    // كانت تُفحص هنا بامتياز hiddenPresence (يُفتح عند SVIP12) فلا يعمل الإخفاء
    // لمن فعّله بمستوى أدنى سمحت به إعدادات الأدمن
    if (hideInRoom && (await userMeetsPrivacyRequirement(me as unknown as Record<string, unknown>, 'hideInRoom'))) {
      const seatIdx = await findMySeatInRoom(roomId);
      if (seatIdx !== null) {
        await update(ref(realtimeDb, `rooms/${roomId}/seats/seat_${seatIdx}`), {
          hiddenInRoom: true,
        }).catch(() => {});
        await update(audienceRef, { hiddenInRoom: true }).catch(() => {});
        scheduleReconcileAudienceCount(roomId);
        return;
      }
      await remove(audienceRef).catch(() => {});
      scheduleReconcileAudienceCount(roomId);
      return;
    }

    const displayName = resolveDisplayName(
      {
        displayName: me?.displayName ?? auth.currentUser?.displayName,
        email: me?.email ?? auth.currentUser?.email ?? undefined,
      },
      fallbackName,
    );
    const avatar =
      resolveOfficialUserAvatar(me as unknown as Record<string, unknown>, uid)
      || fallbackAvatar.trim()
      || '';
    await update(audienceRef, { name: displayName, avatar }).catch(() => {});

    if (!isFirstJoin) return;
    // سطر «انضم للغرفة» لكل الغرف — كان مقصوراً على غرف الوكالات، فمالك
    // الغرفة الشخصية لا يعرف أن أحداً دخل حتى يكتب رسالة
    await sendAgencyRoomEntryWelcome(roomId, {
      uid,
      name: displayName,
      avatar,
    }).catch(() => {});
  } catch {
    // ignore — الحضور الأساسي مسجّل مسبقاً
  }
}

export const joinAudience = async (roomId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const audienceRef = ref(realtimeDb, `roomAudience/${roomId}/${user.uid}`);
  const roomSnap = await get(ref(realtimeDb, `rooms/${roomId}`));
  const roomData = (roomSnap.val() ?? {}) as Record<string, unknown>;

  const [, , , existingAudience] = await Promise.all([
    assertNotBlockedFromRoom(roomId, user.uid),
    assertNotBlockedFromAgencyRoom(roomId, user.uid, roomData),
    assertStaffCanEnterRoom(roomId, user.uid),
    get(audienceRef),
  ]);

  const quickName = resolveDisplayName(
    { displayName: user.displayName, email: user.email ?? undefined },
    'مستخدم',
  );
  const quickAvatar = user.photoURL ?? '';

  if (existingAudience.exists()) {
    onDisconnect(audienceRef).remove();
    void set(ref(realtimeDb, `userCurrentRoom/${user.uid}`), {
      roomId,
      at: Date.now(),
    }).catch(() => {});
    scheduleReconcileAudienceCount(roomId);
    void enrichAudienceAfterJoin(
      roomId,
      user.uid,
      audienceRef,
      false,
      quickName,
      quickAvatar,
    );
    return;
  }

  await set(audienceRef, {
    uid: user.uid,
    name: quickName,
    avatar: quickAvatar,
    joinedAt: Date.now(),
  });
  onDisconnect(audienceRef).remove();
  // مؤشر «رومي الحالي» — يسمح بتنظيف حضور شبح من جلسة سابقة عند فتح التطبيق
  void set(ref(realtimeDb, `userCurrentRoom/${user.uid}`), {
    roomId,
    at: Date.now(),
  }).catch(() => {});
  scheduleReconcileAudienceCount(roomId);

  void enrichAudienceAfterJoin(
    roomId,
    user.uid,
    audienceRef,
    true,
    quickName,
    quickAvatar,
  );
};

/** يمنع تكرار رسائل «دخل الغرفة» المتتالية لنفس المستخدم في العرض */
export function compactAgencyEntryMessages(msgs: RoomMessage[]): RoomMessage[] {
  const lastEntryAtByUid = new Map<string, number>();
  return msgs.filter((m) => {
    if (m.type !== 'agency_entry' || !m.uid) return true;
    const ts = typeof m.createdAt === 'number' ? m.createdAt : Date.now();
    const prev = lastEntryAtByUid.get(m.uid);
    if (prev != null && ts - prev < 120_000) return false;
    lastEntryAtByUid.set(m.uid, ts);
    return true;
  });
}

/** رسالة ترحيب مميزة في شات غرفة الوكالة */
export async function sendAgencyRoomEntryWelcome(
  roomId: string,
  user: { uid: string; name: string; avatar?: string },
): Promise<void> {
  if (!roomId || !user.uid) return;
  const messagesRef = ref(realtimeDb, `roomMessages/${roomId}`);
  const recentQ = query(messagesRef, orderByChild('createdAt'), limitToLast(10));
  const recentSnap = await get(recentQ);
  const now = Date.now();
  if (recentSnap.exists()) {
    const recent = Object.values(recentSnap.val() ?? {}) as Array<{ uid?: string; type?: string; createdAt?: number }>;
    for (const msg of recent) {
      if (msg.type !== 'agency_entry' || msg.uid !== user.uid) continue;
      const ts = typeof msg.createdAt === 'number' ? msg.createdAt : now;
      if (now - ts < 120_000) return;
    }
  }
  const newMsgRef = push(messagesRef);
  await set(newMsgRef, {
    uid: user.uid,
    name: user.name,
    avatar: user.avatar ?? '',
    type: 'agency_entry',
    createdAt: serverTimestamp(),
  });
}

// ==================== LEAVE AUDIENCE ====================
export const leaveAudience = async (roomId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) return;

  const audienceRef = ref(realtimeDb, `roomAudience/${roomId}/${user.uid}`);
  const existing = await get(audienceRef);
  if (!existing.exists()) return;

  try {
    await onDisconnect(audienceRef).cancel();
  } catch {
    // ignore
  }

  await remove(audienceRef);
  await vacateSeatsForUid(roomId, user.uid);
  // امسح مؤشر «رومي الحالي» إن كان يشير لهذه الغرفة
  void (async () => {
    const pointerRef = ref(realtimeDb, `userCurrentRoom/${user.uid}`);
    const pointer = await get(pointerRef);
    if (String((pointer.val() as { roomId?: string } | null)?.roomId ?? '') === roomId) {
      await remove(pointerRef);
    }
  })().catch(() => {});
  scheduleReconcileAudienceCount(roomId);
};

/**
 * تنظيف حضور «شبح» من جلسة سابقة — بطاقات الغرف تعرض صورة المستخدم كأنه
 * ما زال داخل الغرفة إذا قُتل التطبيق قبل تسجيل onDisconnect على السيرفر.
 * تُستدعى عند فتح/استئناف التطبيق: لو مؤشر «رومي الحالي» يشير لغرفة لست فيها
 * فعلاً الآن، نزيل حضورنا (جمهور + مقاعد) منها.
 */
export async function cleanupStaleRoomPresence(
  activeRoomId?: string | null,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const pointerRef = ref(realtimeDb, `userCurrentRoom/${user.uid}`);
  const snap = await get(pointerRef).catch(() => null);
  const val = (snap?.val() ?? null) as { roomId?: string; at?: number } | null;
  const staleRoomId = String(val?.roomId ?? '');
  if (!staleRoomId) return;
  if (activeRoomId && staleRoomId === activeRoomId) return;
  // انضمام حديث جداً — غالباً جلسة دخول حية الآن (deep link)؛ onDisconnect يغطيها
  if (Date.now() - (Number(val?.at) || 0) < 90_000) return;
  await leaveAudience(staleRoomId).catch(() => {});
  await remove(pointerRef).catch(() => {});
}

// الاشتراك في الحضور — قائمة فريدة حسب uid (بدون حد = الكل فوراً)
export const subscribeToAudience = (
  roomId: string,
  callback: (audience: RoomAudienceMember[]) => void,
  limit?: number,
): (() => void) => {
  const baseRef = ref(realtimeDb, `roomAudience/${roomId}`);
  const audRef =
    limit != null && limit > 0
      ? query(baseRef, orderByChild('joinedAt'), limitToLast(limit))
      : baseRef;

  const handler = (snap: DataSnapshot) => {
    callback(parseRoomAudienceSnapshot(snap));
    scheduleReconcileAudienceCount(roomId);
    schedulePruneStaleRoomSeats(roomId);
  };
  onValue(audRef, handler);
  return () => off(audRef, 'value', handler);
};

// ==================== SEND MESSAGE ====================
export const sendMessage = async (
  roomId: string,
  text: string,
  sender?: RoomSenderProfile,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  // رقابة برمجية — منع الألفاظ المسيئة في دردشة الغرفة
  const { assertCleanText } = await import('@/utils/textModeration');
  assertCleanText(text);
  // منع الدعاية لتطبيقات منافسة (config/moderation.bannedTerms)
  const { assertNoBannedTerms } = await import('@/utils/moderation');
  assertNoBannedTerms(text);
  await assertUserCanSendRoomChat(roomId, user.uid);

  const { name: displayName, avatar } = await resolveSenderProfile(sender);

  const messagesRef = ref(realtimeDb, `roomMessages/${roomId}`);
  const newMsgRef = push(messagesRef);
  await set(newMsgRef, {
    uid: user.uid,
    name: displayName,
    avatar,
    text,
    type: 'text',
    createdAt: serverTimestamp(),
  });
  schedulePruneExpiredRoomMessages(roomId);
};

export async function sendRoomGameInviteMessage(
  roomId: string,
  payload: {
    sessionId: string;
    gameId: string;
    gameName: string;
    joinCode: string;
    targetUid?: string;
    targetName?: string;
    previewText: string;
  },
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  await assertUserCanSendRoomChat(roomId, user.uid);

  const { name: displayName, avatar } = await resolveSenderProfile();

  const messagesRef = ref(realtimeDb, `roomMessages/${roomId}`);
  const newMsgRef = push(messagesRef);
  await set(newMsgRef, {
    uid: user.uid,
    name: displayName,
    avatar,
    text: payload.previewText,
    type: 'room_game_invite',
    inviteSessionId: payload.sessionId,
    inviteGameId: payload.gameId,
    inviteGameName: payload.gameName,
    inviteJoinCode: payload.joinCode,
    inviteTargetUid: payload.targetUid ?? null,
    inviteTargetName: payload.targetName ?? null,
    createdAt: serverTimestamp(),
  });
};

// ==================== SEND EMOJI ====================
export const sendEmojiMessage = async (
  roomId: string,
  emoji: string,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  await assertUserCanSendRoomChat(roomId, user.uid);
  if (!emoji?.trim()) return;

  const { name: displayName, avatar } = await resolveSenderProfile();

  const messagesRef = ref(realtimeDb, `roomMessages/${roomId}`);
  const newMsgRef = push(messagesRef);
  await set(newMsgRef, {
    uid: user.uid,
    name: displayName,
    avatar,
    text: emoji,
    emoji,
    type: 'emoji',
    createdAt: serverTimestamp(),
  });
};

// ==================== SUBSCRIBE TO MESSAGES ====================
export const subscribeToRoomMessages = (
  roomId: string,
  callback: (messages: RoomMessage[]) => void,
  options?: number | RoomMessagesSubscribeOptions,
): (() => void) => {
  const limit = typeof options === 'number' ? options : (options?.limit ?? 50);
  const sinceMs = typeof options === 'object' ? options.sinceMs : undefined;

  const messagesRef = query(
    ref(realtimeDb, `roomMessages/${roomId}`),
    orderByChild('createdAt'),
    limitToLast(limit),
  );

  // نحتفظ بآخر لقطة خام + بصمة آخر قائمة مُرسلة، لإعادة تطبيق فلتر TTL محلياً بلا قراءة شبكة
  let lastRawData: Record<string, any> = {};
  let lastEmittedLen = -1;
  let lastEmittedId: string | undefined;

  // بناء القائمة النهائية من البيانات الخام (فرز + دمج + فلتر TTL/وقت الدخول)
  const buildMessages = (data: Record<string, any>): RoomMessage[] => {
    const messages: RoomMessage[] = Object.entries(data)
      .map(([id, msg]: [string, any]) => ({ id, ...msg }))
      .sort((a, b) => resolveRoomMessageCreatedAt(a.createdAt) - resolveRoomMessageCreatedAt(b.createdAt));
    const compacted = compactAgencyEntryMessages(messages);
    return filterRoomMessagesForViewer(compacted, { sinceMs });
  };

  const handler = (snapshot: DataSnapshot) => {
    lastRawData = snapshot.val() ?? {};
    const list = buildMessages(lastRawData);
    lastEmittedLen = list.length;
    lastEmittedId = list[list.length - 1]?.id;
    callback(list);
    schedulePruneExpiredRoomMessages(roomId);
  };

  onValue(messagesRef, handler);
  // تكة محلية كل دقيقة: تعيد تطبيق فلتر TTL على آخر لقطة مخزّنة (بلا قراءة شبكة)،
  // وتُحدّث الواجهة فقط عند اختفاء رسائل منتهية الصلاحية (تغيّر الطول أو آخر معرّف)
  const ttlTick = setInterval(() => {
    const list = buildMessages(lastRawData);
    const lastId = list[list.length - 1]?.id;
    if (list.length === lastEmittedLen && lastId === lastEmittedId) return;
    lastEmittedLen = list.length;
    lastEmittedId = lastId;
    callback(list);
  }, 60_000);
  return () => {
    clearInterval(ttlTick);
    off(messagesRef, 'value', handler);
  };
};

/** مسح سجل الدردشة في الغرفة — للمضيف / مدير الوكالة */
export async function clearRoomChatHistory(roomId: string): Promise<void> {
  if (!roomId) throw new Error('معرّف الغرفة غير صالح');
  await remove(ref(realtimeDb, `roomMessages/${roomId}`));
}

// ==================== SEND GIFT IN ROOM ====================
export type RoomGiftMessagePayload = {
  giftId: string;
  giftName: string;
  giftValue: number;
  giftQuantity?: number;
  imageUrl?: string;
  animationUrl?: string;
  soundUrl?: string;
  videoUrl?: string;
  toUid?: string;
  toName?: string;
  isGroupGift?: boolean;
  recipientCount?: number;
};

export const sendGiftInRoom = async (
  roomId: string,
  payload: RoomGiftMessagePayload,
  sender?: RoomSenderProfile,
): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const qty = Math.max(1, Math.min(99, payload.giftQuantity ?? 1));
  const { name: displayName, avatar } = await resolveSenderProfile(sender);

  const messagesRef = ref(realtimeDb, `roomMessages/${roomId}`);
  const newMsgRef = push(messagesRef);
  await set(newMsgRef, {
    uid: user.uid,
    name: displayName,
    avatar,
    type: 'gift',
    giftId: payload.giftId,
    giftName: payload.giftName,
    giftValue: payload.giftValue,
    giftQuantity: qty,
    imageUrl: payload.imageUrl ?? null,
    animationUrl: payload.animationUrl ?? null,
    soundUrl: payload.soundUrl ?? null,
    videoUrl: payload.videoUrl ?? null,
    toUid: payload.toUid ?? null,
    toName: payload.toName ?? null,
    isGroupGift: payload.isGroupGift === true,
    recipientCount: payload.recipientCount ?? null,
    createdAt: serverTimestamp(),
  });

  const giftCoins = Math.max(0, Math.floor(Number(payload.giftValue) || 0));
  await incrementRoomGiftTotal(roomId, giftCoins);

  return newMsgRef.key!;
};

export const updateRoomGiftMessage = async (
  roomId: string,
  messageId: string,
  patch: { giftQuantity: number; giftValue: number },
): Promise<void> => {
  const msgRef = ref(realtimeDb, `roomMessages/${roomId}/${messageId}`);
  await update(msgRef, {
    giftQuantity: patch.giftQuantity,
    giftValue: patch.giftValue,
  });
};

export const incrementRoomGiftTotal = async (roomId: string, giftCoins: number): Promise<void> => {
  if (giftCoins <= 0) return;
  const totalRef = ref(realtimeDb, `rooms/${roomId}/totalGifts`);
  await runTransaction(totalRef, (cur) => (cur ?? 0) + giftCoins);
};

// ==================== END ROOM ====================
export const endRoom = async (roomId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const roomRef = ref(realtimeDb, `rooms/${roomId}`);
  const snap = await get(roomRef);
  if (snap.val()?.hostUid !== user.uid) {
    throw new Error('فقط المضيف يمكنه إغلاق الغرفة');
  }

  await update(roomRef, { isActive: false, updatedAt: Date.now() });
};

// ==================== ARCHIVE (احتفاظ بالروم) ====================
/**
 * أرشفة الروم — يخفيه من القائمة العامة ويطرد كل المشاركين،
 * لكن البيانات (رسائل/أعضاء/إعدادات) تبقى لما يعيد المالك فتحه.
 * فقط المضيف يقدر يأرشف.
 */
export const archiveRoom = async (roomId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const roomRef = ref(realtimeDb, `rooms/${roomId}`);
  const snap = await get(roomRef);
  if (!snap.exists()) throw new Error('الغرفة غير موجودة');
  if (snap.val()?.hostUid !== user.uid) {
    throw new Error('فقط مالك الغرفة يستطيع أرشفتها');
  }

  // أرشفة: نضع علم isArchived + isActive=false
  // البيانات الأخرى (seats/messages/audience) تبقى كما هي
  await update(roomRef, {
    isArchived: true,
    isActive: false,
    archivedAt: Date.now(),
    updatedAt: Date.now(),
  });
};

/**
 * إلغاء الأرشفة — إعادة فتح الروم بنفس البيانات السابقة
 */
export const unarchiveRoom = async (roomId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const roomRef = ref(realtimeDb, `rooms/${roomId}`);
  const snap = await get(roomRef);
  if (!snap.exists()) throw new Error('الغرفة غير موجودة');
  if (snap.val()?.hostUid !== user.uid) {
    throw new Error('فقط مالك الغرفة يستطيع إعادة فتحها');
  }

  await update(roomRef, {
    isArchived: false,
    isActive: true,
    archivedAt: null,
    updatedAt: Date.now(),
  });
};

/**
 * جلب رومات المستخدم المؤرشفة (تظهر في إعدادات الروم)
 */
export const getMyArchivedRooms = async (): Promise<any[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  const allRoomsSnap = await get(ref(realtimeDb, 'rooms'));
  if (!allRoomsSnap.exists()) return [];

  const all = allRoomsSnap.val() as Record<string, any>;
  return Object.entries(all)
    .filter(([_, r]) => r.hostUid === user.uid && r.isArchived === true)
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));
};

// ==================== UPDATE ROOM SETTINGS ====================
/**
 * تحديث إعدادات الغرفة (للمضيف فقط)
 */
export const updateRoomSettings = async (
  roomId: string,
  updates: {
    name?: string;
    category?: Room['category'];
    banner?: string;
    country?: string;
    seatsCount?: 9 | 11 | 16 | 19 | 21;
    isPrivate?: boolean;
    password?: string | null;
    welcomeMessage?: string;
    /** خلفية الروم (رابط صورة) — تخصيص */
    background?: string;
    /** معرّف إطار الروم المفعّل — تخصيص */
    frameId?: string;
    /** وضع الروم: عام/أصدقاء/مقفل */
    mode?: 'public' | 'friend' | 'locked';
    /** إعلان الروم */
    announcement?: { title: string; content: string; autoShow: boolean };
    /** مقعد المدير الثاني (مُفعَّل بعد الشراء) */
    secondHostMic?: boolean;
  },
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const roomRef = ref(realtimeDb, `rooms/${roomId}`);
  const snap = await get(roomRef);
  if (!snap.exists()) throw new Error('الغرفة غير موجودة');
  if (snap.val()?.hostUid !== user.uid) {
    throw new Error('فقط المضيف يمكنه تعديل الإعدادات');
  }

  const roomData = snap.val();

  // غرفة مقفلة بلا كلمة مرور تتجاوزها بوابة الدخول — نرفض الحفظ
  if (updates.mode === 'locked') {
    const finalPassword = String(
      updates.password !== undefined ? updates.password ?? '' : roomData.password ?? '',
    ).trim();
    if (!finalPassword) {
      throw new Error('يجب تعيين كلمة مرور للغرفة المقفلة');
    }
  }

  const cleanUpdates: Record<string, any> = {
    updatedAt: Date.now(),
  };
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      cleanUpdates[key] = value;
    } else if (key === 'password' && value === null) {
      cleanUpdates.password = '';
    }
  });

  if (updates.seatsCount && updates.seatsCount !== roomData.seatsCount) {
    const maxAllowed = await resolveEffectiveMaxSeatsCount(roomData);
    if (updates.seatsCount > maxAllowed) {
      throw new Error(`الحد الأقصى المسموح ${maxAllowed} مايك — تواصل مع الإدارة لزيادة العدد`);
    }
    cleanUpdates.seats = rebuildSeatsForCountChange(roomData, updates.seatsCount);
  }

  await update(roomRef, cleanUpdates);
};

/** تحديث خلفية/إطار الروم مباشرة — للمضيف/مدير الوكالة/مالك الوكالة */
export const patchRoomLiveDecor = async (
  roomId: string,
  patch: { background?: string; frameId?: string },
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const roomRef = ref(realtimeDb, `rooms/${roomId}`);
  const snap = await get(roomRef);
  if (!snap.exists()) throw new Error('الغرفة غير موجودة');
  const roomData = snap.val() ?? {};

  const staff = await loadStaffFieldsForUid(user.uid);
  const roomCountry = await resolveRoomCountryForRoomId(roomId);
  let allowed = effectiveCanManageRoomUsers(roomData, user.uid, staff, roomCountry);

  if (!allowed && roomData.agencyId) {
    const agencyId = String(roomData.agencyId);
    const agencySnap = await getDoc(doc(firestore, 'agencies', agencyId));
    if (agencySnap.exists()) {
      const agencyData = agencySnap.data()!;
      if (String(agencyData.ownerUid ?? '') === user.uid) {
        allowed = true;
      } else {
        const userSnap = await getDoc(doc(firestore, 'users', user.uid));
        const ud = userSnap.data();
        if (
          String(ud?.agencyId ?? '') === agencyId &&
          (ud?.isAgent === true || ud?.agencyRole === 'owner')
        ) {
          allowed = true;
        }
      }
    }
  }

  if (!allowed) throw new Error('غير مصرح بتعديل خلفية الغرفة');

  const cleanUpdates: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.background !== undefined) cleanUpdates.background = patch.background;
  if (patch.frameId !== undefined) cleanUpdates.frameId = patch.frameId;
  await update(roomRef, cleanUpdates);
};

/**
 * شراء مقعد المدير الثاني — يخصم السعر من عملات صاحب الغرفة (مالك الوكالة) ويُفعّل المقعد.
 * يُخزَّن أيضاً على وثيقة الوكالة للثبات.
 */
export const purchaseSecondHostMic = async (
  roomId: string,
  price: number,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const roomRef = ref(realtimeDb, `rooms/${roomId}`);
  const snap = await get(roomRef);
  if (!snap.exists()) throw new Error('الغرفة غير موجودة');
  const roomData = snap.val();
  if (roomData?.hostUid !== user.uid) throw new Error('فقط صاحب الوكالة يمكنه الشراء');
  const alreadyOwned = roomData?.secondHostMicOwned === true || roomData?.secondHostMic === true;
  if (alreadyOwned) {
    if (roomData?.secondHostMic !== true) {
      await update(roomRef, { secondHostMic: true, secondHostMicOwned: true, updatedAt: Date.now() });
    }
    return;
  }

  const { doc: fsDoc, runTransaction } = await import('firebase/firestore');
  const userRef = fsDoc(firestore, 'users', user.uid);
  await runTransaction(firestore, async (tx) => {
    const uSnap = await tx.get(userRef);
    if (!uSnap.exists()) throw new Error('حسابك غير موجود');
    const data = uSnap.data();
    const coins = getUserCoinsFromData(data);
    if (coins < price) {
      throw new Error(`رصيدك غير كافٍ. تحتاج ${price.toLocaleString()} عملة`);
    }
    tx.update(userRef, buildBalanceIncrementPatch('coins', -price));
  });

  await update(roomRef, { secondHostMic: true, secondHostMicOwned: true, updatedAt: Date.now() });

  // تهيئة مقعد المدير الثاني في RTDB (seat_50) إن لم يكن موجوداً
  const seat50Ref = ref(realtimeDb, `rooms/${roomId}/seats/seat_${SECOND_HOST_SEAT_INDEX}`);
  const seat50Snap = await get(seat50Ref);
  if (!seat50Snap.exists() || seat50Snap.val()?.uid === undefined) {
    await set(seat50Ref, { uid: '' });
  }

  // ثبات على وثيقة الوكالة (لو الروم تابعة لوكالة)
  const agencyId = String(roomData?.agencyId ?? '');
  if (agencyId) {
    try {
      const { doc: fsDoc2, updateDoc } = await import('firebase/firestore');
      await updateDoc(fsDoc2(firestore, 'agencies', agencyId), { secondHostMicEnabled: true });
    } catch {
      // ignore — العلم على الروم كافٍ للجلسة الحالية
    }
  }
};

/** إخلاء مقعد المدير الثاني عند إيقاف الميزة */
export async function vacateSecondHostSeat(roomId: string): Promise<void> {
  const seatRef = ref(realtimeDb, `rooms/${roomId}/seats/seat_${SECOND_HOST_SEAT_INDEX}`);
  const snap = await get(seatRef);
  const uid = String(snap.val()?.uid ?? '').trim();
  if (uid) {
    await leaveSeat(roomId, SECOND_HOST_SEAT_INDEX);
  } else {
    await set(seatRef, { uid: '' });
  }
}

// ==================== KICK USER FROM SEAT ====================
/**
 * طرد مستخدم من المقعد (للمضيف فقط)
 */
async function assertCanManageRoom(roomId: string): Promise<Record<string, unknown>> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  const roomRef = ref(realtimeDb, `rooms/${roomId}`);
  const snap = await get(roomRef);
  const roomData = snap.val() ?? {};
  const staff = await loadStaffFieldsForUid(user.uid);
  const roomCountry = await resolveRoomCountryForRoomId(roomId);
  if (!effectiveCanManageRoomUsers(roomData, user.uid, staff, roomCountry)) {
    // مشرف مُعيَّن عبر memberRoles — لا تسقط صلاحياته إذا تأخرت مزامنة coHosts
    const memberRoles = (roomData as { memberRoles?: Record<string, string> }).memberRoles ?? {};
    if (memberRoles[user.uid] !== 'yellow_supervisor') {
      throw new Error('ليس لديك صلاحية إدارة الغرفة');
    }
  }
  return roomData;
}

export const kickUserFromSeat = async (
  roomId: string,
  seatIdx: number,
): Promise<void> => {
  const roomData = await assertCanManageRoom(roomId);
  const seatUid = (
    await get(ref(realtimeDb, `rooms/${roomId}/seats/seat_${seatIdx}/uid`))
  ).val();
  if (seatUid) {
    await assertAgencyManageTargetAllowed(roomId, String(seatUid), 'removeMic', roomData);
  }
  if (seatUid && (await checkUserHasVipFeature(String(seatUid), 'antiKick'))) {
    throw new Error('لا يمكن طرد هذا العضو — امتياز SVIP «ضد الطرد»');
  }
  const seatRef = ref(realtimeDb, `rooms/${roomId}/seats/seat_${seatIdx}`);
  await set(seatRef, { uid: '' });
  if (seatUid) {
    await set(ref(realtimeDb, `rooms/${roomId}/seatSupport/${seatUid}`), null).catch(() => {});
    const managedMicLock = await getManagedMicSeatLock(roomId, String(seatUid));
    if (managedMicLock?.active && managedMicLock.seatIdx === seatIdx) {
      await setManagedMicSeatLock(roomId, String(seatUid), seatIdx, false).catch(() => {});
    }
  }
};

/** إنزال مستخدم من المايك بالـ uid (للمضيف/مدير الوكالة) */
export const hostRemoveUserFromMic = async (
  roomId: string,
  targetUid: string,
): Promise<void> => {
  if (!targetUid) throw new Error('معرّف المستخدم مطلوب');
  if (await checkUserHasVipFeature(targetUid, 'antiKick')) {
    throw new Error('لا يمكن طرد هذا العضو — امتياز SVIP «ضد الطرد»');
  }
  const roomData = await assertCanManageRoom(roomId);
  await assertAgencyManageTargetAllowed(roomId, targetUid, 'removeMic', roomData);
  let seats = (roomData.seats ?? {}) as Record<string, { uid?: string }>;
  const hostUid = String(roomData.hostUid ?? '');

  const findTargetSeatIdx = (map: Record<string, { uid?: string }>): number | null => {
    for (const [key, s] of Object.entries(map)) {
      if (s?.uid !== targetUid) continue;
      const idx = parseInt(String(key).replace('seat_', ''), 10);
      if (Number.isNaN(idx)) throw new Error('مقعد غير صالح');
      return idx;
    }
    return null;
  };

  let seatIdxFound = findTargetSeatIdx(seats);
  if (seatIdxFound === null) {
    // «المستخدم ليس على المايك» رغم ظهوره على المقعد — القراءة قد تكون أقدم من
    // جلوسه للتو؛ مهلة سماح قصيرة ثم قراءة حديثة قبل الفشل (نفس سماحية changeSeat)
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const retrySnap = await get(ref(realtimeDb, `rooms/${roomId}/seats`));
    seats = (retrySnap.val() ?? {}) as Record<string, { uid?: string }>;
    seatIdxFound = findTargetSeatIdx(seats);
  }
  if (seatIdxFound === null) throw new Error('المستخدم ليس على المايك');
  const idx = seatIdxFound;
  if (idx === 0 && targetUid === hostUid) {
    throw new Error('لا يمكن إنزال المضيف من المايك');
  }
  await set(ref(realtimeDb, `rooms/${roomId}/seats/seat_${idx}`), { uid: '' });
  await set(ref(realtimeDb, `rooms/${roomId}/seatSupport/${targetUid}`), null).catch(() => {});
  const managedMicLock = await getManagedMicSeatLock(roomId, targetUid);
  if (managedMicLock?.active && managedMicLock.seatIdx === idx) {
    await setManagedMicSeatLock(roomId, targetUid, idx, false).catch(() => {});
  }
  await reconcileAudienceCount(roomId);
};

/** كتم/فتح مايك مستخدم على المقعد (للمضيف/مدير الوكالة) */
export const hostToggleUserMicMute = async (
  roomId: string,
  targetUid: string,
): Promise<boolean> => {
  if (!targetUid) throw new Error('معرّف المستخدم مطلوب');
  const roomDataForMute = await assertCanManageRoom(roomId);
  // قواعد الرُتب: لا كتم للوكيل، ولا مشرف↔مشرف — نفس قواعد الطرد/الإنزال
  await assertAgencyManageTargetAllowed(roomId, targetUid, 'mute', roomDataForMute);
  const seatsSnap = await get(ref(realtimeDb, `rooms/${roomId}/seats`));
  let seats = (seatsSnap.val() ?? {}) as Record<string, { uid?: string; isMuted?: boolean }>;
  if (!Object.values(seats).some((s) => s?.uid === targetUid)) {
    // «المستخدم ليس على المايك» رغم ظهوره على المقعد — جلوسه للتو قد لا يكون
    // انتشر بعد؛ مهلة سماح قصيرة ثم قراءة ثانية قبل الفشل (نفس سماحية changeSeat)
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const retrySnap = await get(ref(realtimeDb, `rooms/${roomId}/seats`));
    seats = (retrySnap.val() ?? {}) as Record<string, { uid?: string; isMuted?: boolean }>;
  }
  for (const [key, seat] of Object.entries(seats)) {
    if (seat?.uid !== targetUid) continue;
    const idx = parseInt(String(key).replace('seat_', ''), 10);
    if (Number.isNaN(idx)) throw new Error('مقعد غير صالح');
    const nextMuted = !(seat.isMuted === true);
    await toggleMute(roomId, idx, nextMuted);
    // كتم فعلي على خادم الصوت — يوقف البث حتى لو تجاهل جهاز المكتوم العلامة.
    // بالخلفية: العلامة كُتبت أعلاه، وفشل الاستدعاء لا يُبطل العملية.
    void import('firebase/functions')
      .then(({ httpsCallable }) =>
        httpsCallable(functions, 'setRoomParticipantMuted')({
          roomId,
          targetUid,
          muted: nextMuted,
        }),
      )
      .catch(() => {});
    return nextMuted;
  }
  throw new Error('المستخدم ليس على المايك');
};

/** إيقاف/تفعيل الكتابة والتعليقات في شات الغرفة */
export const hostSetUserChatMuted = async (
  roomId: string,
  targetUid: string,
  muted: boolean,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  if (!targetUid) throw new Error('معرّف المستخدم مطلوب');
  const roomDataForChatMute = await assertCanManageRoom(roomId);
  // كتم الشات يتبع نفس قواعد رُتب الكتم — لا كتم للوكيل ولا مشرف↔مشرف
  await assertAgencyManageTargetAllowed(roomId, targetUid, 'mute', roomDataForChatMute);
  const path = `rooms/${roomId}/chatMutedUsers/${targetUid}`;
  if (muted) {
    await set(ref(realtimeDb, path), {
      mutedAt: Date.now(),
      mutedBy: user.uid,
    });
  } else {
    await set(ref(realtimeDb, path), null);
  }
};

export const hostToggleUserChatMuted = async (
  roomId: string,
  targetUid: string,
): Promise<boolean> => {
  const snap = await get(ref(realtimeDb, `rooms/${roomId}/chatMutedUsers/${targetUid}`));
  const next = !snap.exists();
  await hostSetUserChatMuted(roomId, targetUid, next);
  return next;
};

// ==================== BLOCK USER FROM ROOM ====================

export interface RoomBlockedUser {
  uid: string;
  blockedAt: number;
  /** null = حظر دائم — غير موجود = دائم (بيانات قديمة) */
  blockedUntil?: number | null;
  blockedBy?: string;
  displayName?: string;
  avatar?: string;
}

interface AgencyBlockedUser {
  uid: string;
  blockedAt: number;
  /** null = دائم */
  blockedUntil?: number | null;
  blockedBy?: string;
  displayName?: string;
  avatar?: string;
  roomId?: string;
}

export type RoomBlockOptions =
  | { permanent: true }
  | { permanent?: false; duration: RoomBlockDuration };

function parseRoomBlockedEntry(uid: string, raw: unknown): RoomBlockedUser {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    uid,
    blockedAt: Number(data.blockedAt) || Date.now(),
    blockedUntil:
      data.blockedUntil === null || data.blockedUntil === undefined
        ? data.blockedUntil === null
          ? null
          : undefined
        : Number(data.blockedUntil) || null,
    blockedBy: data.blockedBy ? String(data.blockedBy) : undefined,
    displayName: data.displayName ? String(data.displayName) : undefined,
    avatar: data.avatar ? String(data.avatar) : undefined,
  };
}

function parseAgencyBlockedEntry(uid: string, raw: unknown): AgencyBlockedUser {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    uid,
    blockedAt: Number(data.blockedAt) || Date.now(),
    blockedUntil:
      data.blockedUntil === null || data.blockedUntil === undefined
        ? data.blockedUntil === null
          ? null
          : undefined
        : Number(data.blockedUntil) || null,
    blockedBy: data.blockedBy ? String(data.blockedBy) : undefined,
    displayName: data.displayName ? String(data.displayName) : undefined,
    avatar: data.avatar ? String(data.avatar) : undefined,
    roomId: data.roomId ? String(data.roomId) : undefined,
  };
}

async function purgeExpiredRoomBlock(roomId: string, uid: string, entry: RoomBlockedUser): Promise<boolean> {
  if (entry.blockedUntil != null && !isRoomBlockActive(entry.blockedUntil)) {
    await set(ref(realtimeDb, `rooms/${roomId}/blockedUsers/${uid}`), null);
    return true;
  }
  return false;
}

async function purgeExpiredAgencyBlock(
  agencyId: string,
  uid: string,
  entry: AgencyBlockedUser,
): Promise<boolean> {
  if (entry.blockedUntil != null && !isRoomBlockActive(entry.blockedUntil)) {
    await set(ref(realtimeDb, `agencyBlockedUsers/${agencyId}/${uid}`), null);
    return true;
  }
  return false;
}

async function assertNotBlockedFromAgencyRoom(
  roomId: string,
  uid: string,
  roomDataMaybe?: Record<string, unknown>,
): Promise<void> {
  const roomData =
    roomDataMaybe
    ?? ((await get(ref(realtimeDb, `rooms/${roomId}`))).val() as Record<string, unknown> | null)
    ?? {};
  const agencyId = String(roomData.agencyId ?? '').trim();
  if (!agencyId) return;

  const blockedRef = ref(realtimeDb, `agencyBlockedUsers/${agencyId}/${uid}`);
  const snap = await get(blockedRef);
  if (!snap.exists()) return;

  const entry = parseAgencyBlockedEntry(uid, snap.val());
  if (await purgeExpiredAgencyBlock(agencyId, uid, entry)) return;
  if (!isRoomBlockActive(entry.blockedUntil)) return;

  // امتياز SVIP «إلغاء الحظر»: يتجاوز حظر الوكالة عند الدخول
  if (await checkUserHasVipFeature(uid, 'removeBan')) return;

  const remaining = formatBlockRemaining(entry.blockedUntil, 'ar');
  throw new Error(`أنت مطرود من الوكالة. المدة المتبقية: ${remaining}`);
}

async function evictUserFromAllAgencyRooms(agencyId: string, targetUid: string): Promise<void> {
  const roomsRef = query(ref(realtimeDb, 'rooms'), orderByChild('agencyId'), equalTo(agencyId));
  const roomsSnap = await get(roomsRef);
  if (!roomsSnap.exists()) return;

  const roomsData = roomsSnap.val() as Record<string, { seats?: Record<string, { uid?: string }> }>;
  await Promise.all(
    Object.entries(roomsData).map(async ([agencyRoomId, agencyRoom]) => {
      const seatUpdates: Record<string, unknown> = {};
      for (const [seatKey, seatData] of Object.entries(agencyRoom?.seats ?? {})) {
        if (seatData?.uid === targetUid) {
          seatUpdates[seatKey] = { uid: '' };
        }
      }

      await Promise.all([
        Object.keys(seatUpdates).length > 0
          ? update(ref(realtimeDb, `rooms/${agencyRoomId}/seats`), seatUpdates).catch(() => {})
          : Promise.resolve(),
        remove(ref(realtimeDb, `roomAudience/${agencyRoomId}/${targetUid}`)).catch(() => {}),
        set(ref(realtimeDb, `rooms/${agencyRoomId}/seatSupport/${targetUid}`), null).catch(() => {}),
        set(ref(realtimeDb, `rooms/${agencyRoomId}/managedMicLocks/${targetUid}`), null).catch(() => {}),
        remove(ref(realtimeDb, `roomSeatHold/${agencyRoomId}/${targetUid}`)).catch(() => {}),
      ]);

      await reconcileAudienceCount(agencyRoomId).catch(() => {});
    }),
  );
}

/** هل المستخدم محظور حالياً من الغرفة؟ */
export async function isUserBlockedFromRoom(roomId: string, uid: string): Promise<boolean> {
  const blockedRef = ref(realtimeDb, `rooms/${roomId}/blockedUsers/${uid}`);
  const snap = await get(blockedRef);
  if (!snap.exists()) return false;
  const entry = parseRoomBlockedEntry(uid, snap.val());
  if (await purgeExpiredRoomBlock(roomId, uid, entry)) return false;
  return isRoomBlockActive(entry.blockedUntil);
}

async function assertNotBlockedFromRoom(roomId: string, uid: string): Promise<void> {
  if (await isUserBlockedFromRoom(roomId, uid)) {
    // امتياز SVIP «إلغاء الحظر»: يتجاوز حظر الغرفة عند الدخول
    if (await checkUserHasVipFeature(uid, 'removeBan')) return;
    throw new Error('أنت محظور من هذه الغرفة');
  }
}

/**
 * حظر مستخدم من الغرفة — مع مدة اختيارية
 */
export const blockUserFromRoom = async (
  roomId: string,
  blockedUid: string,
  options?: RoomBlockOptions,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  const roomData = await assertCanManageRoom(roomId);
  await assertAgencyManageTargetAllowed(roomId, blockedUid, 'block', roomData);

  // امتياز SVIP «ضد الطرد»: لا يمكن طرد/حظر عضو يملكه
  if (await checkUserHasVipFeature(blockedUid, 'antiKick')) {
    throw new Error('لا يمكن طرد هذا العضو — امتياز SVIP «ضد الطرد»');
  }

  let blockedUntil: number | null | undefined;
  if (options?.permanent) {
    blockedUntil = null;
  } else if (options?.duration) {
    blockedUntil = computeBlockedUntil(options.duration);
  }

  let displayName: string | undefined;
  let avatar: string | undefined;
  try {
    const userSnap = await getDoc(doc(firestore, 'users', blockedUid));
    if (userSnap.exists()) {
      const d = userSnap.data();
      displayName = resolveDisplayName(
        { displayName: d.profile?.displayName ?? d.displayName },
        'مستخدم',
      );
      avatar = d.profile?.avatar ?? d.avatar ?? '';
    }
  } catch {
    // ignore
  }

  const blockedRef = ref(realtimeDb, `rooms/${roomId}/blockedUsers/${blockedUid}`);
  await set(blockedRef, {
    uid: blockedUid,
    blockedAt: Date.now(),
    blockedUntil: blockedUntil ?? null,
    blockedBy: user.uid,
    displayName,
    avatar,
  });

  const agencyId = String((roomData as { agencyId?: string }).agencyId ?? '').trim();
  if (agencyId) {
    const agencyBlockedRef = ref(realtimeDb, `agencyBlockedUsers/${agencyId}/${blockedUid}`);
    await set(agencyBlockedRef, {
      uid: blockedUid,
      blockedAt: Date.now(),
      blockedUntil: blockedUntil ?? null,
      blockedBy: user.uid,
      displayName,
      avatar,
      roomId,
    });
    await evictUserFromAllAgencyRooms(agencyId, blockedUid);
  }

  const seats = roomData.seats ?? {};
  for (const [seatKey, seatData] of Object.entries(seats)) {
    if ((seatData as any)?.uid === blockedUid) {
      const seatRef = ref(realtimeDb, `rooms/${roomId}/seats/${seatKey}`);
      await set(seatRef, { uid: '' });
    }
  }

  await remove(ref(realtimeDb, `roomAudience/${roomId}/${blockedUid}`)).catch(() => {});
  await reconcileAudienceCount(roomId);
};

/** طرد مستخدم من الغرفة (حظر + إخراج من المقعد والحضور) */
export const kickUserFromRoom = async (
  roomId: string,
  targetUid: string,
  options?: RoomBlockOptions,
): Promise<void> => {
  if (!targetUid) throw new Error('معرّف المستخدم مطلوب');
  await blockUserFromRoom(roomId, targetUid, options ?? { permanent: true });
};

/**
 * قفل/فتح مقعد فارغ — للوكيل والمشرفين
 */
export async function setSeatLocked(
  roomId: string,
  seatIdx: number,
  locked: boolean,
): Promise<void> {
  if (seatIdx === 0) throw new Error('لا يمكن قفل مقعد المضيف');
  if (seatIdx !== SECOND_HOST_SEAT_INDEX && seatIdx < 1) {
    throw new Error('رقم المقعد غير صالح');
  }
  const roomData = await assertCanManageRoom(roomId);
  const seats = (roomData.seats ?? {}) as Record<string, Record<string, unknown> & { uid?: string }>;
  const seatKey = `seat_${seatIdx}`;
  const occupant = seats[seatKey]?.uid;

  // إغلاق مايك مشغول: ننقل شاغله تلقائياً إلى أقرب مايك فارغ غير مقفول (#7)
  // — لا يُنزَل أحد إلا إذا لم يبقَ أي مايك مفتوح فارغ.
  if (locked && occupant && seatIdx !== SECOND_HOST_SEAT_INDEX) {
    const seatsCount = Number(roomData.seatsCount) || 9;
    let targetIdx = -1;
    for (let dist = 1; dist < seatsCount && targetIdx < 0; dist++) {
      for (const cand of [seatIdx - dist, seatIdx + dist]) {
        if (cand < 1 || cand >= seatsCount) continue;
        const candUid = seats[`seat_${cand}`]?.uid ?? '';
        if (candUid === '' && !isSeatLocked(roomData, cand)) {
          targetIdx = cand;
          break;
        }
      }
    }

    if (targetIdx >= 0) {
      const occupantSeat = { ...seats[seatKey] } as Record<string, unknown>;
      await transactionAssignSeat(roomId, targetIdx, occupant, occupantSeat);
      // مايك مقيّد (مدعو من الإدارة) — حدّث رقم مقعده المقفول للموقع الجديد
      const micLock = await getManagedMicSeatLock(roomId, occupant);
      if (micLock?.active && micLock.seatIdx === seatIdx) {
        await setManagedMicSeatLock(roomId, occupant, targetIdx, true).catch(() => {});
      }
    } else {
      // لا مايك فارغاً — عندها فقط يُنزَل الشاغل
      await set(ref(realtimeDb, `rooms/${roomId}/seats/${seatKey}`), { uid: '' });
      await set(ref(realtimeDb, `rooms/${roomId}/seatSupport/${occupant}`), null).catch(() => {});
      const micLock = await getManagedMicSeatLock(roomId, occupant);
      if (micLock?.active && micLock.seatIdx === seatIdx) {
        await setManagedMicSeatLock(roomId, occupant, seatIdx, false).catch(() => {});
      }
    }
  } else if (locked && occupant) {
    throw new Error('لا يمكن قفل مقعد مشغول');
  }

  await update(ref(realtimeDb, `rooms/${roomId}`), {
    [`lockedSeats/${seatKey}`]: locked ? true : null,
    updatedAt: Date.now(),
  });
}

/**
 * المضيف/وكيل الوكالة يضيف مستخدماً لمقعد فارغ (بدون رسم)
 */
export const hostAssignUserToSeat = async (
  roomId: string,
  targetUid: string,
  preferredSeatIdx?: number,
): Promise<number> => {
  const roomData = await assertCanManageRoom(roomId);
  const seats = (roomData.seats ?? {}) as Record<string, { uid?: string }>;
  const seatCount = Number(roomData.seatsCount) || 9;

  for (const [key, s] of Object.entries(seats)) {
    if (s?.uid === targetUid) {
      const idx = parseInt(String(key).replace('seat_', ''), 10);
      if (!Number.isNaN(idx)) return idx;
    }
  }

  let emptyIdx = -1;
  if (preferredSeatIdx != null) {
    if (preferredSeatIdx === SECOND_HOST_SEAT_INDEX) {
      if (roomData.secondHostMic !== true) throw new Error('مقعد المدير الثاني غير مفعّل');
      const key = `seat_${preferredSeatIdx}`;
      if (seats[key]?.uid) throw new Error('المقعد محجوز');
      emptyIdx = preferredSeatIdx;
    } else if (preferredSeatIdx <= 0 || preferredSeatIdx >= seatCount) {
      throw new Error('رقم المقعد غير صالح');
    } else {
      const key = `seat_${preferredSeatIdx}`;
      if (seats[key]?.uid) throw new Error('المقعد محجوز');
      emptyIdx = preferredSeatIdx;
    }
  } else {
    for (let i = 1; i < seatCount; i++) {
      const key = `seat_${i}`;
      const uid = seats[key]?.uid;
      if (!uid && !isSeatLocked(roomData, i)) {
        emptyIdx = i;
        break;
      }
    }
  }
  if (emptyIdx < 0) throw new Error('لا توجد مقاعد فارغة');

  if (isSeatLocked(roomData, emptyIdx)) {
    throw new Error('المقعد مقفل — افتحه أولاً');
  }

  const userSnap = await getDoc(doc(firestore, 'users', targetUid));
  if (!userSnap.exists()) throw new Error('المستخدم غير موجود');
  const userData = userSnap.data();

  const hostAssignRoleSnap = await get(ref(realtimeDb, `rooms/${roomId}/memberRoles/${targetUid}`));
  const hostAssignRole = hostAssignRoleSnap.val();
  if (hostAssignRole === 'cancelled') {
    throw new Error('عضوية هذا المستخدم ملغاة في الغرفة');
  }

  const displayName = resolveDisplayName(
    {
      displayName: userData.profile?.displayName ?? userData.displayName,
    },
    'مستخدم',
  );
  const avatar = userData.profile?.avatar ?? userData.avatar ?? '';
  const seatPayload = buildSeatPublicData(
    userData as Record<string, unknown>,
    targetUid,
    displayName,
    avatar,
    toSafeInt(getUserCoins(userData as Record<string, unknown>), 0),
  );

  await transactionAssignSeat(roomId, emptyIdx, targetUid, {
    ...seatPayload,
    paidFee: 0,
    invitedByHost: true,
  });
  await setManagedMicSeatLock(roomId, targetUid, emptyIdx, true);

  if (emptyIdx === SECOND_HOST_SEAT_INDEX) {
    if (!canAssignUserToSecondHostSeat(roomData, targetUid, hostAssignRole)) {
      throw new Error('مقعد المدير للإشراف فقط — لا يمكن دعوة الأعضاء');
    }
  }

  await reconcileAudienceCount(roomId);
  return emptyIdx;
};

/**
 * المستخدم المدعو يقبل دعوة المايك — يُمنح عضوية الغرفة ثم مقعد بدون رسم
 */
export const acceptInvitedMicSeat = async (
  roomId: string,
  options?: { seatIdx?: number; includeMembership?: boolean },
): Promise<number> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  // قراءات متوازية — كانت متسلسلة فيطول قبول الدعوة كثيراً على الشبكات البطيئة
  const [roomSnap, roleSnap, userSnap, invitesSnap] = await Promise.all([
    get(ref(realtimeDb, `rooms/${roomId}`)),
    get(ref(realtimeDb, `rooms/${roomId}/memberRoles/${user.uid}`)),
    getDoc(doc(firestore, 'users', user.uid)),
    get(ref(realtimeDb, `roomMicInvites/${user.uid}`)),
  ]);
  if (!roomSnap.exists()) throw new Error('الغرفة غير موجودة');
  const roomData = roomSnap.val() as Record<string, unknown>;
  const seats = (roomData.seats ?? {}) as Record<string, { uid?: string }>;
  const seatCount = Number(roomData.seatsCount) || 9;

  for (const [key, s] of Object.entries(seats)) {
    if (s?.uid === user.uid) {
      const idx = parseInt(String(key).replace('seat_', ''), 10);
      if (!Number.isNaN(idx)) return idx;
    }
  }

  // تحصين: لا نمنح مقعداً مجانياً + عضوية إلا بوجود دعوة مايك معلّقة سارية فعلاً لهذه الغرفة
  // (كانت الدالة تثق بالمُستدعي فقط) — نبحث في دعوات هذا المستخدم عن واحدة لم تنتهِ صلاحيتها
  const invites = (invitesSnap.val() ?? {}) as Record<
    string,
    { roomId?: string; status?: string; expiresAt?: number }
  >;
  const nowMs = Date.now();
  const hasValidInvite = Object.values(invites).some(
    (inv) => inv?.roomId === roomId && inv?.status === 'pending' && Number(inv?.expiresAt) > nowMs,
  );
  if (!hasValidInvite) throw new Error('لا توجد دعوة مايك صالحة');

  const includeMembership = options?.includeMembership === true;
  const existingRole = roleSnap.val();
  if (existingRole === 'cancelled') {
    throw new Error('عضويتك ملغاة في هذه الغرفة — لا يمكن قبول دعوة المايك');
  }
  if (
    includeMembership &&
    existingRole !== 'blue_supervisor' &&
    existingRole !== 'yellow_supervisor'
  ) {
    await set(ref(realtimeDb, `rooms/${roomId}/memberRoles/${user.uid}`), 'red_member');
  }

  let emptyIdx = -1;
  const preferred = options?.seatIdx;
  if (preferred != null && preferred >= 0) {
    if (preferred === SECOND_HOST_SEAT_INDEX) {
      if (roomData.secondHostMic !== true) throw new Error('مقعد المدير الثاني غير مفعّل');
      const key = `seat_${preferred}`;
      if (seats[key]?.uid) throw new Error('المقعد محجوز');
      emptyIdx = preferred;
    } else if (preferred > 0 && preferred < seatCount) {
      const key = `seat_${preferred}`;
      if (seats[key]?.uid) throw new Error('المقعد محجوز');
      emptyIdx = preferred;
    }
  }

  if (emptyIdx < 0) {
    for (let i = 1; i < seatCount; i++) {
      const key = `seat_${i}`;
      const uid = seats[key]?.uid;
      if (!uid && !isSeatLocked(roomData, i)) {
        emptyIdx = i;
        break;
      }
    }
  }
  if (emptyIdx < 0) throw new Error('لا توجد مقاعد فارغة');
  if (isSeatLocked(roomData, emptyIdx)) throw new Error('المقعد مقفل');

  const resolvedRole =
    existingRole === 'yellow_supervisor' || existingRole === 'blue_supervisor'
      ? existingRole
      : 'red_member';

  if (emptyIdx === SECOND_HOST_SEAT_INDEX) {
    if (!canAssignUserToSecondHostSeat(roomData, user.uid, resolvedRole)) {
      throw new Error('مقعد المدير للإشراف فقط — لا يمكن للأعضاء الجلوس عليه');
    }
  }

  if (!userSnap.exists()) throw new Error('المستخدم غير موجود');
  const userData = userSnap.data();

  const displayName = resolveDisplayName(
    {
      displayName: userData.profile?.displayName ?? userData.displayName,
    },
    'مستخدم',
  );
  const avatar = userData.profile?.avatar ?? userData.avatar ?? '';
  const seatPayload = buildSeatPublicData(
    userData as Record<string, unknown>,
    user.uid,
    displayName,
    avatar,
    toSafeInt(getUserCoins(userData as Record<string, unknown>), 0),
  );

  await joinAudience(roomId).catch(() => {});
  await transactionAssignSeat(roomId, emptyIdx, user.uid, {
    ...seatPayload,
    paidFee: 0,
    invitedByHost: true,
  });
  if (!includeMembership) {
    await setManagedMicSeatLock(roomId, user.uid, emptyIdx, true);
  } else {
    await set(ref(realtimeDb, `rooms/${roomId}/managedMicLocks/${user.uid}`), null).catch(() => {});
  }

  void bindSeatOnDisconnect(roomId, emptyIdx);
  await reconcileAudienceCount(roomId);
  return emptyIdx;
};

// ==================== UNBLOCK USER ====================
export const unblockUserFromRoom = async (
  roomId: string,
  blockedUid: string,
): Promise<void> => {
  const roomData = await assertCanManageRoom(roomId);
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const isHost = String(roomData.hostUid ?? '') === user.uid;
  if (!isHost) {
    const staff = await loadStaffFieldsForUid(user.uid);
    const roomCountry = await resolveRoomCountryForRoomId(roomId);
    const isStaff = staffCanKickOrManageUsers(staff, roomCountry);
    if (!isStaff) {
      const perms = parseRoomPermissions(roomData);
      if (!perms.moderatorsCanKickBan && !perms.moderatorsCanBlockUsers) {
        throw new Error('ليس لديك صلاحية إزالة الحظر');
      }
    }
  }

  await set(ref(realtimeDb, `rooms/${roomId}/blockedUsers/${blockedUid}`), null);

  const agencyId = String((roomData as { agencyId?: string }).agencyId ?? '').trim();
  if (agencyId) {
    await set(ref(realtimeDb, `agencyBlockedUsers/${agencyId}/${blockedUid}`), null);
  }
};

// ==================== GET ROOM BLOCKED USERS ====================
export const getRoomBlockedUsers = async (roomId: string): Promise<RoomBlockedUser[]> => {
  const blockedRef = ref(realtimeDb, `rooms/${roomId}/blockedUsers`);
  const snap = await get(blockedRef);
  if (!snap.exists()) return [];

  const raw = snap.val() ?? {};
  const active: RoomBlockedUser[] = [];

  for (const [uid, entry] of Object.entries(raw)) {
    const parsed = parseRoomBlockedEntry(uid, entry);
    if (await purgeExpiredRoomBlock(roomId, uid, parsed)) continue;
    if (!isRoomBlockActive(parsed.blockedUntil)) continue;

    if (!parsed.displayName) {
      try {
        const userSnap = await getDoc(doc(firestore, 'users', uid));
        if (userSnap.exists()) {
          const d = userSnap.data();
          parsed.displayName = resolveDisplayName(
            { displayName: d.profile?.displayName ?? d.displayName },
            'مستخدم',
          );
          parsed.avatar = d.profile?.avatar ?? d.avatar ?? '';
        }
      } catch {
        // ignore
      }
    }

    active.push(parsed);
  }

  active.sort((a, b) => b.blockedAt - a.blockedAt);
  return active;
};

// ==================== TRANSFER HOST ROLE ====================
/**
 * نقل صلاحية المضيف لشخص آخر
 */
export const transferHostRole = async (
  roomId: string,
  newHostUid: string,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const roomRef = ref(realtimeDb, `rooms/${roomId}`);
  const snap = await get(roomRef);
  if (snap.val()?.hostUid !== user.uid) {
    throw new Error('فقط المضيف يمكنه نقل الصلاحيات');
  }

  // الحصول على معلومات المضيف الجديد من Firestore
  const { getDoc, doc: docRef } = await import('firebase/firestore');
  const userSnap = await getDoc(docRef(firestore, 'users', newHostUid));
  if (!userSnap.exists()) throw new Error('المستخدم غير موجود');

  const userData = userSnap.data();
  await update(roomRef, {
    hostUid: newHostUid,
    hostName: userData.displayName ?? 'مضيف',
    hostAvatar: userData.avatar ?? '',
    updatedAt: Date.now(),
  });
};

// ==================== SEED DEMO ROOMS ====================
// تستخدم لإنشاء غرف تجريبية حقيقية في Firebase
export const seedDemoRooms = async (): Promise<void> => {
  const roomsRef = ref(realtimeDb, 'rooms');
  const snap = await get(roomsRef);
  if (snap.exists() && Object.keys(snap.val()).length > 0) {
    console.log('Rooms already seeded');
    return;
  }

  const demoRooms = [
    {
      name: 'غرفة الحوار العربي',
      hostUid: 'demo_host_1',
      hostName: 'محمد العتيبي',
      hostAvatar: 'https://i.pravatar.cc/200?img=15',
      country: 'SA',
      category: 'general' as const,
      banner: 'https://picsum.photos/seed/room1/400/200',
      isPrivate: false,
      seatsCount: 9,
      audienceCount: 47,
      totalGifts: 12500,
    },
    {
      name: 'موسيقى عربية كلاسيكية',
      hostUid: 'demo_host_2',
      hostName: 'سارة أحمد',
      hostAvatar: 'https://i.pravatar.cc/200?img=44',
      country: 'EG',
      category: 'music' as const,
      banner: 'https://picsum.photos/seed/room2/400/200',
      isPrivate: false,
      seatsCount: 9,
      audienceCount: 89,
      totalGifts: 25400,
    },
    {
      name: 'لعبة Ludo Master',
      hostUid: 'demo_host_3',
      hostName: 'يوسف الفهد',
      hostAvatar: 'https://i.pravatar.cc/200?img=33',
      country: 'AE',
      category: 'gaming' as const,
      banner: 'https://picsum.photos/seed/room3/400/200',
      isPrivate: false,
      seatsCount: 19,
      audienceCount: 132,
      totalGifts: 45800,
    },
    {
      name: 'محبي الشعر النبطي',
      hostUid: 'demo_host_4',
      hostName: 'علي القحطاني',
      hostAvatar: 'https://i.pravatar.cc/200?img=8',
      country: 'KW',
      category: 'arabic' as const,
      banner: 'https://picsum.photos/seed/room4/400/200',
      isPrivate: false,
      seatsCount: 9,
      audienceCount: 28,
      totalGifts: 8200,
    },
    {
      name: 'مذاكرة وتركيز',
      hostUid: 'demo_host_5',
      hostName: 'ليلى المغربية',
      hostAvatar: 'https://i.pravatar.cc/200?img=45',
      country: 'MA',
      category: 'study' as const,
      banner: 'https://picsum.photos/seed/room5/400/200',
      isPrivate: false,
      seatsCount: 9,
      audienceCount: 15,
      totalGifts: 2400,
    },
    {
      name: 'تعارف وصداقات',
      hostUid: 'demo_host_6',
      hostName: 'فاطمة الزهراء',
      hostAvatar: 'https://i.pravatar.cc/200?img=47',
      country: 'JO',
      category: 'dating' as const,
      banner: 'https://picsum.photos/seed/room6/400/200',
      isPrivate: false,
      seatsCount: 9,
      audienceCount: 76,
      totalGifts: 18900,
    },
  ];

  for (const roomData of demoRooms) {
    const newRoomRef = push(roomsRef);
    const seats: Record<string, RoomSeat> = {};
    for (let i = 0; i < roomData.seatsCount; i++) {
      seats[`seat_${i}`] = {
        uid: i === 0 ? roomData.hostUid : null,
        ...(i === 0 && {
          displayName: roomData.hostName,
          avatar: roomData.hostAvatar,
          joinedAt: Date.now(),
        }),
      };
    }
    await set(newRoomRef, {
      ...roomData,
      seats,
      createdAt: Date.now() - Math.random() * 1000 * 60 * 60 * 24,
      updatedAt: Date.now(),
      isActive: true,
    });
  }

  console.log('✅ Seeded', demoRooms.length, 'demo rooms');
};
