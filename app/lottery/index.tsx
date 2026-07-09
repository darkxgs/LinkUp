/**
 * LinkUp App — نظام حدث اليانصيب الأسبوعي
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { View, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, I18nManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Ticket,
  Trophy,
  Clock,
  Sparkles,
  Crown,
  Plus,
  Minus,
  Calendar,
  TrendingUp,
} from 'lucide-react-native';

import { Text, Card, BackButton } from '@/components/ui';
import { CoinAmount } from '@/components/wallet/CoinAmount';
import { CoinBalanceBar } from '@/components/wallet/CoinBalanceBar';
import { useConfig } from '@/contexts/ConfigContext';
import { useAppLanguage } from '@/localization/useAppLanguage';
import { isSectionVisible } from '@/utils/gamesVisibility';
import { useAuth } from '@/hooks/useAuth';
import { useMarkGamePresence } from '@/hooks/useGamePresence';
import { buyLotteryTickets } from '@/services/firebase/gameTransactions';
import {
  fetchWeeklyLotteryState,
  projectServerCountdown,
  computeLocalNextDrawMs,
  getWeekCountdownParts,
  subscribeToFeaturedLotteryWinner,
  subscribeToWeeklyLotteryDraws,
  type WeeklyLotteryDraw,
  type WeeklyLotteryServerState,
  type LotteryPhase,
} from '@/services/firebase/weeklyLotterySystem';
import { getDisplayAccountId } from '@/services/userIdentifier';
import { colors, radius, spacing, shadows } from '@/theme';

export default function LotteryScreen() {
  const { t, isRTL } = useAppLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { gamesGlobal, games: gamesConfig } = useConfig();
  const { user, refreshUser } = useAuth();
  useMarkGamePresence('lottery');

  useEffect(() => {
    if (!isSectionVisible(gamesConfig, gamesGlobal, 'lottery')) {
      router.replace('/games' as any);
    }
  }, [gamesConfig, gamesGlobal, router]);

  const ticketPrice = gamesGlobal.lotteryTicketPrice;
  const grandPrize = gamesGlobal.lotteryGrandPrize;
  const coins = user?.stats?.coins ?? 0;

  const [ticketCount, setTicketCount] = useState(1);
  const [lotteryState, setLotteryState] = useState<WeeklyLotteryServerState | null>(null);
  const [stateFetchedAt, setStateFetchedAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [myTickets, setMyTickets] = useState(0);
  const [totalWeekTickets, setTotalWeekTickets] = useState(0);
  const [salesOpen, setSalesOpen] = useState(true);
  const [phase, setPhase] = useState<LotteryPhase>('selling');
  const [featuredWinner, setFeaturedWinner] = useState<WeeklyLotteryDraw | null>(null);
  const [winners, setWinners] = useState<WeeklyLotteryDraw[]>([]);
  const [buying, setBuying] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);

  const totalCost = ticketCount * ticketPrice;
  const winChance = (() => {
    const projectedMine = myTickets + ticketCount;
    const projectedTotal = totalWeekTickets + ticketCount;
    if (projectedTotal <= 0) return '0.000';
    return ((projectedMine / projectedTotal) * 100).toFixed(3);
  })();

  const countdownUnits = [
    { key: 'days', value: timeLeft.days, label: t('common.day') },
    { key: 'hours', value: timeLeft.hours, label: t('common.hours') },
    { key: 'minutes', value: timeLeft.minutes, label: t('common.minutes') },
    { key: 'seconds', value: timeLeft.seconds, label: t('lottery.text47306') },
  ];
  // عربي + RTL: عكس الترتيب ليظهر يوم ← ساعة ← دقيقة ← ثانية بشكل طبيعي
  const unitsToShow = isRTL && I18nManager.isRTL
    ? [...countdownUnits].reverse()
    : countdownUnits;

  const refreshServerState = useCallback(async () => {
    try {
      const state = await fetchWeeklyLotteryState();
      const fetchedAt = Date.now();
      setLotteryState(state);
      setStateFetchedAt(fetchedAt);
      setTimeLeft(projectServerCountdown(state, fetchedAt));
      setMyTickets(state.myTickets);
      setTotalWeekTickets(state.totalTickets);
      setSalesOpen(state.salesOpen);
      setPhase(state.phase);
      if (state.featuredWinner?.winnerUid) {
        setFeaturedWinner(state.featuredWinner);
      }
    } catch {
      // الخادم غير متاح — عدّاد محلي (السبت 11:00 الرياض) بدل بقاء 00:00:00
      const fallbackTarget = computeLocalNextDrawMs();
      const fetchedAt = Date.now();
      setLotteryState((prev) =>
        prev ?? ({
          serverNowMs: fetchedAt,
          countdownTargetMs: fallbackTarget,
        } as WeeklyLotteryServerState),
      );
      setStateFetchedAt((prev) => (prev === 0 ? fetchedAt : prev));
      setTimeLeft(getWeekCountdownParts(fallbackTarget, fetchedAt));
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    refreshServerState();
    const sync = setInterval(refreshServerState, 60_000);
    return () => clearInterval(sync);
  }, [refreshServerState]);

  useEffect(() => {
    return subscribeToWeeklyLotteryDraws(setWinners);
  }, []);

  useEffect(() => {
    return subscribeToFeaturedLotteryWinner((w) => {
      if (w?.winnerUid) setFeaturedWinner(w);
    });
  }, []);

  useEffect(() => {
    if (!lotteryState) return;
    const timer = setInterval(() => {
      setTimeLeft(projectServerCountdown(lotteryState, stateFetchedAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [lotteryState, stateFetchedAt]);

  const countdownTitle = phase === 'announcing'
    ? t('games.weeklyLottery.countdownNewRound')
    : t('lottery.text98072');

  const handleBuy = () => {
    if (buying) return; // منع تكديس نوافذ التأكيد → شراء مزدوج
    if (!user?.uid) {
      Alert.alert(t('common.error'), 'يجب تسجيل الدخول أولاً');
      return;
    }
    if (!salesOpen) {
      Alert.alert(
        t('common.error'),
        phase === 'announcing'
          ? t('games.weeklyLottery.salesClosedAnnouncing')
          : t('games.weeklyLottery.salesClosed'),
      );
      return;
    }
    if (coins < totalCost) {
      Alert.alert(t('gifts.insufficientCoins'), `تحتاج ${totalCost.toLocaleString('en-US')} كوين`);
      return;
    }
    Alert.alert(
      t('lottery.text45249'),
      `شراء ${ticketCount} تذكرة بـ ${totalCost.toLocaleString('en-US')} كوين؟`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('store.purchase'),
          onPress: async () => {
            setBuying(true);
            try {
              await buyLotteryTickets(ticketCount);
              await refreshUser();
              await refreshServerState();
              Alert.alert(t('lottery.text40528'), t('games.weeklyLottery.buySuccess'));
            } catch (e: unknown) {
              Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.errorOccurred'));
            } finally {
              setBuying(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F59E0B', '#D97706', '#92400E']}
        style={styles.headerBg}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.base, paddingBottom: insets.bottom + 140 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <BackButton color={colors.white} bg="rgba(0,0,0,0.25)" />
          <Text variant="h3" weight="bold" color={colors.white}>
            {t('games.weeklyLottery.title')}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Big Prize Display */}
        <View style={styles.prizeDisplay}>
          <View style={styles.sparklesContainer}>
            <View style={styles.sparkle1}>
              <Sparkles size={20} color="#FFE082" fill="#FFE082" strokeWidth={0} />
            </View>
            <View style={styles.sparkle2}>
              <Sparkles size={14} color="#FFE082" fill="#FFE082" strokeWidth={0} />
            </View>
            <View style={styles.sparkle3}>
              <Sparkles size={18} color="#FFE082" fill="#FFE082" strokeWidth={0} />
            </View>
          </View>

          <View style={styles.ticketIconWrapper}>
            <Ticket size={56} color={colors.white} strokeWidth={2} />
          </View>

          <Text variant="caption" color="rgba(255,255,255,0.95)" align="center" weight="medium">
            {t('games.weeklyLottery.grandPrizeLabel')}
          </Text>
          <View style={{ marginTop: 8 }}>
            <CoinAmount amount={grandPrize} size="lg" color="#FFFFFF" />
          </View>
        </View>

        {/* White content */}
        <View style={styles.whiteSection}>
          <CoinBalanceBar label={t('lottery.text76838')} amount={coins} />

          {/* Countdown */}
          <Card variant="elevated" style={styles.countdownCard}>
            <View style={styles.countdownHeader}>
              <Clock size={18} color="#F59E0B" strokeWidth={2.5} />
              <Text variant="bodySmall" weight="semibold">
                {countdownTitle}
              </Text>
            </View>
            <View style={[
              styles.countdownRow,
              isRTL && !I18nManager.isRTL && styles.countdownRowRtl,
            ]}>
              {unitsToShow.map((unit) => (
                <TimeBlock key={unit.key} value={unit.value} label={unit.label} isRTL={isRTL} />
              ))}
            </View>
          </Card>

          {/* Buy tickets */}
          <Text variant="label" color={colors.text.secondary} style={styles.sectionLabel}>
            {t('lottery.text34853')}
          </Text>
          <Card variant="elevated" style={styles.buyCard}>
            <View style={styles.ticketPriceRow}>
              <View style={styles.ticketIconSmall}>
                <Ticket size={22} color="#F59E0B" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodySmall" color={colors.text.secondary}>
                  {t('lottery.text25242')}
                </Text>
                <View style={styles.priceRow}>
                  <CoinAmount amount={ticketPrice} size="md" />
                </View>
              </View>
              <Text variant="caption" color={colors.text.secondary}>
                {t('lottery.text24152')}
              </Text>
            </View>

            {/* Quantity */}
            <View style={styles.divider} />
            <View style={styles.quantitySection}>
              <Text variant="bodySmall" weight="semibold">
                {t('lottery.text50916')}
              </Text>
              <View style={styles.quantityControls}>
                <Pressable
                  onPress={() => setTicketCount(Math.max(1, ticketCount - 1))}
                  style={styles.qtyBtn}
                >
                  <Minus size={16} color="#1A0A0C" strokeWidth={2.5} />
                </Pressable>
                <Text variant="h3" weight="bold" style={{ minWidth: 40, textAlign: 'center' }}>
                  {ticketCount}
                </Text>
                <Pressable
                  onPress={() => setTicketCount(Math.min(100, ticketCount + 1))}
                  style={styles.qtyBtn}
                >
                  <Plus size={16} color="#1A0A0C" strokeWidth={2.5} />
                </Pressable>
              </View>
            </View>

            {/* Quick buy */}
            <View style={styles.quickBuyRow}>
              {[5, 10, 25, 50].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setTicketCount(n)}
                  style={[styles.quickChip, ticketCount === n && styles.quickChipActive]}
                >
                  <Text
                    variant="caption"
                    weight="bold"
                    color={ticketCount === n ? colors.white : '#E11414'}
                  >
                    {n}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Summary */}
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <View style={styles.summaryLeft}>
                <TrendingUp size={14} color="#10B981" />
                <Text variant="bodySmall" color={colors.text.secondary}>
                  {t('games.weeklyLottery.winChance')}
                </Text>
              </View>
              <Text variant="bodySmall" weight="bold" color="#10B981">
                {winChance}%
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text variant="bodySmall" color={colors.text.secondary}>
                {t('games.weeklyLottery.myTickets')}
              </Text>
              <Text variant="bodySmall" weight="bold">
                {loadingStats ? '...' : myTickets.toLocaleString('en-US')}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text variant="bodySmall" color={colors.text.secondary}>
                {t('games.weeklyLottery.totalTickets')}
              </Text>
              <Text variant="bodySmall" weight="bold">
                {loadingStats ? '...' : totalWeekTickets.toLocaleString('en-US')}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text variant="body" weight="semibold">
                {t('wallet.total')}
              </Text>
              <CoinAmount amount={totalCost} size="md" />
            </View>
          </Card>

          {/* Featured winner — يبقى ظاهراً حتى يُستبدل بالفائز التالي */}
          {(featuredWinner || winners[0]) && (
            <Card variant="elevated" style={styles.featuredWinnerCard}>
              <View style={styles.featuredWinnerHeader}>
                <Trophy size={20} color="#F59E0B" />
                <Text variant="body" weight="bold">
                  {t('games.weeklyLottery.currentWinner')}
                </Text>
              </View>
              {(() => {
                const w = featuredWinner ?? winners[0]!;
                return (
                  <View style={styles.featuredWinnerBody}>
                    <View style={{ flex: 1 }}>
                      <Text variant="h3" weight="bold">{w.winnerName}</Text>
                      <Text variant="bodySmall" color={colors.text.secondary} style={{ marginTop: 4 }}>
                        {t('games.weeklyLottery.winnerId')}: {getDisplayAccountId(w.winnerPublicId, w.winnerUid)}
                      </Text>
                    </View>
                    <CoinAmount amount={w.prize} size="md" />
                  </View>
                );
              })()}
            </Card>
          )}

          {/* Winner board */}
          <Text variant="label" color={colors.text.secondary} style={styles.sectionLabel}>
            {t('games.weeklyLottery.winnerBoard')}
          </Text>
          <Card variant="elevated" style={styles.winnersCard}>
            {winners.length === 0 ? (
              <View style={{ padding: spacing.lg, alignItems: 'center' }}>
                <Trophy size={28} color="#D1D5DB" />
                <Text variant="bodySmall" color={colors.text.secondary} align="center" style={{ marginTop: 8 }}>
                  {t('games.weeklyLottery.noWinnersYet')}
                </Text>
              </View>
            ) : (
              winners.map((winner, idx) => (
                <View
                  key={winner.weekId}
                  style={[styles.winnerRow, idx < winners.length - 1 && styles.winnerRowBorder]}
                >
                  <View style={styles.winnerRank}>
                    <Crown size={12} color="#fff" />
                  </View>
                  <View style={{ flex: 1, marginStart: spacing.sm }}>
                    <Text variant="body" weight="semibold">{winner.winnerName}</Text>
                    <Text variant="caption" color={colors.text.secondary}>
                      ID: {getDisplayAccountId(winner.winnerPublicId, winner.winnerUid)}
                    </Text>
                    <Text variant="caption" color={colors.text.tertiary}>
                      {winner.weekId}
                    </Text>
                  </View>
                  <CoinAmount amount={winner.prize} size="sm" />
                </View>
              ))
            )}
          </Card>

          {/* Info */}
          <View style={styles.infoCard}>
            <Calendar size={16} color="#ED4444" />
            <Text variant="caption" color={colors.text.secondary} style={{ flex: 1 }}>
              {t('lottery.text35277')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Buy button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Pressable onPress={handleBuy} style={styles.buyButton} disabled={buying || !salesOpen}>
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {buying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ticket size={20} color={colors.white} strokeWidth={2.5} />
              <Text variant="button" color={colors.white} weight="bold">
                شراء {ticketCount} تذكرة
              </Text>
              <View style={styles.buyButtonPrice}>
                <CoinAmount amount={totalCost} size="xs" color="#FFE082" />
              </View>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const TimeBlock: React.FC<{ value: number; label: string; isRTL?: boolean }> = ({
  value,
  label,
  isRTL,
}) => (
  <View style={styles.timeBlock}>
    <View style={styles.timeBlockBg}>
      <Text variant="h3" weight="bold" color="#F59E0B" style={isRTL ? styles.timeDigitsRtl : undefined}>
        {String(value).padStart(2, '0')}
      </Text>
    </View>
    <Text
      variant="caption"
      color={colors.text.secondary}
      style={[styles.timeLabel, isRTL && styles.timeLabelRtl]}
    >
      {label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FCFAFA' },
  headerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
  },
  scrollContent: {},

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.base,
  },

  // Prize display
  prizeDisplay: {
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl,
    position: 'relative',
  },
  sparklesContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  sparkle1: { position: 'absolute', top: 20, right: 60 },
  sparkle2: { position: 'absolute', top: 80, left: 50 },
  sparkle3: { position: 'absolute', bottom: 80, right: 80 },

  ticketIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: spacing.base,
  },
  prizeCoinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },

  // White section
  whiteSection: {
    backgroundColor: '#FCFAFA',
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.base,
  },

  // Countdown
  countdownCard: {
    padding: spacing.base,
    marginBottom: spacing.lg,
  },
  featuredWinnerCard: {
    padding: spacing.base,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: '#FFFBEB',
  },
  featuredWinnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  featuredWinnerBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  countdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  countdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: spacing.xs,
  },
  countdownRowRtl: {
    direction: 'rtl',
    flexDirection: 'row',
  },
  timeBlock: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  timeBlockBg: {
    backgroundColor: '#FEF3C7',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 56,
    alignItems: 'center',
  },
  timeDigitsRtl: {
    writingDirection: 'ltr',
  },
  timeLabel: {
    fontSize: 10,
  },
  timeLabelRtl: {
    writingDirection: 'rtl',
  },

  sectionLabel: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },

  // Buy card
  buyCard: {
    padding: spacing.base,
    marginBottom: spacing.lg,
  },
  ticketPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ticketIconSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  divider: {
    height: 0.5,
    backgroundColor: '#FBEAEA',
    marginVertical: spacing.base,
  },
  quantitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FBEAEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBuyRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  quickChip: {
    flex: 1,
    paddingVertical: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: radius.full,
    alignItems: 'center',
  },
  quickChipActive: {
    backgroundColor: '#E11414',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // Prizes
  prizesCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  prizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
  },
  prizeRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#FBEAEA',
  },
  prizeRankBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prizeAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // Winners
  winnersCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.base,
  },
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    gap: spacing.xs,
  },
  winnerRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#FBEAEA',
  },
  winnerRank: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  winnerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FBEAEA',
  },
  winnerPrize: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },

  // Info
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.base,
    backgroundColor: '#FCDDDD',
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },

  // Bottom
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    padding: spacing.base,
    borderTopWidth: 0.5,
    borderTopColor: colors.border.light,
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.base,
    borderRadius: radius.full,
    overflow: 'hidden',
    ...shadows.md,
  },
  buyButtonPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
});
