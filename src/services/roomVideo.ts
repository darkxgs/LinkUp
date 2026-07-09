/**
 * Room Video Service
 * إدارة الفيديو المُشترك في الروم
 *
 * البنية في RTDB:
 *   rooms/{roomId}/video = {
 *     url: string,
 *     sourceType: 'mp4' | 'hls' | 'youtube',
 *     youtubeId?: string,
 *     addedBy: string,
 *     addedByName: string,
 *     addedByAvatar: string,
 *     addedAt: number,
 *     currentTime: number, // seconds
 *     isPlaying: boolean,
 *     lastUpdateBy: string,
 *     lastUpdatedAt: number, // timestamp لحساب الفرق
 *     duration?: number,
 *     title?: string,
 *   }
 *
 * التزامن:
 *   - عند seek/play/pause: المتحكّم يكتب currentTime + isPlaying + lastUpdatedAt
 *   - بقية الـ clients يقرؤون ويحسبون: actualTime = currentTime + (now - lastUpdatedAt)/1000 (لو playing)
 *   - تردّد التحديث: كل 5 ثوان من المتحكّم (لمنع الانحراف)
 */

import {
  ref,
  set,
  update,
  get,
  remove,
  onValue,
  off,
} from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { realtimeDb, auth, firestore } from './firebase/index';
import {
  parseVideoUrl,
  type VideoSourceType,
} from '@/utils/videoUrlParser';
import { resolveSupervisorPermissions } from './firebase/roomMemberRoles';
import {
  parseStaffFromUserData,
  resolveRoomCountry,
  staffCanReviewRoom,
  type PlatformStaffUser,
} from '@/types/platformStaff';
import { isAgencyAgent } from './firebase/hostTasks';

export interface RoomVideo {
  url: string;
  sourceType: VideoSourceType;
  youtubeId?: string;
  addedBy: string;
  addedByName: string;
  addedByAvatar?: string;
  addedAt: number;
  currentTime: number;
  isPlaying: boolean;
  lastUpdateBy: string;
  lastUpdatedAt: number;
  duration?: number;
  title?: string;
}

export type PublishRoomVideoParams = {
  url: string;
  sourceType: VideoSourceType;
  youtubeId?: string;
  title?: string;
  addedBy: string;
  addedByName: string;
  addedByAvatar?: string;
};

/** نشر فيديو معتمد في الروم (بعد الموافقة أو مباشرة) */
export const publishRoomVideo = async (
  roomId: string,
  params: PublishRoomVideoParams,
): Promise<void> => {
  const videoData: RoomVideo = {
    url: params.url,
    sourceType: params.sourceType === 'unknown' ? 'mp4' : params.sourceType,
    youtubeId: params.youtubeId,
    addedBy: params.addedBy,
    addedByName: params.addedByName,
    addedByAvatar: params.addedByAvatar,
    addedAt: Date.now(),
    currentTime: 0,
    isPlaying: true,
    lastUpdateBy: params.addedBy,
    lastUpdatedAt: Date.now(),
    title: params.title?.trim() || undefined,
  };

  Object.keys(videoData).forEach((k) => {
    if ((videoData as unknown as Record<string, unknown>)[k] === undefined) {
      delete (videoData as unknown as Record<string, unknown>)[k];
    }
  });

  await set(ref(realtimeDb, `rooms/${roomId}/video`), videoData);
};

/**
 * إضافة فيديو إلى الروم
 *
 * @param roomId - معرّف الروم
 * @param url - رابط الفيديو (mp4/youtube/hls)
 * @param title - عنوان اختياري
 */
export const addVideoToRoom = async (
  roomId: string,
  url: string,
  title?: string,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const parsed = parseVideoUrl(url);
  if (!parsed.isValid) {
    throw new Error(parsed.error ?? 'رابط غير صالح');
  }

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

  await publishRoomVideo(roomId, {
    url: parsed.url,
    sourceType: parsed.type,
    youtubeId: parsed.youtubeId,
    title,
    addedBy: user.uid,
    addedByName: userName,
    addedByAvatar: userAvatar,
  });
};

export type RoomVideoControlContext = {
  hostUid?: string;
  coHosts?: string[];
  permissions?: Record<string, unknown>;
  agencyId?: string;
  isAgencyRoom?: boolean;
};

export type RoomVideoControlOpts = {
  staff?: PlatformStaffUser | null;
  roomCountry?: string | null;
  isAgencyManager?: boolean;
};

