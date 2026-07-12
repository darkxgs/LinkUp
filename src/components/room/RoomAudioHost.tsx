/**
 * يحافظ على اتصال صوت الروم (Agora) أثناء التصغير (ابقَ في الروم)
 * يُركَّب في جذر التطبيق — لا يعتمد على شاشة الروم
 * (كان اسمه RoomLiveKitHost قبل إزالة LiveKit)
 */
import { useEffect } from 'react';
import {
  useRoomSessionStore,
  isRoomSessionPinned,
} from '@/stores/roomSessionStore';
import { roomAudioSession } from '@/services/roomAudioSession';
import { syncPinnedRoomListenAudio } from '@/services/pinnedRoomAudio';

export function RoomAudioHost() {
  const roomId = useRoomSessionStore((s) => s.roomId);
  const audioPinned = useRoomSessionStore((s) => s.audioPinned);

  useEffect(() => {
    if (!audioPinned || !roomId) return;

    void syncPinnedRoomListenAudio(roomId);

    return () => {
      const session = useRoomSessionStore.getState();
      // العودة لشاشة الروم (نفس roomId) — لا نقطع جلسة الصوت؛ الشاشة تعيد ضبط النشر/الاستماع
      if (session.roomId === roomId) return;
      if (!roomId || !isRoomSessionPinned(roomId)) {
        void roomAudioSession.disconnect();
      }
    };
  }, [audioPinned, roomId]);

  return null;
}
