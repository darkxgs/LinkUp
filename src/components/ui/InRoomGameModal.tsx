/**
 * InRoomGameModal v2
 * - يستخدم خوارزميات الـ engine (من الوثيقة الفنية)
 * - أيقونات Lucide حقيقية بدل emojis عشوائية
 * - مربوط بـ Firebase (placeBet + recordWin)
 * - Casino Coins منفصلة عن coins العادية
 *
 * الألعاب: Lucky Slot, Greedy Hiya (wheel), Greedy Pro, Greedy Sports, Fishing Star
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Alert,
  Animated,
  Easing,
  Dimensions,
  I18nManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  X,
  Trophy,
  Music,
  List,
  HelpCircle,
  Plus,
  Minus,
  Crown,
  Sparkles,
  Cherry,
  Diamond,
  Gem,
  Bell,
  Star,
  Award,
  Coins,
  Zap,
  Heart,
  Flame,
  Anchor,
  Fish,
  Drumstick,
  Pizza,
  Apple,
  Beef,
  Carrot,
  Trophy as Trophy2,
  Volleyball,
  Target,
  Medal,
} from 'lucide-react-native';

import { Text } from './index';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import {
  playSlot,
  playWheel,
  WHEEL_SEGMENTS,
  STAKE_TIERS,
  type StakeTier,
} from '@/services/games/engine';
import {
  placeBet,
  recordWin,
  recordLoss,
  isFirstEverSpin,
  convertCasinoCoins,
} from '@/services/firebase/gameTransactions';
import {
  formatCasinoCoins,
  toDisplayCasinoCoins,
  coinWinToStoredCasino,
} from '@/utils/casinoCoins';
import { colors, radius, spacing, shadows } from '@/theme';

const { width: SCREEN_W } = Dimensions.get('window');

// ====================================================
// أيقونات Slot Symbols (Lucide بدل emojis)
// ====================================================
type SlotIconKey = 'cherry' | 'diamond' | 'gem' | 'bell' | 'star' | 'crown' | 'coin' | 'lightning' | 'heart' | 'flame';

const SLOT_ICONS: Record<SlotIconKey, { Icon: any; color: string; fill: string }> = {
  cherry: { Icon: Cherry, color: '#EF4444', fill: '#EF4444' },
  diamond: { Icon: Diamond, color: '#C61414', fill: '#C61414' },
  gem: { Icon: Gem, color: '#FCA5A5', fill: '#FCA5A5' },
  bell: { Icon: Bell, color: '#FCD34D', fill: '#FCD34D' },
  star: { Icon: Star, color: '#FBBF24', fill: '#FBBF24' },
  crown: { Icon: Crown, color: '#F59E0B', fill: '#F59E0B' },
  coin: { Icon: Coins, color: '#FCD34D', fill: '#FCD34D' },
  lightning: { Icon: Zap, color: '#EAB308', fill: '#EAB308' },
  heart: { Icon: Heart, color: '#E11414', fill: '#E11414' },
  flame: { Icon: Flame, color: '#F97316', fill: '#F97316' },
};

const SLOT_ICONS_POOL: SlotIconKey[] = ['cherry', 'diamond', 'gem', 'bell', 'star', 'crown', 'coin', 'lightning', 'heart', 'flame'];

// ====================================================
// Wheel configurations مع أيقونات Lucide
// ====================================================

interface WheelSlot {
  Icon: any;
  color: string;
  multiplier: number;
  label: string;
}

const GREEDY_HIYA_SLOTS: WheelSlot[] = [
  { Icon: Drumstick, color: '#F59E0B', multiplier: 45, label: 'دجاج' },
  { Icon: Carrot, color: '#10B981', multiplier: 5, label: 'جزر' },
  { Icon: Apple, color: '#EF4444', multiplier: 5, label: 'تفاح' },
  { Icon: Pizza, color: '#FBBF24', multiplier: 5, label: 'بيتزا' },
  { Icon: Beef, color: '#DC2626', multiplier: 10, label: 'لحم' },
  { Icon: Drumstick, color: '#FB923C', multiplier: 15, label: 'دجاج' },
  { Icon: Beef, color: '#991B1B', multiplier: 25, label: 'لحم' },
  { Icon: Pizza, color: '#F97316', multiplier: 5, label: 'بيتزا' },
];

const GREEDY_PRO_SLOTS: WheelSlot[] = [
  { Icon: Diamond, color: '#C61414', multiplier: 50, label: 'ألماس' },
  { Icon: Crown, color: '#FCD34D', multiplier: 25, label: 'تاج' },
  { Icon: Star, color: '#FBBF24', multiplier: 5, label: 'نجمة' },
  { Icon: Coins, color: '#F59E0B', multiplier: 15, label: 'ذهب' },
  { Icon: Heart, color: '#E11414', multiplier: 5, label: 'قلب' },
  { Icon: Trophy, color: '#FCA5A5', multiplier: 10, label: 'كأس' },
  { Icon: Gem, color: '#10B981', multiplier: 5, label: 'جوهرة' },
  { Icon: Award, color: '#ED4444', multiplier: 5, label: 'وسام' },
];

const GREEDY_SPORTS_SLOTS: WheelSlot[] = [
  { Icon: Volleyball, color: '#10B981', multiplier: 5, label: 'كرة قدم' },
  { Icon: Target, color: '#F97316', multiplier: 10, label: 'سلة' },
  { Icon: Award, color: '#FCD34D', multiplier: 5, label: 'ميدالية' },
  { Icon: Trophy, color: '#FBBF24', multiplier: 50, label: 'كأس' },
  { Icon: Medal, color: '#FCA5A5', multiplier: 5, label: 'وسام' },
  { Icon: Target, color: '#7C2D12', multiplier: 15, label: 'هدف' },
  { Icon: Medal, color: '#F59E0B', multiplier: 25, label: 'بطل' },
  { Icon: Target, color: '#EF4444', multiplier: 5, label: 'هدف' },
];

const FISHING_SLOTS: WheelSlot[] = [
  { Icon: Fish, color: '#C61414', multiplier: 5, label: 'سمكة' },
  { Icon: Fish, color: '#E11414', multiplier: 10, label: 'سمكة' },
  { Icon: Anchor, color: '#ED4444', multiplier: 50, label: 'مرساة' },
  { Icon: Fish, color: '#F97316', multiplier: 15, label: 'سمكة' },
  { Icon: Fish, color: '#FB923C', multiplier: 5, label: 'سمكة' },
  { Icon: Fish, color: '#EF4444', multiplier: 10, label: 'سمكة' },
  { Icon: Anchor, color: '#FCA5A5', multiplier: 25, label: 'مرساة' },
  { Icon: Star, color: '#FCD34D', multiplier: 5, label: 'نجمة' },
];

// ====================================================
// Game configs
// ====================================================
type GameType = 'slot-machine' | 'wheel';

interface GameConfig {
  id: string;
  title: string;
  type: GameType;
  slots?: WheelSlot[];
  jackpot?: number;
}

const GAMES: Record<string, GameConfig> = {
  'lucky-slot': { id: 'lucky-slot', title: 'Lucky Slot', type: 'slot-machine', jackpot: 180129 },
  'greedy-hiya': { id: 'greedy-hiya', title: 'Greedy Hiya', type: 'wheel', slots: GREEDY_HIYA_SLOTS },
  'greedy-pro': { id: 'greedy-pro', title: 'Greedy Pro', type: 'wheel', slots: GREEDY_PRO_SLOTS },
  'greedy-sports': { id: 'greedy-sports', title: 'Greedy Sports', type: 'wheel', slots: GREEDY_SPORTS_SLOTS },
  'fishing': { id: 'fishing', title: 'Fishing Star', type: 'wheel', slots: FISHING_SLOTS },
};

// Game tabs
const GAME_TABS = [
  { id: 'greedy-pro', label: 'Greedy Pro' },
  { id: 'greedy-hiya', label: 'Greedy Hiya' },
  { id: 'lucky-slot', label: 'Lucky Slot' },
  { id: 'fishing', label: 'Fishing Star' },
  { id: 'greedy-sports', label: 'Greedy Sports' },
];

// Stake tiers (بـ coins)
const STAKES: { tier: StakeTier; coins: number; label: string }[] = [
  { tier: '1', coins: 10_000, label: '$1' },
  { tier: '5', coins: 50_000, label: '$5' },
  { tier: '10', coins: 100_000, label: '$10' },
  { tier: '50', coins: 500_000, label: '$50' },
  { tier: '100', coins: 1_000_000, label: '$100' },
];

interface Props {
  visible: boolean;
  gameId: string | null;
  onClose: () => void;
}

export const InRoomGameModal: React.FC<Props> = ({ visible, gameId, onClose }) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [currentGameId, setCurrentGameId] = useState<string>(gameId ?? 'lucky-slot');
  const [stakeTier, setStakeTier] = useState<StakeTier>('1');
  const [spinning, setSpinning] = useState(false);
  const [winAmount, setWinAmount] = useState(0);
  const [autoMode, setAutoMode] = useState(false);
  const [quickMode, setQuickMode] = useState(false);

  // Wheel state
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Slot state - 5 reels × 3 rows
  const [reels, setReels] = useState<SlotIconKey[][]>([
    ['cherry', 'diamond', 'gem'],
    ['gem', 'bell', 'star'],
    ['star', 'crown', 'coin'],
    ['crown', 'coin', 'lightning'],
    ['lightning', 'heart', 'flame'],
  ]);
  const reelAnims = useRef([0, 0, 0, 0, 0].map(() => new Animated.Value(0))).current;

  // Sync gameId
  useEffect(() => {
    if (gameId) setCurrentGameId(gameId);
  }, [gameId]);

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setSelectedSlot(null);
      setWinAmount(0);
      setSpinning(false);
      setAutoMode(false);
      spinAnim.setValue(0);
    }
  }, [visible]);

  const stake = STAKES.find((s) => s.tier === stakeTier)?.coins ?? 10_000;
  const game = GAMES[currentGameId] ?? GAMES['lucky-slot']!;
  const casinoCoins = (user as any)?.stats?.casinoCoins ?? 0;

  // ===== Spin Wheel =====
  const handleSpinWheel = async () => {
    if (!user || !game.slots) return;
    if (selectedSlot === null) {
      Alert.alert('اختر رمزاً', 'يرجى اختيار رمز للمراهنة عليه على العجلة');
      return;
    }
    if (user.stats.coins < stake) {
      Alert.alert('رصيد غير كافٍ', `تحتاج ${stake.toLocaleString()} عملة على الأقل`);
      return;
    }

    setSpinning(true);
    setWinAmount(0);

    try {
      // 1. خصم الرهان
      await placeBet(stake);

      // 2. تشغيل الخوارزمية
      const result = playWheel(stake);
      const winSlotIdx = result.result.segment;

      // 3. الأنيميشن
      const finalAngle = 5 * 360 + 360 - winSlotIdx * 45;
      Animated.timing(spinAnim, {
        toValue: finalAngle,
        duration: 3500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(async () => {
        // 4. حساب الربح (إذا اختار اللاعب الخانة الصحيحة)
        const playerWin = selectedSlot === winSlotIdx && result.multiplier > 0;
        const finalWinAmount = playerWin ? stake * game.slots![winSlotIdx]!.multiplier : 0;

        // 5. تسجيل في Firebase
        if (finalWinAmount > 0) {
          await recordWin('wheel', stake, finalWinAmount, game.slots![winSlotIdx]!.multiplier, {
            game: currentGameId,
            segment: winSlotIdx,
            slot: game.slots![winSlotIdx],
          });
        } else {
          await recordLoss('wheel', stake, { game: currentGameId, segment: winSlotIdx });
        }

        setWinAmount(finalWinAmount);
        await refreshUser();
        setSpinning(false);
        spinAnim.setValue(finalAngle % 360);

        if (finalWinAmount > 0) {
          setTimeout(() => {
            Alert.alert('🎉 فوز!', `ربحت ${formatCasinoCoins(coinWinToStoredCasino(finalWinAmount))} عملة كازينو!`);
          }, 200);
        }
      });
    } catch (e: any) {
      setSpinning(false);
      Alert.alert('خطأ', e.message);
    }
  };

  // ===== Spin Slot Machine =====
  const handleSpinSlot = async () => {
    if (!user) return;
    if (user.stats.coins < stake) {
      Alert.alert('رصيد غير كافٍ', `تحتاج ${stake.toLocaleString()} عملة`);
      return;
    }

    setSpinning(true);
    setWinAmount(0);

    try {
      // 1. خصم
      await placeBet(stake);

      // 2. هل أول لفة؟
      const firstSpin = await isFirstEverSpin(user.uid);

      // 3. الخوارزمية
      const result = playSlot(stake, firstSpin);

      // 4. تحويل النتيجة إلى icons
      const symbolMap: Record<string, SlotIconKey> = {
        'bronze': 'coin',
        'silver': 'star',
        'gold': 'crown',
        'cherry': 'cherry',
        'lemon': 'flame',
        'grape': 'gem',
        'bell': 'bell',
        'star': 'star',
        'wild': 'diamond',
      };
      const winIcons: SlotIconKey[] = result.result.symbols.map((s) => symbolMap[s] ?? 'cherry');

      // 5. Animate reels
      reelAnims.forEach((anim, i) => {
        anim.setValue(0);
        Animated.timing(anim, {
          toValue: 1,
          duration: (quickMode ? 600 : 1500) + i * (quickMode ? 100 : 250),
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      });

      const duration = quickMode ? 1000 : 2700;
      setTimeout(async () => {
        // 6. تحديث الـ reels حسب النتيجة
        const newReels: SlotIconKey[][] = [];
        for (let r = 0; r < 5; r++) {
          if (r < 3 && result.win) {
            // الـ 3 reels الأولى تظهر النتيجة في الـ middle row
            const top = SLOT_ICONS_POOL[Math.floor(Math.random() * SLOT_ICONS_POOL.length)]!;
            const bottom = SLOT_ICONS_POOL[Math.floor(Math.random() * SLOT_ICONS_POOL.length)]!;
            newReels.push([top, winIcons[r]!, bottom]);
          } else {
            // باقي الـ reels عشوائية
            const a = SLOT_ICONS_POOL[Math.floor(Math.random() * SLOT_ICONS_POOL.length)]!;
            const b = SLOT_ICONS_POOL[Math.floor(Math.random() * SLOT_ICONS_POOL.length)]!;
            const c = SLOT_ICONS_POOL[Math.floor(Math.random() * SLOT_ICONS_POOL.length)]!;
            newReels.push([a, b, c]);
          }
        }
        setReels(newReels);

        // 7. تسجيل النتيجة
        if (result.winAmount > 0) {
          await recordWin('slot', stake, result.winAmount, result.multiplier, result.result);
        } else {
          await recordLoss('slot', stake, result.result);
        }

        setWinAmount(result.winAmount);
        await refreshUser();
        setSpinning(false);

        // Auto mode
        if (autoMode && user.stats.coins >= stake) {
          setTimeout(handleSpinSlot, 1500);
        }
      }, duration);
    } catch (e: any) {
      setSpinning(false);
      Alert.alert('خطأ', e.message);
    }
  };

  // ===== Convert Casino Coins =====
  const handleConvert = () => {
    const displayCasino = toDisplayCasinoCoins(casinoCoins);
    if (displayCasino <= 0) {
      Alert.alert('لا يوجد رصيد', 'ليس لديك Casino Coins للتحويل');
      return;
    }
    const wholeCasino = Math.floor(displayCasino);
    if (wholeCasino <= 0) {
      Alert.alert('رصيد غير كافٍ', 'تحتاج عملة كازينو كاملة واحدة على الأقل للتحويل');
      return;
    }
    Alert.alert(
      'تحويل Casino Coins',
      `تحويل ${formatCasinoCoins(wholeCasino * 10000)} عملة كازينو إلى رصيد عادي؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تحويل',
          onPress: async () => {
            try {
              await convertCasinoCoins(wholeCasino);
              await refreshUser();
              Alert.alert('تم', 'تم التحويل بنجاح');
            } catch (e: any) {
              Alert.alert('خطأ', e.message);
            }
          },
        },
      ],
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <LinearGradient
          colors={
            game.type === 'slot-machine'
              ? ['#3A0A0A', '#26090C', '#100406']
              : ['#26090C', '#3A0A0A', '#26090C']
          }
          style={StyleSheet.absoluteFill}
        />

        {/* Stars */}
        <View style={styles.starsBg} pointerEvents="none">
          {[...Array(30)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.star,
                {
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  opacity: 0.3 + Math.random() * 0.5,
                },
              ]}
            />
          ))}
        </View>

        {/* Header */}
        <View style={styles.topHeader}>
          <Pressable onPress={onClose} style={styles.exitBtn}>
            <X size={18} color={colors.white} strokeWidth={2.5} />
          </Pressable>

          <View style={styles.roomCard}>
            <Image
              source={{ uri: user?.profile.avatar || 'https://i.pravatar.cc/100?img=12' }}
              style={styles.userAvatar}
              contentFit="cover"
            />
            <View style={{ flex: 1 }}>
              <Text variant="bodySmall" weight="bold" color={colors.white} numberOfLines={1}>
                {user?.profile.displayName ?? 'مستخدم'}
              </Text>
              <Text variant="caption" color="rgba(255,255,255,0.7)" style={{ fontSize: 10 }}>
                Casino Coins
              </Text>
            </View>
            <View style={styles.lvBadgeUser}>
              <Text variant="caption" weight="bold" color={colors.white} style={{ fontSize: 10 }}>
                LV{user?.stats.level ?? 1}
              </Text>
            </View>
          </View>

          <Pressable onPress={handleConvert} style={styles.convertBtn}>
            <Sparkles size={14} color="#FCD34D" strokeWidth={2.5} />
          </Pressable>
        </View>

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScroll}
        >
          {GAME_TABS.map((tab) => {
            const isActive = currentGameId === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => {
                  setCurrentGameId(tab.id);
                  setSelectedSlot(null);
                }}
                style={styles.tabBtn}
              >
                <Text
                  variant="body"
                  weight={isActive ? 'bold' : 'medium'}
                  color={isActive ? colors.white : 'rgba(255,255,255,0.5)'}
                >
                  {tab.label}
                </Text>
                {isActive && <View style={styles.tabIndicator} />}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Top icons + Casino balance */}
        <View style={styles.topIconsRow}>
          <Pressable style={styles.topIcon}>
            <Trophy size={16} color="#FCA5A5" strokeWidth={2.5} />
          </Pressable>
          <Pressable style={styles.topIcon}>
            <Music size={16} color="#FCA5A5" strokeWidth={2.5} />
          </Pressable>
          <Pressable style={styles.topIcon}>
            <List size={16} color="#FCA5A5" strokeWidth={2.5} />
          </Pressable>
          <Pressable style={styles.topIcon}>
            <HelpCircle size={16} color="#FCA5A5" strokeWidth={2.5} />
          </Pressable>

          <View style={{ flex: 1 }} />

          {/* Casino Coins display */}
          <Pressable onPress={handleConvert} style={styles.balancePill}>
            <View style={styles.balanceMinus}>
              <Coins size={14} color="#E11414" strokeWidth={3} />
            </View>
            <View style={styles.balanceCenter}>
              <Text variant="bodySmall" weight="bold" color={colors.white}>
                {formatCasinoCoins(casinoCoins)}
              </Text>
            </View>
            <View style={styles.balancePlus}>
              <Plus size={14} color={colors.white} strokeWidth={3} />
            </View>
          </Pressable>
        </View>

        {/* Game content */}
        <View style={styles.gameContent}>
          {game.type === 'slot-machine' ? (
            <SlotMachineGame
              jackpot={game.jackpot ?? 180129}
              reels={reels}
              reelAnims={reelAnims}
              winAmount={winAmount}
              user={user}
            />
          ) : (
            <WheelGame
              slots={game.slots ?? []}
              selectedSlot={selectedSlot}
              setSelectedSlot={setSelectedSlot}
              spinAnim={spinAnim}
              spinning={spinning}
              winAmount={winAmount}
            />
          )}
        </View>

        {/* Controls */}
        {game.type === 'slot-machine' ? (
          <SlotControls
            stake={stake}
            stakeTier={stakeTier}
            setStakeTier={setStakeTier}
            quickMode={quickMode}
            setQuickMode={setQuickMode}
            autoMode={autoMode}
            setAutoMode={setAutoMode}
            spinning={spinning}
            onSpin={handleSpinSlot}
          />
        ) : (
          <WheelControls
            stakeTier={stakeTier}
            setStakeTier={setStakeTier}
            spinning={spinning}
            selectedSlot={selectedSlot}
            onSpin={handleSpinWheel}
          />
        )}
      </View>
    </Modal>
  );
};

