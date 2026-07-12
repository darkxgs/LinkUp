import { useEffect, useState, useCallback, useRef } from 'react';
import {
  roomAudioSession,
  type RoomConnectionState,
  type RoomParticipant,
} from '@/services/roomAudioSession';
import {
  isRoomSessionPinned,
  getLiveKitRoomName,
  useRoomSessionStore,
} from '@/stores/roomSessionStore';

export type { RoomConnectionState, RoomParticipant };

interface UseRoomAudioOptions {
  roomName: string;
  canPublish?: boolean;
  autoConnect?: boolean;
}

/** صوت الغرفة الحي (Agora) — كان اسمه useLiveKitRoom قبل إزالة LiveKit */
export function useRoomAudio({
  roomName,
  canPublish = true,
  autoConnect = true,
}: UseRoomAudioOptions) {
  const [snapshot, setSnapshot] = useState(() => roomAudioSession.getSnapshot());

  useEffect(() => {
    setSnapshot(roomAudioSession.getSnapshot());
    return roomAudioSession.subscribe(() => {
      setSnapshot(roomAudioSession.getSnapshot());
    });
  }, []);

  const connect = useCallback(
    () => roomAudioSession.connect(roomName, canPublish),
    [roomName, canPublish],
  );

  const disconnect = useCallback(() => roomAudioSession.disconnect(), []);

  const canPublishRef = useRef(canPublish);
  canPublishRef.current = canPublish;

  // دخول/خروج الغرفة فقط — لا نقطع الجلسة عند تغيّر canPublish (الجلوس على المقعد)
  useEffect(() => {
    if (!autoConnect || !roomName) return;

    void roomAudioSession.connect(roomName, canPublishRef.current);

    return () => {
      const session = useRoomSessionStore.getState();
      const expected = session.roomId ? getLiveKitRoomName(session.roomId) : '';
      if (
        session.audioPinned &&
        session.roomId &&
        isRoomSessionPinned(session.roomId) &&
        roomName === expected
      ) {
        return;
      }
      void roomAudioSession.disconnect();
    };
  }, [autoConnect, roomName]);

  // ترقية/تخفيض صلاحية النشر (مستمع ↔ مايك) بدون disconnect كامل
  useEffect(() => {
    if (!autoConnect || !roomName) return;
    void roomAudioSession.connect(roomName, canPublish);
  }, [autoConnect, roomName, canPublish]);

  return {
    connectionState: snapshot.connectionState,
    participants: snapshot.participants,
    isMuted: snapshot.isMuted,
    error: snapshot.error,
    room: snapshot.room,
    connect,
    disconnect,
    toggleMute: () => roomAudioSession.toggleMute(),
    setMuted: (muted: boolean) => roomAudioSession.setMuted(muted),
    requestToSpeak: () => roomAudioSession.requestToSpeak(),
  };
}
