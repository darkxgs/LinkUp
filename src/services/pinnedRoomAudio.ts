/**
 * صوت الروم أثناء «احتفظ في الروم» — عبر الفقاعة العائمة
 */
import { roomAudioSession } from '@/services/roomAudioSession';
import { getLiveKitRoomName, useRoomSessionStore } from '@/stores/roomSessionStore';

/** اتصال LiveKit أثناء التصغير + ضبط مستوى السماع */
export async function syncPinnedRoomListenAudio(roomId: string): Promise<void> {
  if (!roomId) return;
  const session = useRoomSessionStore.getState();
  const roomName = getLiveKitRoomName(roomId);
  const listenMuted = session.listenMuted;
  const canPublish = session.canPublish;
  roomAudioSession.setRemoteAudioMuted(listenMuted);
  await roomAudioSession.connect(roomName, canPublish);
  roomAudioSession.setRemoteAudioMuted(listenMuted);
  roomAudioSession.resyncRemoteAudio();
}

/** إعادة مزامنة الصوت بعد العودة من وضع «احتفظ» لشاشة الروم */
export async function resyncRoomAudioAfterResume(
  roomId: string,
  canPublish: boolean,
): Promise<void> {
  if (!roomId) return;
  const roomName = getLiveKitRoomName(roomId);
  const listenMuted = useRoomSessionStore.getState().listenMuted;
  roomAudioSession.setRemoteAudioMuted(listenMuted);
  const snap = roomAudioSession.getSnapshot();
  if (snap.connectionState === 'error') {
    await roomAudioSession.disconnect().catch(() => {});
  }
  await roomAudioSession.connect(roomName, canPublish);
  roomAudioSession.setRemoteAudioMuted(listenMuted);
  roomAudioSession.resyncRemoteAudio();
}