// ====================================================
// Slot Machine Component
// ====================================================
const SlotMachineGame: React.FC<any> = ({ jackpot, reels, reelAnims, winAmount, user }) => {
  return (
    <View style={styles.slotWrap}>
      {/* SLOTS title */}
      <View style={styles.slotsTitle}>
        <LinearGradient
          colors={['#FCA5A5', '#E11414']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <Text variant="h1" weight="bold" color="#FFFFFF" style={{ fontSize: 28, letterSpacing: 3 }}>
          SLOTS
        </Text>
        {/* Bulbs around */}
        {[...Array(12)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.bulb,
              {
                top: i < 6 ? 2 : undefined,
                bottom: i >= 6 ? 2 : undefined,
                left: (i % 6) * ((SCREEN_W - 60) / 6) + 8,
              },
            ]}
          />
        ))}
      </View>

      {/* JACKPOT banner */}
      <View style={styles.jackpotBanner}>
        <LinearGradient colors={['#E11414', '#8A0E0E']} style={StyleSheet.absoluteFill} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="h2" weight="bold" color="#FCD34D" style={{ fontSize: 18, letterSpacing: 2 }}>
            JACKPOT
          </Text>
          <Text variant="h2" weight="bold" color="#FCD34D" style={{ fontSize: 20 }}>
            {jackpot.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Reels */}
      <View style={styles.reelsContainer}>
        <LinearGradient colors={['#FCD34D', '#F59E0B']} style={StyleSheet.absoluteFill} />
        <View style={styles.reelsInner}>
          {reels.map((reel: SlotIconKey[], i: number) => (
            <Animated.View
              key={i}
              style={[
                styles.reel,
                {
                  opacity: reelAnims[i].interpolate({
                    inputRange: [0, 0.3, 0.7, 1],
                    outputRange: [1, 0.2, 0.2, 1],
                  }),
                },
              ]}
            >
              {reel.map((iconKey, j) => {
                const icon = SLOT_ICONS[iconKey];
                return (
                  <View key={j} style={styles.reelCell}>
                    <icon.Icon size={36} color={icon.color} fill={icon.fill} strokeWidth={1.5} />
                  </View>
                );
              })}
            </Animated.View>
          ))}
        </View>
      </View>

      {/* WIN */}
      <View style={styles.winRow}>
        <View style={styles.top1Badge}>
          <Image
            source={{ uri: user?.profile.avatar || 'https://i.pravatar.cc/100?img=12' }}
            style={styles.top1Avatar}
            contentFit="cover"
          />
          <Text variant="caption" weight="bold" color="#FCA5A5" style={{ fontSize: 9, marginTop: 2 }}>
            TOP1
          </Text>
          <Text variant="caption" color="#FCD34D" style={{ fontSize: 9 }}>
            Reward 300k
          </Text>
        </View>

        <View style={styles.winBox}>
          <LinearGradient colors={['#F59E0B', '#D97706']} style={StyleSheet.absoluteFill} />
          <Text variant="h2" weight="bold" color={colors.white} style={{ fontSize: 22 }}>
            WIN {formatCasinoCoins(coinWinToStoredCasino(winAmount))}
          </Text>
        </View>
      </View>
    </View>
  );
};

