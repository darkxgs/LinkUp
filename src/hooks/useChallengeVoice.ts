import { useCallback, useEffect, useState } from 'react';
import {
  roomAudioSession,
  type RoomConnectionState,
  type RoomParticipant,
} from '@/services/roomAudioSession';
import { callSession } from '@/services/callSession';
import { getChallengeLiveKitRoomName } from '@/utils/challengeVoice';

interface UseChallengeVoiceOptions {
  challengeId: string;
  opponentUid: string;
  enabled: boolean;
}

export function useChallengeVoice({
  challengeId,
  opponentUid,
  enabled,
}: UseChallengeVoiceOptions) {
  const roomName = challengeId ? getChallengeLiveKitRoomName(challengeId) : '';
  const [snapshot, setSnapshot] = useState(() => roomAudioSession.getSnapshot());

  useEffect(() => {
    setSnapshot(roomAudioSession.getSnapshot());
    return roomAudioSession.subscribe(() => {
      setSnapshot(roomAudioSession.getSnapshot());
    });
  }, []);

  useEffect(() => {
    if (!enabled || !roomName) return;

    const callSnap = callSession.getSnapshot();
    if (callSnap.callState === 'connected' || callSnap.callState === 'connecting') {
      return;
    }

    let cancelled = false;

    (async () => {
      await roomAudioSession.connect(roomName, true, opponentUid);
      if (cancelled) return;
      const snap = roomAudioSession.getSnapshot();
      if (snap.connectionState === 'connected' && !snap.isMuted) {
        await roomAudioSession.toggleMute();
      }
    })();

    return () => {
      cancelled = true;
      if (roomAudioSession.isConnectedTo(roomName)) {
        void roomAudioSession.disconnect();
      }
    };
  }, [enabled, opponentUid, roomName]);

  const remoteParticipant = snapshot.participants.find((p) => !p.isLocal && p.identity === opponentUid)
    ?? snapshot.participants.find((p) => !p.isLocal);

  const remoteJoined = !!remoteParticipant;
  const opponentSpeaking =
    !!remoteParticipant &&
    !remoteParticipant.isMuted &&
    (remoteParticipant.isSpeaking || (remoteParticipant.audioLevel ?? 0) > 0.045);

  const toggleMute = useCallback(() => roomAudioSession.toggleMute(), []);

  return {
    connectionState: snapshot.connectionState as RoomConnectionState,
    isMuted: snapshot.isMuted,
    error: snapshot.error,
    participants: snapshot.participants as RoomParticipant[],
    remoteJoined,
    opponentSpeaking,
    toggleMute,
    connect: () => roomAudioSession.connect(roomName, true, opponentUid),
    disconnect: () => roomAudioSession.disconnect(),
  };
}
