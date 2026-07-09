/**
 * قسم الاستبدال — يعرض اختصار لـ exchange screen الموجودة
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeftRight, Sparkles } from 'lucide-react-native';
import { Image } from 'expo-image';
import { ChevronLeft } from '@/components/ui/RtlIcons';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { spacing, radius, shadows } from '@/theme';
import { COIN_CURRENCY_ICON, CASINO_CURRENCY_ICON, PEARL_CURRENCY_ICON } from '@/constants/brandAssets';

const IMG_COIN = COIN_CURRENCY_ICON;
const IMG_PEARL = PEARL_CURRENCY_ICON;
const IMG_CASINO = CASINO_CURRENCY_ICON;

const ROUTES = [
  {
    id: 'coins_to_pearls',
    title: 'العملات إلى الماسة',
    desc: 'حوّل عملاتك إلى ماسة',
    fromImg: IMG_COIN,
    toImg: IMG_PEARL,
    themeColor: '#E11414',
  },
  {
    id: 'casino_to_coins',
    title: 'كازينو إلى كوينز',
    desc: '1 كازينو = 9,000 كوينز',
    fromImg: IMG_CASINO,
    toImg: IMG_COIN,
    themeColor: '#F59E0B',
  },
  {
    id: 'casino_to_pearls',
    title: 'كازينو إلى ماسة',
    desc: '1 كازينو = 1 ماسة',
    fromImg: IMG_CASINO,
    toImg: IMG_PEARL,
    themeColor: '#C61414',
  },
];

export function ExchangeSection() {
  const router = useRouter();

  return (
    <View>
      <View style={styles.exchangeHeader}>
        <Text variant="h3" weight="bold" color="#111827">
          بوابة الاستبدال
        </Text>
        <Text variant="caption" color="#6B7280" style={{ marginTop: 4 }}>
          اختر نوع التحويل لرؤية الأسعار الفورية
        </Text>
      </View>

      {ROUTES.map((r) => (
        <Pressable
          key={r.id}
          onPress={() =>
            router.push({
              pathname: '/wallet/exchange',
              params: { route: r.id },
            } as any)
          }
          style={({ pressed }) => [
            styles.routePremiumCard,
            pressed && { transform: [{ scale: 0.98 }] },
          ]}
        >
          <View style={styles.routePremiumGlow} />
          <View style={styles.routePremiumInner}>
            <View style={styles.routePremiumIconBox}>
              <Image source={r.fromImg} style={{ width: 24, height: 24 }} contentFit="contain" />
              <ArrowLeftRight size={14} color="#9CA3AF" style={{ marginHorizontal: 6 }} />
              <Image source={r.toImg} style={{ width: 24, height: 24 }} contentFit="contain" />
            </View>
            
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text variant="body" weight="bold" color="#111827" style={{ marginBottom: 4 }}>{r.title}</Text>
              <Text variant="caption" color="#6B7280">{r.desc}</Text>
            </View>

            <View style={styles.routeActionArrow}>
               <ChevronLeft size={20} color="#E11414" />
            </View>
          </View>
        </Pressable>
      ))}

      {/* بطاقة تنبيهية */}
      <View style={styles.premiumNotice}>
        <Sparkles size={16} color="#E11414" />
        <Text variant="caption" color="#6B7280" weight="bold">
          الأسعار مُحدثة تلقائياً وفقاً للسوق الداخلي
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  exchangeHeader: {
    marginBottom: 24,
    alignItems: 'center',
  },
  routePremiumCard: {
    marginBottom: 16,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    overflow: 'hidden',
  },
  routePremiumInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    zIndex: 1,
  },
  routePremiumGlow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(225, 20, 20, 0.06)',
  },
  routePremiumIconBox: {
    paddingHorizontal: 12,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  routeActionArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumNotice: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#F9FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});
