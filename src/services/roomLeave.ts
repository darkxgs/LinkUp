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
import { stopRoomSound } from '@/utils/playRoomSound';

export async function completeRoomLeave(
  roomId: string,
  uid?: string | null,
  options?: { skipAudioDisconnect?: boolean },
): Promise<void> {
  if (!roomId) return;

  // إيقاف مؤثرات/أصوات expo-av فوراً — يرفع جيل الإيقاف بشكل متزامن فتُسقط
  // كل التشغيلات المتراكمة بالطابور نفسها (كانت تنفجر دفعة واحدة بعد الخروج)
  void stopRoomSound().catch(() => {});
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

  // احتياط ضد سباق cleanup الـunmount: لو أعاد أي طرف تثبيت جلسة نفس الروم
  // بعد clear() أعلاه (minimize/pin على المايك) امسحها — الخروج هنا صريح ونهائي.
  const refilled = useRoomSessionStore.getState();
  if (refilled.audioPinned && refilled.roomId === roomId) {
    useRoomSessionStore.getState().clear();
  }
}
