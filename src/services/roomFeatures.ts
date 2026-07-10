/**
 * Room Features Service — ميزات إضافية للرومات:
 *
 * 1. favoriteRoom / unfavoriteRoom → متابعة روم (إشعار عند فتحه)
 * 2. getMyFavoriteRooms → قائمة الرومات المفضّلة
 * 3. addRecentRoom / getMyRecentRooms → اختصار وصول (آخر 10 رومات)
 * 4. trackUserPresence → تتبّع متابَعين (إشعار لما يدخلوا روم)
 * 5. shareRoomLink → توليد لينك دعوة للروم
 *
 * البنية في Firestore:
 *   users/{uid}/favoriteRooms/{roomId} → { addedAt, roomName }
 *   users/{uid}/recentRooms/{roomId}    → { lastVisit, roomName }
 *
 * البنية في RTDB (للـ presence السريع):
 *   userPresence/{uid} → { currentRoomId, roomName, since }
 */

import {
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import {
  ref,
  set as rtSet,
  remove,
  get as rtGet,
  onValue,
  off,
  onDisconnect,
} from 'firebase/database';
import { firestore, realtimeDb, auth } from './firebase/index';
import { getDoc, doc as fsDoc } from 'firebase/firestore';

// كاش وجود الوكالات — يمنع تكرار قراءة Firestore لنفس الوكالة في نفس الجلسة
const agencyExistsCache = new Map<string, boolean>();

/** هل وكالة هذه الغرفة ما زالت موجودة؟ الغرف التابعة لوكالات محذوفة تُخفى */
async function agencyStillExists(agencyId: string): Promise<boolean> {
  const id = agencyId.trim();
  if (!id) return true;
  const cached = agencyExistsCache.get(id);
  if (cached != null) return cached;
  try {
    const snap = await getDoc(fsDoc(firestore, 'agencies', id));
    agencyExistsCache.set(id, snap.exists());
    return snap.exists();
  } catch {
    return true; // فشل شبكة عابر — لا نخفي
  }
}

// ========================================================
// 1. FAVORITE ROOMS (متابعة الروم)
// ========================================================

export interface FavoriteRoom {
  roomId: string;
  roomName: string;
  hostName?: string;
  hostAvatar?: string;
  roomBanner?: string;
  addedAt: number;
  agencyId?: string;
  isAgencyRoom?: boolean;
}

export type FavoriteRoomMeta = {
  agencyId?: string;
  isAgencyRoom?: boolean;
  roomBanner?: string;
};

/**
 * إضافة روم للمفضّلة (متابعة)
 */
export const favoriteRoom = async (
  roomId: string,
  roomName: string,
  hostName?: string,
  hostAvatar?: string,
  meta?: FavoriteRoomMeta,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  await setDoc(doc(firestore, 'users', user.uid, 'favoriteRooms', roomId), {
    roomId,
    roomName,
    hostName: hostName ?? '',
    hostAvatar: hostAvatar ?? '',
    addedAt: Date.now(),
    ...(meta?.agencyId ? { agencyId: meta.agencyId } : {}),
    ...(meta?.isAgencyRoom ? { isAgencyRoom: true } : {}),
    ...(meta?.roomBanner ? { roomBanner: meta.roomBanner } : {}),
  });
};

/**
 * إلغاء المتابعة
 */
export const unfavoriteRoom = async (roomId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  await deleteDoc(doc(firestore, 'users', user.uid, 'favoriteRooms', roomId));
};

/**
 * فحص هل الروم في المفضّلة
 */
export const isRoomFavorited = async (roomId: string): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    const snap = await getDocs(
      query(
        collection(firestore, 'users', user.uid, 'favoriteRooms'),
        where('roomId', '==', roomId),
        limit(1),
      ),
    );
    return !snap.empty;
  } catch {
    return false;
  }
};

/**
 * جلب الرومات المفضّلة للمستخدم
 */
export const getMyFavoriteRooms = async (): Promise<FavoriteRoom[]> => {
  const user = auth.currentUser;
  if (!user) return [];
  try {
    const snap = await getDocs(
      query(
        collection(firestore, 'users', user.uid, 'favoriteRooms'),
        orderBy('addedAt', 'desc'),
        limit(50),
      ),
    );
    return snap.docs.map((d) => d.data() as FavoriteRoom);
  } catch {
    return [];
  }
};

/**
 * الاستماع المباشر للمفضّلة + معلومات حية (هل الروم نشط؟)
 */
