/**
 * يحافظ على الروم المثبّت (ابقَ في الروم) أثناء التصغير فقط:
 * - خدمة أمامية على أندرويد
 * - إعادة اتصال LiveKit عند العودة للتطبيق إن انقطع
 */
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  useRoomSessionStore,
  isRoomSessionPinned,
} from '@/stores/roomSessionStore';
import { syncPinnedRoomListenAudio } from '@/services/pinnedRoomAudio';
import {
  startRoomForegroundService,
  stopRoomForegroundService,
} from '@/services/roomForegroundService';

export function RoomPinnedBackgroundHost() {
  const audioPinned = useRoomSessionStore((s) => s.audioPinned);
  const isMinimized = useRoomSessionStore((s) => s.isMinimized);
  const roomId = useRoomSessionStore((s) => s.roomId);
  const roomName = useRoomSessionStore((s) => s.roomName);
  const pinnedInBackground = !!roomId && audioPinned && isMinimized;

  useEffect(() => {
    if (!pinnedInBackground || !roomId) {
      void stopRoomForegroundService();
      return undefined;
    }

    void startRoomForegroundService(roomName);
    return () => {
      if (!roomId || !isRoomSessionPinned(roomId)) {
        void stopRoomForegroundService();
      }
    };
  }, [pinnedInBackground, roomId, roomName]);

  useEffect(() => {
    if (!pinnedInBackground || !roomId) return;

    const ensureLiveConnection = () => {
      void syncPinnedRoomListenAudio(roomId);
    };

    const onAppState = (next: AppStateStatus) => {
      if (next === 'active' || next === 'background') {
        ensureLiveConnection();
      }
    };

    ensureLiveConnection();
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [pinnedInBackground, roomId]);

  return null;
}