// ====================================================
// Wheel Component مع أيقونات Lucide
// ====================================================
const WheelGame: React.FC<any> = ({ slots, selectedSlot, setSelectedSlot, spinAnim, spinning, winAmount }) => {
  const WHEEL_SIZE = Math.min(SCREEN_W - 80, 320);

  const rotateStyle = {
    transform: [
      {
        rotate: spinAnim.interpolate({
          inputRange: [0, 360],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  };

  return (
    <View style={styles.wheelWrap}>
      <View style={[styles.wheelContainer, { width: WHEEL_SIZE, height: WHEEL_SIZE }]}>
        <View style={styles.wheelOuterRing} />

        <Animated.View style={[styles.wheel, { width: WHEEL_SIZE, height: WHEEL_SIZE }, rotateStyle]}>
          <LinearGradient colors={['#8A0E0E', '#3A0A0A', '#8A0E0E']} style={StyleSheet.absoluteFill} />

          {slots.map((slot: WheelSlot, idx: number) => {
            const angle = idx * 45 - 90;
            const rad = (angle * Math.PI) / 180;
            const r = WHEEL_SIZE / 2 - 42;
            const x = Math.cos(rad) * r + WHEEL_SIZE / 2 - 32;
            const y = Math.sin(rad) * r + WHEEL_SIZE / 2 - 32;
            const isSelected = selectedSlot === idx;

            return (
              <Pressable
                key={idx}
                onPress={() => !spinning && setSelectedSlot(idx)}
                style={[
                  styles.slotItem,
                  {
                    left: x,
                    top: y,
                    backgroundColor: `${slot.color}30`,
                    borderColor: slot.color,
                  },
                  isSelected && styles.slotItemSelected,
                ]}
              >
                <slot.Icon size={28} color={slot.color} fill={slot.color} strokeWidth={1.5} />
                <Text variant="caption" color={colors.white} weight="bold" style={{ fontSize: 9, marginTop: 1 }}>
                  ×{slot.multiplier}
                </Text>
              </Pressable>
            );
          })}

          {/* Center */}
          <View style={styles.wheelCenter}>
            <LinearGradient colors={['#E11414', '#8A0E0E']} style={StyleSheet.absoluteFill} />
            {selectedSlot !== null && slots[selectedSlot] ? (
              <>
                {(() => {
                  const Sel = slots[selectedSlot];
                  return <Sel.Icon size={36} color={Sel.color} fill={Sel.color} strokeWidth={1.5} />;
                })()}
                <Text variant="caption" color="#FCD34D" weight="bold" style={{ fontSize: 11, marginTop: 2 }}>
                  ×{slots[selectedSlot].multiplier}
                </Text>
              </>
            ) : (
              <>
                <Text variant="caption" color="rgba(255,255,255,0.85)" style={{ fontSize: 11 }}>
                  اختر
                </Text>
                <Text variant="h2" weight="bold" color="#FCD34D">?</Text>
              </>
            )}
          </View>
        </Animated.View>

        {/* Pointer */}
        <View style={styles.pointer} pointerEvents="none">
          <View style={styles.pointerTriangle} />
        </View>
      </View>

      {winAmount > 0 && (
        <View style={styles.wheelWinBadge}>
          <Sparkles size={16} color="#FCD34D" fill="#FCD34D" strokeWidth={0} />
          <Text variant="h3" weight="bold" color="#FCD34D">
            +{formatCasinoCoins(coinWinToStoredCasino(winAmount))}
          </Text>
        </View>
      )}
    </View>
  );
};

// ====================================================
// Slot Controls
// ====================================================
const SlotControls: React.FC<any> = ({
  stake, stakeTier, setStakeTier, quickMode, setQuickMode, autoMode, setAutoMode, spinning, onSpin,
}) => {
  return (
    <View style={styles.controlsWrap}>
      {/* Stake selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stakesScroll}>
        {STAKES.map((s) => {
          const active = stakeTier === s.tier;
          return (
            <Pressable
              key={s.tier}
              onPress={() => !spinning && setStakeTier(s.tier)}
              style={[styles.stakeBtn, active && styles.stakeBtnActive]}
            >
              <Coins size={14} color="#FCD34D" fill="#FCD34D" strokeWidth={1.5} />
              <Text variant="bodySmall" color="#FCD34D" weight="bold">
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.spinRow}>
        {/* Mode toggles */}
        <View style={styles.modesColumn}>
          <Pressable onPress={() => setQuickMode(!quickMode)} style={styles.modeToggle}>
            <View style={[styles.checkBox, quickMode && styles.checkBoxActive]}>
              {quickMode && <Text style={{ color: colors.white, fontSize: 11, lineHeight: 14 }}>✓</Text>}
            </View>
            <Text variant="bodySmall" weight="bold" color="rgba(255,255,255,0.85)">
              QUICK
            </Text>
          </Pressable>

          <Pressable onPress={() => setAutoMode(!autoMode)} style={styles.modeToggle}>
            <View style={[styles.checkBox, autoMode && styles.checkBoxActive]}>
              {autoMode && <Text style={{ color: colors.white, fontSize: 11, lineHeight: 14 }}>✓</Text>}
            </View>
            <Text variant="bodySmall" weight="bold" color="rgba(255,255,255,0.85)">
              AUTO
            </Text>
          </Pressable>
        </View>

        {/* SPIN button */}
        <Pressable onPress={onSpin} disabled={spinning} style={[styles.spinBtn, spinning && { opacity: 0.6 }]}>
          <LinearGradient colors={['#FCD34D', '#F59E0B', '#D97706']} style={StyleSheet.absoluteFill} />
          <Text variant="h1" weight="bold" color="#FFFFFF" style={{ fontSize: 28, letterSpacing: 3 }}>
            SPIN
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.95)" style={{ fontSize: 11 }}>
            COST:{' '}
            <Text variant="caption" color="#FFFFFF" weight="bold" style={{ fontSize: 12 }}>
              {stake.toLocaleString()}
            </Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

// ====================================================
// Wheel Controls
// ====================================================
const WheelControls: React.FC<any> = ({ stakeTier, setStakeTier, spinning, selectedSlot, onSpin }) => {
  return (
    <View style={[styles.controlsWrap, styles.wheelControls]}>
      <Text variant="caption" color="rgba(255,255,255,0.85)" align="center" style={{ marginBottom: 8 }}>
        مبلغ الرهان
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stakesScroll}>
        {STAKES.map((s) => {
          const active = stakeTier === s.tier;
          return (
            <Pressable
              key={s.tier}
              onPress={() => !spinning && setStakeTier(s.tier)}
              style={[styles.stakeBtn, active && styles.stakeBtnActive]}
            >
              <Coins size={14} color="#FCD34D" fill="#FCD34D" strokeWidth={1.5} />
              <Text variant="bodySmall" color="#FCD34D" weight="bold">
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={onSpin}
        disabled={spinning || selectedSlot === null}
        style={[styles.wheelSpinBtn, (spinning || selectedSlot === null) && { opacity: 0.6 }]}
      >
        <LinearGradient
          colors={['#FCD34D', '#F59E0B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <Text variant="button" weight="bold" color={colors.white}>
          {spinning ? 'جاري الدوران...' : selectedSlot === null ? 'اختر رمزاً للمراهنة' : 'راهن الآن'}
        </Text>
      </Pressable>
    </View>
  );
};

// ====================================================
// Styles
// ====================================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  starsBg: { ...StyleSheet.absoluteFillObject },
  star: { position: 'absolute', width: 2, height: 2, borderRadius: 1, backgroundColor: colors.white },

  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: 8,
    gap: spacing.sm,
  },
  exitBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  roomCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  userAvatar: { width: 32, height: 32, borderRadius: 16 },
  lvBadgeUser: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#E11414',
    borderRadius: 4,
  },
  convertBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(252, 211, 77, 0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },

  tabsScroll: {
    paddingHorizontal: spacing.sm,
    paddingTop: 12,
    gap: spacing.base,
    flexDirection: 'row',
  },
  tabBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  tabIndicator: {
    width: 24, height: 2,
    backgroundColor: colors.white,
    borderRadius: 1,
    marginTop: 4,
  },

  topIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: 12,
    gap: 6,
  },
  topIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(225, 20, 20, 0.3)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.4)',
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7A0A0A',
    borderRadius: radius.full,
    paddingHorizontal: 4,
    paddingVertical: 3,
    gap: 6,
    minWidth: 110,
  },
  balanceMinus: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#FCD34D',
    alignItems: 'center', justifyContent: 'center',
  },
  balancePlus: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#F59E0B',
    alignItems: 'center', justifyContent: 'center',
  },
  balanceCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },

  gameContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },

  // Slot
  slotWrap: { width: '100%', alignItems: 'center' },
  slotsTitle: {
    width: SCREEN_W - 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FCD34D',
    marginBottom: 4,
  },
  bulb: {
    position: 'absolute',
    width: 5, height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FCD34D',
  },
  jackpotBanner: {
    width: SCREEN_W - 90,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2,
    borderWidth: 2,
    borderColor: '#FCD34D',
  },
  reelsContainer: {
    width: SCREEN_W - 30,
    aspectRatio: 1.05,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#D97706',
    marginTop: 8,
  },
  reelsInner: {
    flex: 1,
    flexDirection: 'row',
    margin: 4,
    backgroundColor: '#26090C',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  reel: {
    flex: 1,
    flexDirection: 'column',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.3)',
  },
  reelCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  winRow: {
    width: SCREEN_W - 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  top1Badge: {
    width: 70,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: radius.md,
    padding: 4,
  },
  top1Avatar: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FCD34D',
  },
  winBox: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FCD34D',
  },

  // Wheel
  wheelWrap: { alignItems: 'center' },
  wheelContainer: { position: 'relative' },
  wheelOuterRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 200,
    borderWidth: 4,
    borderColor: '#FCD34D',
    opacity: 0.5,
  },
  wheel: {
    borderRadius: 200,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FCD34D',
  },
  slotItem: {
    position: 'absolute',
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  slotItemSelected: {
    borderWidth: 3,
    borderColor: '#FCD34D',
    transform: [{ scale: 1.1 }],
  },
  wheelCenter: {
    position: 'absolute',
    top: '50%', left: '50%',
    marginLeft: -45, marginTop: -45,
    width: 90, height: 90, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FCD34D',
  },
  pointer: {
    position: 'absolute',
    top: -8, left: '50%',
    marginLeft: -10,
  },
  pointerTriangle: {
    width: 0, height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FCD34D',
  },
  wheelWinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.base,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(252, 211, 77, 0.2)',
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: '#FCD34D',
  },

  // Controls
  controlsWrap: {
    paddingHorizontal: spacing.sm,
    paddingBottom: 30,
    paddingTop: spacing.sm,
  },
  wheelControls: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  stakesScroll: {
    gap: 8,
    paddingVertical: 4,
    flexDirection: 'row',
  },
  stakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    minWidth: 70,
    justifyContent: 'center',
  },
  stakeBtnActive: {
    borderColor: '#FCD34D',
    backgroundColor: 'rgba(252, 211, 77, 0.2)',
  },
  spinRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    marginTop: 12,
  },
  modesColumn: {
    justifyContent: 'center',
    gap: 12,
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkBox: {
    width: 18, height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkBoxActive: {
    backgroundColor: '#E11414',
    borderColor: '#E11414',
  },
  spinBtn: {
    flex: 1,
    borderRadius: radius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#FCD34D',
  },
  wheelSpinBtn: {
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.base,
  },
});
