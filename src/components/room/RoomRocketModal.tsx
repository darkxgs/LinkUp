/**
 * RoomRocketModal — بطاقة صاروخ الروم والوكالة بمظهر متميز ومحاكاة للمكافآت
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  I18nManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Crown, ChevronLeft, ChevronRight, HelpCircle, Gift, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';

import { Text, useAlert } from '@/components/ui';
import { RocketIcon } from '@/components/ui/GameIcons';
import {
  type RoomRocketLaunch,
  type RoomRocketProgress,
  type RocketLevel,
  ROCKET_LEVEL_COINS,
  contributeToRoomRocket,
  getRocketProgressPercent,
} from '@/services/roomRocket';
import { lu } from '@/theme/lu-brand';

// الأصول المحلية
const rocketBlue = require('../../../assets/rocket_blue.webp');
const rocketPurple = require('../../../assets/rocket_purple.webp');
const rocketGold = require('../../../assets/rocket_gold.webp');
const cyberMotorcycle = require('../../../assets/cyber_motorcycle.webp');
const goldCoinsStack = require('../../../assets/gold_coins_stack.webp');

interface Props {
  visible: boolean;
  onClose: () => void;
  onOpenGifts?: () => void;
  roomId: string;
  progress: RoomRocketProgress;
  launch: RoomRocketLaunch | null;
  myCoins?: number;
  onLaunched?: () => void;
}

// هيكل الجوائز لكل مستوى
interface RewardItem {
  id: string;
  name: string;
  image: any;
  type: 'coins' | 'gift' | 'badge' | 'frame';
  label?: string;
  value?: string;
  isLarge?: boolean;
}

const LEVEL_REWARDS: Record<RocketLevel, RewardItem[]> = {
  1: [
    { id: 'coins_1', name: 'ألف كوينز', image: goldCoinsStack, type: 'coins', label: 'شائع', value: '1,000' },
    { id: 'lollipop_1', name: 'مصاصة كومبو', image: '🍭', type: 'gift', label: 'هدية' },
    { id: 'badge_1', name: 'شعار الداعم', image: '🏅', type: 'badge', label: 'برونزي' },
    { id: 'frame_1', name: 'إطار متوهج', image: '👑', type: 'frame', label: 'مؤقت', isLarge: true },
  ],
  2: [
    { id: 'coins_2', name: '5 آلاف كوينز', image: goldCoinsStack, type: 'coins', label: 'نادر', value: '5,000' },
    { id: 'icecream_2', name: 'كوب مثلجات', image: '🍨', type: 'gift', label: 'مميز' },
    { id: 'badge_2', name: 'شعار ذهبي', image: '🏆', type: 'badge', label: 'فضي' },
    { id: 'frame_2', name: 'إطار الأسطورة', image: '👑', type: 'frame', label: 'Epic', isLarge: true },
  ],
  3: [
    { id: 'coins_3', name: '15 ألف كوينز', image: goldCoinsStack, type: 'coins', label: 'الذهبي', value: '15,000' },
    { id: 'icecream_3', name: 'كوب مثلجات فاخر', image: '🍨', type: 'gift', label: 'نادر' },
    { id: 'badge_3', name: 'مساهم الصاروخ', image: '🛡️', type: 'badge', label: 'Most Contributed' },
    { id: 'motorcycle_3', name: 'دراجة نارية خيالية', image: cyberMotorcycle, type: 'frame', label: 'Rare', isLarge: true },
  ],
};

const CROWN_COLORS = ['#FBBF24', '#94A3B8', '#D97706'];

export function RoomRocketModal({
  visible,
  onClose,
  onOpenGifts,
  roomId,
  progress,
  launch,
  myCoins = 0,
  onLaunched,
}: Props) {
  const { t, i18n } = useTranslation();
  const { showAlert } = useAlert();
  const isAr = i18n.language?.startsWith('ar');

  const [selectedLevel, setSelectedLevel] = useState<RocketLevel>(launch?.level ?? 1);
  const [activeTab, setActiveTab] = useState<'rewards' | 'contributors'>('rewards');
  const [launching, setLaunching] = useState(false);

  const nextMilestoneLevel = useMemo((): RocketLevel => {
    const launched = progress.maxLevelLaunched ?? 0;
    if (launched >= 3) return 1;
    return (launched + 1) as RocketLevel;
  }, [progress.maxLevelLaunched]);

  const displayLevel = launch?.level ?? nextMilestoneLevel;

  const progressPercent = useMemo(
    () => getRocketProgressPercent(progress.cycleTotal, nextMilestoneLevel),
    [progress.cycleTotal, nextMilestoneLevel],
  );

  const topContributors = useMemo(() => {
    if (launch?.topContributors?.length) return launch.topContributors;
    return Object.values(progress.contributors).sort((a, b) => b.coins - a.coins);
  }, [launch, progress.contributors]);

  // استخراج الجوائز بناء على المستوى المحدد
  const rewards = useMemo(() => LEVEL_REWARDS[selectedLevel] || [], [selectedLevel]);
  const grandReward = useMemo(() => rewards.find((r) => r.isLarge), [rewards]);
  const smallRewards = useMemo(() => rewards.filter((r) => !r.isLarge), [rewards]);

  const handleContributeDirect = useCallback(async () => {
    const cost = ROCKET_LEVEL_COINS[selectedLevel];
    if (myCoins < cost) {
      showAlert({
        type: 'warning',
        title: `الرصيد غير كافٍ الإرسال الصاروخ (${cost.toLocaleString()} كوين)`,
        message: 'شحن العملات الذهبية لمواصلة دعم الصاروخ',
      });
      return;
    }

    Alert.alert(
      'تأكيد إرسال الصاروخ',
      `هل تود خصم ${cost.toLocaleString()} كوين ودعم تقدم صاروخ الغرفة مباشرة؟`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'إرسال ودعم',
          onPress: async () => {
            setLaunching(true);
            try {
              const launchId = await contributeToRoomRocket(roomId, cost);
              onLaunched?.();
              if (launchId) {
                showAlert({
                  type: 'celebration',
                  title: 'تم إطلاق الصاروخ!',
                  message: 'تم بلوغ الهدف الإجمالي للصاروخ بنجاح.',
                });
                onClose();
              } else {
                showAlert({
                  type: 'success',
                  title: 'تم دعم الصاروخ بنجاح',
                  message: `تم إضافة ${cost.toLocaleString()} كوين لعداد التقدم للصاروخ القادم.`,
                });
              }
            } catch (e: any) {
              showAlert({
                type: 'error',
                title: t('common.error'),
                message: e?.message || 'فشل دعم الصاروخ',
              });
            } finally {
              setLaunching(false);
            }
          },
        },
      ],
    );
  }, [myCoins, onClose, onLaunched, roomId, selectedLevel, showAlert, t]);

  // الصاروخ الرئيسي المعروض بالمنتصف
  const heroRocketImage = useMemo(() => {
    if (selectedLevel === 1) return rocketBlue;
    if (selectedLevel === 2) return rocketPurple;
    return rocketGold;
  }, [selectedLevel]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['#5B21B6', '#3B0764', '#1E003B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* صاروخ عائم ومجسم بالأعلى يتقاطع مع الحافة */}
          <View style={styles.heroRocketContainer}>
            <View style={styles.heroRocketGlow} />
            <Image source={heroRocketImage} style={styles.heroRocketImage} contentFit="contain" />
          </View>

          {/* الأزرار العلوية */}
          <View style={styles.topActionsRow}>
            <Pressable
              onPress={() =>
                Alert.alert(
                  'تفاصيل إطلاق الصاروخ',
                  'يتشارك أعضاء الغرفة في دعم الصاروخ بإرسال الهدايا، وعند اكتمال شريط التقدم ينطلق الصاروخ وتوزع العملات والجوائز المتميزة للمساهمين وفقاً لترتيب دعمهم.'
                )
              }
              style={styles.helpBtn}
            >
              <HelpCircle size={18} color="rgba(255,255,255,0.7)" />
            </Pressable>

            <Pressable style={styles.closeBtn} onPress={onClose}>
              <X size={16} color="#fff" />
            </Pressable>
          </View>

          {/* خط المستويات الأفقي (ذهبي <- بنفسجي <- أزرق) */}
          <View style={styles.levelsRow}>
            {/* المستوى 3: ذهبي */}
            <Pressable
              onPress={() => setSelectedLevel(3)}
              style={[styles.levelNode, selectedLevel === 3 && styles.levelNodeActive]}
            >
              <Image source={rocketGold} style={styles.miniRocketImage} contentFit="contain" />
              <Text style={styles.miniRocketText} weight="bold">المستوى 3</Text>
            </Pressable>

            <ChevronLeft size={16} color="rgba(255,255,255,0.3)" />

            {/* المستوى 2: بنفسجي */}
            <Pressable
              onPress={() => setSelectedLevel(2)}
              style={[styles.levelNode, selectedLevel === 2 && styles.levelNodeActive]}
            >
              <Image source={rocketPurple} style={styles.miniRocketImage} contentFit="contain" />
              <Text style={styles.miniRocketText} weight="bold">المستوى 2</Text>
            </Pressable>

            <ChevronLeft size={16} color="rgba(255,255,255,0.3)" />

            {/* المستوى 1: أزرق */}
            <Pressable
              onPress={() => setSelectedLevel(1)}
              style={[styles.levelNode, selectedLevel === 1 && styles.levelNodeActive]}
            >
              <Image source={rocketBlue} style={styles.miniRocketImage} contentFit="contain" />
              <Text style={[styles.miniRocketText, { color: '#6EE7B7' }]} weight="bold">الحالي</Text>
            </Pressable>
          </View>

          {/* شريط كبسولة التقدم */}
          <View style={styles.progressCapsuleContainer}>
            <View style={styles.progressCapsuleBg}>
              <View style={[styles.progressCapsuleFill, { width: `${progressPercent}%` }]}>
                <LinearGradient
                  colors={['#A855F7', '#EC4899', '#FBBF24']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                {progressPercent > 0 && (
                  <View style={styles.sparkleIcon}>
                    <Text style={{ fontSize: 10 }}>✨</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.progressText}>
              {progress.cycleTotal.toLocaleString()} / {ROCKET_LEVEL_COINS[nextMilestoneLevel].toLocaleString()} كوين
            </Text>
          </View>

          {/* تبويبات التصفح داخل المودال */}
          <View style={styles.modalTabs}>
            <Pressable
              onPress={() => setActiveTab('rewards')}
              style={[styles.modalTabBtn, activeTab === 'rewards' && styles.modalTabBtnActive]}
            >
              <Text style={[styles.modalTabText, activeTab === 'rewards' && styles.modalTabTextActive]} weight="bold">
                المكافأة
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('contributors')}
              style={[styles.modalTabBtn, activeTab === 'contributors' && styles.modalTabBtnActive]}
            >
              <Text style={[styles.modalTabText, activeTab === 'contributors' && styles.modalTabTextActive]} weight="bold">
                المساهمون
              </Text>
            </Pressable>
          </View>

          {/* محتوى التبويبات */}
          {activeTab === 'rewards' ? (
            <View style={styles.rewardsLayout}>
              {/* شبكة المكافآت الصغيرة (يسار في التخطيط العام) */}
              <View style={styles.smallRewardsGrid}>
                {smallRewards.map((r) => (
                  <View key={r.id} style={styles.smallRewardCard}>
                    {r.label ? (
                      <View style={[styles.rewardTag, r.label === 'Most Contributed' && styles.tagContributed]}>
                        <Text style={styles.tagText} numberOfLines={1}>{r.label}</Text>
                      </View>
                    ) : null}
                    
                    {r.type === 'coins' ? (
                      <Image source={r.image} style={styles.rewardImage} contentFit="contain" />
                    ) : (
                      <Text style={styles.rewardEmoji}>{r.image}</Text>
                    )}

                    <Text style={styles.rewardName} numberOfLines={1}>{r.name}</Text>
                    {r.value ? <Text style={styles.rewardValue}>{r.value} كوين</Text> : null}
                  </View>
                ))}
              </View>

              {/* بطاقة الجائزة الكبرى الكبيرة (يمين) */}
              {grandReward ? (
                <View style={styles.grandRewardCard}>
                  {grandReward.label ? (
                    <View style={styles.grandRewardTag}>
                      <Text style={styles.tagText}>{grandReward.label}</Text>
                    </View>
                  ) : null}
                  
                  {grandReward.id === 'motorcycle_3' ? (
                    <Image source={grandReward.image} style={styles.grandRewardImage} contentFit="cover" />
                  ) : (
                    <View style={styles.grandFramePreview}>
                      <Text style={{ fontSize: 50 }}>{grandReward.image}</Text>
                    </View>
                  )}
                  <Text style={styles.grandRewardName} weight="bold">{grandReward.name}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <ScrollView style={styles.contribScroll} showsVerticalScrollIndicator={false}>
              {topContributors.length > 0 ? (
                topContributors.map((c, i) => (
                  <View key={`${c.uid}-${i}`} style={styles.contribRow}>
                    <View style={styles.contribRank}>
                      {i < 3 ? (
                        <Crown size={16} color={CROWN_COLORS[i] ?? '#fff'} fill={CROWN_COLORS[i] ?? '#fff'} />
                      ) : (
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{i + 1}</Text>
                      )}
                    </View>

                    <Image
                      source={{ uri: c.avatar || 'https://i.pravatar.cc/100' }}
                      style={styles.contribAvatar}
                    />

                    <View style={styles.contribNameWrap}>
                      <Text style={styles.contribName} weight="bold" numberOfLines={1}>{c.name}</Text>
                      {c.isVIP && <Text style={styles.vipTag}>VIP</Text>}
                    </View>

                    <Text style={styles.contribCoins} weight="bold">
                      {c.coins.toLocaleString()} كوين
                    </Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyContributors}>
                  <Users size={32} color="rgba(255,255,255,0.3)" />
                  <Text style={styles.emptyText}>لا توجد مساهمات للصاروخ الحالي بعد</Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* أزرار الإجراءات السفلية */}
          <View style={styles.footerActions}>
            <Pressable style={styles.sendGiftsBtn} onPress={onOpenGifts}>
              <LinearGradient
                colors={['#EC4899', '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <Gift size={16} color="#fff" />
              <Text style={styles.sendGiftsText} weight="bold">
                إرسال الهدايا لإطلاق الصواريخ &gt;
              </Text>
            </Pressable>

            <Pressable
              style={[styles.directContributeBtn, launching && { opacity: 0.6 }]}
              disabled={launching}
              onPress={handleContributeDirect}
            >
              {launching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.directContributeText}>
                  دعم مباشر ({ (ROCKET_LEVEL_COINS[selectedLevel] / 1000).toFixed(0) }k كوين)
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    paddingTop: 75, // زيادة البادينغ لفسح مجال للصاروخ العائم
    paddingHorizontal: 16,
    paddingBottom: 20,
    overflow: 'visible',
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  heroRocketContainer: {
    position: 'absolute',
    top: -65,
    alignSelf: 'center',
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  heroRocketGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#8B5CF6',
    opacity: 0.4,
    transform: [{ scale: 1.15 }],
  },
  heroRocketImage: {
    width: 130,
    height: 130,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 5,
  },
  helpBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  levelNode: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 80,
  },
  levelNodeActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.5)',
  },
  miniRocketImage: {
    width: 32,
    height: 32,
    marginBottom: 2,
  },
  miniRocketText: {
    fontSize: 10,
    color: '#fff',
  },
  progressCapsuleContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  progressCapsuleBg: {
    width: '100%',
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.4)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  progressCapsuleFill: {
    height: '100%',
    borderRadius: 7,
    position: 'relative',
  },
  sparkleIcon: {
    position: 'absolute',
    right: -4,
    top: -2,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  modalTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  modalTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  modalTabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#EC4899',
  },
  modalTabText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  modalTabTextActive: {
    color: '#fff',
  },
  rewardsLayout: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  smallRewardsGrid: {
    flex: 1.2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  smallRewardCard: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    position: 'relative',
  },
  rewardTag: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tagContributed: {
    backgroundColor: '#3B82F6',
  },
  tagText: {
    fontSize: 7,
    fontWeight: '800',
    color: '#fff',
  },
  rewardImage: {
    width: 32,
    height: 32,
    marginBottom: 2,
  },
  rewardEmoji: {
    fontSize: 24,
    marginBottom: 2,
  },
  rewardName: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  rewardValue: {
    fontSize: 8,
    color: '#FBBF24',
    fontWeight: 'bold',
  },
  grandRewardCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(236, 72, 153, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    position: 'relative',
  },
  grandRewardTag: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#EC4899',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  grandRewardImage: {
    width: '100%',
    height: 90,
    borderRadius: 8,
    marginBottom: 6,
  },
  grandFramePreview: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2.5,
    borderColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginBottom: 6,
  },
  grandRewardName: {
    fontSize: 10,
    color: '#fff',
    textAlign: 'center',
  },
  contribScroll: {
    maxHeight: 180,
    marginBottom: 16,
  },
  contribRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  contribRank: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contribAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginHorizontal: 8,
    backgroundColor: '#E5E7EB',
  },
  contribNameWrap: {
    flex: 1,
    alignItems: 'flex-start',
  },
  contribName: {
    fontSize: 12,
    color: '#fff',
  },
  vipTag: {
    fontSize: 8,
    color: '#FBBF24',
    fontWeight: 'bold',
  },
  contribCoins: {
    fontSize: 12,
    color: '#FBBF24',
  },
  emptyContributors: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  footerActions: {
    gap: 8,
  },
  sendGiftsBtn: {
    height: 42,
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  sendGiftsText: {
    fontSize: 13,
    color: '#fff',
  },
  directContributeBtn: {
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  directContributeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
});
