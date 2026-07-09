/**
 * بطاقة دعوة لعبة روم في شات الغرفة
 */
import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gamepad2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { radius, spacing } from '@/theme';
import type { RoomMessage } from '@/services/firebase/rooms';
import type { RoomFreeGameId } from '@/constants/roomFreeGames';

interface Props {
  msg: RoomMessage;
  myUid?: string;
  onJoin: (payload: {
    sessionId: string;
    gameId: RoomFreeGameId;
    joinCode?: string;
  }) => void;
}

export function RoomGameInviteChatCard({ msg, myUid, onJoin }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const sessionId = msg.inviteSessionId ?? '';
  const gameId = (msg.inviteGameId ?? 'ludo') as RoomFreeGameId;
  const gameName = msg.inviteGameName ?? t('roomGameInvite.gameFallback');
  const joinCode = msg.inviteJoinCode;
  const isMine = msg.uid === myUid;
  const isForMe =
    !msg.inviteTargetUid || msg.inviteTargetUid === myUid || isMine;
  const targetedOther =
    !!msg.inviteTargetUid && msg.inviteTargetUid !== myUid && !isMine;

  const handleJoin = async () => {
    if (!sessionId || loading || targetedOther) return;
    setLoading(true);
    try {
      onJoin({ sessionId, gameId, joinCode });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.card, isMine ? styles.cardMine : styles.cardOther]}>
      <LinearGradient
        colors={['rgba(225, 20, 20, 0.3)', 'rgba(225, 20, 20, 0.2)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.iconWrap}>
        <Gamepad2 size={22} color="#fff" />
      </View>
      <Text variant="button" weight="bold" color="#fff" style={styles.title}>
        {gameName}
      </Text>
      {joinCode ? (
        <Text variant="caption" color="#FEE2E2" weight="bold">
          {t('roomGameInvite.code', { code: joinCode })}
        </Text>
      ) : null}
      <Text variant="caption" color="rgba(255,255,255,0.82)" align="center" style={styles.sub}>
        {targetedOther
          ? t('roomGameInvite.privateOther', { name: msg.inviteTargetName ?? '' })
          : isMine
            ? t('roomGameInvite.sent')
            : t('roomGameInvite.received')}
      </Text>
      {!isMine && isForMe && sessionId ? (
        <Pressable onPress={() => void handleJoin()} style={styles.joinBtn} disabled={loading}>
          <LinearGradient
            colors={[lu.colors.pink, lu.colors.purple]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text variant="caption" weight="bold" color="#fff">
              {t('roomGameInvite.join')}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 230,
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: spacing.md,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginTop: 4,
  },
  cardMine: { alignSelf: 'flex-end' },
  cardOther: { alignSelf: 'flex-start' },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { textAlign: 'center' },
  sub: { marginBottom: 4 },
  joinBtn: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
    minWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
});
