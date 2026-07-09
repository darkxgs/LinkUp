import React from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Mic, MicOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui';
import { useChallengeVoice } from '@/hooks/useChallengeVoice';
import type { RoomConnectionState } from '@/services/roomAudioSession';

interface ChallengeVoiceBarProps {
  challengeId: string;
  opponentUid: string;
  opponentName: string;
  enabled: boolean;
  bottomInset: number;
}

export function ChallengeVoiceBar({
  challengeId,
  opponentUid,
  opponentName,
  enabled,
  bottomInset,
}: ChallengeVoiceBarProps) {
  const { t } = useTranslation();
  const {
    connectionState,
    isMuted,
    error,
    remoteJoined,
    opponentSpeaking,
    toggleMute,
  } = useChallengeVoice({ challengeId, opponentUid, enabled });

  const statusLabel = (
    state: RoomConnectionState,
    joined: boolean,
    speaking: boolean,
    name: string,
  ): string => {
    if (state === 'connecting') return t('challenges.voice.connecting');
    if (state === 'error') return t('challenges.voice.error');
    if (!joined) return t('challenges.voice.waitingOpponent');
    if (speaking) return t('challenges.voice.opponentSpeaking', { name });
    return t('challenges.voice.connected');
  };

  if (!enabled) return null;

  const isConnecting = connectionState === 'connecting';
  const isConnected = connectionState === 'connected';
  const status = error ?? statusLabel(connectionState, remoteJoined, opponentSpeaking, opponentName);

  return (
    <View style={[styles.wrap, { bottom: Math.max(bottomInset, 12) + 8 }]}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => void toggleMute()}
          disabled={!isConnected || isConnecting}
          style={[
            styles.micBtn,
            !isMuted && isConnected ? styles.micBtnLive : null,
            isMuted ? styles.micBtnMuted : null,
          ]}
        >
          {isConnecting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : isMuted ? (
            <MicOff size={20} color="#fff" strokeWidth={2.5} />
          ) : (
            <Mic size={20} color="#fff" strokeWidth={2.5} />
          )}
        </Pressable>

        <View style={styles.textCol}>
          <View style={styles.titleRow}>
            <View
              style={[
                styles.dot,
                isConnecting && styles.dotPending,
                isConnected && remoteJoined && styles.dotOn,
                opponentSpeaking && styles.dotSpeaking,
              ]}
            />
            <Text variant="caption" weight="bold" color="#FDE68A" style={styles.title}>
              {t('challenges.voice.title')}
            </Text>
          </View>
          <Text variant="caption" color="rgba(255,255,255,0.78)" numberOfLines={1}>
            {status}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 72,
    zIndex: 12,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 6, 6, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  micBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  micBtnLive: {
    backgroundColor: '#10B981',
    borderColor: '#34D399',
  },
  micBtnMuted: {
    backgroundColor: 'rgba(239, 68, 68, 0.35)',
    borderColor: 'rgba(248, 113, 113, 0.55)',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  title: {
    fontSize: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotPending: {
    backgroundColor: '#F59E0B',
  },
  dotOn: {
    backgroundColor: '#10B981',
  },
  dotSpeaking: {
    backgroundColor: '#EA2626',
  },
});
