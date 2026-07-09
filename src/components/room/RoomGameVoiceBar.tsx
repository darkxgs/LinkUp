/**
 * تحكم صوت الغرفة أثناء لعب WebView — أزرار مضغوطة في الشريط العلوي
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react-native';

import {
  roomAudioSession,
  type RoomConnectionState,
} from '@/services/roomAudioSession';

interface Props {
  canMic: boolean;
  volumeMuted: boolean;
  onToggleVolume: () => void;
  /** حالة الكتم من مقعد Firebase — أدق من حالة LiveKit المحلية */
  micMuted?: boolean;
  onToggleMic?: () => void;
}

function dotStyle(state: RoomConnectionState, speaking: boolean, connected: boolean) {
  if (state === 'connecting') return styles.dotPending;
  if (speaking) return styles.dotSpeaking;
  if (connected) return styles.dotOn;
  if (state === 'error') return styles.dotError;
  return styles.dotOff;
}

export function RoomGameVoiceBar({
  canMic,
  volumeMuted,
  onToggleVolume,
  micMuted,
  onToggleMic,
}: Props) {
  const [snap, setSnap] = useState(() => roomAudioSession.getSnapshot());

  useEffect(() => roomAudioSession.subscribe(() => setSnap(roomAudioSession.getSnapshot())), []);

  const remoteSpeaking = useMemo(
    () =>
      snap.participants.some(
        (p) =>
          !p.isLocal &&
          !p.isMuted &&
          (p.isSpeaking || (p.audioLevel ?? 0) > 0.045),
      ),
    [snap.participants],
  );

  const isConnecting = snap.connectionState === 'connecting';
  const isConnected = snap.connectionState === 'connected';
  const micIsMuted = micMuted ?? snap.isMuted;

  const handleMic = () => {
    if (!canMic || !isConnected) return;
    if (onToggleMic) {
      onToggleMic();
      return;
    }
    void roomAudioSession.toggleMute();
  };

  return (
    <View style={styles.wrap}>
      {canMic ? (
        <Pressable
          onPress={handleMic}
          disabled={!isConnected || isConnecting}
          style={[
            styles.btn,
            !micIsMuted && isConnected ? styles.micLive : null,
            micIsMuted ? styles.micMuted : null,
          ]}
          hitSlop={4}
        >
          {isConnecting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : micIsMuted ? (
            <MicOff size={15} color="#fff" strokeWidth={2.5} />
          ) : (
            <Mic size={15} color="#fff" strokeWidth={2.5} />
          )}
          <View style={[styles.dot, dotStyle(snap.connectionState, remoteSpeaking, isConnected)]} />
        </Pressable>
      ) : null}

      <Pressable
        onPress={onToggleVolume}
        disabled={!isConnected}
        style={[styles.btn, volumeMuted ? styles.volMuted : styles.volOn]}
        hitSlop={4}
      >
        {volumeMuted ? (
          <VolumeX size={15} color="#fff" strokeWidth={2.5} />
        ) : (
          <Volume2 size={15} color="#fff" strokeWidth={2.5} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(225, 20, 20, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20, 0.35)',
  },
  micLive: {
    backgroundColor: 'rgba(16, 185, 129, 0.35)',
    borderColor: '#34D399',
  },
  micMuted: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderColor: 'rgba(248, 113, 113, 0.5)',
  },
  volOn: {
    backgroundColor: 'rgba(237, 68, 68, 0.22)',
    borderColor: 'rgba(240, 106, 106, 0.45)',
  },
  volMuted: {
    backgroundColor: 'rgba(100, 116, 139, 0.28)',
    borderColor: 'rgba(148, 163, 184, 0.4)',
  },
  dot: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#0A0405',
  },
  dotOff: { backgroundColor: 'rgba(255,255,255,0.35)' },
  dotPending: { backgroundColor: '#F59E0B' },
  dotOn: { backgroundColor: '#10B981' },
  dotSpeaking: { backgroundColor: '#EA2626' },
  dotError: { backgroundColor: '#EF4444' },
});
