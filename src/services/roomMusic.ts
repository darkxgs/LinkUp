/**
 * Room Music — حالة موسيقى الروم في RTDB (واجهة عرض فقط)
 *
 * rooms/{roomId}/music = {
 *   url, title, fileName,
 *   addedBy, addedByName, addedByAvatar,
 *   addedAt, currentTime, isPlaying,
 *   lastUpdateBy, lastUpdatedAt, duration?, volume?,
 * }
 *
 * الصوت الفعلي لا يمر من هنا إطلاقاً: جهاز الـDJ يخلط الملف داخل فريمات
 * مايكه المنشورة عبر Agora (roomMusicPlaybackManager) فيسمعه الجميع من
 * ستريم واحد متزامناً — هذه العقدة تغذّي الواجهات فقط (من يشغّل ماذا،
 * موضع التقدم عبر heartbeat الـDJ كل 4 ثوانٍ، ومستوى صوت الجمهور).
 */

import {
  ref,
  update,
  get,
  remove,
  onValue,
  off,
  serverTimestamp,
} from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { realtimeDb, auth, firestore } from './firebase/index';
import { useRoomMusicUiStore } from '@/stores/roomMusicUiStore';
import { resolveSupervisorPermissions } from './firebase/roomMemberRoles';
import {
  parseStaffFromUserData,
  resolveRoomCountry,
  staffCanReviewRoom,
  type PlatformStaffUser,
} from '@/types/platformStaff';
import { isAgencyManagerForRoom } from './roomVideo';

// فرق ساعة الجهاز عن ساعة سيرفر Firebase — يزيل انحراف الساعات بين DJ والمستمعين
let serverTimeOffsetMs = 0;
let offsetSubscribed = false;
function ensureServerTimeOffset(): void {
  if (offsetSubscribed) return;
  offsetSubscribed = true;
  try {
    onValue(ref(realtimeDb, '.info/serverTimeOffset'), (snap) => {
      const v = snap.val();
      if (typeof v === 'number') serverTimeOffsetMs = v;
    });
  } catch {
    // ignore
  }
}

export const serverNow = (): number => {
  ensureServerTimeOffset();
  return Date.now() + serverTimeOffsetMs;
};

export interface RoomMusic {
  /** رابط https (صندوق الروم) أو local://trackId (ملف على جهاز الـDJ) — للعرض/التخطي فقط */
  url: string;
  title: string;
  fileName?: string;
  addedBy: string;
  addedByName: string;
  addedByAvatar?: string;
  addedAt: number;
  currentTime: number;
  isPlaying: boolean;
  lastUpdateBy: string;
  lastUpdatedAt: number;
  duration?: number;
  /** مستوى صوت الجمهور (0–1) — يتحكم به الـ DJ (adjustAudioMixingPublishVolume) */
  volume?: number;
}

async function resolveUserMeta() {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  let userName = user.displayName ?? 'مستخدم';
  let userAvatar = user.photoURL ?? '';
  try {
    const { getUser } = await import('./firebase/users');
    const u = await getUser(user.uid);
    if (u) {
      userName = u.displayName ?? userName;
      userAvatar = u.avatar ?? userAvatar;
    }
  } catch {
    // ignore
  }
  return { user, userName, userAvatar };
}

/** هل المستخدم جالس على أي مقعد في الروم؟ */
export function isUidOnRoomSeats(
  seats: Record<string, { uid?: string }> | null | undefined,
  uid: string | undefined,
): boolean {
  if (!seats || !uid) return false;
  return Object.values(seats).some((seat) => seat?.uid === uid);
}

async function assertUserOnRoomSeat(roomId: string, uid: string): Promise<void> {
  const snap = await get(ref(realtimeDb, `rooms/${roomId}/seats`));
  if (snap.exists() && isUidOnRoomSeats(snap.val() as Record<string, { uid?: string }>, uid)) {
    return;
  }
  // «لست على مقعد» مباشرة بعد أخذ المقعد — كتابة المقعد قد لا تكون انتشرت بعد؛
  // مهلة سماح قصيرة ثم قراءة ثانية قبل الفشل (نفس سماحية changeSeat)
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const retrySnap = await get(ref(realtimeDb, `rooms/${roomId}/seats`));
  if (
    retrySnap.exists() &&
    isUidOnRoomSeats(retrySnap.val() as Record<string, { uid?: string }>, uid)
  ) {
    return;
  }
  throw new Error('يجب الجلوس على مقعد لتشغيل الموسيقى');
}

