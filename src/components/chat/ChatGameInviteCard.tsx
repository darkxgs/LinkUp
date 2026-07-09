/**
 * بطاقة دعوة تحدي لعبة داخل المحادثة
 */
import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Swords, Coins, ExternalLink } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Linking from 'expo-linking';
import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { radius, spacing } from '@/theme';
import type { ChatMessage } from '@/services/firebase/chat';
import { acceptChallenge, getChallengeById } from '@/services/firebase/challenges';
import { getChallengeAppRoute } from '@/utils/challengeDeepLink';
import { getChallengeGameLabel } from '@/utils/challengeI18n';
import type { ChallengeGameId } from '@/services/firebase/challenges';

interface Props {
  msg: ChatMessage;
  isMine: boolean;
}

export function ChatGameInviteCard({ msg, isMine }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const gameName = msg.inviteGameId
    ? getChallengeGameLabel(msg.inviteGameId as ChallengeGameId)
    : (msg.inviteGameName ?? t('challenges.chat.fallback'));
  const bet = msg.inviteBet ?? 0;
  const challengeId = msg.inviteChallengeId ?? '';
  const deepLink = msg.inviteDeepLink ?? (challengeId ? `linkup://challenge/${challengeId}` : '');

  const goActive = () => {
    if (!challengeId) return;
    router.push(getChallengeAppRoute(challengeId) as any);
  };

  const openDeepLink = async () => {
    if (challengeId) {
      goActive();
      return;
    }
    if (deepLink) {
      const can = await Linking.canOpenURL(deepLink);
      if (can) await Linking.openURL(deepLink);
    }
  };

  const handleJoin = async () => {
    if (!challengeId || loading) return;
    setLoading(true);
    setStatusNote(null);
    try {
      const session = await getChallengeById(challengeId);
      if (!session) {
        setStatusNote(t('challenges.chat.expired'));
        return;
      }
      if (session.status === 'active') {
        goActive();
        return;
      }
      if (session.status !== 'pending') {
        setStatusNote(
          session.status === 'completed'
            ? t('challenges.chat.ended')
            : t('challenges.chat.unavailable'),
        );
        return;
      }
      await acceptChallenge(challengeId);
      goActive();
    } catch (e: any) {
      const message = e?.message ?? t('challenges.chat.acceptFailed');
      if (message.includes('لم يعد معلقاً') || message.includes('نشطة')) {
        goActive();
        return;
      }
      setStatusNote(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable onPress={openDeepLink} style={[styles.card, isMine ? styles.cardMine : styles.cardOther]}>
      <LinearGradient
        colors={['rgba(239, 68, 68, 0.28)', 'rgba(225, 20, 20, 0.22)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.iconWrap}>
        <Swords size={22} color="#fff" />
      </View>
      <Text variant="button" weight="bold" color="#fff" style={styles.title}>
        {gameName}
      </Text>
      <View style={styles.betRow}>
        <Coins size={13} color="#FCD34D" />
        <Text variant="caption" color="#FCD34D" weight="bold">
          {t('challenges.chat.bet', { amount: bet.toLocaleString() })}
        </Text>
      </View>
      <Text variant="caption" color="rgba(255,255,255,0.8)" align="center" style={styles.sub}>
        {isMine ? t('challenges.chat.sentInvite') : t('challenges.chat.receivedInvite')}
      </Text>
      {statusNote ? (
        <Text variant="caption" color="#FCA5A5" align="center" style={styles.sub}>
          {statusNote}
        </Text>
      ) : null}
      {!isMine && challengeId ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            void handleJoin();
          }}
          style={styles.joinBtn}
          disabled={loading}
        >
          <LinearGradient
            colors={[lu.colors.pink, lu.colors.purple]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <ExternalLink size={14} color="#fff" />
              <Text variant="caption" weight="bold" color="#fff">
                {t('challenges.chat.acceptJoin')}
              </Text>
            </>
          )}
        </Pressable>
      ) : isMine && challengeId ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            goActive();
          }}
          style={styles.joinBtn}
        >
          <ExternalLink size={14} color="#fff" />
          <Text variant="caption" weight="bold" color="#fff">
            {t('challenges.chat.continue')}
          </Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 220,
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: spacing.md,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cardMine: {
    alignSelf: 'flex-end',
  },
  cardOther: {
    alignSelf: 'flex-start',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
  },
  betRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sub: {
    marginBottom: 4,
  },
  joinBtn: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
});
