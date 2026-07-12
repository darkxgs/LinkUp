/**
 * مكتبة موسيقى الروم — جلستك الحالية + المقاطع المثبَّتة في صندوق الروم
 * (roomMusicLibrary/{roomId} في RTDB — تبقى بعد الخروج والعودة وتُشارك مع الأعضاء).
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  ref as dbRef,
  get as dbGet,
  set as dbSet,
  remove as dbRemove,
  onValue,
  off,
} from 'firebase/database';

import { withRoomMediaPickerGuard } from '@/utils/roomMediaPickerGuard';
import {
  assertRoomMusicFileSize,
  ROOM_MUSIC_MAX_LIBRARY_TRACKS,
  ROOM_MUSIC_STORAGE_FOLDER,
} from '@/constants/roomMusic';
import { storage, auth, realtimeDb } from './firebase/index';
import {
  addSessionMusicTrack,
  clearSessionMusicLibrary,
  getSessionMusicLibrary,
  removeSessionMusicTrack,
  subscribeSessionMusicLibrary,
} from './roomMusicSessionLibrary';

export { clearSessionMusicLibrary };

export interface UserMusicTrack {
  id: string;
  title: string;
  artist?: string;
  url: string;
  fileName?: string;
  addedAt: number;
  addedByUid?: string;
}

/** روابط قابلة للمشاركة فقط تُثبَّت في صندوق الروم — لا مسارات محلية/مؤقتة */
function isPersistableTrackUrl(url: string | undefined): boolean {
  return (
    !!url &&
    !url.startsWith('local://') &&
    !url.startsWith('pending://') &&
    !url.startsWith('file://')
  );
}

function pinnedTrackRef(roomId: string, trackId: string) {
  return dbRef(realtimeDb, `roomMusicLibrary/${roomId}/${trackId}`);
}

function normalizePinnedTrack(raw: unknown): UserMusicTrack | null {
  const t = (raw ?? {}) as Partial<UserMusicTrack>;
  if (!t.id || !t.url || !t.title) return null;
  return {
    id: String(t.id),
    title: String(t.title),
    url: String(t.url),
    fileName: t.fileName ? String(t.fileName) : undefined,
    addedAt: Number(t.addedAt) || 0,
    addedByUid: t.addedByUid ? String(t.addedByUid) : undefined,
  };
}

/** دمج المثبَّت مع الجلسة — نسخة الجلسة تتقدّم (فيها المسار المحلي = تشغيل فوري) */
function mergeLibraryTracks(
  pinned: UserMusicTrack[],
  session: UserMusicTrack[],
): UserMusicTrack[] {
  const byId = new Map<string, UserMusicTrack>();
  for (const t of pinned) byId.set(t.id, t);
  for (const t of session) byId.set(t.id, t);
  return Array.from(byId.values())
    .sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0))
    .slice(0, ROOM_MUSIC_MAX_LIBRARY_TRACKS);
}

async function fetchPinnedRoomLibrary(roomId: string): Promise<UserMusicTrack[]> {
  try {
    const snap = await dbGet(dbRef(realtimeDb, `roomMusicLibrary/${roomId}`));
    if (!snap.exists()) return [];
    const val = (snap.val() ?? {}) as Record<string, unknown>;
    return Object.values(val)
      .map(normalizePinnedTrack)
      .filter((t): t is UserMusicTrack => t !== null);
  } catch {
    return [];
  }
}

export async function loadRoomMusicLibrary(roomId: string): Promise<UserMusicTrack[]> {
  const uid = auth.currentUser?.uid;
  if (!roomId || !uid) return [];
  const [pinned, session] = await Promise.all([
    fetchPinnedRoomLibrary(roomId),
    Promise.resolve(getSessionMusicLibrary(roomId, uid)),
  ]);
  return mergeLibraryTracks(pinned, session);
}

export function subscribeToRoomMusicLibrary(
  roomId: string,
  callback: (tracks: UserMusicTrack[]) => void,
): () => void {
  const uid = auth.currentUser?.uid;
  if (!roomId || !uid) {
    callback([]);
    return () => {};
  }
  let session: UserMusicTrack[] = getSessionMusicLibrary(roomId, uid);
  let pinned: UserMusicTrack[] = [];
  const emit = () => callback(mergeLibraryTracks(pinned, session));

  const unsubSession = subscribeSessionMusicLibrary(roomId, uid, (tracks) => {
    session = tracks;
    emit();
  });
  const libRef = dbRef(realtimeDb, `roomMusicLibrary/${roomId}`);
  const handler = onValue(
    libRef,
    (snap) => {
      const val = (snap.val() ?? {}) as Record<string, unknown>;
      pinned = Object.values(val)
        .map(normalizePinnedTrack)
        .filter((t): t is UserMusicTrack => t !== null);
      emit();
    },
    () => {
      pinned = [];
      emit();
    },
  );
  return () => {
    unsubSession();
    off(libRef, 'value', handler);
  };
}