export const subscribeToFavoriteRoomsLive = (
  callback: (rooms: (FavoriteRoom & { isLive: boolean })[]) => void,
): (() => void) => {
  const user = auth.currentUser;
  if (!user) return () => {};

  const unsubFav = onSnapshot(
    query(
      collection(firestore, 'users', user.uid, 'favoriteRooms'),
      orderBy('addedAt', 'desc'),
      limit(50),
    ),
    async (snap) => {
      const favs = snap.docs.map((d) => d.data() as FavoriteRoom);
      // جلب حالة كل روم من RTDB (محدود بـ 50 لتفادي عشرات القراءات المتوازية على النت الضعيف)
      const enriched = await Promise.all(
        favs.map(async (f) => {
          try {
            const roomSnap = await rtGet(ref(realtimeDb, `rooms/${f.roomId}`));
            const roomData = roomSnap.exists()
              ? (roomSnap.val() as Record<string, unknown>)
              : null;
            const isLive = !!(roomData && roomData.isActive === true);
            const hostAvatar = f.hostAvatar || String(roomData?.hostAvatar ?? '');
            const roomBanner = f.roomBanner || String(roomData?.banner ?? '');
            const isAgencyRoom =
              f.isAgencyRoom === true ||
              roomData?.isAgencyRoom === true ||
              Boolean(roomData?.agencyId);
            const agencyId = f.agencyId || String(roomData?.agencyId ?? '') || undefined;
            const archived = roomData?.isArchived === true;
            const agencyGone =
              isAgencyRoom && agencyId ? !(await agencyStillExists(agencyId)) : false;
            return {
              ...f,
              hostAvatar: hostAvatar || undefined,
              roomBanner: roomBanner || undefined,
              isAgencyRoom,
              agencyId,
              isLive,
              // حالة القفل الحية من الغرفة نفسها (بيانات الحفظ قد تكون قديمة)
              isPrivate: roomData
                ? roomData.mode === 'locked' || roomData.isPrivate === true
                : (f as { isPrivate?: boolean }).isPrivate,
              exists: roomSnap.exists() && !archived && !agencyGone,
            };
          } catch {
            return { ...f, isLive: false, exists: true };
          }
        }),
      );
      // الغرف المحذوفة نهائياً من قاعدة البيانات تُخفى — الدخول إليها مستحيل،
      // وتُحذف وثائقها (شفاء ذاتي حتى لا تضخّم عدّاد الغرف بأسماء وهمية)
      for (const dead of enriched.filter((r) => (r as { exists?: boolean }).exists === false)) {
        void deleteDoc(doc(firestore, 'users', user.uid, 'favoriteRooms', dead.roomId)).catch(() => {});
      }
      callback(enriched.filter((r) => (r as { exists?: boolean }).exists !== false));
    },
  );
  return unsubFav;
};

// ========================================================
// 2. RECENT ROOMS (اختصار وصول)
// ========================================================

export interface RecentRoom {
  roomId: string;
  roomName: string;
  lastVisit: number;
  hostAvatar?: string;
  roomBanner?: string;
  isAgencyRoom?: boolean;
  agencyId?: string;
}

export type RecentRoomMeta = {
  hostAvatar?: string;
  roomBanner?: string;
  isAgencyRoom?: boolean;
  agencyId?: string;
};

/**
 * تسجيل زيارة روم (يُستدعى تلقائياً عند الدخول)
 */
export const recordRoomVisit = async (
  roomId: string,
  roomName: string,
  meta?: RecentRoomMeta,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await setDoc(doc(firestore, 'users', user.uid, 'recentRooms', roomId), {
      roomId,
      roomName,
      lastVisit: Date.now(),
      ...(meta?.hostAvatar ? { hostAvatar: meta.hostAvatar } : {}),
      ...(meta?.roomBanner ? { roomBanner: meta.roomBanner } : {}),
      ...(meta?.agencyId ? { agencyId: meta.agencyId } : {}),
      ...(meta?.isAgencyRoom ? { isAgencyRoom: true } : {}),
    });
  } catch {
    // فشل صامت
  }
};

/**
 * اشتراك مباشر بآخر الرومات الم visited
 */
