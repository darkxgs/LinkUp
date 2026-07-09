/**
 * LinkUp App — Wealth Level Screen
 * مطابقة Level Details.png من Line up App Full File
 */

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

import { Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { lu } from '@/theme/lu-brand';
import { COIN_CURRENCY_ICON } from '@/constants/brandAssets';
import { Sparkles } from 'lucide-react-native';
import {
  WlBackIcon,
  WlGameIcon,
  WlGiftIcon,
  WlHomeIcon,
  WlLockIcon,
  WlLockWhiteIcon,
  WlMicIcon,
  WlQuestionIcon,
  WlRocketIcon,
} from '@/components/wealthLevel/WealthLevelDesignIcons';
import {
  RelationshipLevelPanelShape,
  REL_PANEL_ASPECT,
} from '@/components/relationships/RelationshipLevelPanelShape';
import {
  WL_ASSETS,
  WL_DESIGN,
  WEALTH_PRIVILEGES,
} from '@/components/wealthLevel/wealthLevelDesign';
import { WealthLevelExpBubbles } from '@/components/wealthLevel/WealthLevelExpBubbles';
import { WealthXpGainFlash } from '@/components/wealthLevel/WealthXpGainFlash';
import { WALLET_ASSETS } from '@/components/wallet/walletDesign';
import { PrivilegeVectorIcon, VectorEmblem } from '@/components/icons/PrivilegeVectorIcon';
import {
  claimWealthExpBubble,
  upgradeWealthLevelWithCoins,
  coinsNeededForLevelUp,
  xpRequiredForLevel,
  WEALTH_TODAY_BONUS,
  todayDateKey,
  type WealthExpBubbleId,
} from '@/services/firebase/wealthLevel';
import { resolveUserWealthLevel } from '@/utils/userBalance';

type DailyStatsKey = 'totalRoomMinutes' | 'totalGiftsSent' | 'totalRoomsCreated';

interface DailyTaskDef {
  id: string;
  titleKey: string;
  max: number;
  xp: number;
  statsKey: DailyStatsKey | null;
  divisor?: number;
  renderIcon: (size: number) => React.ReactNode;
}

const TASKS_PREVIEW_COUNT = 2;

const DAILY_TASK_DEFS: DailyTaskDef[] = [
  {
    id: 'stay-room',
    titleKey: 'wealthLevel.text94553',
    max: 3,
    xp: 5,
    statsKey: 'totalRoomMinutes',
    divisor: 5,
    renderIcon: (size) => <WlHomeIcon size={size} />,
  },
  {
    id: 'mic-time',
    titleKey: 'wealthLevel.text78346',
    max: 3,
    xp: 5,
    statsKey: 'totalRoomMinutes',
    divisor: 10,
    renderIcon: (size) => <WlMicIcon size={size} />,
  },
  {
    id: 'send-gifts',
    titleKey: 'wealthLevel.text36228',
    max: 3,
    xp: 5,
    statsKey: 'totalGiftsSent',
    renderIcon: (size) => <WlGiftIcon size={size} />,
  },
  {
    id: 'game-bet',
    titleKey: 'wealthLevel.gameBet',
    max: 3,
    xp: 5,
    statsKey: null,
    renderIcon: (size) => <WlGameIcon size={size} />,
  },
];

export default function WealthLevelScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { width: W } = useWindowDimensions();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [hiddenBubbleIds, setHiddenBubbleIds] = useState<string[]>([]);
  const [upgrading, setUpgrading] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [xpFlash, setXpFlash] = useState<{ amount: number; key: number } | null>(null);

  const level = resolveUserWealthLevel(user);
  const xp = user?.stats.xp ?? 0;
  const userCoins = user?.stats?.coins ?? 0;
  const xpNeeded = xpRequiredForLevel(level);
  const xpProgress = Math.min((xp / xpNeeded) * 100, 100);
  const xpRemaining = Math.max(0, xpNeeded - xp);
  const upgradeCost = coinsNeededForLevelUp(level, xp);
  const canUpgradeWithCoins = upgradeCost === 0 || userCoins >= upgradeCost;

  const progressAnim = useRef(new Animated.Value(xpProgress)).current;
  const xpNumScale = useRef(new Animated.Value(1)).current;
  const levelNumScale = useRef(new Animated.Value(1)).current;
  const prevLevel = useRef(level);
  const prevXp = useRef(xp);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: xpProgress,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [xpProgress, progressAnim]);

  useEffect(() => {
    if (xp > prevXp.current) {
      Animated.sequence([
        Animated.timing(xpNumScale, { toValue: 1.12, duration: 160, useNativeDriver: true }),
        Animated.timing(xpNumScale, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
    prevXp.current = xp;
  }, [xp, xpNumScale]);

  useEffect(() => {
    if (level > prevLevel.current) {
      Animated.sequence([
        Animated.timing(levelNumScale, { toValue: 1.2, duration: 200, useNativeDriver: true }),
        Animated.spring(levelNumScale, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    }
    prevLevel.current = level;
  }, [level, levelNumScale]);

  const joinDays = useMemo(() => {
    if (!user?.createdAt) return 1;
    try {
      const ts = user.createdAt as any;
      const dateMs = ts.toMillis ? ts.toMillis() : new Date(ts).getTime();
      return Math.max(1, Math.floor((Date.now() - dateMs) / (1000 * 60 * 60 * 24)));
    } catch {
      return 1;
    }
  }, [user?.createdAt]);

  const tasksWithProgress = useMemo(() => {
    if (!user) return DAILY_TASK_DEFS.map((task) => ({ ...task, current: 0 }));
    return DAILY_TASK_DEFS.map((task) => {
      if (task.id === 'game-bet') {
        const raw = user.rewardsProgress?.daily?.stats?.gameBets ?? 0;
        return { ...task, current: Math.min(raw, task.max) };
      }
      if (!task.statsKey) return { ...task, current: 0 };
      const raw = (user.stats as unknown as Record<string, number>)[task.statsKey] ?? 0;
      const current = Math.min(task.divisor ? Math.floor(raw / task.divisor) : raw, task.max);
      return { ...task, current };
    });
  }, [user]);

  const visibleTasks = useMemo(
    () => (showAllTasks ? tasksWithProgress : tasksWithProgress.slice(0, TASKS_PREVIEW_COUNT)),
    [showAllTasks, tasksWithProgress],
  );

  const canExpandTasks = tasksWithProgress.length > TASKS_PREVIEW_COUNT;

  const unlockedPrivileges = useMemo(
    () => WEALTH_PRIVILEGES.filter((p) => level >= p.unlockLevel).length,
    [level],
  );

  const claimedBubbleIds = useMemo(() => {
    const today = todayDateKey();
    const stored = user?.wealthExpBubbles;
    const serverIds = stored?.dateKey === today ? stored.claimedIds : [];
    return [...new Set([...serverIds, ...hiddenBubbleIds])];
  }, [user?.wealthExpBubbles, hiddenBubbleIds]);

  const triggerXpFlash = useCallback((amount: number) => {
    setXpFlash({ amount, key: Date.now() });
  }, []);

  const handleBubbleClaim = useCallback(async (id: WealthExpBubbleId, amount: number) => {
    setHiddenBubbleIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setClaimingId(id);
    try {
      const res = await claimWealthExpBubble(id);
      triggerXpFlash(res.gained);
      await refreshUser();
    } catch (e: unknown) {
      setHiddenBubbleIds((prev) => prev.filter((x) => x !== id));
      Alert.alert(
        t('common.error'),
        e instanceof Error ? e.message : t('common.errorOccurred'),
      );
    } finally {
      setClaimingId(null);
    }
  }, [refreshUser, t, triggerXpFlash]);

  const handleLevelUpgrade = useCallback(async () => {
    if (!canUpgradeWithCoins) {
      Alert.alert(
        t('wealthLevel.insufficientCoinsTitle'),
        t('wealthLevel.insufficientCoins', {
          needed: upgradeCost.toLocaleString('en-US'),
          have: userCoins.toLocaleString('en-US'),
        }),
      );
      return;
    }

    const msg = upgradeCost > 0
      ? t('wealthLevel.upgradeConfirmMsg', {
        level: level + 1,
        coins: upgradeCost.toLocaleString('en-US'),
      })
      : t('wealthLevel.upgradeFreeConfirm', { level: level + 1 });

    Alert.alert(t('wealthLevel.upgradeConfirmTitle'), msg, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('wealthLevel.upgrade'),
        onPress: async () => {
          setUpgrading(true);
          try {
            const res = await upgradeWealthLevelWithCoins();
            triggerXpFlash(upgradeCost > 0 ? upgradeCost : xpNeeded);
            await refreshUser();
            Alert.alert(
              t('common.success'),
              t('wealthLevel.upgradeSuccess', { level: res.newLevel }),
            );
          } catch (e: unknown) {
            Alert.alert(
              t('common.error'),
              e instanceof Error ? e.message : t('common.errorOccurred'),
            );
          } finally {
            setUpgrading(false);
          }
        },
      },
    ]);
  }, [canUpgradeWithCoins, upgradeCost, userCoins, level, xpNeeded, refreshUser, t, triggerXpFlash]);

  const panelW = W - 28;
  const naturalPanelH = panelW * REL_PANEL_ASPECT;
  // ارتفاع اللوحة يتبع ارتفاع المحتوى الفعلي حتى لا يتداخل مع الورقة السفلية
  const [panelContentH, setPanelContentH] = useState(0);
  const panelH = Math.max(naturalPanelH, panelContentH);
  const medalW = Math.min(panelW * 0.34, 118);

  return (
    <View style={styles.fill}>
      <LinearGradient colors={[...WL_DESIGN.header]} style={StyleSheet.absoluteFill} />

      {/* ===== Header ===== */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.headBtn} hitSlop={10}>
          <WlBackIcon size={20} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text weight="bold" style={styles.headerTitleText}>
            {t('profile.wealthLevel')}
          </Text>
          <View style={styles.headerTitleDivider} />
        </View>
        <Pressable style={styles.headBtn} hitSlop={10}>
          <WlQuestionIcon size={20} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        {/* ===== Level Panel ===== */}
        <View style={[styles.panelWrap, { width: panelW, minHeight: naturalPanelH, alignSelf: 'center' }]}>
          <View
            style={[styles.panelInner, { minHeight: naturalPanelH }]}
            onLayout={(e) => {
              const h = Math.ceil(e.nativeEvent.layout.height);
              if (Math.abs(h - panelContentH) > 1) setPanelContentH(h);
            }}
          >
            <View style={styles.panelLeft}>
              <Animated.Text
                style={{
                  fontFamily: lu.fonts.displayHeavy,
                  fontSize: 34,
                  lineHeight: 42,
                  color: '#B8860B',
                  includeFontPadding: false,
                  transform: [{ scale: levelNumScale }],
                  textShadowColor: 'rgba(184, 134, 11, 0.3)',
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 4,
                }}
              >
                Lv.{level}
              </Animated.Text>
              <Text style={styles.joinedText}>
                عضو في <Text style={{ color: '#B8860B', fontWeight: 'bold' }}>LinkUp</Text> منذ {joinDays} يوم
              </Text>

              <View style={styles.xpProgressWrap}>
                <WealthXpGainFlash
                  amount={xpFlash?.amount ?? 0}
                  triggerKey={xpFlash?.key ?? 0}
                  label={t('wealthLevel.expGained', { count: xpFlash?.amount ?? 0 })}
                />
                <Animated.Text
                  style={{
                    fontFamily: lu.fonts.displayHeavy,
                    fontSize: 14,
                    lineHeight: 20,
                    color: WL_DESIGN.ink,
                    marginTop: 14,
                    includeFontPadding: false,
                    transform: [{ scale: xpNumScale }],
                  }}
                >
                  {t('wealthLevel.expProgress', {
                    current: xp.toLocaleString('en-US'),
                    total: xpNeeded.toLocaleString('en-US'),
                  })}
                </Animated.Text>
              </View>

              <View style={styles.xpTrack}>
                <Animated.View
                  style={[
                    styles.xpFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[...WL_DESIGN.progress]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              </View>

              <Text style={styles.xpHint}>
                {t('wealthLevel.expNeededToday', {
                  count: xpRemaining,
                  today: WEALTH_TODAY_BONUS,
                })}
              </Text>

              <View style={styles.coinsRow}>
                <Image source={COIN_CURRENCY_ICON} style={styles.coinMini} contentFit="contain" />
                <Text style={styles.coinsText} numberOfLines={1}>
                  {t('wealthLevel.yourCoins', { coins: userCoins.toLocaleString('en-US') })}
                </Text>
              </View>

              <Pressable
                onPress={() => void handleLevelUpgrade()}
                disabled={upgrading}
                style={[styles.upgradeBtn, !canUpgradeWithCoins && styles.upgradeBtnDisabled]}
              >
                <LinearGradient colors={['#B00E0E', '#FF6670', '#FBBF24']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text weight="bold" style={styles.upgradeBtnText} numberOfLines={1}>
                    {upgrading
                      ? '...'
                      : upgradeCost > 0
                        ? t('wealthLevel.upgradeWithCoins', { coins: upgradeCost.toLocaleString('en-US') })
                        : t('wealthLevel.upgradeFree')}
                  </Text>
                  <Sparkles size={14} color="#FFF" />
                </View>
              </Pressable>
            </View>

            <View style={styles.medalCol}>
              <View style={[styles.medalFrame, { width: medalW + 48, height: medalW * 1.5 }]}>
                <WealthLevelExpBubbles
                  claimedIds={claimedBubbleIds}
                  claimingId={claimingId}
                  onClaim={(id, _amount) => void handleBubbleClaim(id, _amount)}
                />
                <Image
                  source={require('../assets/images/image.png')}
                  style={{ width: medalW * 1.2, height: medalW * 1.2 }}
                  contentFit="contain"
                />
                <View style={styles.lockedPill}>
                  <WlLockIcon size={14} color={WL_DESIGN.gold} />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ===== White Sheet ===== */}
        <View style={styles.sheet}>
          {/* Privileges */}
          <View style={styles.sectionTitleWrap}>
            <View style={styles.titleDivider} />
            <Text weight="bold" style={styles.sectionTitle}>
              {t('wealthLevel.privilegesCount', { count: unlockedPrivileges })}
            </Text>
            <View style={styles.titleDivider} />
          </View>

          <View style={styles.privilegesRow}>
            {WEALTH_PRIVILEGES.map((p) => {
              const unlocked = level >= p.unlockLevel;
              return (
                <View key={p.id} style={[styles.privilegeCard, !unlocked && styles.privilegeCardLocked]}>
                  {!unlocked ? (
                    <View style={styles.privilegeLockOverlay}>
                      <View style={styles.privilegeLockBadge}>
                        <WlLockWhiteIcon size={14} />
                      </View>
                    </View>
                  ) : null}
                  <View style={[styles.privilegeIconWrap, !unlocked && styles.privilegeImgLocked]}>
                    <Image 
                      source={WL_ASSETS[p.imageKey as keyof typeof WL_ASSETS]} 
                      style={{ width: 44, height: 44 }} 
                      contentFit="contain" 
                    />
                  </View>
                  <Text weight="bold" numberOfLines={2} style={styles.privilegeTitle}>
                    {t(p.titleKey)}
                  </Text>
                  <Text style={[styles.privilegeUnlock, unlocked && { color: WL_DESIGN.purple }]}>
                    {t('wealthLevel.unlockAt', { level: p.unlockLevel })}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Daily Tasks */}
          <View style={styles.tasksCard}>
            <View style={styles.tasksHeader}>
              <View style={styles.tasksTitleRow}>
                <Sparkles size={16} color="#B8860B" />
                <Text weight="bold" style={styles.tasksTitle}>
                  {t('wealthLevel.dailyTasks')}
                </Text>
              </View>
              {canExpandTasks ? (
                <Pressable
                  style={styles.seeAllBtn}
                  onPress={() => setShowAllTasks((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={showAllTasks ? t('wealthLevel.showLess') : t('wealthLevel.seeAll')}
                >
                  <Text weight="bold" style={styles.seeAllText}>
                    {showAllTasks ? t('wealthLevel.showLess') : t('wealthLevel.seeAll')}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {visibleTasks.map((task, idx) => (
              <View key={task.id}>
                {idx > 0 ? <View style={styles.taskDivider} /> : null}
                <View style={styles.taskRow}>
                  <View style={styles.taskIconBox}>{task.renderIcon(20)}</View>
                  <View style={styles.taskBody}>
                    <Text weight="bold" numberOfLines={2} style={styles.taskTitle}>
                      {t(task.titleKey)}
                    </Text>
                    <Text style={styles.taskProgress}>
                      ({task.current}/{task.max})
                    </Text>
                  </View>
                  <Text weight="bold" style={styles.taskExp}>
                    {t('wealthLevel.expReward', { count: task.xp })}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Level Up */}
          <View style={styles.levelUpBox}>
            <Text weight="bold" style={styles.levelUpTitle}>
              {t('wealthLevel.levelUp')}
            </Text>

            <View style={styles.levelUpRow}>
              <View style={styles.levelUpIcon}>
                <WlGiftIcon size={18} />
              </View>
              <Text style={styles.levelUpText}>{t('wealthLevel.giftingInfo')}</Text>
            </View>

            <View style={[styles.levelUpRow, { marginTop: 12 }]}>
              <View style={styles.levelUpIcon}>
                <WlRocketIcon size={18} />
              </View>
              <Text style={styles.levelUpText}>{t('wealthLevel.vipInfo')}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  headBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E6DAC3',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleText: {
    fontFamily: lu.fonts.displayHeavy,
    fontSize: 20,
    lineHeight: 26,
    color: '#333',
    includeFontPadding: false,
  },
  headerTitleDivider: {
    width: 40,
    height: 2,
    backgroundColor: '#D4AF37',
    marginTop: 4,
    borderRadius: 1,
  },

  panelWrap: {
    position: 'relative',
    marginTop: 4,
    overflow: 'visible',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E6DAC3',
    shadowColor: '#F3D060',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  panelInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    zIndex: 1,
    overflow: 'visible',
  },
  panelLeft: {
    flex: 1,
    paddingEnd: 8,
  },
  joinedText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 20,
    color: WL_DESIGN.ink2,
    includeFontPadding: false,
    paddingTop: 2,
  },
  xpProgressWrap: {
    position: 'relative',
    overflow: 'visible',
  },
  coinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  coinMini: { width: 16, height: 16 },
  coinsText: {
    flex: 1,
    fontSize: 11,
    color: '#B8860B',
    fontFamily: lu.fonts.bodySemi,
    includeFontPadding: false,
  },
  upgradeBtn: {
    marginTop: 10,
    borderRadius: 99,
    overflow: 'hidden',
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FDF5E6',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeBtnDisabled: { opacity: 0.55 },
  upgradeBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  xpTrack: {
    height: 6,
    backgroundColor: '#FDF5E6',
    borderRadius: 99,
    marginTop: 8,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 99,
    overflow: 'hidden',
  },
  xpHint: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    color: WL_DESIGN.muted,
  },

  medalCol: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  medalFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
    shadowColor: '#F3D060',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  lockedPill: {
    position: 'absolute',
    bottom: -8,
    backgroundColor: '#1A0A0C',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#B8860B',
  },
  lockedPillText: {
    fontSize: 11,
    lineHeight: 17,
    color: '#FFFFFF',
  },

  sheet: {
    marginTop: -6,
    backgroundColor: WL_DESIGN.sheet,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 8,
    minHeight: 400,
  },

  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  titleDivider: {
    height: 1,
    width: 40,
    backgroundColor: '#D4AF37',
  },
  sectionTitle: {
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 24,
    color: '#4B3621',
    includeFontPadding: false,
  },

  privilegesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  privilegeCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: WL_DESIGN.privilegeBorder,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    minHeight: 128,
    overflow: 'hidden',
    position: 'relative',
  },
  privilegeCardLocked: {
    backgroundColor: '#FCFAFA',
  },
  privilegeLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  privilegeLockBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  privilegeImg: {
    width: 52,
    height: 52,
  },
  privilegeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privilegeImgLocked: {
    opacity: 0.45,
  },
  privilegeTitle: {
    fontSize: 11,
    lineHeight: 15,
    color: WL_DESIGN.ink,
    textAlign: 'center',
    marginTop: 8,
    includeFontPadding: false,
  },
  privilegeUnlock: {
    fontSize: 10,
    lineHeight: 16,
    color: WL_DESIGN.muted,
    marginTop: 4,
    textAlign: 'center',
  },

  tasksCard: {
    borderWidth: 1,
    borderColor: WL_DESIGN.taskCardBorder,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6,
    marginBottom: 14,
  },
  tasksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tasksTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tasksTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: WL_DESIGN.purple,
    includeFontPadding: false,
  },
  seeAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: WL_DESIGN.seeAllBg,
  },
  seeAllText: {
    fontSize: 11,
    lineHeight: 17,
    color: WL_DESIGN.seeAllText,
  },

  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  taskIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: WL_DESIGN.taskIconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskBody: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 13,
    lineHeight: 18,
    color: WL_DESIGN.ink,
    includeFontPadding: false,
  },
  taskProgress: {
    fontSize: 11,
    lineHeight: 15,
    color: WL_DESIGN.muted,
    marginTop: 2,
  },
  taskExp: {
    fontSize: 13,
    lineHeight: 18,
    color: WL_DESIGN.expPurple,
    includeFontPadding: false,
  },
  taskDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: WL_DESIGN.line,
  },

  levelUpBox: {
    backgroundColor: WL_DESIGN.levelUpBg,
    borderRadius: 18,
    padding: 16,
    marginBottom: 8,
  },
  levelUpTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: WL_DESIGN.purple,
    marginBottom: 12,
    includeFontPadding: false,
  },
  levelUpRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  levelUpIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelUpText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: WL_DESIGN.ink2,
  },
});
