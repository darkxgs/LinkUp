/**
 * مكتبة موسيقى الجهاز — مسارات محلية دائمة داخل التطبيق
 * تبقى بعد إغلاق الروم ولا تحتاج إعادة اختيار الملف من الجهاز.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

import { auth } from './firebase/index';

const DEVICE_LIB_KEY = 'device_music_library_v1';
const MAX_TRACKS = 150;

export const DEVICE_MUSIC_URL_PREFIX = 'local://';

export interface DeviceMusicTrack {
  id: string;
  title: string;
  fileName?: string;
  localUri: string;
  remoteUrl?: string;
  addedAt: number;
  addedByUid?: string;
}

function devicePlayUrl(trackId: string): string {
  return `${DEVICE_MUSIC_URL_PREFIX}${trackId}`;
}

export function isDeviceLocalMusicUrl(url: string): boolean {
  return url.startsWith(DEVICE_MUSIC_URL_PREFIX);
}

export function deviceMusicUrlToId(url: string): string | null {
  if (!isDeviceLocalMusicUrl(url)) return null;
  return url.slice(DEVICE_MUSIC_URL_PREFIX.length) || null;
}

async function readLibrary(): Promise<DeviceMusicTrack[]> {
  try {
    const raw = await AsyncStorage.getItem(DEVICE_LIB_KEY);
    const parsed = raw ? (JSON.parse(raw) as DeviceMusicTrack[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => t?.id && t?.localUri);
  } catch {
    return [];
  }
}

async function writeLibrary(tracks: DeviceMusicTrack[]): Promise<void> {
  try {
    const sorted = [...tracks].sort((a, b) => b.addedAt - a.addedAt).slice(0, MAX_TRACKS);
    await AsyncStorage.setItem(DEVICE_LIB_KEY, JSON.stringify(sorted));
  } catch {
    // ignore
  }
}

export async function loadDeviceMusicLibrary(): Promise<DeviceMusicTrack[]> {
  const tracks = await readLibrary();
  const valid: DeviceMusicTrack[] = [];
  let changed = false;

  for (const track of tracks) {
    try {
      const info = await FileSystem.getInfoAsync(track.localUri);
      if (info.exists && !info.isDirectory) {
        valid.push(track);
      } else {
        changed = true;
      }
    } catch {
      changed = true;
    }
  }

  if (changed) await writeLibrary(valid);
  return valid.sort((a, b) => b.addedAt - a.addedAt);
}

export async function getDeviceMusicTrack(trackId: string): Promise<DeviceMusicTrack | null> {
  const tracks = await loadDeviceMusicLibrary();
  return tracks.find((t) => t.id === trackId) ?? null;
}

export async function addDeviceMusicTrack(input: {
  title: string;
  fileName?: string;
  localUri: string;
  id?: string;
}): Promise<DeviceMusicTrack> {
  const uid = auth.currentUser?.uid ?? 'anon';
  const track: DeviceMusicTrack = {
    id: input.id ?? `${uid}_${Date.now()}`,
    title: input.title.trim() || input.fileName || 'مقطع صوتي',
    fileName: input.fileName,
    localUri: input.localUri,
    addedAt: Date.now(),
    addedByUid: uid,
  };

  const tracks = await readLibrary();
  const withoutDup = tracks.filter(
    (t) => t.localUri !== track.localUri && t.id !== track.id,
  );
  await writeLibrary([track, ...withoutDup]);
  return track;
}

export async function updateDeviceMusicTrackRemoteUrl(
  trackId: string,
  remoteUrl: string,
): Promise<void> {
  if (!trackId || !remoteUrl) return;
  const tracks = await readLibrary();
  const idx = tracks.findIndex((t) => t.id === trackId);
  if (idx < 0) return;
  tracks[idx] = { ...tracks[idx]!, remoteUrl };
  await writeLibrary(tracks);
}

export function deviceTrackToUserMusicTrack(track: DeviceMusicTrack) {
  return {
    id: track.id,
    title: track.title,
    fileName: track.fileName,
    url: track.remoteUrl ?? devicePlayUrl(track.id),
    addedAt: track.addedAt,
    addedByUid: track.addedByUid,
  };
}
