/**
 * إيقاف الموسيقى/الفيديو عند مغادرة الروم — محلياً ومن RTDB إن كان المستخدم هو المُشغّل
 */
import { ref, get, remove } from 'firebase/database';
import { realtimeDb } from './firebase/index';
import { useRoomMusicUiStore } from '@/stores/roomMusicUiStore';
import type { RoomMusic } from './roomMusic';
import { stopRoomMusicPlayback } from './roomMusicPlaybackManager';

export async function cleanupRoomMediaOnLeave(
  roomId: string,
  uid: string,
): Promise<void> {
  if (!roomId || !uid) return;

  await stopRoomMusicPlayback().catch(() => {});
  useRoomMusicUiStore.getState().clearIfRoom(roomId);

  const musicRef = ref(realtimeDb, `rooms/${roomId}/music`);
  const videoRef = ref(realtimeDb, `rooms/${roomId}/video`);

  await Promise.all([
    (async () => {
      try {
        const musicSnap = await get(musicRef);
        if (musicSnap.exists()) {
          const music = musicSnap.val() as RoomMusic;
          if (music.addedBy === uid) {
            // حذف العقدة يكفي — مراقب مدير الخلط يوقف بث الـDJ فوراً،
            // والطابور يبقى في RTDB لمن يتابعه («متابعة الطابور»)
            await remove(musicRef);
          }
        }
      } catch {
        // ignore
      }
    })(),
    (async () => {
      try {
        const videoSnap = await get(videoRef);
        if (videoSnap.exists()) {
          const video = videoSnap.val() as { addedBy?: string };
          if (video.addedBy === uid) {
            await remove(videoRef);
          }
        }
      } catch {
        // ignore
      }
    })(),
  ]);
}
