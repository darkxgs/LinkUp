/**
 * LinkUp — مركز المكافآت
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  MessageCircle,
  Gamepad2,
  User,
  Trophy,
  Check,
  Lock,
  Ticket,
  Coins,
  Frame,
  Gift,
  ChevronDown,
  Star,
} from 'lucide-react-native';
import { ChevronLeft } from '@/components/ui/RtlIcons';

import { Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { lu } from '@/theme/lu-brand';
import { REWARDS_ASSETS, REWARDS_DESIGN } from '@/components/rewards/rewardsDesign';
import {
  readRewardsProgress,
  getTaskProgressList,
  claimFreeCheckIn,
  claimPremiumCheckIn,
  purchaseCheckInUpgrade,
  claimTaskReward,
  canClaimFreeCheckIn,
  canClaimPremiumCheckInToday,
  isPremiumCheckInActive,
  type TaskProgressView,
  type CheckInDayConfig,
} from '@/services/firebase/rewardsCenter';

function TaskIcon({ keyName, size }: { keyName: string; size: number }) {
  const color = REWARDS_DESIGN.pink;
  switch (keyName) {
    case 'message':
      return <MessageCircle size={size} color={color} />;
    case 'level':
      return <Trophy size={size} color={REWARDS_DESIGN.gold2} />;
    case 'chat':
      return <MessageCircle size={size} color={lu.colors.blue} />;
    case 'game':
      return <Gamepad2 size={size} color={lu.colors.purple} />;
    default:
      return <User size={size} color={lu.colors.magenta} />;
  }
}

function RewardBadge({
  type,
  amount,
  isAr,
}: {
  type: string;
  amount: number;
  isAr: boolean;
}) {
  if (type === 'message_cards' || type === 'tickets') {
    return (
      <View style={styles.rewardBadge}>
        <Image source={REWARDS_ASSETS.ticket} style={styles.miniBadgeImage} contentFit="contain" />
        <Text style={styles.rewardBadgeText}>x{amount}</Text>
      </View>
    );
  }
  if (type === 'coins') {
    return (
      <View style={styles.rewardBadge}>
        <Image source={REWARDS_ASSETS.coin} style={styles.miniBadgeImage} contentFit="contain" />
        <Text style={styles.rewardBadgeText}>x{amount}</Text>
      </View>
    );
  }
  if (type === 'pearls') {
    return (
      <View style={styles.rewardBadge}>
        <Image source={REWARDS_ASSETS.pearl} style={styles.miniBadgeImage} contentFit="contain" />
        <Text style={styles.rewardBadgeText}>x{amount}</Text>
      </View>
    );
  }
  if (type === 'frame') {
    return (
      <View style={styles.rewardBadge}>
        <Image source={REWARDS_ASSETS.frame} style={styles.miniBadgeImage} contentFit="contain" />
        <Text style={styles.rewardBadgeText}>{isAr ? 'إطار' : 'Frame'}</Text>
      </View>
    );
  }
  if (type === 'gift') {
    return (
      <View style={styles.rewardBadge}>
        <Image source={REWARDS_ASSETS.gift} style={styles.miniBadgeImage} contentFit="contain" />
        <Text style={styles.rewardBadgeText}>{isAr ? 'هدية' : 'Gift'}</Text>
      </View>
    );
  }
  return (
    <Text style={styles.rewardBadgeText}>
      {isAr ? (type === 'frame' ? 'إطار' : 'هدية') : type}
    </Text>
  );
}

function CheckInDayCell({
  day,
  reward,
  claimed,
  isToday,
  isAr,
  onPress,
  isPremium,
}: {
  day: number;
  reward: CheckInDayConfig;
  claimed: boolean;
  isToday: boolean;
  isAr: boolean;
  onPress?: () => void;
  isPremium?: boolean;
}) {
  const label = isPremium 
    ? (isAr ? `${day} أيام` : `${day} Days`) 
    : (isAr ? `اليوم ${day}` : `Day ${day}`);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.dayCell,
        claimed && styles.dayCellClaimed,
        isToday && !claimed && styles.dayCellToday,
        isPremium && styles.dayCellPremium,
      ]}
    >
      {isToday && !claimed && !isPremium && (
        <View style={styles.activeCheckBadge}>
          <Check size={8} color="#fff" strokeWidth={3} />
        </View>
      )}
      {isToday && !claimed && isPremium && (
        <View style={styles.activeStarBadge}>
          <Star size={8} color="#fff" fill="#fff" />
        </View>
      )}
      <Text style={styles.dayLabel}>{label}</Text>
      {claimed ? (
        <View style={styles.claimedCheck}>
          <Check size={12} color="#fff" strokeWidth={3} />
        </View>
      ) : (
        <>
          {reward.rewardType === 'coins' && (
            <Image source={REWARDS_ASSETS.coin} style={styles.dayAssetImage} contentFit="contain" />
          )}
          {reward.rewardType === 'message_cards' && (
            <Image source={REWARDS_ASSETS.ticket} style={styles.dayAssetImage} contentFit="contain" />
          )}
          {reward.rewardType === 'frame' && (
            <Image source={REWARDS_ASSETS.frame} style={styles.dayAssetImage} contentFit="contain" />
          )}
          {reward.rewardType === 'gift' && (
            <Image source={REWARDS_ASSETS.gift} style={styles.dayAssetImage} contentFit="contain" />
          )}
          {reward.rewardType === 'pearls' && (
            <Image source={REWARDS_ASSETS.pearl} style={styles.dayAssetImage} contentFit="contain" />
          )}
          <Text style={styles.dayAmount}>
            {reward.rewardType === 'coins' || reward.rewardType === 'message_cards' || reward.rewardType === 'pearls'
              ? `x${reward.amount}`
              : (isAr ? 'إطار' : 'Frame')}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const TaskRow = React.memo(function TaskRow({
  item,
  isAr,
  busy,
  onAction,
}: {
  item: TaskProgressView;
  isAr: boolean;
  busy: boolean;
  onAction: () => void;
}) {
  const title = isAr ? item.task.titleAr : item.task.titleEn;
  const progressLabel = `(${item.progress}/${item.target})`;

  let btnLabel = isAr ? 'إكمال' : 'Go';
  if (item.claimed) btnLabel = isAr ? 'تم' : 'Done';
  else if (item.done) btnLabel = isAr ? 'استلام' : 'Claim';

  return (
    <View style={styles.taskCard}>
      <View style={styles.taskIconWrap}>
        <TaskIcon keyName={item.task.iconKey} size={24} />
      </View>

      <View style={styles.taskBody}>
        <Text style={styles.taskTitle}>
          {title} {progressLabel}
        </Text>
        <RewardBadge
          type={item.task.rewardType}
          amount={item.task.rewardAmount}
          isAr={isAr}
        />
      </View>

      <Pressable
        onPress={onAction}
        disabled={busy || item.claimed}
        style={[styles.taskBtn, item.claimed && styles.taskBtnDone]}
      >
        <LinearGradient
          colors={item.claimed ? ['#EAEAEA', '#F2F2F2'] : [...REWARDS_DESIGN.taskBtn]}
          style={styles.taskBtnGrad}
        >
          {busy ? (
            <ActivityIndicator color="#D4AF37" size="small" />
          ) : (
            <Text style={[styles.taskBtnText, item.claimed && { color: '#999' }]}>{btnLabel}</Text>
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
});

export default function RewardsCenterScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { rewardsCenter } = useConfig();

  const isAr = i18n.language?.startsWith('ar');
  const config = rewardsCenter;
  const progress = useMemo(
    () => readRewardsProgress({ rewardsProgress: user?.rewardsProgress }),
    [user?.rewardsProgress],
  );

  const [dailyTasks, setDailyTasks] = useState<TaskProgressView[]>([]);
  const [newUserTasks, setNewUserTasks] = useState<TaskProgressView[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [claimingCheckIn, setClaimingCheckIn] = useState<'free' | 'premium' | null>(null);

  const freeCards = progress.freeMessageCards;
  const premiumActive = isPremiumCheckInActive(progress);
  const canFree = canClaimFreeCheckIn(progress);
  const canPremium = canClaimPremiumCheckInToday(progress);

  const title = isAr ? config.titleAr : config.titleEn;
  const cardsLabel = isAr ? config.freeCardsLabelAr : config.freeCardsLabelEn;

  const reloadTasks = useCallback(async () => {
    if (!user?.uid) return;
    setLoadingTasks(true);
    try {
      const userData = {
        displayName: user.profile.displayName,
        avatar: user.profile.avatar,
        gender: user.profile.gender,
        birthYear: user.profile.birthYear,
        country: user.profile.country,
        bio: user.profile.bio,
        photos: user.profile.photos,
        residence: user.profile.residence,
        voiceBio: user.profile.voiceBio,
        height: user.profile.height,
        weight: user.profile.weight,
        education: user.profile.education,
        job: user.profile.job,
        relationship: user.profile.relationship,
      };
      const [daily, nu] = await Promise.all([
        getTaskProgressList(config, progress, user.uid, userData, 'daily'),
        getTaskProgressList(config, progress, user.uid, userData, 'newUser'),
      ]);
      setDailyTasks(daily);
      setNewUserTasks(nu);
    } finally {
      setLoadingTasks(false);
    }
  }, [user, config, progress]);

  useEffect(() => {
    reloadTasks();
  }, [reloadTasks]);

  const handleFreeCheckIn = async () => {
    if (!canFree || claimingCheckIn) return;
    setClaimingCheckIn('free');
    try {
      const res = await claimFreeCheckIn();
      await refreshUser?.();
      await reloadTasks();
      Alert.alert(
        t('common.success'),
        t('rewards.checkInClaimed', {
          amount: res.reward.amount,
          day: res.day,
        }),
      );
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.errorOccurred'));
    } finally {
      setClaimingCheckIn(null);
    }
  };

  const handlePremiumCheckIn = async () => {
    if (!canPremium || claimingCheckIn) return;
    setClaimingCheckIn('premium');
    try {
      const res = await claimPremiumCheckIn();
      await refreshUser?.();
      Alert.alert(t('common.success'), t('rewards.checkInClaimed', { amount: res.reward.amount, day: res.day }));
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.errorOccurred'));
    } finally {
      setClaimingCheckIn(null);
    }
  };

  const handleUpgrade = async () => {
    setShowUpgradeModal(false);
    try {
      await purchaseCheckInUpgrade();
      await refreshUser?.();
      Alert.alert(t('common.success'), t('rewards.upgradeSuccess'));
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.errorOccurred'));
    }
  };

  const handleTaskAction = async (item: TaskProgressView, section: 'daily' | 'newUser') => {
    const key = `${section}-${item.task.id}`;
    if (item.claimed) return;

    if (!item.done) {
      router.push(item.task.route as any);
      return;
    }

    setBusyId(key);
    try {
      await claimTaskReward(item.task.id, section);
      await refreshUser?.();
      await reloadTasks();
      Alert.alert(t('common.success'), t('rewards.taskClaimed'));
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.errorOccurred'));
    } finally {
      setBusyId(null);
    }
  };

  const renderCheckInDays = (
    days: CheckInDayConfig[],
    streakDay: number,
    lastClaim: string | null,
    onClaimToday?: () => void,
    isPremium = false,
  ) => {
    const today = new Date().toISOString().slice(0, 10);
    const claimedToday = lastClaim === today;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.daysRow,
          { flexDirection: 'row' }
        ]}
      >
        {days.map((d) => {
          const claimed = d.day < streakDay || (d.day === streakDay - 1 && claimedToday) ||
            (claimedToday && d.day === streakDay - 1);
          const isToday = d.day === streakDay && !claimedToday;
          return (
            <CheckInDayCell
              key={d.day}
              day={d.day}
              reward={d}
              claimed={claimed}
              isToday={isToday}
              isAr={isAr}
              onPress={isToday ? onClaimToday : undefined}
              isPremium={isPremium}
            />
          );
        })}
      </ScrollView>
    );
  };

  if (!config.enabled) {
    return (
      <View style={[styles.fill, { paddingTop: insets.top }]}>
        <Text style={styles.disabled}>{t('rewards.disabled')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <LinearGradient colors={[...REWARDS_DESIGN.headerSoft]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft size={22} color={REWARDS_DESIGN.ink} />
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 40, height: 2, backgroundColor: REWARDS_DESIGN.gold, marginTop: 4, borderRadius: 1 }} />
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* بطاقات الرسائل */}
        <View style={styles.cardsHero}>
          <View style={styles.cardsHeroLeft}>
            <Ticket size={36} color={REWARDS_DESIGN.gold2} />
          </View>
          <View style={styles.cardsHeroRight}>
            <Text style={styles.cardsLabel}>{cardsLabel}</Text>
            <Text style={styles.cardsSubLabel}>{isAr ? 'استخدمها لإرسال رسائل مجانية' : 'Use them to send free messages'}</Text>
          </View>
          <ChevronDown size={20} color={REWARDS_DESIGN.ink} />
        </View>

        {/* تسجيل الدخول المجاني */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleWrap}>
            <View style={styles.titleDividerSmall} /><View style={styles.titleDot} />
            <Text style={styles.sectionTitle}>
              {isAr ? config.checkInFreeTitleAr : config.checkInFreeTitleEn}
            </Text>
            <View style={styles.titleDot} /><View style={styles.titleDividerSmall} />
          </View>
          {renderCheckInDays(
            config.freeCheckInDays,
            progress.checkIn.freeStreakDay,
            progress.checkIn.lastFreeClaimDate,
            handleFreeCheckIn,
          )}
          {canFree && (
            <Pressable onPress={handleFreeCheckIn} style={styles.claimChip}>
              {claimingCheckIn === 'free' ? (
                <ActivityIndicator color={REWARDS_DESIGN.gold2} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Gift size={16} color={REWARDS_DESIGN.gold2} />
                  <Text style={styles.claimChipText}>{t('rewards.claimToday')}</Text>
                </View>
              )}
            </Pressable>
          )}
        </View>

        {/* ترقية تسجيل الدخول */}
        <LinearGradient colors={[...REWARDS_DESIGN.premium]} style={styles.premiumCard}>
          {!premiumActive && (
            <View style={styles.premiumLock}>
              <Lock size={14} color="#D4AF37" />
            </View>
          )}
          <Text style={styles.premiumTitle}>
            {isAr ? config.checkInPremiumTitleAr : config.checkInPremiumTitleEn}
          </Text>
          {renderCheckInDays(
            config.premiumCheckInDays,
            progress.checkIn.premiumStreakDay,
            progress.checkIn.lastPremiumClaimDate,
            premiumActive ? handlePremiumCheckIn : undefined,
            true
          )}
          <Text style={styles.premiumInfo}>
            {isAr ? config.premiumMaxInfoAr : config.premiumMaxInfoEn}
          </Text>
          <Pressable
            onPress={() => {
              if (premiumActive && canPremium) handlePremiumCheckIn();
              else if (!premiumActive) setShowUpgradeModal(true);
            }}
            style={styles.upgradeBtn}
          >
            <Text style={styles.upgradeBtnText}>
              {premiumActive
                ? (isAr ? 'تم الترقية' : 'Upgraded')
                : `${config.upgradePriceLabel} ${isAr ? 'ترقية' : 'Upgrade'}`}
            </Text>
          </Pressable>
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>{isAr ? 'جديد' : 'New'}</Text>
          </View>
        </LinearGradient>

        {/* المهام اليومية */}
        <View style={[styles.sectionTitleWrap, { marginTop: 24, marginBottom: 4 }]}>
          <View style={styles.titleDividerSmall} /><View style={styles.titleDot} />
          <Text style={styles.blockTitle}>{t('wealthLevel.dailyTasks')}</Text>
          <View style={styles.titleDot} /><View style={styles.titleDividerSmall} />
        </View>
        <Text style={styles.blockSub}>
          {isAr ? config.dailyTasksSubtitleAr : config.dailyTasksSubtitleEn}
        </Text>
        {loadingTasks ? (
          <ActivityIndicator color={lu.colors.pink} style={{ marginVertical: 16 }} />
        ) : (
          dailyTasks.map((item) => (
            <TaskRow
              key={item.task.id}
              item={item}
              isAr={isAr}
              busy={busyId === `daily-${item.task.id}`}
              onAction={() => handleTaskAction(item, 'daily')}
            />
          ))
        )}

        {/* مهام المستخدمين الجدد */}
        <Text style={[styles.blockTitle, { marginTop: 20 }]}>
          {t('rewards.newUserTasks')}
        </Text>
        <Text style={styles.blockSub}>
          {isAr ? config.newUserTasksSubtitleAr : config.newUserTasksSubtitleEn}
        </Text>
        {newUserTasks.map((item) => (
          <TaskRow
            key={item.task.id}
            item={item}
            isAr={isAr}
            busy={busyId === `newUser-${item.task.id}`}
            onAction={() => handleTaskAction(item, 'newUser')}
          />
        ))}
      </ScrollView>

      <Modal visible={showUpgradeModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalText}>
              {isAr ? config.upgradeModalAr : config.upgradeModalEn}
            </Text>
            <Text style={styles.modalPrice}>
              {config.upgradePriceLabel} · {config.upgradePriceCoins.toLocaleString('en-US')} {isAr ? 'كوين' : 'coins'}
            </Text>
            <Pressable onPress={handleUpgrade} style={styles.modalOkWrap}>
              <LinearGradient colors={[...REWARDS_DESIGN.taskBtn]} style={styles.modalOk}>
                <Text style={styles.modalOkText}>
                  {isAr ? `شراء ${config.upgradePriceLabel}` : `Buy ${config.upgradePriceLabel}`}
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={() => setShowUpgradeModal(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>{t('rewards.gotIt')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: lu.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: REWARDS_DESIGN.ink },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  disabled: { textAlign: 'center', marginTop: 40, color: REWARDS_DESIGN.muted },

  cardsHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: REWARDS_DESIGN.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    ...lu.shadows.card,
  },
  cardsHeroLeft: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#FFF8E8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3D060',
  },
  cardsHeroRight: { flex: 1, marginStart: 14 },
  cardsLabel: { fontSize: 16, color: REWARDS_DESIGN.ink, fontWeight: '800' },
  cardsSubLabel: { fontSize: 12, color: REWARDS_DESIGN.muted, marginTop: 4 },

  sectionCard: {
    backgroundColor: REWARDS_DESIGN.card,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    ...lu.shadows.card,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  titleDividerSmall: { width: 20, height: 1, backgroundColor: REWARDS_DESIGN.gold },
  titleDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: REWARDS_DESIGN.gold, transform: [{ rotate: '45deg' }] },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: REWARDS_DESIGN.ink },
  daysRow: { gap: 8, paddingBottom: 4 },
  dayCell: {
    width: 64,
    minHeight: 88,
    borderRadius: 14,
    backgroundColor: REWARDS_DESIGN.dayBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#F1F1F1',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },
  dayCellPremium: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F3D060',
  },
  dayCellClaimed: { backgroundColor: REWARDS_DESIGN.dayClaimed },
  dayCellToday: { borderWidth: 2, borderColor: REWARDS_DESIGN.gold, shadowOpacity: 0.15 },
  activeCheckBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: REWARDS_DESIGN.gold,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFF',
  },
  activeStarBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: REWARDS_DESIGN.gold,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFF',
  },
  dayLabel: { fontSize: 11, fontWeight: '700', color: REWARDS_DESIGN.ink },
  dayCoin: { width: 22, height: 22 },
  dayAmount: { fontSize: 11, fontWeight: '800', color: REWARDS_DESIGN.ink },
  daySpecial: { fontSize: 10, fontWeight: '700', color: REWARDS_DESIGN.ink },
  claimChip: {
    alignSelf: 'center',
    marginTop: 14,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 99,
    backgroundColor: '#FDF5E6',
    borderWidth: 1,
    borderColor: REWARDS_DESIGN.gold,
  },
  claimChipText: { fontWeight: '800', color: REWARDS_DESIGN.gold2, fontSize: 14 },

  premiumCard: {
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },
  premiumLock: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6E5528',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#B8860B',
  },
  premiumTitle: { fontSize: 16, fontWeight: '800', color: '#4B3621', marginBottom: 10, textAlign: 'center' },
  premiumInfo: { fontSize: 12, color: '#665544', marginTop: 12, textAlign: 'center', fontWeight: '600' },
  upgradeBtn: {
    marginTop: 12,
    backgroundColor: REWARDS_DESIGN.upgradeBtn,
    borderRadius: 99,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeBtnText: { fontWeight: '800', color: '#4B3621', fontSize: 16 },
  newBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: REWARDS_DESIGN.mint,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  newBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  blockTitle: { fontSize: 16, fontWeight: '800', color: REWARDS_DESIGN.ink },
  blockSub: { fontSize: 12, color: REWARDS_DESIGN.muted, marginBottom: 10, textAlign: 'center' },

  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: REWARDS_DESIGN.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    gap: 10,
    ...lu.shadows.card,
  },
  taskBtn: { borderRadius: 20, overflow: 'hidden' },
  taskBtnDone: { opacity: 0.6 },
  taskBtnGrad: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, minWidth: 72, alignItems: 'center', borderWidth: 1, borderColor: '#F3D060' },
  taskBtnText: { color: '#4B3621', fontWeight: '800', fontSize: 13 },
  taskBody: { flex: 1, gap: 6, marginHorizontal: 8 },
  taskTitle: { fontSize: 14, fontWeight: '700', color: REWARDS_DESIGN.ink, lineHeight: 20 },
  taskIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3D060',
  },
  rewardBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rewardBadgeText: { fontSize: 12, fontWeight: '800', color: REWARDS_DESIGN.gold2 },
  coinMini: { width: 16, height: 16 },
  miniBadgeImage: {
    width: 14,
    height: 14,
    marginRight: 4,
  },
  dayAssetImage: {
    width: 32,
    height: 32,
    marginVertical: 4,
  },
  claimedCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2BD9A8',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 9,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
  },
  modalText: { fontSize: 14, lineHeight: 22, color: REWARDS_DESIGN.ink, textAlign: 'center' },
  modalPrice: { fontSize: 13, fontWeight: '700', color: REWARDS_DESIGN.ink2, textAlign: 'center', marginTop: 12 },
  modalOkWrap: { marginTop: 16, borderRadius: 24, overflow: 'hidden' },
  modalOk: { paddingVertical: 14, alignItems: 'center', borderRadius: 24 },
  modalOkText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  modalCancel: { marginTop: 10, alignItems: 'center', padding: 8 },
  modalCancelText: { color: REWARDS_DESIGN.muted, fontWeight: '600' },
});
