/**
 * يحافظ على اتصال LiveKit للروم أثناء التصغير (ابقَ في الروم)
 * يُركَّب في جذر التطبيق — لا يعتمد على شاشة الروم
 */
import { useEffect } from 'react';
import {
  useRoomSessionStore,
  isRoomSessionPinned,
} from '@/stores/roomSessionStore';
import { roomAudioSession } from '@/services/roomAudioSession';
import { syncPinnedRoomListenAudio } from '@/services/pinnedRoomAudio';

export function RoomLiveKitHost() {
  const roomId = useRoomSessionStore((s) => s.roomId);
  const audioPinned = useRoomSessionStore((s) => s.audioPinned);

  useEffect(() => {
    if (!audioPinned || !roomId) return;

    void syncPinnedRoomListenAudio(roomId);

    return () => {
      const session = useRoomSessionStore.getState();
      // العودة لشاشة الروم (نفس roomId) — لا نقطع LiveKit؛ الشاشة تعيد ضبط النشر/الاستماع
      if (session.roomId === roomId) return;
      if (!roomId || !isRoomSessionPinned(roomId)) {
        void roomAudioSession.disconnect();
      }
    };
  }, [audioPinned, roomId]);

  return null;
}
