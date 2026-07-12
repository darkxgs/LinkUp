/**
 * عند فتح واتساب أو تصفّح خارج التطبيق (بدون إغلاقه):
 * - إلغاء onDisconnect المؤقت حتى لا يُفرَّغ المقعد
 * - خدمة أمامية + جلسة الصوت (Agora) يبقيان نشطين
 * - عند العودة: إعادة ربط onDisconnect
 */
import { useEffect, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import {
  installRoomRtdbReconnectRecovery,
  recoverRoomPresenceAfterRtdbReconnect,
  rebindRoomOnDisconnectHandlers,
  suspendRoomOnDisconnectForBackground,
} from '@/services/firebase/rooms';
import { roomAudioSession } from '@/services/roomAudioSession';
import {
  startRoomForegroundService,
  stopRoomForegroundService,
} from '@/services/roomForegroundService';
import { getLiveKitRoomName, useRoomSessionStore } from '@/stores/roomSessionStore';
import { getRoomVoiceSession } from '@/utils/roomVoiceSessionGuard';

function isBackgroundAppState(state: AppStateStatus): boolean {
  return state === 'background' || (Platform.OS === 'ios' && state === 'inactive');
}

function hasActiveRoomSession(
  roomId: string,
  vs: ReturnType<typeof getRoomVoiceSession>,
  pinned: ReturnType<typeof useRoomSessionStore.getState>,
): boolean {
  if (vs.active || pinned.audioPinned) return true;
  return pinned.roomId === roomId && (pinned.canPublish || pinned.micSeatIndex != null);
}

export function RoomBackgroundKeepAlive() {
  const suspendedRef = useRef(false);
  const roomIdRef = useRef<string | null>(null);

  useEffect(() => {
    installRoomRtdbReconnectRecovery();
  }, []);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (isBackgroundAppState(next)) {
        const vs = getRoomVoiceSession();
        const pinned = useRoomSessionStore.getState();
        const roomId = vs.roomId ?? pinned.roomId;
        if (!roomId || !hasActiveRoomSession(roomId, vs, pinned)) return;

        roomIdRef.current = roomId;
        suspendedRef.current = true;
        void suspendRoomOnDisconnectForBackground(roomId).catch(() => {});
        void startRoomForegroundService(vs.roomTitle || pinned.roomName || 'LinkUp');
        return;
      }

      if (next === 'active') {
        const roomId = roomIdRef.current;
        if (suspendedRef.current && roomId) {
          suspendedRef.current = false;
          void recoverRoomPresenceAfterRtdbReconnect()
            .then(() => {
              const pinned = useRoomSessionStore.getState();
              if (pinned.roomId === roomId && pinned.canPublish) {
                return suspendRoomOnDisconnectForBackground(roomId);
              }
              return rebindRoomOnDisconnectHandlers(roomId);
            })
            .catch(() => {});
          const vs = getRoomVoiceSession();
          const pinned = useRoomSessionStore.getState();
          const lkName = getLiveKitRoomName(roomId);
          const snap = roomAudioSession.getSnapshot();
          const shouldPublish = vs.canSpeak || pinned.canPublish;
          if (snap.roomName !== lkName || snap.connectionState !== 'connected') {
            void roomAudioSession.connect(lkName, shouldPublish).then(() => {
              roomAudioSession.resyncRemoteAudio();
            }).catch(() => {});
          } else {
            roomAudioSession.resyncRemoteAudio();
          }
        }
        return;
      }
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  return null;
}
