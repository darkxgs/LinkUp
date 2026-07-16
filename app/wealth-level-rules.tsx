/**
 * توضيح القواعد — صفحة شرح مستوى الثروة (تُفتح من علامة الاستفهام).
 * بمرجع المالك (2026-07-17): خلفية زرقاء فاتحة، منحنى شارات المستويات،
 * أقسام بشرطة عمودية، بطاقة طرق الحصول على الخبرة، المستوى المُقفل، المهام اليومية.
 */
import React from 'react';
import { View, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Shield, Medal, Gem, Crown, Trophy, Gift, Rocket } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { WlBackIcon } from '@/components/wealthLevel/WealthLevelDesignIcons';

const INK = '#1F2B54';
const INK_SOFT = '#3D4A78';

/** شارات منحنى المستويات — من الأدنى للأعلى (مرجع 10→120) */
const CURVE_BADGES = [
  { level: 10, colors: ['#12B886', '#087F5B'] as const, Icon: Shield },
  { level: 30, colors: ['#5C7CFA', '#3B5BDB'] as const, Icon: Medal },
  { level: 60, colors: ['#FA5252', '#C92A2A'] as const, Icon: Gem },
  { level: 90, colors: ['#9775FA', '#7048E8'] as const, Icon: Crown },
  { level: 120, colors: ['#B197FC', '#845EF7'] as const, Icon: Trophy },
];

/** مواضع الشارات داخل بطاقة المنحنى (نِسَب من عرض/ارتفاع البطاقة) */
const BADGE_POS = [
  { x: 0.06, y: 0.72 },
  { x: 0.27, y: 0.66 },
  { x: 0.47, y: 0.55 },
  { x: 0.64, y: 0.36 },
  { x: 0.68, y: 0.1 },
];

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionBar} />
      <Text weight="bold" style={styles.sectionTitleText}>
        {title}
      </Text>
    </View>
  );
}

function NumberedLine({ index, text }: { index: number; text: string }) {
  return (
    <View style={styles.numberedRow}>
      <Text style={styles.bodyText}>{index}. </Text>
      <Text style={[styles.bodyText, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

export default function WealthLevelRulesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();

  const curveW = W - 32;
  const curveH = curveW * 0.62;

  return (
    <View style={styles.fill}>
      <LinearGradient
        colors={['#CFE0F8', '#E4EEFC', '#F2F7FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ===== Header ===== */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <WlBackIcon size={20} />
        </Pressable>
        <Text weight="bold" style={styles.headerTitle}>
          {t('wealthRules.title')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== ماهو مستوى الثروة؟ ===== */}
        <SectionTitle title={t('wealthRules.whatTitle')} />
        <Text style={styles.bodyText}>{t('wealthRules.whatBody')}</Text>

        {/* بطاقة منحنى المستويات */}
        <View style={[styles.curveCard, { height: curveH }]}>
          <Svg
            width={curveW}
            height={curveH}
            viewBox={`0 0 ${curveW} ${curveH}`}
            style={StyleSheet.absoluteFill}
          >
            <Path
              d={`M ${curveW * 0.06} ${curveH * 0.86} C ${curveW * 0.45} ${curveH * 0.82}, ${curveW * 0.75} ${curveH * 0.62}, ${curveW * 0.88} ${curveH * 0.12}`}
              stroke="#4C8DFF"
              strokeWidth={5}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
          {CURVE_BADGES.map((b, i) => {
            const pos = BADGE_POS[i] ?? { x: 0, y: 0 };
            return (
            <View
              key={b.level}
              style={[
                styles.curveBadge,
                { start: pos.x * curveW, top: pos.y * curveH },
              ]}
            >
              <LinearGradient
                colors={[...b.colors]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.curveBadgePill}
              >
                <View style={styles.curveBadgeEmblem}>
                  <b.Icon size={16} color="#FFFFFF" strokeWidth={2.2} />
                </View>
                <Text weight="bold" style={styles.curveBadgeText}>
                  {b.level}
                </Text>
              </LinearGradient>
            </View>
            );
          })}
        </View>

        {/* ===== كيف تحصل على نقاط الخبرة؟ ===== */}
        <SectionTitle title={t('wealthRules.howTitle')} />
        <Text style={styles.bodyText}>{t('wealthRules.howIntro')}</Text>
        <NumberedLine index={1} text={t('wealthRules.how1')} />
        <NumberedLine index={2} text={t('wealthRules.how2')} />

        {/* بطاقة طرق الخبرة */}
        <View style={styles.waysCard}>
          <View style={styles.wayRow}>
            <View style={styles.wayIconBox}>
              <Gift size={18} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <Text style={styles.wayText}>{t('wealthRules.wayGifts')}</Text>
          </View>
          <View style={[styles.wayRow, { marginTop: 14 }]}>
            <View style={styles.wayIconBox}>
              <Rocket size={18} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <Text style={styles.wayText}>{t('wealthRules.wayStore')}</Text>
          </View>
        </View>

        {/* ===== المستوى مُقفل ===== */}
        <SectionTitle title={t('wealthRules.lockTitle')} />
        <Text style={styles.bodyText}>{t('wealthRules.lockBody')}</Text>

        {/* ===== المهام اليومية ===== */}
        <SectionTitle title={t('wealthRules.dailyTitle')} />
        <NumberedLine index={1} text={t('wealthRules.daily1')} />
        <NumberedLine index={2} text={t('wealthRules.daily2')} />
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
    paddingBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: lu.fonts.displayHeavy,
    fontSize: 19,
    color: INK,
    includeFontPadding: false,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 26,
    marginBottom: 10,
  },
  sectionBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: INK,
  },
  sectionTitleText: {
    fontSize: 17,
    color: INK,
    includeFontPadding: false,
  },
  bodyText: {
    fontSize: 14.5,
    lineHeight: 26,
    color: INK_SOFT,
    includeFontPadding: false,
  },
  numberedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 2,
  },

  curveCard: {
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.55)',
    overflow: 'hidden',
  },
  curveBadge: {
    position: 'absolute',
  },
  curveBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingStart: 4,
    paddingEnd: 14,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#1F2B54',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  curveBadgeEmblem: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  curveBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    includeFontPadding: false,
  },

  waysCard: {
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  wayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  wayIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#3D4A9E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wayText: {
    flex: 1,
    fontSize: 14.5,
    color: INK_SOFT,
    includeFontPadding: false,
  },
});