/** يتحقق أن المستخدم على مقعد قبل أي بث موسيقى */
export async function assertCanBroadcastRoomMusic(roomId: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  await assertUserOnRoomSeat(roomId, user.uid);
  return user.uid;
}

export const addMusicToRoom = async (
  roomId: string,
  url: string,
  title: string,
  fileName?: string,
  durationSec?: number,
): Promise<void> => {
  const { user, userName, userAvatar } = await resolveUserMeta();
  await assertCanBroadcastRoomMusic(roomId);

  // update() لا set() الاستبدالي — كتابة متزامنة أخرى على العقدة (نبضة
  // مزامنة/صوت) لا تُمحى بالكامل؛ والحقول الاختيارية الغائبة تُصفَّر بـnull
  // صراحةً حتى لا يرث المقطعُ الجديد duration/fileName مقطعٍ سابق.
  const music: Record<string, unknown> = {
    url,
    title: title.trim() || fileName || 'مقطع صوتي',
    fileName: fileName ?? null,
    addedBy: user.uid,
    addedByName: userName,
    addedByAvatar: userAvatar,
    addedAt: Date.now(),
    currentTime: 0,
    isPlaying: true,
    volume: 1,
    lastUpdateBy: user.uid,
    // طابع سيرفر — حتى لا يتأثر التزامن بساعة جهاز الـDJ
    lastUpdatedAt: serverTimestamp(),
    duration: durationSec ?? null,
  };

  await update(ref(realtimeDb, `rooms/${roomId}/music`), music);

  // صرتُ أنا الـDJ — فُكّ الإخفاء المحلي لواجهة الموسيقى إجبارياً: تركيب
  // RoomMusicPlaybackHost (المشروط بعدم الإخفاء) هو ما يستدعي syncDjBroadcast
  // ويبدأ الخلط؛ من أخفى موسيقى غيره بزر X ثم شغّل موسيقاه كانت عقدته
  // تُكتب «يشغّل الآن» للجميع بلا صوت وزر إيقافها بلا سياق (عقدة شبح).
  useRoomMusicUiStore.getState().resetDismiss();
};

export type RoomMusicControlOpts = {
  staff?: PlatformStaffUser | null;
  roomCountry?: string | null;
  isAgencyManager?: boolean;
};

/** هل يستطيع إيقاف/إلغاء موسيقى الآخرين؟ — المضيف، مشرف الإشراف، أو وكيل الوكالة */
export function canControlRoomMusic(
  userUid: string | null | undefined,
  room: Record<string, unknown> | null | undefined,
  opts?: RoomMusicControlOpts,
): boolean {
  if (!userUid || !room) return false;
  const hostUid = String(room.hostUid ?? '');
  if (hostUid && hostUid === userUid) return true;
  if (opts?.isAgencyManager) return true;
  if (staffCanReviewRoom(opts?.staff, opts?.roomCountry)) return true;
  return resolveSupervisorPermissions(room, userUid, opts?.staff, opts?.roomCountry).reviewVideo;
}

async function loadMusicControlOpts(
  roomData: Record<string, unknown>,
): Promise<RoomMusicControlOpts> {
  const user = auth.currentUser;
  if (!user) return {};
  try {
    const userSnap = await getDoc(doc(firestore, 'users', user.uid));
    const userData = userSnap.exists() ? userSnap.data() : null;
    const staff = parseStaffFromUserData(userData);
    const roomCountry = resolveRoomCountry(roomData as { country?: string; agencyId?: string }, null);
    const roomAgencyId = roomData.agencyId != null ? String(roomData.agencyId) : '';
    const isAgencyManager = isAgencyManagerForRoom(
      {
        agencyId: userData?.agencyId != null ? String(userData.agencyId) : null,
        agencyRole: userData?.agencyRole as string | null | undefined,
        isAgent: userData?.isAgent === true,
      },
      roomAgencyId || undefined,
    );
    return { staff, roomCountry, isAgencyManager };
  } catch {
    return {};
  }
}

