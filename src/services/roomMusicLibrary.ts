/**
 * مكتبة موسيقى الجلسة — مقاطعك الحالية فقط داخل الروم (لا حفظ دائم ولا مشاركة).
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

import { withRoomMediaPickerGuard } from '@/utils/roomMediaPickerGuard';
import {
  assertRoomMusicFileSize,
  ROOM_MUSIC_MAX_LIBRARY_TRACKS,
  ROOM_MUSIC_STORAGE_FOLDER,
} from '@/constants/roomMusic';
import { storage, auth } from './firebase/index';
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

export async function loadRoomMusicLibrary(roomId: string): Promise<UserMusicTrack[]> {
  const uid = auth.currentUser?.uid;
  if (!roomId || !uid) return [];
  return getSessionMusicLibrary(roomId, uid);
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
  return subscribeSessionMusicLibrary(roomId, uid, callback);
}

export async function addTrackToRoomLibrary(
  roomId: string,
  track: UserMusicTrack,
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !roomId) return;
  addSessionMusicTrack(roomId, uid, { ...track, addedByUid: track.addedByUid ?? uid });
}

/** يحوّل مسار الجهاز المحلي إلى رابط سحابي جاهز للبث للجميع */
export async function resolveTrackUrlForBroadcast(
  roomId: string,
  url: string,
): Promise<string> {
  const { isDeviceLocalMusicUrl, getDeviceMusicTrack } = await import('./roomMusicDeviceLibrary');
  if (!isDeviceLocalMusicUrl(url)) return url;

  const trackId = url.replace(/^local:\/\//, '');
  const deviceTrack = await getDeviceMusicTrack(trackId);
  if (!deviceTrack?.localUri) {
    throw new Error('الملف غير موجود على الجهاز — أعد اختياره من الجهاز');
  }

  if (deviceTrack.remoteUrl) {
    const { resolveLocalPlayableUri } = await import('./roomMusicLocal');
    const local = await resolveLocalPlayableUri(deviceTrack.remoteUrl);
    if (local !== deviceTrack.remoteUrl) return deviceTrack.remoteUrl;
  }

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
  const { updateDeviceMusicTrackRemoteUrl } = await import('./roomMusicDeviceLibrary');
  await updateDeviceMusicTrackRemoteUrl(trackId, uploaded.url);
  return uploaded.url;
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
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  if (!picked.uri) throw new Error('ملف غير صالح');

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
  await uploadBytes(fileRef, blob, {
    contentType: picked.mimeType ?? `audio/${ext}`,
  });
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
