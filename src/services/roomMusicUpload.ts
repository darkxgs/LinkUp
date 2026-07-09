/**
 * اختيار ملف صوتي من الجهاز وبثه في الروم
 *
 * التشغيل يبدأ فوراً من الجهاز (نسخة محلية). الملف الأصلي يبقى عندك.
 * لسماع بقية الأعضاء يُرسل تلقائياً تدفق مؤقت للمزامنة فقط — لا يُحفظ في مكتبة الغرفة
 * ويُحذف من السحابة عند إيقاف الموسيقى.
 */
import { InteractionManager, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ref, get, update } from 'firebase/database';

import { addMusicToRoom } from '@/services/roomMusic';
import {
  uploadAudioFileToRoomStorage,
  addTrackToRoomLibrary,
  type UserMusicTrack,
} from '@/services/roomMusicLibrary';
import { saveLocalMusicCopy, rememberLocalCopy } from '@/services/roomMusicLocal';
import {
  addDeviceMusicTrack,
  updateDeviceMusicTrackRemoteUrl,
} from '@/services/roomMusicDeviceLibrary';
import { assertRoomMusicFileSize } from '@/constants/roomMusic';
import { auth, realtimeDb } from '@/services/firebase';
import { withRoomMediaPickerGuard } from '@/utils/roomMediaPickerGuard';

/** أنواع MIME / UTType — iOS لا يفتح المنتقي أحياناً مع audio/* فقط */
const AUDIO_PICKER_TYPES: string | string[] = Platform.select({
  ios: [
    'public.audio',
    'public.mp3',
    'public.mpeg-4-audio',
    'com.apple.m4a-audio',
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/wav',
  ],
  android: ['audio/*', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav'],
  default: 'audio/*',
} as any)!;

export class MusicPickCanceled extends Error {
  constructor() {
    super('canceled');
    this.name = 'MusicPickCanceled';
  }
}

export type InstantBroadcastOptions = {
  /** إضافة لقائمة «الخاص» في هذه الجلسة فقط */
  saveToLibrary?: boolean;
  /** حذف نسخة المزامنة من السحابة عند الإيقاف — افتراضياً نعم */
  ephemeralRelay?: boolean;
};

/** بعد إغلاق Modal — ضروري على iOS وإلا يُلغى منتقي الملفات فوراً */
export function waitAfterSheetDismiss(): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      const delay = Platform.OS === 'ios' ? 520 : 220;
      setTimeout(resolve, delay);
    });
  });
}

export async function pickRoomMusicFile(): Promise<DocumentPicker.DocumentPickerAsset> {
  return withRoomMediaPickerGuard(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: AUDIO_PICKER_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (res.canceled || !res.assets?.[0]?.uri) {
      throw new MusicPickCanceled();
    }

    return res.assets[0];
  });
}

/** @deprecated استخدم startInstantLocalBroadcast — بث فوري من الجهاز */
export async function uploadAndBroadcastRoomMusic(
  roomId: string,
  picked: DocumentPicker.DocumentPickerAsset,
  onProgress?: (percent: number) => void,
  titleOverride?: string,
): Promise<void> {
  await startInstantLocalBroadcast(roomId, picked, undefined, {
    saveToLibrary: false,
    ephemeralRelay: true,
  });
  onProgress?.(100);
  void titleOverride;
}

/**
 * بث فوري من الجهاز — يبدأ التشغيل لحظياً من النسخة المحلية على جهاز صاحب الملف،
 * ويُرسل تدفق مؤقت بالخلفية للمزامنة؛ عند الإيقاف تُحذف نسخة السحابة.
 */