async function assertCanStopRoomMusic(roomId: string): Promise<void> {
  const { user } = await resolveUserMeta();
  const musicRef = ref(realtimeDb, `rooms/${roomId}/music`);
  const snap = await get(musicRef);
  if (!snap.exists()) return;
  const current = snap.val() as Partial<RoomMusic>;
  if (current.addedBy === user.uid) return;

  const roomSnap = await get(ref(realtimeDb, `rooms/${roomId}`));
  if (!roomSnap.exists()) throw new Error('الغرفة غير موجودة');
  const opts = await loadMusicControlOpts(roomSnap.val() as Record<string, unknown>);
  if (!canControlRoomMusic(user.uid, roomSnap.val() as Record<string, unknown>, opts)) {
    throw new Error('فقط المشرف أو وكيل الوكالة يستطيع إيقاف الموسيقى');
  }
}

/** هل المستخدم الحالي يستطيع إيقاف موسيقى الآخرين في هذا الروم؟ */
export async function resolveCanManageRoomMusic(roomId: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !roomId) return false;
  try {
    const roomSnap = await get(ref(realtimeDb, `rooms/${roomId}`));
    if (!roomSnap.exists()) return false;
    const roomData = roomSnap.val() as Record<string, unknown>;
    const opts = await loadMusicControlOpts(roomData);
    return canControlRoomMusic(user.uid, roomData, opts);
  } catch {
    return false;
  }
}

export const removeMusicFromRoom = async (roomId: string): Promise<void> => {
  const musicRef = ref(realtimeDb, `rooms/${roomId}/music`);
  const snap = await get(musicRef);
  if (!snap.exists()) return;
  await assertCanStopRoomMusic(roomId);
  await remove(musicRef);
};

export const updateMusicPlayback = async (
  roomId: string,
  data: {
    currentTime?: number;
    isPlaying?: boolean;
    duration?: number;
    volume?: number;
  },
): Promise<void> => {
  const { user } = await resolveUserMeta();
  const musicRef = ref(realtimeDb, `rooms/${roomId}/music`);
  const snap = await get(musicRef);
  if (!snap.exists()) throw new Error('لا توجد موسيقى نشطة');
  const current = snap.val() as Partial<RoomMusic>;
  if (current.addedBy !== user.uid) {
    throw new Error('فقط DJ الروم يستطيع التحكم');
  }

  const updates: Record<string, unknown> = {
    lastUpdateBy: user.uid,
    lastUpdatedAt: serverTimestamp(),
  };
  if (data.currentTime !== undefined) updates.currentTime = data.currentTime;
  if (data.isPlaying !== undefined) updates.isPlaying = data.isPlaying;
  if (data.duration !== undefined) updates.duration = data.duration;
  if (data.volume !== undefined) {
    updates.volume = Math.max(0, Math.min(1, data.volume));
  }

  await update(musicRef, updates);
};

export const setMusicVolume = async (roomId: string, volume: number): Promise<void> => {
  const clamped = Math.max(0, Math.min(1, volume));
  await updateMusicPlayback(roomId, { volume: clamped });
};

export const subscribeToRoomMusic = (
  roomId: string,
  callback: (music: RoomMusic | null) => void,
): (() => void) => {
  ensureServerTimeOffset();
  const musicRef = ref(realtimeDb, `rooms/${roomId}/music`);
  const handler = onValue(musicRef, (snap) => {
    callback(snap.exists() ? (snap.val() as RoomMusic) : null);
  });
  return () => off(musicRef, 'value', handler);
};

export const calculateMusicTime = (music: RoomMusic): number => {
  if (!music.isPlaying) return music.currentTime ?? 0;
  // ساعة السيرفر لا الجهاز — انحراف ساعات الأجهزة كان يسبّب قفزات seek عند المستمعين
  const elapsed = Math.max(0, (serverNow() - (music.lastUpdatedAt ?? 0)) / 1000);
  const t = (music.currentTime ?? 0) + elapsed;
  if (music.duration && t > music.duration) return music.duration;
  return t;
};

/** هل المستخدم DJ الحالي (تحكم تشغيل/مزامنة)؟ */
export const isRoomMusicDj = (
  music: RoomMusic | null,
  userUid: string | null | undefined,
): boolean => Boolean(userUid && music && music.addedBy === userUid);

/** هل يستطيع إيقاف الموسيقى (DJ أو مشرف/وكيل)؟ */
export const canStopRoomMusic = (
  music: RoomMusic | null,
  userUid: string | null | undefined,
  canManage?: boolean,
): boolean => {
  if (!userUid || !music) return false;
  if (music.addedBy === userUid) return true;
  return Boolean(canManage);
};

/** @deprecated استخدم isRoomMusicDj */
export const canControlMusic = isRoomMusicDj;
