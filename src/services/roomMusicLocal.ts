/**
 * نسخ محلية لموسيقى الروم — خلط فوري من القرص بدون شبكة
 *
 * عند إضافة ملف من الجهاز تُحفظ نسخة دائمة داخل مجلد التطبيق،
 * ويُربط رابط التخزين السحابي (إن ثُبِّت في صندوق الروم) بالمسار المحلي.
 * جهاز الـDJ يخلط النسخة المحلية إن وُجدت (startAudioMixing من القرص)،
 * وإلا يخلط الرابط السحابي مباشرة — المستمعون لا يحمّلون شيئاً إطلاقاً.
 */
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  deviceMusicUrlToId,
  getDeviceMusicTrack,
  isDeviceLocalMusicUrl,
} from './roomMusicDeviceLibrary';

const LOCAL_MAP_KEY = 'room_music_local_map_v1';
const LOCAL_DIR = `${FileSystem.documentDirectory ?? ''}roomMusic/`;
const MAX_MAP_ENTRIES = 150;

type LocalMap = Record<string, string>;

async function readMap(): Promise<LocalMap> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_MAP_KEY);
    const parsed = raw ? (JSON.parse(raw) as LocalMap) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeMap(map: LocalMap): Promise<void> {
  try {
    const keys = Object.keys(map);
    if (keys.length > MAX_MAP_ENTRIES) {
      for (const k of keys.slice(0, keys.length - MAX_MAP_ENTRIES)) delete map[k];
    }
    await AsyncStorage.setItem(LOCAL_MAP_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

async function ensureLocalDir(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(LOCAL_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(LOCAL_DIR, { intermediates: true });
    }
  } catch {
    // ignore
  }
}

/** ينسخ ملفاً مُنتقى إلى مجلد دائم داخل التطبيق ويعيد مساره المحلي */
export async function saveLocalMusicCopy(
  sourceUri: string,
  fileName?: string | null,
): Promise<string | null> {
  if (!sourceUri || !FileSystem.documentDirectory) return null;
  try {
    await ensureLocalDir();
    const ext = (fileName ?? sourceUri).split('.').pop()?.toLowerCase() || 'm4a';
    const safeExt = /^[a-z0-9]{1,5}$/.test(ext) ? ext : 'm4a';
    const dest = `${LOCAL_DIR}${Date.now()}_${Math.floor(Math.random() * 1e6)}.${safeExt}`;
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    return dest;
  } catch {
    return null;
  }
}

/** يربط رابط التخزين السحابي بالنسخة المحلية على هذا الجهاز */
export async function rememberLocalCopy(remoteUrl: string, localUri: string): Promise<void> {
  if (!remoteUrl || !localUri) return;
  const map = await readMap();
  map[remoteUrl] = localUri;
  await writeMap(map);
}

/**
 * يُرجع المسار المحلي إن كانت النسخة موجودة على الجهاز، وإلا الرابط السحابي.
 * يستخدمه مدير خلط Agora على جهاز الـDJ — الخلط من القرص أوثق من التدفق.
 */
export async function resolveLocalPlayableUri(remoteUrl: string): Promise<string> {
  if (!remoteUrl) return remoteUrl;
  if (isDeviceLocalMusicUrl(remoteUrl)) {
    const trackId = deviceMusicUrlToId(remoteUrl);
    if (trackId) {
      const track = await getDeviceMusicTrack(trackId);
      if (track?.localUri) {
        try {
          const info = await FileSystem.getInfoAsync(track.localUri);
          if (info.exists && !info.isDirectory) return track.localUri;
        } catch {
          // fall through
        }
      }
    }
    return remoteUrl;
  }
  try {
    const map = await readMap();
    const localUri = map[remoteUrl];
    if (!localUri) return remoteUrl;
    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists && !info.isDirectory) return localUri;
    // النسخة حُذفت (إعادة تثبيت مثلاً) — نظّف الخريطة
    delete map[remoteUrl];
    await writeMap(map);
    return remoteUrl;
  } catch {
    return remoteUrl;
  }
}