export const subscribeToRecentRoomsLive = (
  callback: (rooms: (RecentRoom & { isLive: boolean })[]) => void,
  max = 12,
): (() => void) => {
  const user = auth.currentUser;
  if (!user) return () => {};

  const unsub = onSnapshot(
    query(
      collection(firestore, 'users', user.uid, 'recentRooms'),
      orderBy('lastVisit', 'desc'),
      limit(max),
    ),
    async (snap) => {
      const recents = snap.docs.map((d) => d.data() as RecentRoom);
      const enriched = await Promise.all(
        recents.map(async (r) => {
          try {
            const roomSnap = await rtGet(ref(realtimeDb, `rooms/${r.roomId}`));
            const roomData = roomSnap.exists()
              ? (roomSnap.val() as Record<string, unknown>)
              : null;
            const isLive = !!(roomData && roomData.isActive === true);
            const hostAvatar =
              r.hostAvatar ||
              String(roomData?.hostAvatar ?? '');
            const roomBanner = r.roomBanner || String(roomData?.banner ?? '');
            const isAgencyRoom =
              r.isAgencyRoom === true ||
              roomData?.isAgencyRoom === true ||
              Boolean(roomData?.agencyId);
            const agencyId = r.agencyId || String(roomData?.agencyId ?? '') || undefined;
            // تُحذف من القائمة والسجل:
            // - غرفة محذوفة أو مؤرشفة
            // - غرفة وكالة حُذفت وكالتها
            // - غرفي الشخصية (تظهر في بطاقة «غرفتي» أعلى الشاشة — نسخها
            //   المكررة القديمة «غرفة» كانت تزاحم القائمة وتضخّم العدّاد)
            const archived = roomData?.isArchived === true;
            const agencyGone =
              isAgencyRoom && agencyId ? !(await agencyStillExists(agencyId)) : false;
            const ownPersonal =
              !!roomData && String(roomData.hostUid ?? '') === user.uid && !isAgencyRoom;
            return {
              ...r,
              hostAvatar: hostAvatar || undefined,
              roomBanner: roomBanner || undefined,
              isAgencyRoom,
              agencyId,
              isLive,
              // حالة القفل الحية من الغرفة نفسها (بيانات الزيارة قد تكون قديمة)
              isPrivate: roomData
                ? roomData.mode === 'locked' || roomData.isPrivate === true
                : (r as { isPrivate?: boolean }).isPrivate,
              exists: roomSnap.exists() && !archived && !agencyGone && !ownPersonal,
            };
          } catch {
            return { ...r, isLive: false, exists: true };
          }
        }),
      );
      for (const dead of enriched.filter((r) => (r as { exists?: boolean }).exists === false)) {
        void deleteDoc(doc(firestore, 'users', user.uid, 'recentRooms', dead.roomId)).catch(() => {});
      }
      callback(enriched.filter((r) => (r as { exists?: boolean }).exists !== false));
    },
  );
  return unsub;
};

export type MyRoomStats = {
  joined: number;
  agencies: number;
  favorites: number;
};

/** عدادات خفيفة للملف الشخصي — بدون جلب حالة RTDB */
export const subscribeToMyRoomStats = (
  callback: (stats: MyRoomStats) => void,
): (() => void) => {
  const user = auth.currentUser;
  if (!user) {
    callback({ joined: 0, agencies: 0, favorites: 0 });
    return () => {};
  }

  let joined = 0;
  let agencies = 0;
  let favorites = 0;

  const emit = () => callback({ joined, agencies, favorites });

  // هل تُحسب هذه الغرفة؟ — قراءات أوراق صغيرة بدل الغرفة كاملة.
  // لا تُحسب (وتُحذف وثيقتها): غرفة محذوفة/مؤرشفة، غرفة وكالة محذوفة،
  // وغرفي الشخصية في «انضم» (تظهر في بطاقة «غرفتي» — نسخها كانت تضخّم العدّاد).
  const shouldCountRoom = async (
    roomId: string,
    excludeOwnPersonal: boolean,
  ): Promise<boolean> => {
    try {
      const [hostSnap, archSnap, agencySnap] = await Promise.all([
        rtGet(ref(realtimeDb, `rooms/${roomId}/hostUid`)),
        rtGet(ref(realtimeDb, `rooms/${roomId}/isArchived`)),
        rtGet(ref(realtimeDb, `rooms/${roomId}/agencyId`)),
      ]);
      if (!hostSnap.exists()) return false;
      if (archSnap.val() === true) return false;
      const agencyId = String(agencySnap.val() ?? '').trim();
      if (agencyId && !(await agencyStillExists(agencyId))) return false;
      if (excludeOwnPersonal && !agencyId && String(hostSnap.val()) === user.uid) return false;
      return true;
    } catch {
      return true; // فشل شبكة عابر — لا نحذف ولا نُنقص العدّ
    }
  };

  const unsubRecent = onSnapshot(
    query(
      collection(firestore, 'users', user.uid, 'recentRooms'),
      orderBy('lastVisit', 'desc'),
      limit(50),
    ),
    (snap) => {
      void (async () => {
        const docs = snap.docs;
        const checks = await Promise.all(docs.map((d) => shouldCountRoom(d.id, true)));
        joined = checks.filter(Boolean).length;
        docs.forEach((d, i) => {
          if (!checks[i]) void deleteDoc(d.ref).catch(() => {});
        });
        emit();
      })();
    },
    () => emit(),
  );

  const unsubFav = onSnapshot(
    query(
      collection(firestore, 'users', user.uid, 'favoriteRooms'),
      orderBy('addedAt', 'desc'),
      limit(50),
    ),
    (snap) => {
      void (async () => {
        const docs = snap.docs;
        const checks = await Promise.all(docs.map((d) => shouldCountRoom(d.id, false)));
        agencies = 0;
        favorites = 0;
        docs.forEach((d, i) => {
          if (!checks[i]) {
            void deleteDoc(d.ref).catch(() => {});
            return;
          }
          const data = d.data() as FavoriteRoom;
          if (data.isAgencyRoom) agencies += 1;
          else favorites += 1;
        });
        emit();
      })();
    },
    () => emit(),
  );

  return () => {
    unsubRecent();
    unsubFav();
  };
};