export async function addTrackToRoomLibrary(
  roomId: string,
  track: UserMusicTrack,
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !roomId) return;
  const addedByUid = track.addedByUid ?? uid;
  addSessionMusicTrack(roomId, uid, { ...track, addedByUid });

  // تثبيت في صندوق الروم (RTDB) — يبقى بعد الخروج والعودة؛ الروابط السحابية فقط
  if (isPersistableTrackUrl(track.url) && addedByUid === uid) {
    void dbSet(pinnedTrackRef(roomId, track.id), {
      id: track.id,
      title: track.title,
      url: track.url,
      addedAt: track.addedAt,
      addedByUid,
      ...(track.fileName ? { fileName: track.fileName } : {}),
    }).catch(() => {});
  }
}

/**
 * «تثبيت في صندوق الروم» — الرفع إلى Storage صار اختيارياً بالكامل:
 * التشغيل يعمل من الملف المحلي مباشرة (خلط Agora)، وهذا الزر يرفع الملف
 * بالخلفية ويثبّته في roomMusicLibrary ليبقى بعد الخروج ويُتاح لأي DJ آخر.
 * يُحدَّث أيضاً رابط المقطع في قائمة الانتظار حتى يصبح قابلاً للتشغيل من
 * أي جهاز (كان local:// «غير متاح» لغير صاحبه).
 */
export async function pinTrackToRoomBox(
  roomId: string,
  track: Pick<UserMusicTrack, 'id' | 'url' | 'title' | 'fileName' | 'addedAt'>,
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !roomId) throw new Error('يجب تسجيل الدخول');

  // رابط سحابي أصلاً — تثبيت مباشر بلا رفع
  if (isPersistableTrackUrl(track.url)) {
    await addTrackToRoomLibrary(roomId, { ...track, addedAt: track.addedAt, addedByUid: uid });
    return;
  }

  const { isDeviceLocalMusicUrl, getDeviceMusicTrack, updateDeviceMusicTrackRemoteUrl } =
    await import('./roomMusicDeviceLibrary');
  if (!isDeviceLocalMusicUrl(track.url)) {
    throw new Error('هذا المقطع لا يمكن تثبيته');
  }
  const trackId = track.url.replace(/^local:\/\//, '');
  const deviceTrack = await getDeviceMusicTrack(trackId);
  if (!deviceTrack?.localUri) {
    throw new Error('الملف غير موجود على الجهاز — أعد اختياره من الجهاز');
  }

  // رُفع سابقاً — ثبّت الرابط الجاهز
  let remoteUrl = deviceTrack.remoteUrl;
  if (!remoteUrl) {
    const picked = {
      uri: deviceTrack.localUri,
      name: deviceTrack.fileName ?? deviceTrack.title,
    } as DocumentPicker.DocumentPickerAsset;
    const uploaded = await uploadAudioFileToRoomStorage(
      roomId,
      picked,
      undefined,
      deviceTrack.localUri,
    );
    remoteUrl = uploaded.url;
    await updateDeviceMusicTrackRemoteUrl(trackId, remoteUrl);
  }

  await addTrackToRoomLibrary(roomId, {
    id: track.id,
    title: track.title,
    url: remoteUrl,
    fileName: track.fileName,
    addedAt: track.addedAt || Date.now(),
    addedByUid: uid,
  });

  // مقاطع القائمة بالرابط المحلي القديم — حدّثها للرابط السحابي ذرّياً
  try {
    const { runTransaction, ref: rtdbRef } = await import('firebase/database');
    await runTransaction(
      rtdbRef(realtimeDb, `rooms/${roomId}/musicQueue`),
      (raw: { items?: unknown } | null) => {
        if (!raw) return raw;
        const items = (
          Array.isArray(raw.items) ? raw.items : Object.values(raw.items ?? {})
        ) as { url?: string }[];
        let changed = false;
        for (const it of items) {
          if (it && it.url === track.url) {
            it.url = remoteUrl;
            changed = true;
          }
        }
        if (!changed) return raw;
        return { items, updatedAt: Date.now() };
      },
    );
  } catch {
    // تحسين اختياري — القائمة تبقى بالمسار المحلي (يعمل على جهاز صاحبه)
  }
}

/** @deprecated استخدم loadRoomMusicLibrary(roomId) */
export async function loadUserMusicLibrary(roomId?: string): Promise<UserMusicTrack[]> {
  if (!roomId) return [];
  return loadRoomMusicLibrary(roomId);
}

