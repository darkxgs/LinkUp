/**
 * مغادرة كاملة للروم — قطع المايك والصوت وإخلاء المقعد/الحضور.
 * لا تُستخدم عند «احتفظ في الروم» (audioPinned).
 */
import { useRoomSessionStore } from '@/stores/roomSessionStore';
import { useRoomMusicUiStore } from '@/stores/roomMusicUiStore';
import { useRoomVideoUiStore } from '@/stores/roomVideoUiStore';
import { releaseRoomMembership } from '@/services/firebase/rooms';
import { cleanupRoomMediaOnLeave } from '@/services/roomMediaCleanup';
import { roomAudioSession } from '@/services/roomAudioSession';
import { stopRoomForegroundService } from '@/services/roomForegroundService';
import { stopRoomMusicPlayback } from '@/services/roomMusicPlaybackManager';

export async function completeRoomLeave(
  roomId: string,
  uid?: string | null,
  options?: { skipAudioDisconnect?: boolean },
): Promise<void> {
  if (!roomId) return;

  // إيقاف موسيقى الروم فوراً — قبل قطع LiveKit أو إلغاء mount الشاشة
  await stopRoomMusicPlayback().catch(() => {});

  // قطع سماع الصوت + مسح الحالة فوراً — قبل انتظار الشبكة
  roomAudioSession.setRemoteAudioMuted(true);
  useRoomSessionStore.getState().clear();
  useRoomMusicUiStore.getState().clearIfRoom(roomId);
  useRoomVideoUiStore.getState().clearPinned(roomId);
  void stopRoomForegroundService();

  await Promise.all([
    options?.skipAudioDisconnect ? Promise.resolve() : roomAudioSession.disconnect().catch(() => {}),
    uid ? cleanupRoomMediaOnLeave(roomId, uid).catch(() => {}) : Promise.resolve(),
    releaseRoomMembership(roomId).catch(() => {}),
  ]);
}
