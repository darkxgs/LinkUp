/**
 * LinkUp App — شاشة تحويل العملات الذاتية (Exchange)
 *
 * تصميم فخم مستوحى من تطبيقات الكريبتو (Binance VIP / Revolut)
 * واجهة Swap ذكية + كروت اختيار 3D + Light Mode
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { ArrowDown, Info, AlertCircle, ArrowRightLeft } from 'lucide-react-native';
import { ChevronRight } from '@/components/ui/RtlIcons';
import i18n from '@/localization/i18n';

import { Text } from '@/components/ui';
import { useAlert } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import {
  exchangeCurrency,
  calculateExchange,
  ALLOWED_EXCHANGE_ROUTES,
  type ExchangeRoute,
} from '@/services/currencyExchange';
import { toDisplayCasinoCoins } from '@/utils/casinoCoins';
import { WithdrawTabPanel } from '@/components/wallet/WithdrawTabPanel';
import { lu } from '@/theme/lu-brand';

type ScreenTab = 'exchange' | 'withdraw';

interface RouteDef {
  id: ExchangeRoute;
  sourceKey: string;
  targetKey: string;
  sourceImg: any;
  targetImg: any;
  themeColor: string;
  gradient: [string, string];
}

import { COIN_CURRENCY_ICON, CASINO_CURRENCY_ICON, PEARL_CURRENCY_ICON } from '@/constants/brandAssets';

const IMG_COIN = COIN_CURRENCY_ICON;
const IMG_PEARL = PEARL_CURRENCY_ICON;
const IMG_CASINO = CASINO_CURRENCY_ICON;

const ROUTES: RouteDef[] = ALLOWED_EXCHANGE_ROUTES.map((id) => {
  const defs: Record<ExchangeRoute, RouteDef> = {
    coins_to_pearls: {
      id: 'coins_to_pearls',
      sourceKey: 'profile.coinsLabel',
      targetKey: 'profile.pearlsLabel',
      sourceImg: IMG_COIN,
      targetImg: IMG_PEARL,
      themeColor: '#E11414',
      gradient: ['#FF4D4D', '#B00E0E'],
    },
    casino_to_coins: {
      id: 'casino_to_coins',
      sourceKey: 'wallet.text65404',
      targetKey: 'profile.coinsLabel',
      sourceImg: IMG_CASINO,
      targetImg: IMG_COIN,
      themeColor: '#F59E0B',
      gradient: ['#F59E0B', '#E11414'],
    },
    casino_to_pearls: {
      id: 'casino_to_pearls',
      sourceKey: 'wallet.text65404',
      targetKey: 'profile.pearlsLabel',
      sourceImg: IMG_CASINO,
      targetImg: IMG_PEARL,
      themeColor: '#C61414',
      gradient: ['#C61414', '#ED4444'],
    },
  };
  return defs[id];
});

const FORBIDDEN_ROUTE_LABELS = [
  'ماسة → كوينز',
  'كوينز → كازينو',
  'ماسة → كازينو',
] as const;

function formatExchangeRateText(
  route: ExchangeRoute,
  rate: number,
  sourceLabel: string,
  targetLabel: string,
): string {
  if (route === 'coins_to_pearls') {
    return `${rate.toLocaleString()} ${sourceLabel} = 1 ${targetLabel}`;
  }
  return `1 ${sourceLabel} = ${rate.toLocaleString()} ${targetLabel}`;
}

const LABEL_FALLBACK: Record<string, string> = {
  'profile.coinsLabel': 'كوينز',
  'profile.pearlsLabel': 'ماسة',
  'wallet.text65404': 'كازينو',
};

function formatWalletBalance(value: number, decimals = 0): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function WalletBalanceChip({
  icon,
  label,
  amount,
}: {
  icon: typeof IMG_COIN;
  label: string;
  amount: string;
}) {
  return (
    <View style={styles.balanceChip}>
      <Image source={icon} style={styles.balanceChipIcon} contentFit="contain" />
      <Text variant="caption" color="#9CA3AF" numberOfLines={1} style={styles.balanceLabel}>
        {label}
      </Text>
      <Text
        weight="bold"
        color="#111827"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
        style={styles.balanceAmount}
      >
        {amount}
      </Text>
    </View>
  );
}

export default function ExchangeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { route: routeParam, tab: tabParam } = useLocalSearchParams<{
    route?: string;
    tab?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { settings } = useConfig();
  const { showAlert } = useAlert();

  const initialScreenTab: ScreenTab = tabParam === 'withdraw' ? 'withdraw' : 'exchange';
  const [activeScreenTab, setActiveScreenTab] = useState<ScreenTab>(initialScreenTab);

  const initialRoute: ExchangeRoute =
    routeParam && ALLOWED_EXCHANGE_ROUTES.includes(routeParam as ExchangeRoute)
      ? (routeParam as ExchangeRoute)
      : 'coins_to_pearls';

  const [activeRoute, setActiveRoute] = useState<ExchangeRoute>(initialRoute);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshUser?.();
    }, [refreshUser]),
  );

  const pearlBalance = user?.stats?.pearls ?? 0;
  const coinBalance = user?.stats?.coins ?? 0;
  const casinoBalance = Math.floor(toDisplayCasinoCoins(user?.stats?.casinoCoins ?? 0));

  useEffect(() => {
    if (tabParam === 'withdraw' || tabParam === 'exchange') {
      setActiveScreenTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    if (routeParam && ALLOWED_EXCHANGE_ROUTES.includes(routeParam as ExchangeRoute)) {
      setActiveRoute(routeParam as ExchangeRoute);
      setAmount('');
    }
  }, [routeParam]);

  const rates = useMemo(
    () => ({
      coinsToPearls: Math.max(1, settings?.coinsToPearlsRate ?? 50_000),
      casinoToCoins: Math.max(1, settings?.casinoToCoinsRate ?? 9_000),
      casinoToPearls: Math.max(1, settings?.casinoToPearlsRate ?? 1),
    }),
    [settings],
  );

  const routeDef = ROUTES.find((r) => r.id === activeRoute)!;

  const labelFor = (key: string) => {
    const v = t(key);
    return !v || v === key ? (LABEL_FALLBACK[key] ?? key) : v;
  };
  const sourceLabel = labelFor(routeDef.sourceKey);
  const targetLabel = labelFor(routeDef.targetKey);

  const sourceBalance = useMemo(() => {
    switch (activeRoute) {
      case 'coins_to_pearls':
        return user?.stats?.coins ?? 0;
      case 'casino_to_coins':
      case 'casino_to_pearls':
        return Math.floor(toDisplayCasinoCoins(user?.stats?.casinoCoins ?? 0));
    }
  }, [activeRoute, user]);

  const numAmount = Number(amount.replace(/[^0-9]/g, '')) || 0;
  const calc = useMemo(
    () => calculateExchange(activeRoute, numAmount, rates),
    [activeRoute, numAmount, rates],
  );

  const canExchange =
    numAmount > 0 &&
    numAmount <= sourceBalance &&
    calc.received > 0 &&
    !submitting;

  const handleExchange = () => {
    if (!canExchange) return;
    showAlert({
      type: 'warning',
      title: 'تأكيد عملية التحويل',
      message: `سيتم استبدال ${numAmount.toLocaleString()} ${sourceLabel} والحصول على ${calc.received.toLocaleString()} ${targetLabel}\n\nتتم العملية فوراً وبدون عمولات إضافية.`,
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'تأكيد العملية',
          onPress: async () => {
            setSubmitting(true);
            try {
              await exchangeCurrency(activeRoute, numAmount);
              showAlert({
                type: 'success',
                title: 'عملية ناجحة!',
                message: `لقد حصلت على ${calc.received.toLocaleString()} ${targetLabel} بنجاح.`,
                buttons: [
                  {
                    text: 'حسناً',
                    onPress: () => {
                      refreshUser?.();
                      setAmount('');
                    },
                  },
                ],
              });
            } catch (e: any) {
              showAlert({
                type: 'error',
                title: t('wallet.text98609'),
                message: e?.message ?? t('common.errorOccurred'),
              });
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#F8FAFC', '#F1F5F9']} style={StyleSheet.absoluteFillObject} />
      
      {/* Premium Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronRight size={24} color="#111827" />
        </Pressable>
        <Text variant="h3" color="#111827" weight="bold" style={styles.headerTitle}>
          {t('wallet.exchangeWithdraw')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.screenTabsWrap}>
        <View style={styles.screenTabs}>
          <Pressable
            onPress={() => setActiveScreenTab('exchange')}
            style={[styles.screenTab, activeScreenTab === 'exchange' && styles.screenTabActive]}
          >
            <Text
              variant="button"
              weight={activeScreenTab === 'exchange' ? 'bold' : 'regular'}
              color={activeScreenTab === 'exchange' ? lu.colors.purple : '#6B7280'}
            >
              {t('wallet.exchange')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveScreenTab('withdraw')}
            style={[styles.screenTab, activeScreenTab === 'withdraw' && styles.screenTabActive]}
          >
            <Text
              variant="button"
              weight={activeScreenTab === 'withdraw' ? 'bold' : 'regular'}
              color={activeScreenTab === 'withdraw' ? lu.colors.purple : '#6B7280'}
            >
              {t('wallet.withdraw')}
            </Text>
          </Pressable>
        </View>
      </View>

      {activeScreenTab === 'withdraw' ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <WithdrawTabPanel />
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120 }}
          showsVerticalScrollIndicator={false}
        >
          {/* أرصدة المحفظة — يوضّح رصيد الماسة الحقيقي */}
          <View style={styles.balancesCard}>
            <Text variant="caption" color="#6B7280" weight="bold" style={{ marginBottom: 12 }}>
              أرصدة محفظتك
            </Text>
            <View style={styles.balancesRow}>
              <WalletBalanceChip
                icon={IMG_PEARL}
                label="ماسة"
                amount={formatWalletBalance(pearlBalance, 2)}
              />
              <WalletBalanceChip
                icon={IMG_COIN}
                label="كوينز"
                amount={formatWalletBalance(coinBalance)}
              />
              <WalletBalanceChip
                icon={IMG_CASINO}
                label="كازينو"
                amount={formatWalletBalance(casinoBalance)}
              />
            </View>
            {pearlBalance > 0 && activeRoute === 'coins_to_pearls' && coinBalance === 0 && casinoBalance === 0 ? (
              <Text variant="caption" color="#92400E" style={{ marginTop: 10 }}>
                لديك ماسة في محفظتك. للسحب انتقل لتبويب «سحب»، أو حوّل كازينو/كوينز إلى ماسة من البطاقات أدناه.
              </Text>
            ) : null}
            {pearlBalance === 0 && casinoBalance > 0 && activeRoute === 'coins_to_pearls' ? (
              <Text variant="caption" color="#92400E" style={{ marginTop: 10 }}>
                رصيد الكوينز صفر — جرّب «إلى ماسة» من الكازينو إذا لديك رصيد كازينو.
              </Text>
            ) : null}
          </View>

          {/* Route Carousel */}
          <Text variant="caption" weight="bold" color="#6B7280" style={{ marginBottom: 12, letterSpacing: 0.5 }}>
            {t('wallet.text13510')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routesScroll}>
            {ROUTES.map((r) => {
              const isActive = r.id === activeRoute;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    setActiveRoute(r.id);
                    setAmount('');
                  }}
                  style={[
                    styles.routeCard,
                    isActive && styles.routeCardActive,
                    !isActive && { borderColor: '#F3F4F6' },
                  ]}
                >
                  {isActive ? (
                    <LinearGradient
                      colors={r.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]}
                    />
                  ) : null}
                  <View style={styles.routeCardContent}>
                    <View style={styles.routeIconRow}>
                      <View style={[styles.miniIconBox, { backgroundColor: isActive ? '#fff' : '#F3F4F6' }]}>
                        <Image source={r.sourceImg} style={{ width: 18, height: 18 }} contentFit="contain" />
                      </View>
                      <ArrowRightLeft size={14} color={isActive ? '#fff' : '#9CA3AF'} />
                      <View style={[styles.miniIconBox, { backgroundColor: isActive ? '#fff' : '#F3F4F6' }]}>
                        <Image source={r.targetImg} style={{ width: 18, height: 18 }} contentFit="contain" />
                      </View>
                    </View>
                    <Text
                      variant="button"
                      weight="bold"
                      color={isActive ? '#fff' : '#111827'}
                      style={{ marginTop: 12, textAlign: 'center' }}
                    >
                      إلى {labelFor(r.targetKey)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Crypto Swap Interface */}
          <View style={styles.swapContainer}>
             {/* You Pay Section */}
             <View style={styles.swapBlock}>
                <View style={styles.swapHeader}>
                   <Text variant="caption" color="#6B7280" weight="bold">أنت تدفع</Text>
                   <Text variant="caption" color="#9CA3AF">متاح: {sourceBalance.toLocaleString()} {sourceLabel}</Text>
                </View>
                <View style={styles.swapInputRow}>
                   <TextInput
                     style={styles.hugeInput}
                     value={amount}
                     onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
                     keyboardType="number-pad"
                     placeholder="0"
                     placeholderTextColor="#D1D5DB"
                   />
                   <View style={styles.currencyPill}>
                      <Image source={routeDef.sourceImg} style={{ width: 20, height: 20 }} contentFit="contain" />
                      <Text variant="button" weight="bold" color="#111827">{sourceLabel}</Text>
                   </View>
                </View>
             </View>

             {/* Swap Divider Button */}
             <View style={styles.swapDivider}>
               <View style={styles.swapDividerLine} />
               <View style={styles.swapArrowCircle}>
                 <ArrowDown size={20} color={routeDef.themeColor} />
               </View>
             </View>

             {/* You Receive Section */}
             <View style={[styles.swapBlock, { backgroundColor: '#F9FAFC' }]}>
                <View style={styles.swapHeader}>
                   <Text variant="caption" color="#6B7280" weight="bold">أنت تحصل على (تقديري)</Text>
                   <Text variant="caption" color={routeDef.themeColor} weight="bold">
                     معدل التحويل {formatExchangeRateText(activeRoute, calc.rate, '', '')}
                   </Text>
                </View>
                <View style={styles.swapInputRow}>
                   <TextInput
                     style={[styles.hugeInput, { color: calc.received > 0 ? '#111827' : '#D1D5DB' }]}
                     value={calc.received > 0 ? calc.received.toLocaleString() : '0'}
                     editable={false}
                   />
                   <View style={[styles.currencyPill, { backgroundColor: '#F3F4F6' }]}>
                      <Image source={routeDef.targetImg} style={{ width: 20, height: 20 }} contentFit="contain" />
                      <Text variant="button" weight="bold" color="#111827">{targetLabel}</Text>
                   </View>
                </View>
             </View>
          </View>

          {/* Quick Amounts */}
          <Text variant="caption" weight="bold" color="#9CA3AF" style={{ textAlign: 'center', marginTop: 8, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            تحديد سريع
          </Text>
          <View style={styles.quickRow}>
            {[
              { label: '25%', val: Math.floor(sourceBalance * 0.25) },
              { label: '50%', val: Math.floor(sourceBalance * 0.5) },
              { label: '75%', val: Math.floor(sourceBalance * 0.75) },
              { label: 'الكل MAX', val: sourceBalance },
            ].map((q) => (
              <Pressable
                key={q.label}
                onPress={() => setAmount(String(q.val))}
                style={[styles.quickGlassChip, amount === String(q.val) && { borderColor: routeDef.themeColor, backgroundColor: routeDef.themeColor + '11' }]}
              >
                <Text variant="caption" color={amount === String(q.val) ? routeDef.themeColor : '#4B5563'} weight="bold">
                  {q.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Info & Warnings */}
          {numAmount > sourceBalance && (
            <View style={styles.warnCard}>
              <AlertCircle size={20} color="#EF4444" />
              <Text variant="body" color="#B91C1C" weight="bold">
                رصيدك الحالي لا يكفي لإتمام هذه العملية
              </Text>
            </View>
          )}

          {activeRoute === 'coins_to_pearls' && numAmount > 0 && numAmount < calc.rate && (
            <View style={[styles.warnCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
              <Info size={20} color="#D97706" />
              <Text variant="body" color="#92400E" weight="bold">
                الحد الأدنى للتحويل هو {calc.rate.toLocaleString()} كوينز لربح 1 ماسة
              </Text>
            </View>
          )}

          <Pressable
            onPress={() => router.push('/wallet/transfer' as any)}
            style={styles.transferLink}
          >
            <Text variant="caption" color="#6B7280" weight="bold">
              {t('wallet.transferToUser')} ←
            </Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Massive CTA Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={handleExchange}
          disabled={!canExchange}
          style={({ pressed }) => [
            styles.massiveBtn,
            !canExchange && styles.massiveBtnDisabled,
            pressed && canExchange && { opacity: 0.92 },
          ]}
        >
          <LinearGradient
            colors={canExchange ? routeDef.gradient : ['#D1D5DB', '#9CA3AF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.massiveBtnContent}>
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text
                variant="button"
                weight="bold"
                color="#fff"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={styles.massiveBtnText}
              >
                {calc.received > 0
                  ? `استبدال بـ ${calc.received.toLocaleString()} ${targetLabel}`
                  : 'أدخل المبلغ أولاً'}
              </Text>
            )}
          </View>
        </Pressable>
      </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    zIndex: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
  },
  screenTabsWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  screenTabs: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 14,
    padding: 4,
  },
  screenTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 11,
  },
  screenTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  balancesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  balancesRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  balanceChip: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  balanceChipIcon: {
    width: 26,
    height: 26,
    marginBottom: 6,
  },
  balanceLabel: {
    textAlign: 'center',
    marginBottom: 2,
    width: '100%',
  },
  balanceAmount: {
    textAlign: 'center',
    width: '100%',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: lu.fonts.displayHeavy,
    paddingHorizontal: 2,
  },
  routesScroll: {
    paddingBottom: 16,
    gap: 12,
  },
  routeCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  routeCardActive: {
    borderWidth: 0,
    shadowColor: '#E11414',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  routeCardContent: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 8,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 6,
  },
  swapBlock: {
    padding: 20,
    borderRadius: 24,
  },
  swapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  swapInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hugeInput: {
    flex: 1,
    fontFamily: lu.fonts.displayHeavy,
    fontSize: 40,
    color: '#111827',
    paddingVertical: 0,
    textAlign: 'left',
  },
  currencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  swapDivider: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    zIndex: 10,
  },
  swapDividerLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  swapArrowCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  quickGlassChip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  warnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
  },
  transferLink: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 16,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  massiveBtn: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  massiveBtnDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  massiveBtnContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  massiveBtnText: {
    textAlign: 'center',
    letterSpacing: 0.3,
    fontSize: 16,
  },
});