export async function removeTrackFromRoomLibrary(
  roomId: string,
  trackId: string,
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !roomId) return;
  removeSessionMusicTrack(roomId, uid, trackId);
  // إزالة التثبيت من صندوق الروم — القواعد تسمح لصاحب المقطع أو الوكيل
  void dbRemove(pinnedTrackRef(roomId, trackId)).catch(() => {});
}

/** @deprecated */
export async function removeTrackFromUserLibrary(trackId: string, roomId?: string): Promise<void> {
  if (!roomId) return;
  await removeTrackFromRoomLibrary(roomId, trackId);
}

// iOS: UTTypes فقط — خلط MIME معها كان يُبطل الفلترة فيَظهر كل الملفات
// public.audio يغطي كل الصيغ الصوتية (mp3/m4a/wav/aac/flac...)
const AUDIO_PICKER_TYPES: string | string[] = Platform.select({
  ios: ['public.audio'],
  android: ['audio/*'],
  default: 'audio/*',
} as any)!;

export async function pickDeviceAudioFiles(): Promise<DocumentPicker.DocumentPickerAsset[]> {
  return withRoomMediaPickerGuard(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: AUDIO_PICKER_TYPES,
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (res.canceled || !res.assets?.length) return [];
    return res.assets;
  });
}

export async function uploadAudioFileToRoomStorage(
  roomId: string,
  picked: DocumentPicker.DocumentPickerAsset,
  onProgress?: (pct: number) => void,
  existingLocalUri?: string,
): Promise<{ url: string; title: string; fileName?: string; storagePath: string }> {
  // الحارس يبقى نشطاً طوال الرفع — إضافة/رفع متكرر لا يمرّ بنافذة إفراغ المقعد
  return withRoomMediaPickerGuard(() =>
    uploadAudioFileToRoomStorageInner(roomId, picked, onProgress, existingLocalUri),
  );
}

async function uploadAudioFileToRoomStorageInner(
  roomId: string,
  picked: DocumentPicker.DocumentPickerAsset,
  onProgress?: (pct: number) => void,
  existingLocalUri?: string,
): Promise<{ url: string; title: string; fileName?: string; storagePath: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  if (!picked.uri) throw new Error('ملف غير صالح');

  // تجديد التوكن قبل الرفع — الجلسة القديمة كانت تُرفض بـ storage/unauthorized
  // على room_music فيظهر خطأ غامض بالخلفية (نفس معالجة رفع KYC)
  await user.getIdToken(true).catch(() => {});

  onProgress?.(10);
  const response = await fetch(picked.uri);
  const blob = await response.blob();
  assertRoomMusicFileSize(blob.size);

  const ext =
    picked.name?.split('.').pop()?.toLowerCase() ??
    picked.mimeType?.split('/').pop() ??
    'm4a';
  const path = `${ROOM_MUSIC_STORAGE_FOLDER}/${roomId}/${user.uid}_${Date.now()}.${ext}`;
  const fileRef = storageRef(storage, path);

  onProgress?.(45);
  // قواعد Storage تشترط contentType صوتياً — بعض المنتقيات تُرجع octet-stream
  const contentType = picked.mimeType?.startsWith('audio/')
    ? picked.mimeType
    : `audio/${ext}`;
  await uploadBytes(fileRef, blob, { contentType });
  onProgress?.(85);
  const url = await getDownloadURL(fileRef);
  onProgress?.(100);

  // نسخة محلية دائمة — صاحب الملف يشغّل من القرص فوراً بدون تحميل من الشبكة
  try {
    const { saveLocalMusicCopy, rememberLocalCopy } = await import('./roomMusicLocal');
    const localUri =
      existingLocalUri ?? (await saveLocalMusicCopy(picked.uri, picked.name));
    if (localUri) await rememberLocalCopy(url, localUri);
  } catch {
    // النسخة المحلية تحسين اختياري — لا تُفشل الرفع
  }

  const baseName = picked.name?.replace(/\.[^.]+$/, '')?.trim() ?? 'مقطع';
  return {
    url,
    title: baseName || picked.name || 'مقطع صوتي',
    fileName: picked.name,
    storagePath: path,
  };
}

export async function uploadUserMusicTrack(
  roomId: string,
  picked: DocumentPicker.DocumentPickerAsset,
  onProgress?: (pct: number) => void,
): Promise<UserMusicTrack> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const { url, title, fileName } = await uploadAudioFileToRoomStorage(
    roomId,
    picked,
    onProgress,
  );

  const track: UserMusicTrack = {
    id: `${user.uid}_${Date.now()}`,
    title,
    artist: '',
    url,
    fileName,
    addedAt: Date.now(),
    addedByUid: user.uid,
  };
  await addTrackToRoomLibrary(roomId, track);
  return track;
}
