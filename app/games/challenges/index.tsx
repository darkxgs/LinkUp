/**
 * LinkUp App — التحديات
 * تحدّ الأصدقاء في ألعاب 1v1
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView, Pressable, Alert, Modal, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  Swords,
  Coins,
  Users,
  Trophy,
  Target,
  Brain,
  Zap,
  Sparkles,
  Plus,
  ChevronLeft,
  Flame,
  Crown,
} from 'lucide-react-native';
import i18n from '@/localization/i18n';

import { Text, Card, BackButton } from '@/components/ui';
import { colors, radius, spacing, shadows } from '@/theme';
import { firestore } from '@/services/firebase';
import { cancelChallenge, subscribeToMyChallengeHistory, getChallengeGameLabel, getChallengeGameDesc, type ChallengeGameId, type ChallengeHistoryItem } from '@/services/firebase/challenges';
import { formatRelativeTime } from '@/utils/relativeTime';
import { doc, onSnapshot } from 'firebase/firestore';
import { useConfig } from '@/contexts/ConfigContext';
import { getChallengeAppRoute } from '@/utils/challengeDeepLink';
import {
  getChallengeStakeOptions,
  CHALLENGE_CONFIG_GAME_IDS,
} from '@/services/games/stakeChips';
import { getGameConfig } from '@/services/firebase/gamesConfig';
import { isGameEnabled, isSectionVisible } from '@/utils/gamesVisibility';
import { ChallengeInviteSheet } from '@/components/games/ChallengeInviteSheet';
import { useAuth } from '@/hooks/useAuth';
import { useMarkGamePresence } from '@/hooks/useGamePresence';
import { resolveUserWealthLevel } from '@/utils/userBalance';

interface ChallengeGameMeta {
  id: ChallengeGameId;
  Icon: any;
  colors: [string, string];
  isPopular?: boolean;
  isNew?: boolean;
  minBet: number;
}

const GAMES_META: ChallengeGameMeta[] = [
  {
    id: 'penalty',
    Icon: Target,
    colors: ['#10B981', '#059669'],
    isPopular: true,
    minBet: 100,
  },
  {
    id: 'coin-flip',
    Icon: Coins,
    colors: ['#C61414', '#A91111'],
    isPopular: true,
    minBet: 50,
  },
  {
    id: 'billiards',
    Icon: Trophy,
    colors: ['#FF3340', '#B00E0E'],
    isNew: true,
    minBet: 100,
  },
];

interface ChallengeGame extends ChallengeGameMeta {
  name: string;
  desc: string;
}

export default function ChallengesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ incoming?: string }>();
  const insets = useSafeAreaInsets();
  const { games: gamesConfig, gamesGlobal } = useConfig();
  const { user } = useAuth();
  useMarkGamePresence('challenges');
  const coinBalance = user?.stats?.coins ?? 0;

  useEffect(() => {
    if (!isSectionVisible(gamesConfig, gamesGlobal, 'challenges')) {
      router.replace('/games' as any);
    }
  }, [gamesConfig, gamesGlobal, router]);

  const userLevel = resolveUserWealthLevel(user);
  const winnerPercent = gamesGlobal.challengeWinnerPercent ?? 80;

  const [recentChallenges, setRecentChallenges] = useState<ChallengeHistoryItem[]>([]);
  const [challengeWins, setChallengeWins] = useState(0);
  const [winStreak, setWinStreak] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(true);

  const getGameConfigForChallenge = (localId: string) => {
    const configId = CHALLENGE_CONFIG_GAME_IDS[localId] ?? localId;
    return getGameConfig(gamesConfig, configId);
  };

  const visibleGames = useMemo<ChallengeGame[]>(() => {
    return GAMES_META.filter((g) => {
      const configId = CHALLENGE_CONFIG_GAME_IDS[g.id] ?? g.id;
      return isGameEnabled(gamesConfig, gamesGlobal, configId);
    }).map((g) => ({
      ...g,
      name: getChallengeGameLabel(g.id),
      desc: getChallengeGameDesc(g.id),
    }));
  }, [gamesConfig, gamesGlobal, t]);

  const getBetOptions = (localId: string) => {
    const cfg = getGameConfigForChallenge(localId);
    return getChallengeStakeOptions(gamesGlobal, cfg);
  };

  const [selectedGame, setSelectedGame] = useState<ChallengeGame | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [bet, setBet] = useState(gamesGlobal.challengeStakeChips[0] ?? 10000);

  const [sentChallengeId, setSentChallengeId] = useState<string | null>(null);

  useEffect(() => {
    const incoming =
      typeof params.incoming === 'string'
        ? params.incoming
        : Array.isArray(params.incoming)
          ? params.incoming[0]
          : '';
    if (incoming) {
      router.replace(getChallengeAppRoute(incoming) as any);
    }
  }, [params.incoming, router]);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setRecentChallenges([]);
      setChallengeWins(0);
      setWinStreak(0);
      setHistoryLoading(false);
      return;
    }

    setHistoryLoading(true);
    const unsub = subscribeToMyChallengeHistory(uid, winnerPercent, (items, stats) => {
      setRecentChallenges(items);
      setChallengeWins(stats.wins);
      setWinStreak(stats.streak);
      setHistoryLoading(false);
    });

    return unsub;
  }, [user?.uid, winnerPercent]);

  // الاستماع لحالة التحدي المرسل وتوجيه المتحدي تلقائياً عند قبول الخصم
  useEffect(() => {
    if (!sentChallengeId) return;

    const unsub = onSnapshot(doc(firestore, 'gameChallenges', sentChallengeId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status === 'active') {
        const targetId = sentChallengeId;
        setShowFriendPicker(false);
        setSentChallengeId(null);
        setSelectedGame(null);
        router.push(`/games/challenges/active?challengeId=${targetId}` as any);
      } else if (data.status === 'declined') {
        Alert.alert(t('challenges.declined'), t('challenges.declinedBody'));
        setSentChallengeId(null);
      }
    });

    return unsub;
  }, [sentChallengeId]);

  const onChallengeSent = (chalId: string) => {
    setShowFriendPicker(false);
    setSentChallengeId(chalId);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#EF4444', '#DC2626', '#991B1B']}
        style={styles.headerBg}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.base, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <BackButton color={colors.white} bg="rgba(0,0,0,0.3)" />
          <View style={styles.titleRow}>
            <Swords size={20} color="#FCD34D" strokeWidth={2.5} />
            <Text variant="h3" weight="bold" color={colors.white}>
              {t('games.text32938')}
            </Text>
          </View>
          <View style={styles.balanceChip}>
            <Coins size={14} color="#FCD34D" strokeWidth={2.5} />
            <Text variant="caption" weight="bold" color={colors.white}>
              {coinBalance.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Stats banner */}
        <View style={styles.statsBanner}>
          <View style={styles.statBoxLarge}>
            <Trophy size={24} color="#FCD34D" fill="#FCD34D" strokeWidth={0} />
            <Text variant="caption" color="rgba(255,255,255,0.85)">{t('games.text10128')}</Text>
            <Text variant="h2" weight="bold" color={colors.white}>{challengeWins}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBoxLarge}>
            <Flame size={24} color="#FCD34D" fill="#FCD34D" strokeWidth={0} />
            <Text variant="caption" color="rgba(255,255,255,0.85)">{t('games.text13800')}</Text>
            <Text variant="h2" weight="bold" color={colors.white}>{winStreak}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBoxLarge}>
            <Crown size={24} color="#FCD34D" strokeWidth={2.5} />
            <Text variant="caption" color="rgba(255,255,255,0.85)">{t('relationships.level')}</Text>
            <Text variant="h2" weight="bold" color={colors.white}>{userLevel}</Text>
          </View>
        </View>

        {/* White section */}
        <View style={styles.whiteSection}>
          {/* Games title */}
          <View style={styles.sectionTitle}>
            <Swords size={18} color="#EF4444" strokeWidth={2.5} />
            <Text variant="h3" weight="bold">
              {t('games.text24701')}
            </Text>
          </View>

          {/* Games grid */}
          <View style={styles.gamesGrid}>
            {visibleGames.map((game) => {
              const cfg = getGameConfigForChallenge(game.id);
              const displayMinBet = cfg ? cfg.minBet : game.minBet;

              return (
                <Pressable
                  key={game.id}
                  onPress={() => {
                    setSelectedGame(game);
                    const opts = getBetOptions(game.id);
                    setBet(opts[0] || 10000);
                    setShowFriendPicker(true);
                  }}
                  style={styles.gameCard}
                >
                  <LinearGradient
                    colors={game.colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />

                  {/* Badges */}
                  <View style={styles.gameBadges}>
                    {game.isPopular && (
                      <View style={[styles.gameBadge, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
                        <Flame size={9} color="#FCD34D" fill="#FCD34D" strokeWidth={0} />
                        <Text variant="caption" color={colors.white} weight="bold" style={{ fontSize: 9 }}>
                          {t('search.trending')}
                        </Text>
                      </View>
                    )}
                    {game.isNew && (
                      <View style={[styles.gameBadge, { backgroundColor: '#10B981' }]}>
                        <Text variant="caption" color={colors.white} weight="bold" style={{ fontSize: 9 }}>
                          {t('store.new')}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Icon */}
                  <View style={styles.gameIconWrapper}>
                    <game.Icon size={36} color={colors.white} strokeWidth={2} />
                  </View>

                  {/* Info */}
                  <Text variant="body" weight="bold" color={colors.white}>
                    {game.name}
                  </Text>
                  <Text variant="caption" color="rgba(255,255,255,0.85)" numberOfLines={1}>
                    {game.desc}
                  </Text>
                  <View style={styles.minBetRow}>
                    <Coins size={10} color="#FCD34D" strokeWidth={2.5} />
                    <Text variant="caption" color="#FCD34D" weight="bold" style={{ fontSize: 10 }}>
                      {t('challenges.minBet', { amount: displayMinBet.toLocaleString() })}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Recent challenges */}
          <View style={styles.sectionTitle}>
            <Trophy size={18} color="#F59E0B" fill="#F59E0B" strokeWidth={0} />
            <Text variant="h3" weight="bold">
              {t('games.text58889')}
            </Text>
          </View>

          <Card variant="elevated" style={styles.recentCard}>
            {historyLoading ? (
              <ActivityIndicator size="small" color="#E11414" style={{ margin: spacing.lg }} />
            ) : recentChallenges.length === 0 ? (
              <Text
                variant="bodySmall"
                color={colors.text.secondary}
                align="center"
                style={{ padding: spacing.lg }}
              >
                {t('challenges.noHistory')}
              </Text>
            ) : (
              recentChallenges.map((challenge, idx) => (
              <View
                key={challenge.id}
                style={[
                  styles.challengeRow,
                  idx < recentChallenges.length - 1 && styles.challengeRowBorder,
                ]}
              >
                {challenge.opponentAvatar ? (
                  <Image
                    source={{ uri: challenge.opponentAvatar }}
                    style={styles.challengeAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.challengeAvatar, styles.challengeAvatarFallback]}>
                    <Text variant="caption" weight="bold" color={colors.text.secondary}>
                      {challenge.opponentName?.charAt(0) ?? '?'}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, marginStart: spacing.sm }}>
                  <Text variant="bodySmall" weight="semibold">
                    {challenge.opponentName}
                  </Text>
                  <Text variant="caption" color={colors.text.secondary}>
                    {getChallengeGameLabel(challenge.gameId)} • {formatRelativeTime(challenge.completedAt)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.resultBadge,
                    {
                      backgroundColor:
                        challenge.result === 'win'
                          ? '#D1FAE5'
                          : challenge.result === 'lose'
                            ? '#FEE2E2'
                            : '#F3F4F6',
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    weight="bold"
                    color={
                      challenge.result === 'win'
                        ? '#10B981'
                        : challenge.result === 'lose'
                          ? '#EF4444'
                          : '#6B7280'
                    }
                  >
                    {challenge.result === 'tie'
                      ? t('challenges.tie')
                      : `${challenge.earnings > 0 ? '+' : ''}${challenge.earnings.toLocaleString()}`}
                  </Text>
                </View>
              </View>
              ))
            )}
          </Card>
        </View>
      </ScrollView>

      {/* Friend / match / ID invite sheet */}
      <ChallengeInviteSheet
        visible={showFriendPicker}
        game={selectedGame ? {
          id: selectedGame.id as any,
          name: selectedGame.name,
          colors: selectedGame.colors,
          Icon: selectedGame.Icon,
        } : null}
        bet={bet}
        betOptions={selectedGame ? getBetOptions(selectedGame.id) : []}
        onClose={() => {
          setShowFriendPicker(false);
          setSelectedGame(null);
        }}
        onBetChange={setBet}
        onChallengeSent={onChallengeSent}
      />

      {/* Waiting for opponent to accept modal */}
      <Modal
        visible={sentChallengeId !== null}
        animationType="fade"
        transparent
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.friendModal, { alignItems: 'center', paddingVertical: 36 }]}>
            <ActivityIndicator size="large" color="#EF4444" style={{ marginBottom: 16 }} />
            <Text variant="h3" weight="bold" style={{ marginBottom: 8 }}>{t('challenges.sentTitle')}</Text>
            <Text variant="body" color={colors.text.secondary} align="center" style={{ paddingHorizontal: 24, marginBottom: 24 }}>
              {t('challenges.sentWaiting')}
            </Text>
            <Pressable
              onPress={async () => {
                if (sentChallengeId) {
                  const targetId = sentChallengeId;
                  setSentChallengeId(null);
                  await cancelChallenge(targetId);
                }
              }}
              style={{
                backgroundColor: '#FEE2E2',
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: radius.md,
              }}
            >
              <Text variant="button" color="#EF4444" weight="bold">{t('challenges.cancelAndRefund')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FCFAFA' },
  headerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  scrollContent: {},

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  balanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: radius.full,
  },

  // Stats banner
  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.lg,
    marginHorizontal: spacing.base,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
  },
  statBoxLarge: {
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // White section
  whiteSection: {
    backgroundColor: '#FCFAFA',
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.base,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },

  // Games grid
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  gameCard: {
    width: '48%',
    height: 150,
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: spacing.md,
    justifyContent: 'space-between',
    ...shadows.sm,
    position: 'relative',
  },
  gameBadges: {
    position: 'absolute',
    top: 8,
    right: 8,
    gap: 4,
    zIndex: 1,
  },
  gameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  gameIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  minBetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },

  // Recent
  recentCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
  },
  challengeRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#FBEAEA',
  },
  challengeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FBEAEA',
  },
  challengeAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  friendModal: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    paddingBottom: spacing.xl,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0D0D0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.base,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  modalGameInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalGameIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bet
  betRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  betChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    backgroundColor: '#FEF3C7',
    borderRadius: radius.full,
  },
  betChipActive: {
    backgroundColor: '#F59E0B',
  },

  // Friends
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#FCFAFA',
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  friendAvatarWrapper: {
    position: 'relative',
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FBEAEA',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: colors.white,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E11414',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.purpleGlow,
  },
});