/**
 * جلب آخر 10 رومات
 */
export const getMyRecentRooms = async (max = 10): Promise<RecentRoom[]> => {
  const user = auth.currentUser;
  if (!user) return [];
  try {
    const snap = await getDocs(
      query(
        collection(firestore, 'users', user.uid, 'recentRooms'),
        orderBy('lastVisit', 'desc'),
        limit(max),
      ),
    );
    return snap.docs.map((d) => d.data() as RecentRoom);
  } catch {
    return [];
  }
};

// ========================================================
// 3. USER PRESENCE (الشخص موجود بروم؟)
// ========================================================

export interface UserPresence {
  uid: string;
  currentRoomId: string;
  roomName: string;
  since: number;
  agencyId?: string;
  isAgencyRoom?: boolean;
}

function parseUserPresence(uid: string, data: Record<string, unknown>): UserPresence {
  return {
    uid,
    currentRoomId: String(data.currentRoomId ?? ''),
    roomName: String(data.roomName ?? ''),
    since: Number(data.since) || Date.now(),
    agencyId: data.agencyId ? String(data.agencyId) : undefined,
    isAgencyRoom: data.isAgencyRoom === true,
  };
}

/** هل المستخدم في غرفة صوتية الآن؟ (أي غرفة — ليس الوكالة فقط) */
export function isTrackableAgencyPresence(presence: UserPresence | null | undefined): boolean {
  return Boolean(String(presence?.currentRoomId ?? '').trim());
}

/**
 * تعيين الـ presence للمستخدم (يُستدعى عند دخول روم)
 */
export const setUserInRoom = async (
  roomId: string,
  roomName: string,
  meta?: { agencyId?: string; isAgencyRoom?: boolean },
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const presenceRef = ref(realtimeDb, `userPresence/${user.uid}`);
    const payload: Record<string, unknown> = {
      currentRoomId: roomId,
      roomName,
      since: Date.now(),
    };
    if (meta?.agencyId) payload.agencyId = meta.agencyId;
    if (meta?.isAgencyRoom) payload.isAgencyRoom = true;
    else if (meta?.isAgencyRoom === false) payload.isAgencyRoom = false;
    await rtSet(presenceRef, payload);
    await onDisconnect(presenceRef).remove();
  } catch {}
};

/**
 * مسح الـ presence (يُستدعى عند الخروج)
 */
export const clearUserFromRoom = async (): Promise<void> => {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const presenceRef = ref(realtimeDb, `userPresence/${user.uid}`);
    try {
      await onDisconnect(presenceRef).cancel();
    } catch {
      // ignore
    }
    await remove(presenceRef);
  } catch {}
};

/**
 * استعلام: هل هذا المستخدم في روم الآن؟
 */
export const getUserCurrentRoom = async (
  uid: string,
): Promise<UserPresence | null> => {
  try {
    const snap = await rtGet(ref(realtimeDb, `userPresence/${uid}`));
    if (!snap.exists()) return null;
    return parseUserPresence(uid, snap.val() as Record<string, unknown>);
  } catch {
    return null;
  }
};