/** وكيل/مالك الوكالة لغرفة وكالته */
export function isAgencyManagerForRoom(
  user: { agencyId?: string | null; agencyRole?: string | null; isAgent?: boolean } | null | undefined,
  roomAgencyId: string | null | undefined,
): boolean {
  if (!roomAgencyId || !user) return false;
  if (String(user.agencyId ?? '') !== String(roomAgencyId)) return false;
  return isAgencyAgent(user);
}

/** هل يستطيع هذا المستخدم إيقاف/التحكم بالفيدio؟ — المضيف، مشرف الإشراف، أو وكيل الوكالة فقط */
export function canControlRoomVideo(
  userUid: string | null | undefined,
  room: RoomVideoControlContext | Record<string, unknown> | null | undefined,
  opts?: RoomVideoControlOpts,
): boolean {
  if (!userUid || !room) return false;
  const hostUid = String((room as RoomVideoControlContext).hostUid ?? '');
  if (hostUid && hostUid === userUid) return true;
  if (opts?.isAgencyManager) return true;
  if (staffCanReviewRoom(opts?.staff, opts?.roomCountry)) return true;
  return resolveSupervisorPermissions(room as Record<string, unknown>, userUid, opts?.staff, opts?.roomCountry)
    .reviewVideo;
}

export const canControlVideo = (
  video: RoomVideo | null,
  userUid: string | null | undefined,
  room: RoomVideoControlContext | Record<string, unknown> | null | undefined,
  opts?: RoomVideoControlOpts,
): boolean => {
  if (!video || !userUid) return false;
  return canControlRoomVideo(userUid, room, opts);
};

async function loadVideoControlOpts(
  roomData: Record<string, unknown>,
): Promise<RoomVideoControlOpts> {
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

async function assertCanControlRoomVideo(roomId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const roomSnap = await get(ref(realtimeDb, `rooms/${roomId}`));
  if (!roomSnap.exists()) throw new Error('الغرفة غير موجودة');
  const roomData = roomSnap.val() as Record<string, unknown>;
  const opts = await loadVideoControlOpts(roomData);

  const videoRef = ref(realtimeDb, `rooms/${roomId}/video`);
  const videoSnap = await get(videoRef);
  const addedBy = videoSnap.exists()
    ? String((videoSnap.val() as RoomVideo).addedBy ?? '')
    : '';
  if (addedBy && addedBy === user.uid) return;

  if (!canControlRoomVideo(user.uid, roomData, opts)) {
    throw new Error('فقط المشرف أو وكيل الوكالة يستطيع التحكم بالفيديو');
  }
}

/**
 * إزالة الفيديو من الروم — المضيف / مشرف الإشراف / وكيل الوكالة فقط
 */
export const removeVideoFromRoom = async (roomId: string): Promise<void> => {
  const videoRef = ref(realtimeDb, `rooms/${roomId}/video`);
  const snap = await get(videoRef);
  if (!snap.exists()) return;

  await assertCanControlRoomVideo(roomId);
  await remove(videoRef);
};

/**
 * تحديث حالة التشغيل (play/pause/seek)
 * يستدعى من المتحكّم فقط
 */
export const updateVideoPlayback = async (
  roomId: string,
  data: {
    currentTime?: number;
    isPlaying?: boolean;
    duration?: number;
  },
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const videoRef = ref(realtimeDb, `rooms/${roomId}/video`);
  const snap = await get(videoRef);
  if (!snap.exists()) throw new Error('لا يوجد فيديو نشط');

  await assertCanControlRoomVideo(roomId);

  const updates: Record<string, unknown> = {
    lastUpdateBy: user.uid,
    lastUpdatedAt: Date.now(),
  };
  if (data.currentTime !== undefined) updates.currentTime = data.currentTime;
  if (data.isPlaying !== undefined) updates.isPlaying = data.isPlaying;
  if (data.duration !== undefined) updates.duration = data.duration;

  await update(ref(realtimeDb, `rooms/${roomId}/video`), updates);
};

/**
 * Subscribe لحالة الفيديو في الروم (real-time)
 */
export const subscribeToRoomVideo = (
  roomId: string,
  callback: (video: RoomVideo | null) => void,
): (() => void) => {
  const videoRef = ref(realtimeDb, `rooms/${roomId}/video`);
  const handler = onValue(videoRef, (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback(snap.val() as RoomVideo);
  });
  return () => off(videoRef, 'value', handler);
};

/**
 * يحسب الوقت الفعلي للفيديو بناءً على آخر تحديث + هل هو playing
 * يستخدم للمشاهدين (غير المتحكّمين) لتزامن أنفسهم
 */
export const calculateActualTime = (video: RoomVideo): number => {
  if (!video.isPlaying) return video.currentTime;
  const elapsed = (Date.now() - (video.lastUpdatedAt ?? 0)) / 1000;
  return video.currentTime + elapsed;
};

