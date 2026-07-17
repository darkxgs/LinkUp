/**
 * LinkUp — شاشة العلاقة
 * مطابقة Level-1.png من Line up App Full File
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';

import { Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import {
  getMyRelationships,
  getOrCreateRelationship,
  calculateLevel,
  getPartnerInfo,
  purchaseLevelUpgrade,
  RELATIONSHIP_LEVELS,
  type Relationship,
} from '@/services/firebase/social';
import { getUser } from '@/services/firebase/users';
import { LuArrowIcon } from '@/components/icons/LuDesignIcons';
import {
  REL_ASSETS,
  REL_DESIGN,
  levelCardImage,
} from '@/components/relationships/relationshipDesign';
import { RelQuestionIcon } from '@/components/relationships/RelationshipDesignIcons';
import {
  RelationshipLevelPanelShape,
  REL_PANEL_ASPECT,
} from '@/components/relationships/RelationshipLevelPanelShape';
import { RelationshipAvatarFrame } from '@/components/relationships/RelationshipAvatarFrame';
import {
  RelationshipTimeline,
  timelineWindow,
} from '@/components/relationships/RelationshipTimeline';

export default function RelationshipsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { user, refreshUser } = useAuth();
  const params = useLocalSearchParams<{ userId?: string }>();
  const incomingUserId = params.userId;

  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [viewingLevel, setViewingLevel] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      let data = await getMyRelationships();

      if (incomingUserId && user?.uid) {
        const exists = data.find(
          (r) => r.user1Uid === incomingUserId || r.user2Uid === incomingUserId,
        );
        if (!exists) {
          try {
            const partnerUser = await getUser(incomingUserId);
            if (partnerUser) {
              await getOrCreateRelationship(
                incomingUserId,
                partnerUser.displayName,
                partnerUser.avatar,
              );
              data = await getMyRelationships();
            }
          } catch (e) {
            console.warn('failed to create rel for incoming user:', e);
          }
        }
        const idx = data.findIndex(
          (r) => r.user1Uid === incomingUserId || r.user2Uid === incomingUserId,
        );
        if (idx >= 0) setActiveIdx(idx);
      }

      setRelationships(data);
    } catch (e) {
      console.error('relationships load:', e);
    } finally {
      setLoading(false);
    }
  }, [incomingUserId, user?.uid]);

  useEffect(() => {
    load();
  }, [load]);

  const current = relationships[activeIdx];
  const partner = useMemo(
    () => (current && user?.uid ? getPartnerInfo(current, user.uid) : null),
    [current, user?.uid],
  );
  const levelInfo = useMemo(
    () => (current ? calculateLevel(current.intimacyPoints) : null),
    [current],
  );

  // المستوى المُنجَز فعلياً — الأعلى بين المحسوب من النقاط والمحفوظ في وثيقة العلاقة
  // (كان الحساب من النقاط وحده يقفل مستوى وصله المستخدم سابقاً)
  const achievedLevel = Math.max(levelInfo?.level ?? 0, current?.level ?? 0);
  const displayLevel = viewingLevel ?? (achievedLevel || 1);
  const displayLevelInfo = useMemo(
    () => RELATIONSHIP_LEVELS.find((l) => l.level === displayLevel) ?? RELATIONSHIP_LEVELS[0]!,
    [displayLevel],
  );
  const isReachedLevel = achievedLevel >= displayLevel;

  const progressCurrent = useMemo(() => {
    if (!current || !levelInfo) return { current: 0, total: 100, pct: 0, toNext: 0 };
    if (!levelInfo.nextLevelInfo) {
      return { current: 100, total: 100, pct: 100, toNext: 0 };
    }
    const bandStart = levelInfo.currentLevelInfo.pointsRequired;
    const bandEnd = levelInfo.nextLevelInfo.pointsRequired;
    const inBand = Math.max(0, current.intimacyPoints - bandStart);
    const bandSize = bandEnd - bandStart;
    return {
      current: inBand,
      total: bandSize,
      pct: Math.min(100, (inBand / bandSize) * 100),
      toNext: levelInfo.pointsToNext,
    };
  }, [current, levelInfo]);

  const timelineLevels = useMemo(() => timelineWindow(displayLevel), [displayLevel]);

  const goLevel = (delta: number) => {
    setViewingLevel(Math.min(15, Math.max(1, displayLevel + delta)));
  };

  const handleUpgrade = async () => {
    if (!partner || !current || upgrading || !levelInfo?.nextLevelInfo) {
      Alert.alert(t('relationships.text42779'), t('relationships.text77960'));
      return;
    }

    const coinsNeeded = levelInfo.pointsToNext;
    const userCoins = user?.stats?.coins ?? 0;

    if (userCoins < coinsNeeded) {
      Alert.alert(
        t('gifts.insufficientCoins'),
        t('relationships.needCoinsBody', {
          needed: coinsNeeded.toLocaleString('en-US'),
          balance: userCoins.toLocaleString('en-US'),
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('wallet.recharge'), onPress: () => router.push('/wallet/recharge') },
        ],
      );
      return;
    }

    Alert.alert(
      t('relationships.text54035'),
      t('relationships.upgradeConfirmBody', {
        level: levelInfo.nextLevelInfo.level,
        title: levelInfo.nextLevelInfo.title,
        cost: coinsNeeded.toLocaleString('en-US'),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('relationships.upgrade'),
          onPress: async () => {
            setUpgrading(true);
            try {
              const result = await purchaseLevelUpgrade(
                partner.uid,
                partner.name,
                partner.avatar,
              );
              await refreshUser();
              await load();
              setViewingLevel(result.newLevel);
              Alert.alert(
                t('relationships.upgradedTitle'),
                t('relationships.upgradedBody', {
                  level: result.newLevel,
                  title: RELATIONSHIP_LEVELS.find((l) => l.level === result.newLevel)?.title ?? '',
                }),
              );
            } catch (e: any) {
              Alert.alert(t('roomSettings.text32386'), e.message ?? t('relationships.text6013'));
            } finally {
              setUpgrading(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={[...REL_DESIGN.bg]} style={styles.fill}>
        <ActivityIndicator size="large" color={REL_DESIGN.purple} style={{ marginTop: 200 }} />
      </LinearGradient>
    );
  }

  if (!current || !partner || !levelInfo) {
    return (
      <LinearGradient colors={[...REL_DESIGN.bg]} style={[styles.fill, styles.center]}>
        <Image source={REL_ASSETS.heart3d} style={{ width: 72, height: 72 }} contentFit="contain" />
        <Text weight="bold" style={{ fontSize: 17, color: REL_DESIGN.ink, marginTop: 14 }}>
          {t('relationships.noRelationships')}
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 22 }}>
          <Text weight="bold" style={{ color: REL_DESIGN.purple, fontSize: 14 }}>{t('profile.back')}</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  const myAvatar = user?.profile?.avatar;
  const myName = (user?.profile?.displayName ?? t('relationships.text93163')).split(' ')[0] ?? '';
  const partnerName = partner.name.split(' ')[0];
  const panelW = W - 28;
  const panelH = panelW * REL_PANEL_ASPECT;
  const illuSize = Math.min(panelW * 0.52, 200);

  return (
    <View style={styles.fill}>
      <LinearGradient colors={[...REL_DESIGN.bg]} style={StyleSheet.absoluteFill} />

      {/* ===== الهيدر + الأزواج ===== */}
      <View style={[styles.hero, { paddingTop: insets.top + 6 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headBtn} hitSlop={10}>
            <LuArrowIcon size={20} color={REL_DESIGN.ink} direction="left" />
          </Pressable>
          <View style={styles.relationPill}>
            <Image source={REL_ASSETS.heart3d} style={{ width: 16, height: 16 }} contentFit="contain" />
            <Text weight="bold" style={styles.relationPillText}>{t('relationships.text62936')}</Text>
          </View>
          <Pressable
            style={styles.headBtn}
            hitSlop={10}
            onPress={() =>
              Alert.alert(
                t('relationships.helpTitle', 'نظام العلاقات'),
                t(
                  'relationships.helpBody',
                  'ترتبط بعلاقة مع صديق/صديقة وتكسبان نقاط حميمية معاً:\n\n• الرسائل والهدايا المتبادلة ترفع نقاط العلاقة\n• كل مستوى يفتح وساماً وشكلاً جديداً للعلاقة\n• زر «ترقية» يظهر عند اكتمال نقاط المستوى التالي\n• يمكنك التنقل بين المستويات بالسهمين لمعاينة المكافآت',
                ),
              )
            }
          >
            <RelQuestionIcon size={20} color={REL_DESIGN.ink} />
          </Pressable>
        </View>

        {relationships.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relPicker}>
            {relationships.map((rel, idx) => {
              const p = user?.uid ? getPartnerInfo(rel, user.uid) : null;
              const info = calculateLevel(rel.intimacyPoints);
              return (
                <Pressable
                  key={rel.id}
                  onPress={() => { setActiveIdx(idx); setViewingLevel(null); }}
                  style={[styles.relChip, idx === activeIdx && styles.relChipActive]}
                >
                  <RelationshipAvatarFrame uri={p?.avatar} name={p?.name ?? '?'} width={40} />
                  <Text weight="bold" style={{ fontSize: 9, color: REL_DESIGN.purple, marginTop: 2 }}>
                    {String(info.level).padStart(2, '0')}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.coupleWrap}>
          <Image
            source={REL_ASSETS.honorMedal}
            style={styles.honorBg}
            contentFit="contain"
          />
          <View style={styles.coupleRow}>
            <RelationshipAvatarFrame uri={myAvatar ?? ''} name={myName} width={92} tilt="left" />
            <View style={styles.coupleHeart}>
              <Image source={REL_ASSETS.heart3d} style={{ width: 58, height: 58 }} contentFit="contain" />
            </View>
            <RelationshipAvatarFrame uri={partner.avatar} name={partner.name} width={92} tilt="right" />
          </View>
          <View style={styles.namesRow}>
            <Text weight="bold" style={styles.nameText} numberOfLines={1}>{myName}</Text>
            <Text weight="bold" style={styles.nameText} numberOfLines={1}>{partnerName}</Text>
          </View>
        </View>
      </View>

      {/* ===== البطاقة السفلية (Bottom Sheet) ===== */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.sheetHandle} />

        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
        <RelationshipTimeline
          levels={timelineLevels}
          displayLevel={displayLevel}
          currentLevel={achievedLevel}
          levelLabel={`${t('relationships.level')} ${String(displayLevel).padStart(2, '0')}`}
          statusLabel={isReachedLevel ? t('relationships.reached') : t('relationships.locked')}
          isReached={isReachedLevel}
          onSelect={setViewingLevel}
        />

        {/* لوحة المحتوى */}
        <View style={[styles.panel, { width: panelW, height: panelH, alignSelf: 'center' }]}>
          <RelationshipLevelPanelShape width={panelW} height={panelH} />

          <View style={[styles.panelInner, { minHeight: panelH, zIndex: 1 }]}>
            <View style={styles.illuRow}>
              <Pressable
                onPress={() => goLevel(-1)}
                disabled={displayLevel <= 1}
                style={[styles.navBtn, displayLevel <= 1 && styles.navBtnDisabled]}
              >
                <LuArrowIcon size={16} color={REL_DESIGN.ink2} direction="left" />
              </Pressable>

              <Image
                source={levelCardImage(displayLevel)}
                style={{ width: illuSize, height: illuSize * 0.88 }}
                contentFit="contain"
              />

              <Pressable
                onPress={() => goLevel(1)}
                disabled={displayLevel >= 15}
                style={[styles.navBtn, displayLevel >= 15 && styles.navBtnDisabled]}
              >
                <LuArrowIcon size={16} color={REL_DESIGN.ink2} direction="right" />
              </Pressable>
            </View>

            <Text weight="bold" style={styles.levelTitle}>{displayLevelInfo.title}</Text>
            <Text style={styles.levelDesc}>{t('relationships.text706')}</Text>
          </View>
        </View>
        </ScrollView>

        {/* شريط التقدّم الزجاجي */}
        <View style={styles.glassBarOuter}>
          <BlurView intensity={28} tint="light" style={styles.glassBar}>
            <View style={{ flex: 1 }}>
              <Text weight="bold" style={styles.progressNums}>
                {levelInfo.nextLevelInfo
                  ? `${progressCurrent.current.toLocaleString('en-US')}/${progressCurrent.total.toLocaleString('en-US')}`
                  : t('relationships.maxLevel')}
              </Text>
              <View style={styles.progressTrack}>
                <LinearGradient
                  colors={[...REL_DESIGN.progress]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${progressCurrent.pct}%` }]}
                />
              </View>
              <Text style={styles.progressHint}>
                {progressCurrent.toNext > 0
                  ? t('relationships.pointsToUpgrade', { count: progressCurrent.toNext })
                  : t('relationships.text62023')}
              </Text>
            </View>

            <Pressable
              onPress={handleUpgrade}
              disabled={upgrading || !levelInfo.nextLevelInfo}
              style={[styles.upgradeBtn, (!levelInfo.nextLevelInfo || upgrading) && { opacity: 0.5 }]}
            >
              <LinearGradient
                colors={[...REL_DESIGN.upgrade]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {upgrading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text weight="bold" style={styles.upgradeText}>{t('relationships.upgrade')}</Text>
              )}
            </Pressable>
          </BlurView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },

  hero: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  relationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 99,
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  relationPillText: {
    fontSize: 14,
    color: REL_DESIGN.purple,
  },

  relPicker: {
    gap: 8,
    paddingVertical: 6,
  },
  relChip: {
    alignItems: 'center',
    padding: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  relChipActive: {
    borderColor: REL_DESIGN.purple,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },

  coupleWrap: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 8,
    minHeight: 150,
    justifyContent: 'center',
  },
  honorBg: {
    position: 'absolute',
    width: 200,
    height: 200,
    opacity: 0.14,
    top: 8,
  },
  coupleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coupleHeart: {
    marginHorizontal: -14,
    zIndex: 3,
  },
  namesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '78%',
    marginTop: 10,
  },
  nameText: {
    fontSize: 14,
    color: REL_DESIGN.ink,
  },

  sheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    paddingTop: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 99,
    backgroundColor: '#EFEFF2',
    marginBottom: 12,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    paddingBottom: 8,
  },

  panel: {
    marginTop: 10,
    marginBottom: 8,
    position: 'relative',
  },
  panelInner: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: 'center',
  },
  illuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
    marginVertical: 4,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFEFF2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  navBtnDisabled: {
    opacity: 0.3,
  },

  levelTitle: {
    fontSize: 20,
    color: REL_DESIGN.ink,
    textAlign: 'center',
    marginTop: 6,
  },
  levelDesc: {
    fontSize: 12.5,
    color: REL_DESIGN.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
    paddingHorizontal: 20,
  },

  glassBarOuter: {
    marginHorizontal: 14,
    marginTop: 'auto' as any,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  glassBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  progressNums: {
    fontSize: 16,
    color: REL_DESIGN.ink,
  },
  progressTrack: {
    height: 9,
    borderRadius: 99,
    backgroundColor: '#EFEFF2',
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
  },
  progressHint: {
    fontSize: 10.5,
    color: REL_DESIGN.muted,
    marginTop: 4,
  },
  upgradeBtn: {
    minWidth: 100,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: REL_DESIGN.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeText: {
    color: '#fff',
    fontSize: 15,
  },
});