/**
 * الاستماع المباشر لـ presence مستخدم (في البروفايل)
 */
export const subscribeToUserPresence = (
  uid: string,
  callback: (presence: UserPresence | null) => void,
): (() => void) => {
  const r = ref(realtimeDb, `userPresence/${uid}`);
  const handler = (snap: any) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    const data = snap.val();
    callback(parseUserPresence(uid, data as Record<string, unknown>));
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
};

// ========================================================
// 4. ROOM ENTRY NOTIFICATIONS (إشعارات دخول المتابَعين)
// ========================================================
// لما متابَع يدخل روم، نضع إشعاراً في:
//   notifications/{follower_uid}/items/{auto_id}
//
// السبب: لا نطلب من العميل أن يستمع لكل متابَع. بدل ذلك، نكتب
// إشعاراً واحداً للمتابعين عند الدخول.

/**
 * عند دخول روم: نُشعِر متابعيّ (الذين يتتبّعونني)
 */
export const notifyFollowersOfRoomEntry = async (
  roomId: string,
  roomName: string,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // اقرأ كل من يتابعني (follows where following=me)
    const followsSnap = await getDocs(
      query(
        collection(firestore, 'follows'),
        where('following', '==', user.uid),
        limit(500), // حدّ معقول
      ),
    );

    const myName = user.displayName ?? 'مستخدم';
    const myAvatar = user.photoURL ?? '';

    // نكتب إشعاراً لكل متابع
    await Promise.all(
      followsSnap.docs.map((d) => {
        const followerUid = d.data().follower;
        if (!followerUid) return null;
        return setDoc(
          doc(firestore, 'roomEntryNotifications', `${followerUid}_${roomId}_${Date.now()}`),
          {
            forUid: followerUid,
            fromUid: user.uid,
            fromName: myName,
            fromAvatar: myAvatar,
            roomId,
            roomName,
            createdAt: Date.now(),
            seen: false,
          },
        );
      }),
    );
  } catch (e) {
    // فشل صامت
  }
};

/**
 * الاستماع لإشعارات دخول الرومات (للمتابَعين)
 */
export const subscribeToRoomEntryNotifications = (
  callback: (notifs: any[]) => void,
): (() => void) => {
  const user = auth.currentUser;
  if (!user) return () => {};
  const q = query(
    collection(firestore, 'roomEntryNotifications'),
    where('forUid', '==', user.uid),
    orderBy('createdAt', 'desc'),
    limit(30),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};

// ========================================================
// 5. SHARE ROOM LINK (لينك دعوة)
// ========================================================

/**
 * @deprecated استخدم createRoomShareMessage من @/services/firebase/shareLinks
 */
export const getRoomShareLink = (roomId: string, roomName: string): {
  deepLink: string;
  webLink: string;
  text: string;
} => {
  const deepLink = `linkup://room/${roomId}`;
  const webLink = `https://linkuplivechat.com/r/local`;
  const text = `انضم لغرفة "${roomName}" على LinkUp\n${deepLink}`;
  return { deepLink, webLink, text };
};

// ========================================================
// 6. BATCH PRESENCE (تتبع مجموعة مستخدمين)
// ========================================================

/**
 * الاستماع المباشر لـ presence مجموعة مستخدمين دفعة واحدة.
 * يُنشئ listener لكل uid ويجمعها في map واحدة.
 */
export const subscribeToBatchPresence = (
  uids: string[],
  callback: (map: Record<string, UserPresence | null>) => void,
): (() => void) => {
  if (uids.length === 0) {
    callback({});
    return () => {};
  }
  const map: Record<string, UserPresence | null> = {};
  const unsubs: (() => void)[] = [];
  let initialised = 0;

  for (const uid of uids) {
    map[uid] = null;
    const r = ref(realtimeDb, `userPresence/${uid}`);
    const handler = (snap: any) => {
      if (!snap.exists()) {
        map[uid] = null;
      } else {
        map[uid] = parseUserPresence(uid, snap.val() as Record<string, unknown>);
      }
      if (initialised >= uids.length) {
        callback({ ...map });
      } else {
        initialised++;
        if (initialised >= uids.length) callback({ ...map });
      }
    };
    onValue(r, handler);
    unsubs.push(() => off(r, 'value', handler));
  }

  return () => unsubs.forEach((u) => u());
};
