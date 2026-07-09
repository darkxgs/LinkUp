/**
 * أثناء الروم: منع إطفاء الشاشة + خدمة أمامية على أندرويد للمايك/الصوت.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';

import {
  startRoomForegroundService,
  stopRoomForegroundService,
} from '@/services/roomForegroundService';
import { isRoomSessionPinned, useRoomSessionStore } from '@/stores/roomSessionStore';
import { setRoomVoiceSession } from '@/utils/roomVoiceSessionGuard';

type Props = {
  active: boolean;
  roomId?: string;
  roomTitle?: string;
  /** على مقعد أو مضيف — تشغيل الخدمة الأمامية على أندرويد */
  canSpeak?: boolean;
};

export function RoomVoiceSessionGuard({
  active,
  roomId,
  roomTitle,
  canSpeak = false,
}: Props) {
  useEffect(() => {
    setRoomVoiceSession({
      active,
      roomId: active ? (roomId ?? null) : null,
      roomTitle: roomTitle ?? '',
      canSpeak: active ? canSpeak : false,
    });
    if (!active) return undefined;
    return () => {
      const pinned = useRoomSessionStore.getState();
      if (pinned.audioPinned && pinned.roomId === roomId) return;
      setRoomVoiceSession({
        active: false,
        roomId: null,
        roomTitle: '',
        canSpeak: false,
      });
    };
  }, [active, roomId, roomTitle, canSpeak]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    if (!active || !roomId) {
      const pinned = useRoomSessionStore.getState();
      if (!pinned.audioPinned || !pinned.isMinimized) {
        void stopRoomForegroundService();
      }
      return undefined;
    }

    void startRoomForegroundService(roomTitle ?? 'LinkUp');
    return () => {
      if (!roomId || !isRoomSessionPinned(roomId)) {
        const pinned = useRoomSessionStore.getState();
        if (!pinned.audioPinned || !pinned.isMinimized) {
          void stopRoomForegroundService();
        }
      }
    };
  }, [active, roomId, roomTitle]);

  return null;
}
