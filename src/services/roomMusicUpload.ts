/**
 * إضافة ملفات صوتية من الجهاز لموسيقى الروم — بلا رفع إجباري
 *
 * الملف يدخل مكتبة الجهاز (نسخة دائمة داخل التطبيق) ويُبث فوراً بمساره
 * المحلي عبر خلط Agora على جهاز الـDJ — الجميع يسمعونه من ستريم الـDJ.
 * الرفع إلى Storage صار زراً اختيارياً «تثبيت في صندوق الروم»
 * (pinTrackToRoomBox في roomMusicLibrary) يعمل بالخلفية.
 */
import { InteractionManager, Platform } from 'react-native';
import type * as DocumentPicker from 'expo-document-picker';

import { saveLocalMusicCopy, rememberLocalCopy } from '@/services/roomMusicLocal';
import { addDeviceMusicTrack } from '@/services/roomMusicDeviceLibrary';
import { addTrackToRoomLibrary } from '@/services/roomMusicLibrary';
import { playAllTracksInRoom } from '@/services/roomMusicQueue';
import type { RoomMusic } from '@/services/roomMusic';
import {
  assertRoomMusicFileSize,
  formatRoomMusicMaxSizeLabel,
  RoomMusicFileTooLargeError,
} from '@/constants/roomMusic';
import { auth } from '@/services/firebase';

/** بعد إغلاق Modal — ضروري على iOS وإلا يُلغى منتقي الملفات فوراً */
export function waitAfterSheetDismiss(): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      const delay = Platform.OS === 'ios' ? 520 : 220;
      setTimeout(resolve, delay);
    });
  });
}

export interface AddDeviceFilesResult {
  /** عدد الملفات التي دخلت المكتبة/القائمة بنجاح */
  added: number;
  total: number;
  /** أسماء الملفات المتعذرة مع سبب عربي مختصر */
  failed: { name: string; reason: string }[];
  /** true = لم يكن هناك موسيقى فبدأ أول ملف بالتشغيل فوراً */
  playedNow: boolean;
}

/**
 * إدخال دفعة ملفات من الجهاز: نسخة محلية دائمة + مكتبة الجهاز + مكتبة
 * الجلسة، ثم تشغيل/إلحاق عبر playAllTracksInRoom (append-only — لا قطع).
 * الأخطاء لا تُبتلع: تُجمع لكل ملف وتعود للواجهة («أُضيفت 4 من 5 …»).
 */
export async function addDeviceFilesToRoomMusic(
  roomId: string,
  files: DocumentPicker.DocumentPickerAsset[],
  currentMusic: RoomMusic | null,
): Promise<AddDeviceFilesResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const result: AddDeviceFilesResult = {
    added: 0,
    total: files.length,
    failed: [],
    playedNow: false,
  };
  const tracks: { url: string; title: string; fileName?: string }[] = [];

  for (const picked of files) {
    const name = picked.name || 'ملف صوتي';
    try {
      if (!picked.uri) throw new Error('ملف غير صالح');
      if (typeof picked.size === 'number') assertRoomMusicFileSize(picked.size);

      // نسخة دائمة داخل التطبيق؛ وإن فشل النسخ نستخدم ملف الكاش من المنتقي
      // مباشرة (copyToCacheDirectory: true يجعله محلياً أصلاً)
      const localUri = (await saveLocalMusicCopy(picked.uri, picked.name)) ?? picked.uri;
      const title = picked.name?.replace(/\.[^.]+$/, '')?.trim() || 'مقطع صوتي';
      const deviceTrack = await addDeviceMusicTrack({
        title,
        fileName: picked.name,
        localUri,
      });
      const localPlayUrl = `local://${deviceTrack.id}`;
      await rememberLocalCopy(localPlayUrl, localUri);

      // مكتبة الجلسة («الخاص») — يظهر فوراً في شاشة الموسيقى مع زر التثبيت
      await addTrackToRoomLibrary(roomId, {
        id: deviceTrack.id,
        title,
        url: localPlayUrl,
        fileName: picked.name,
        addedAt: deviceTrack.addedAt,
        addedByUid: user.uid,
      });

      tracks.push({ url: localPlayUrl, title, fileName: picked.name });
      result.added += 1;
    } catch (e) {
      result.failed.push({
        name,
        reason:
          e instanceof RoomMusicFileTooLargeError
            ? `أكبر من ${formatRoomMusicMaxSizeLabel()}`
            : 'تعذّر فتح الملف',
      });
    }
  }

  if (tracks.length) {
    await playAllTracksInRoom(roomId, tracks, currentMusic);
    result.playedNow = !currentMusic;
  }
  return result;
}
