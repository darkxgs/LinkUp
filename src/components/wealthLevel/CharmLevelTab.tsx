/**
 * تبويب «مستوى الجاذبية» — تجربة من استقبال الهدايا (1 تجربة = 1 ذهب).
 * القيم يكتبها السيرفر حصرياً (charmXpOnGiftReceived) وتصل عبر مستمع وثيقة
 * المستخدم الحي — لا مستمعات جديدة هنا. التصميم بمرجع المالك (الصفحة الوردية).
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Star, Gift } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { xpRequiredForLevel } from '@/services/firebase/wealthLevel';

/** تدرّج رأس صفحة الجاذبية — وردي (مرجع المالك) */
export const CHARM_HEADER_GRADIENT = ['#FF8FA8', '#FB4D8C', '#F02779'] as const;

const AVATAR = 96;

type Props = {
  avatarUri?: string;
  displayName?: string;
  charmLevel: number;
  charmXp: number;
};

export function CharmLevelTab({ avatarUri, displayName, charmLevel, charmXp }: Props) {
  const { t } = useTranslation();

  const xpNeeded = xpRequiredForLevel(charmLevel);
  const pct = Math.min(Math.max((charmXp / xpNeeded) * 100, 0), 100);
  const remaining = Math.max(0, xpNeeded - charmXp);

  const progressAnim = useRef(new Animated.Value(pct)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: pct,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, progressAnim]);

  return (
    <View style={styles.fill}>
      {/* ===== Hero وردي: الصورة + شريط المستوى + التقدّم ===== */}
      <View style={styles.hero}>
        <View style={styles.avatarWrap}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text weight="bold" style={styles.avatarLetter}>
                {(displayName ?? '?').charAt(0)}
              </Text>
            </View>
          )}
          {/* شريط Lv تحت الصورة (مرجع Lv.8) */}
          <View style={styles.ribbon}>
            <Text weight="bold" style={styles.ribbonText}>
              Lv.{charmLevel}
            </Text>
          </View>
        </View>

        {/* شريط التقدّم: المستوى الحالي ← التالي، وفوقه فقاعة التجربة الحالية */}
        <View style={styles.progressBlock}>
          <View style={styles.progressChipRow} pointerEvents="none">
            <View style={{ width: `${pct}%` }} />
            <View style={styles.xpChip}>
              <Text weight="bold" style={styles.xpChipText}>
                {charmXp.toLocaleString('en-US')}
              </Text>
            </View>
          </View>
          <View style={styles.progressRow}>
            <Text weight="bold" style={styles.progressLevelLabel}>
              Lv.{charmLevel}
            </Text>
            <View style={styles.track}>
              <Animated.View
                style={[
                  styles.trackFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <Text weight="bold" style={styles.progressLevelLabel}>
              Lv.{charmLevel + 1}
            </Text>
          </View>
          <Text style={styles.progressHint}>
            {t('charmLevel.expNeeded', { count: remaining })}
          </Text>
        </View>
      </View>

      {/* ===== الورقة البيضاء: المكافآت + كيفية الترقية ===== */}
      <View style={styles.sheet}>
        <View style={styles.sectionTitleWrap}>
          <View style={styles.titleDivider} />
          <Text weight="bold" style={styles.sectionTitle}>
            {t('charmLevel.rewards')}
          </Text>
          <View style={styles.titleDivider} />
        </View>

        <View style={styles.rewardItem}>
          <View style={styles.rewardIconCircle}>
            <Star size={26} color="#9CA3AF" strokeWidth={1.8} />
          </View>
          <Text style={styles.rewardLabel}>{t('charmLevel.levelSymbol')}</Text>
        </View>

        <View style={[styles.sectionTitleWrap, { marginTop: 26 }]}>
          <View style={styles.titleDivider} />
          <Text weight="bold" style={styles.sectionTitle}>
            {t('charmLevel.howToUpgrade')}
          </Text>
          <View style={styles.titleDivider} />
        </View>

        <View style={styles.howRow}>
          <LinearGradient
            colors={['#FBBF24', '#F59E0B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.howIconCircle}
          >
            <Gift size={26} color="#FFFFFF" strokeWidth={2} />
          </LinearGradient>
          <View style={styles.howTextCol}>
            <Text weight="bold" style={styles.howTitle}>
              {t('charmLevel.receiveGiftTitle')}
            </Text>
            <Text style={styles.howSubtitle}>{t('charmLevel.receiveGiftRule')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },

  hero: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 26,
  },
  avatarWrap: {
    alignItems: 'center',
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 36,
    includeFontPadding: false,
  },
  // شريط المستوى الأبيض تحت الصورة (مرجع Lv.8)
  ribbon: {
    marginTop: -14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingVertical: 4,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  ribbonText: {
    color: '#F0257E',
    fontSize: 16,
    includeFontPadding: false,
  },

  progressBlock: {
    alignSelf: 'stretch',
    paddingHorizontal: 18,
    marginTop: 18,
  },
  progressChipRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 40,
    marginBottom: 6,
    minHeight: 26,
  },
  xpChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    marginStart: -20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  xpChipText: {
    color: '#F0257E',
    fontSize: 12,
    includeFontPadding: false,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressLevelLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    includeFontPadding: false,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
  },
  progressHint: {
    marginTop: 10,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    includeFontPadding: false,
  },

  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 32,
    minHeight: 420,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  titleDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#EADFC8',
  },
  sectionTitle: {
    color: '#8A6D3B',
    fontSize: 16,
    fontFamily: lu.fonts.displayHeavy,
    includeFontPadding: false,
  },

  rewardItem: {
    alignItems: 'flex-start',
    marginTop: 22,
    paddingHorizontal: 8,
  },
  rewardIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardLabel: {
    marginTop: 8,
    color: '#374151',
    fontSize: 13,
    includeFontPadding: false,
  },

  howRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
    paddingHorizontal: 8,
  },
  howIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howTextCol: {
    flex: 1,
  },
  howTitle: {
    color: '#111827',
    fontSize: 15,
    includeFontPadding: false,
  },
  howSubtitle: {
    marginTop: 3,
    color: '#6B7280',
    fontSize: 13,
    includeFontPadding: false,
  },
});
