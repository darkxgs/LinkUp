/**
 * شحن العملات — LinkUp
 * طلب شحن عبر بوت LinkUp (أو بوابة دفع عند التفعيل)
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
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { FileText, Headphones, ChevronDown, Sparkles } from 'lucide-react-native';
import { ChevronLeft } from '@/components/ui/RtlIcons';

import { Text, RealCountryFlag, CountryPickerSheet } from '@/components/ui';
import { getCountryByCode } from '@/data/countries';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { rechargeCoins } from '@/services/firebase/shop';
import { isRegularAccount } from '@/services/firebase/firstRechargeBonus';
import { getDisplayAccountId } from '@/services/userIdentifier';
import { RECHARGE_BOT_UID, sendRechargeBotPackageRequest } from '@/services/rechargeBot';
import { lu } from '@/theme/lu-brand';
import { WALLET_ASSETS, WALLET_DESIGN } from '@/components/wallet/walletDesign';
import type { RechargePackage } from '@/services/firebase/config';
import { findRechargePackageTag, getRechargePackageTagLabel } from '@/utils/rechargePackageTags';

const COLS = 3;
const COL_GAP = 10;
const H_PAD = 16;

function formatCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  return n.toLocaleString('en-US');
}

function resolveUserCountryCode(user: { profile?: { country?: string }; country?: string } | null): string {
  const raw = (user?.profile?.country ?? user?.country ?? 'SA').trim().toUpperCase();
  if (raw.length === 2 && getCountryByCode(raw)) return raw;
  const byName = getCountryByCode(raw);
  if (byName) return byName.code;
  return 'SA';
}

function getCountryLabel(code: string, lang: string, t: (key: string, opts?: { defaultValue?: string }) => string): string {
  if (lang.startsWith('en')) {
    const translated = t(`countries.${code}`, { defaultValue: '' });
    if (translated && !translated.startsWith('countries.')) return translated;
  }
  return getCountryByCode(code)?.name ?? code;
}

export default function RechargeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { user, updateUserData } = useAuth();
  const { rechargePackages, rechargePackageTags, settings } = useConfig();

  const inAppEnabled = settings.inAppRechargeEnabled === true;
  const showFirstRechargeHint =
    isRegularAccount({
      isAgent: user?.isAgent,
      isFemaleHost: user?.isFemaleHost,
      agencyRole: user?.agencyRole,
    }) && user?.firstRechargeBonusClaimed !== true;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [countryCode, setCountryCode] = useState('SA');
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);

  useEffect(() => {
    setCountryCode(resolveUserCountryCode(user));
  }, [user?.profile?.country, user?.country]);

  const coins = user?.stats?.coins ?? 0;
  const accountId = useMemo(
    () => getDisplayAccountId(user?.publicAccountId, user?.uid ?? ''),
    [user?.publicAccountId, user?.uid],
  );

  const packages = rechargePackages;
  const selected = packages.find((p) => p.id === selectedId) ?? packages[0] ?? null;
  const cardW = Math.floor((W - H_PAD * 2 - COL_GAP * (COLS - 1)) / COLS);
  const countryLabel = useMemo(
    () => getCountryLabel(countryCode, i18n.language, t),
    [countryCode, i18n.language, t],
  );

  const startBotRecharge = useCallback(async (pkg: RechargePackage) => {
    if (!user) return;
    setProcessing(true);
    try {
      await sendRechargeBotPackageRequest({
        publicAccountId: accountId,
        displayName: user.profile?.displayName ?? '',
        currentCoins: coins,
        countryCode,
        countryName: getCountryLabel(countryCode, i18n.language, t),
        pkg: {
          id: pkg.id,
          coins: pkg.coins,
          bonus: pkg.bonus,
          priceUSD: pkg.priceUSD,
        },
      });
      router.push(`/chat/${RECHARGE_BOT_UID}` as any);
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : '';
      const msg = raw.includes('permission') || raw.includes('Permission')
        ? t('wallet.rechargePermissionError')
        : (raw || t('common.errorOccurred'));
      Alert.alert(t('common.error'), msg);
    } finally {
      setProcessing(false);
    }
  }, [user, accountId, coins, countryCode, i18n.language, router, t]);

  const handleRecharge = async () => {
    // منع تكديس نوافذ التأكيد بالنقر المزدوج قبل أن يعمل disabled (مسار مال حقيقي)
    if (processing) return;
    if (!selected || !user) return;

    if (inAppEnabled) {
      Alert.alert(
        t('store.purchaseConfirm'),
        t('wallet.rechargeConfirmMsg', {
          coins: (selected.coins + (selected.bonus ?? 0)).toLocaleString('en-US'),
          price: selected.priceUSD,
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('wallet.recharge'),
            onPress: async () => {
              setProcessing(true);
              try {
                const total = selected.coins + (selected.bonus ?? 0);
                const { firstRechargeBonus } = await rechargeCoins(selected.id, total, selected.priceUSD);
                const credited = total + firstRechargeBonus;
                await updateUserData({
                  stats: { ...(user.stats ?? {}), coins: coins + credited } as any,
                });
                Alert.alert(
                  t('common.success'),
                  firstRechargeBonus > 0
                    ? t('wallet.rechargeSuccessWithBonus', {
                        count: total,
                        bonus: firstRechargeBonus.toLocaleString('en-US'),
                      })
                    : t('wallet.rechargeSuccess', { count: total }),
                );
              } catch (e: unknown) {
                Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.errorOccurred'));
              } finally {
                setProcessing(false);
              }
            },
          },
        ],
      );
      return;
    }

    await startBotRecharge(selected);
  };

  const balanceStr = coins.toLocaleString('en-US');
  const balanceCompact = balanceStr.length > 12;

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[...WALLET_DESIGN.rechargeHeader]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerBg, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.push('/wallet/coins-history' as any)}
            style={styles.headIconBtn}
            hitSlop={8}
          >
            <FileText size={20} color="#fff" strokeWidth={2.2} />
          </Pressable>
          <Text weight="bold" style={styles.headerTitle}>{t('wallet.recharge')}</Text>
          <Pressable onPress={() => router.back()} style={styles.headIconBtn} hitSlop={8}>
            <ChevronLeft size={22} color="#fff" strokeWidth={2.5} />
          </Pressable>
        </View>

        <View style={styles.balanceCard}>
          <Image source={WALLET_ASSETS.coinBg} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          <View style={styles.balanceRowInside}>
            <Image source={WALLET_ASSETS.coin} style={styles.coinHero} contentFit="contain" />
            <View style={styles.balanceCol}>
              <Text style={styles.balanceLabel}>{t('wallet.balance')}</Text>
              <Text
                weight="bold"
                style={[styles.balanceValue, balanceCompact && styles.balanceValueCompact]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.55}
              >
                {balanceStr}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push(`/chat/${RECHARGE_BOT_UID}` as any)}
              style={styles.supportFab}
              hitSlop={8}
            >
              <Headphones size={18} color={WALLET_DESIGN.gold2} strokeWidth={2.2} />
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
        >
          <Text weight="bold" style={styles.sectionTitle}>{t('wallet.rechargeCoinsTab')}</Text>

          <Pressable onPress={() => router.push('/vip' as any)} style={styles.vipBanner}>
            <LinearGradient
              colors={[...WALLET_DESIGN.vipBanner]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Sparkles size={15} color={WALLET_DESIGN.gold} style={{ flexShrink: 0 }} />
            <Text style={styles.vipBannerText} numberOfLines={2}>
              {t('wallet.rechargeVipPromo')}
            </Text>
            <View style={styles.vipJoinBtn}>
              <Text weight="bold" style={styles.vipJoinText}>{t('wallet.rechargeVipJoin')}</Text>
            </View>
          </Pressable>

          {showFirstRechargeHint ? (
            <View style={styles.firstBonusBanner}>
              <Sparkles size={14} color={WALLET_DESIGN.gold} style={{ flexShrink: 0 }} />
              <Text style={styles.firstBonusText}>{t('wallet.firstRechargeBonusHint')}</Text>
            </View>
          ) : null}

          <View style={[styles.pkgGrid, { gap: COL_GAP }]}>
            {packages.map((pkg) => {
              const active = (selectedId ?? packages[0]?.id) === pkg.id;
              const showFull = pkg.coins < 100_000;
              const tag = findRechargePackageTag(rechargePackageTags, pkg.tagId);
              const tagLabel = getRechargePackageTagLabel(tag, i18n.language);
              return (
                <Pressable
                  key={pkg.id}
                  onPress={() => setSelectedId(pkg.id)}
                  style={[
                    styles.pkgCard,
                    { width: cardW, minHeight: cardW * 1.05 },
                    tag?.borderColor ? { borderColor: tag.borderColor, borderWidth: 2 } : null,
                    active && styles.pkgCardActive,
                  ]}
                >
                  {tag && tagLabel ? (
                    <View style={[styles.weeklyRibbon, tag.color ? { backgroundColor: tag.color } : null]}>
                      <Text style={styles.weeklyRibbonText} numberOfLines={1}>
                        {tag.emoji ? `${tag.emoji} ` : ''}{tagLabel}
                      </Text>
                    </View>
                  ) : null}
                  <Image source={WALLET_ASSETS.coin} style={styles.pkgCoin} contentFit="contain" />
                  <Text
                    weight="bold"
                    style={styles.pkgCoins}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {showFull ? pkg.coins.toLocaleString('en-US') : formatCoins(pkg.coins)}
                  </Text>
                  {pkg.bonus ? (
                    <Text style={styles.pkgBonus} numberOfLines={1}>
                      +{formatCoins(pkg.bonus)}
                    </Text>
                  ) : (
                    <View style={styles.pkgBonusSpacer} />
                  )}
                  <Text style={[styles.pkgPrice, active && styles.pkgPriceActive]} numberOfLines={1}>
                    USD {pkg.priceUSD}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.channelLabel}>{t('wallet.rechargeChannel')}</Text>
          <Pressable
            style={({ pressed }) => [styles.channelPicker, pressed && styles.channelPickerPressed]}
            onPress={() => setCountryPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('wallet.rechargeCountryPicker')}
            hitSlop={8}
          >
            <RealCountryFlag countryCode={countryCode} size={22} shape="rectangle" />
            <Text style={styles.channelText} numberOfLines={1}>{countryLabel}</Text>
            <ChevronDown size={16} color={WALLET_DESIGN.muted} />
          </Pressable>

          <Text style={styles.secureNote}>{t('wallet.rechargeSecure')}</Text>

          <Pressable
            onPress={() => router.push('/wallet/recharge-problem' as any)}
            style={styles.problemLink}
          >
            <Text style={styles.problemLinkText}>{t('wallet.rechargeProblem')}</Text>
          </Pressable>
        </ScrollView>
      </View>

      {selected ? (
        <View
          style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() => void handleRecharge()}
            disabled={processing}
            style={[styles.rechargeBtn, processing && { opacity: 0.75 }]}
          >
            <LinearGradient
              colors={[lu.colors.pink, lu.colors.purple]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text weight="bold" style={styles.rechargeBtnText} numberOfLines={1}>
                {inAppEnabled
                  ? t('wallet.rechargePay', { price: selected.priceUSD })
                  : t('wallet.rechargeRequest', { price: selected.priceUSD })}
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}

      <CountryPickerSheet
        visible={countryPickerOpen}
        title={t('wallet.rechargeCountryPicker')}
        selectedCode={countryCode}
        onSelect={(country) => {
          setCountryCode(country.code);
          setCountryPickerOpen(false);
        }}
        onClose={() => setCountryPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FCFAFA' },
  headerBg: {
    paddingHorizontal: H_PAD,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    color: '#fff',
    includeFontPadding: false,
    lineHeight: 26,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  supportFab: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  coinHero: { width: 64, height: 64, flexShrink: 0 },
  balanceCol: {
    flex: 1,
    alignItems: 'flex-end',
    minWidth: 0,
  },
  balanceLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.92)',
    includeFontPadding: false,
    lineHeight: 18,
  },
  balanceValue: {
    fontSize: 32,
    color: '#fff',
    fontFamily: lu.fonts.displayHeavy,
    includeFontPadding: false,
    lineHeight: 40,
    maxWidth: '100%',
  },
  balanceValueCompact: { fontSize: 24, lineHeight: 32 },
  balanceCard: {
    height: 100,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 16,
    position: 'relative',
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    ...lu.shadows.card,
  },
  balanceRowInside: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  body: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    marginTop: -14,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 15,
    color: WALLET_DESIGN.ink,
    textAlign: 'center',
    paddingTop: 16,
    paddingBottom: 4,
    includeFontPadding: false,
    lineHeight: 22,
  },
  vipBanner: {
    marginHorizontal: H_PAD,
    marginTop: 10,
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 48,
  },
  vipBannerText: {
    flex: 1,
    flexShrink: 1,
    color: WALLET_DESIGN.gold,
    fontSize: 12.5,
    lineHeight: 18,
    includeFontPadding: false,
  },
  vipJoinBtn: {
    flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
  },
  vipJoinText: {
    fontSize: 11,
    color: '#fff',
    includeFontPadding: false,
    lineHeight: 16,
  },
  firstBonusBanner: {
    marginHorizontal: H_PAD,
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  firstBonusText: {
    flex: 1,
    color: WALLET_DESIGN.gold2,
    fontSize: 12,
    lineHeight: 17,
    includeFontPadding: false,
  },
  pkgGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: H_PAD,
    paddingTop: 14,
    justifyContent: 'flex-start',
  },
  pkgCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: WALLET_DESIGN.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    paddingTop: 14,
    ...lu.shadows.card,
  },
  pkgCardActive: {
    borderColor: WALLET_DESIGN.selectedBorder,
    borderWidth: 2,
  },
  weeklyRibbon: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    backgroundColor: WALLET_DESIGN.botBadge,
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    alignItems: 'center',
  },
  weeklyRibbonText: {
    fontSize: 7.5,
    color: '#fff',
    fontWeight: '700',
    includeFontPadding: false,
    lineHeight: 11,
    textAlign: 'center',
  },
  pkgCoin: { width: 26, height: 26, marginBottom: 6 },
  pkgCoins: {
    fontSize: 14,
    color: WALLET_DESIGN.ink,
    includeFontPadding: false,
    lineHeight: 20,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 2,
  },
  pkgBonus: {
    fontSize: 9,
    color: WALLET_DESIGN.mint,
    marginTop: 2,
    includeFontPadding: false,
    lineHeight: 13,
    fontWeight: '700',
  },
  pkgBonusSpacer: { height: 13, marginTop: 2 },
  pkgPrice: {
    fontSize: 10,
    color: WALLET_DESIGN.muted,
    marginTop: 8,
    includeFontPadding: false,
    lineHeight: 14,
    fontWeight: '600',
  },
  pkgPriceActive: { color: WALLET_DESIGN.pink, fontWeight: '800' },
  channelLabel: {
    marginHorizontal: H_PAD,
    marginTop: 18,
    fontSize: 13,
    color: WALLET_DESIGN.ink2,
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
    lineHeight: 20,
  },
  channelPicker: {
    marginHorizontal: H_PAD,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: WALLET_DESIGN.line,
    zIndex: 2,
  },
  channelPickerPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  channelText: {
    flex: 1,
    fontSize: 14,
    color: WALLET_DESIGN.ink,
    includeFontPadding: false,
    lineHeight: 20,
  },
  secureNote: {
    textAlign: 'center',
    marginTop: 16,
    marginHorizontal: 20,
    fontSize: 11,
    color: WALLET_DESIGN.muted,
    lineHeight: 17,
    includeFontPadding: false,
  },
  problemLink: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  problemLinkText: {
    fontSize: 13,
    color: WALLET_DESIGN.purple,
    textDecorationLine: 'underline',
    includeFontPadding: false,
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    paddingHorizontal: H_PAD,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: WALLET_DESIGN.line,
    ...lu.shadows.card,
  },
  rechargeBtn: {
    borderRadius: 99,
    overflow: 'hidden',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  rechargeBtnText: {
    color: '#fff',
    fontSize: 15,
    includeFontPadding: false,
    lineHeight: 22,
    textAlign: 'center',
  },
});