export async function startInstantLocalBroadcast(
  roomId: string,
  picked: DocumentPicker.DocumentPickerAsset,
  callbacks?: {
    onUploaded?: () => void;
    onUploadError?: (message: string) => void;
  },
  options?: InstantBroadcastOptions,
): Promise<void> {
  const saveToLibrary = options?.saveToLibrary ?? false;
  const ephemeralRelay = options?.ephemeralRelay ?? true;

  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  if (!picked.uri) throw new Error('ملف غير صالح');
  if (typeof picked.size === 'number') assertRoomMusicFileSize(picked.size);

  // نسخة دائمة داخل التطبيق؛ وإن فشل النسخ نستخدم ملف الكاش من المنتقي مباشرة
  // (copyToCacheDirectory: true يجعله محلياً أصلاً) بدل إفشال العملية وتعليق المستخدم.
  const localUri = (await saveLocalMusicCopy(picked.uri, picked.name)) ?? picked.uri;

  const title = picked.name?.replace(/\.[^.]+$/, '')?.trim() || 'مقطع صوتي';
  const trackId = `${user.uid}_${Date.now()}`;
  const deviceTrack = await addDeviceMusicTrack({
    id: trackId,
    title,
    fileName: picked.name,
    localUri,
  });
  const localPlayUrl = `local://${deviceTrack.id}`;

  const pendingUrl = `pending://${user.uid}_${Date.now()}`;
  await rememberLocalCopy(pendingUrl, localUri);
  await rememberLocalCopy(localPlayUrl, localUri);

  if (saveToLibrary) {
    await addTrackToRoomLibrary(roomId, {
      id: deviceTrack.id,
      title,
      url: localPlayUrl,
      fileName: picked.name,
      addedAt: deviceTrack.addedAt,
      addedByUid: user.uid,
    });
  }

  await addMusicToRoom(roomId, pendingUrl, title, picked.name, undefined, {
    liveRelay: ephemeralRelay,
  });
  const { useRoomMusicUiStore } = await import('@/stores/roomMusicUiStore');
  useRoomMusicUiStore.getState().openDjPanel();

  void (async () => {
    try {
      const uploaded = await uploadAudioFileToRoomStorage(
        roomId,
        picked,
        undefined,
        localUri,
      );

      const musicRef = ref(realtimeDb, `rooms/${roomId}/music`);
      const snap = await get(musicRef);
      if (snap.exists() && (snap.val() as { url?: string }).url === pendingUrl) {
        await update(musicRef, {
          url: uploaded.url,
          ...(ephemeralRelay ? { liveRelay: true, storagePath: uploaded.storagePath } : {}),
        });
        await rememberLocalCopy(uploaded.url, localUri);
        await updateDeviceMusicTrackRemoteUrl(deviceTrack.id, uploaded.url);

        if (saveToLibrary) {
          await addTrackToRoomLibrary(roomId, {
            id: deviceTrack.id,
            title: uploaded.title,
            url: uploaded.url,
            fileName: uploaded.fileName,
            addedAt: deviceTrack.addedAt,
            addedByUid: user.uid,
          });
        }
      }

      callbacks?.onUploaded?.();
    } catch (e) {
      callbacks?.onUploadError?.(
        e instanceof Error ? e.message : 'تعذّر مزامنة البث — الموسيقى تعمل على جهازك فقط',
      );
    }
  })();
}

/** يُستدعى بعد setShowTools(false) وانتظار الإغلاق */
export async function pickAndBroadcastRoomMusic(
  roomId: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const picked = await pickRoomMusicFile();
  await startInstantLocalBroadcast(roomId, picked);
  onProgress?.(100);
}

/** إضافة لقائمة الانتظار + حفظ في مكتبة الجهاز والغرفة */
export async function relayLocalMusicToQueue(
  roomId: string,
  picked: DocumentPicker.DocumentPickerAsset,
): Promise<void> {
  if (!picked.uri) return;
  if (typeof picked.size === 'number') assertRoomMusicFileSize(picked.size);

  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const localUri = await saveLocalMusicCopy(picked.uri, picked.name);
  const title = picked.name?.replace(/\.[^.]+$/, '')?.trim() || 'مقطع صوتي';

  let deviceTrackId: string | undefined;
  if (localUri) {
    const deviceTrack = await addDeviceMusicTrack({
      title,
      fileName: picked.name,
      localUri,
    });
    deviceTrackId = deviceTrack.id;
    await rememberLocalCopy(`local://${deviceTrack.id}`, localUri);
  }

  const uploaded = await uploadAudioFileToRoomStorage(
    roomId,
    picked,
    undefined,
    localUri ?? undefined,
  );
  if (localUri) await rememberLocalCopy(uploaded.url, localUri);
  if (deviceTrackId) await updateDeviceMusicTrackRemoteUrl(deviceTrackId, uploaded.url);

  const { appendToRoomMusicQueue } = await import('@/services/roomMusicQueue');
  await appendToRoomMusicQueue(roomId, {
    url: uploaded.url,
    title: uploaded.title,
    fileName: uploaded.fileName,
  });
}
