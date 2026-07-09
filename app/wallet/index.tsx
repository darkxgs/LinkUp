/**
 * Wallet — Redesigned with LinkUp brand
 * Source: /tmp/design2/test/project/app/screens/wallet.jsx
 * يحافظ على:
 *  - useAuthStore (stats.coins/pearls/casinoCoins)
 *  - الروابط: /wallet/recharge, /wallet/withdraw, /gifts
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowDownRight, Gift, ArrowLeftRight, Gem, Dice5 } from 'lucide-react-native';
import { ChevronLeft, ArrowUpRight } from '@/components/ui/RtlIcons';

import { lu } from '@/theme/lu-brand';
import { useAuthStore } from '@/stores/authStore';
import { useConfig } from '@/contexts/ConfigContext';
import { subscribeToUserTransactions, type Transaction } from '@/services/firebase/shop';
import { formatRelativeTime } from '@/utils/relativeTime';
import { Image } from 'expo-image';
import { formatCasinoCoins } from '@/utils/casinoCoins';
import { WALLET_ASSETS } from '@/components/wallet/walletDesign';

export default function WalletScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const user = useAuthStore((s) => s.user);
  const { settings } = useConfig();
  const inAppRecharge = settings.inAppRechargeEnabled === true;
  const isSmall = W < 360;

  const stats = user?.stats ?? { coins: 0, pearls: 0, casinoCoins: 0 } as any;
  const coins = stats.coins ?? 0;
  const pearls = stats.pearls ?? 0;
  const casino = stats.casinoCoins ?? 0;
  const [recentTxs, setRecentTxs] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeToUserTransactions(10, (txs) => {
      setRecentTxs(txs.filter((x) => x.currency === 'coins').slice(0, 3));
    });
  }, [user?.uid]);

  const txLabel = (tx: Transaction): string => {
    if (tx.itemName) return tx.itemName;
    if (tx.type === 'recharge') return t('wallet.txRecharge');
    if (tx.type === 'gift_sent') return t('wallet.txGiftSent');
    if (tx.type === 'purchase') return t('wallet.txPurchase');
    return tx.type;
  };

  return (
    <LinearGradient
      colors={lu.gradients.pageProfile}
      locations={[0, 0.3]}
      style={{ flex: 1 }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 24,
        }}
      >
        {/* ===== Header ===== */}
        <View style={[styles.header, { paddingHorizontal: isSmall ? 14 : 18 }]}>
          <Text style={styles.headerTitle}>{t('wallet.title')}</Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <ChevronLeft size={22} color={lu.colors.ink} />
          </Pressable>
        </View>

        {/* ===== Hero coins card ===== */}
        <View style={{ paddingHorizontal: isSmall ? 14 : 16 }}>
          <View style={styles.heroCard}>
            <Image
              source={WALLET_ASSETS.coinBg}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
            />
            <View style={styles.heroIcon}>
              <Image source={WALLET_ASSETS.coin} style={{ width: 64, height: 64 }} contentFit="contain" />
            </View>
            <Text style={styles.heroLabel}>{t('wallet.text67461')}</Text>
            <Text style={styles.heroValue}>
              {coins.toLocaleString('en-US')}
            </Text>
            <Pressable
              onPress={() => router.push('/wallet/recharge' as any)}
              style={({ pressed }) => [styles.heroBtn, pressed && { opacity: 0.85 }]}
            >
              <ArrowUpRight size={16} color={lu.colors.purple} />
              <Text style={styles.heroBtnText}>
                {inAppRecharge ? t('wallet.rechargeNow') : t('wallet.rechargeViaAdmin')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ===== Two smaller wallets (Casino + Pearls) ===== */}
        <View style={[styles.twoRow, { paddingHorizontal: isSmall ? 14 : 16 }]}>
          <View style={styles.miniWallet}>
            <Image source={WALLET_ASSETS.casino} style={{ width: 44, height: 44, marginBottom: 8 }} contentFit="contain" />
            <Text style={styles.miniLabel}>{t('wallet.text51237')}</Text>
            <Text style={styles.miniValue}>{formatCasinoCoins(casino)}</Text>
            <Pressable
              onPress={() => router.push('/wallet/exchange' as any)}
              style={({ pressed }) => [styles.miniBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.miniBtnText}>{t('wallet.exchange')}</Text>
            </Pressable>
          </View>

          <View style={styles.miniWallet}>
            <Image source={WALLET_ASSETS.pearls} style={{ width: 44, height: 44, marginBottom: 8 }} contentFit="contain" />
            <Text style={styles.miniLabel}>{t('wallet.text95769')}</Text>
            <Text style={styles.miniValue}>
              {/* toLocaleString على ناتج toFixed (نص) لا يفعل شيئاً — الفواصل كانت تضيع */}
              {Number(pearls.toFixed(2)).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
            <Pressable
              onPress={() => router.push('/wallet/exchange?tab=withdraw' as any)}
              style={({ pressed }) => [styles.miniBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.miniBtnText}>{t('wallet.withdraw')}</Text>
            </Pressable>
          </View>
        </View>

        {/* ===== Quick actions ===== */}
        <View style={[styles.quickCard, { marginHorizontal: isSmall ? 14 : 16 }]}>
          <Text style={styles.sectionTitle}>{t('wallet.text89833')}</Text>
          <View style={styles.quickRow}>
            <QuickAction
              Icon={Gift}
              label={t('wallet.quickGift')}
              bg="#FFE6E9"
              color={lu.colors.pink}
              onPress={() => router.push('/gifts' as any)}
            />
            <QuickAction
              Icon={ArrowLeftRight}
              label={t('wallet.exchange')}
              bg="#FEE2E2"
              color={lu.colors.purple}
              onPress={() => router.push('/wallet/exchange' as any)}
            />
            <QuickAction
              Icon={ArrowUpRight}
              label={t('wallet.withdraw')}
              bg="#FDEAEA"
              color={lu.colors.blue}
              onPress={() => router.push('/wallet/exchange?tab=withdraw' as any)}
            />
            <QuickAction
              Icon={ArrowDownRight}
              label={t('wallet.recharge')}
              bg="#E0FFF1"
              color={lu.colors.mint}
              onPress={() => router.push('/wallet/recharge' as any)}
            />
          </View>
        </View>

        {/* ===== Recent transactions ===== */}
        <View style={[styles.txCard, { marginHorizontal: isSmall ? 14 : 16 }]}>
          <View style={styles.txHeader}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('wallet.text12481')}</Text>
            <Pressable
              onPress={() => router.push('/wallet/coins-history' as any)}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.viewAll}>{t('common.viewAll')}</Text>
            </Pressable>
          </View>

          {recentTxs.length === 0 ? (
            <Text style={styles.emptyTx}>{t('wallet.noTransactions')}</Text>
          ) : (
            recentTxs.map((tx, i) => (
              <TxRow
                key={tx.id}
                label={txLabel(tx)}
                time={formatRelativeTime(tx.createdAt ?? Date.now())}
                amount={tx.amount}
                currency={tx.currency}
                kind={tx.type === 'recharge' ? 'recharge' : tx.type === 'gift_sent' ? 'gift' : 'spend'}
                isLast={i === recentTxs.length - 1}
              />
            ))
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

// ============ Sub-components ============
function QuickAction({
  Icon, label, bg, color, onPress,
}: {
  Icon: typeof Gift; label: string; bg: string; color: string; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.quickItem, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.quickIcon, { backgroundColor: bg }]}>
        <Icon size={22} color={color} strokeWidth={2.2} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function TxRow({
  label, time, amount, kind, isLast, currency,
}: {
  label: string; time: string; amount: number;
  kind: 'gift' | 'recharge' | 'win' | 'spend';
  isLast?: boolean;
  currency?: string;
}) {
  const isPositive = amount > 0;
  const iconBg = kind === 'gift' ? '#FFE6E9' :
    kind === 'recharge' ? '#E0FFF1' :
      kind === 'win' ? '#FFF1E0' : '#FEE2E2';
  const iconColor = kind === 'gift' ? lu.colors.pink :
    kind === 'recharge' ? lu.colors.mint :
      kind === 'win' ? lu.colors.gold2 : lu.colors.purple;
  const Icon = kind === 'gift' ? Gift :
    kind === 'recharge' ? ArrowDownRight :
      kind === 'win' ? Dice5 : ArrowUpRight;

  return (
    <View
      style={[
        styles.txRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: lu.colors.line },
      ]}
    >
      <View style={[styles.txIcon, { backgroundColor: iconBg }]}>
        <Icon size={18} color={iconColor} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.txLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.txTime}>{time}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={[
          styles.txAmount,
          { color: isPositive ? lu.colors.mint : lu.colors.live },
        ]}>
          {isPositive ? '+' : ''}{amount.toLocaleString()}
        </Text>
        <Image
          source={currency === 'pearls' ? WALLET_ASSETS.pearls : WALLET_ASSETS.coin}
          style={{ width: 16, height: 16 }}
          contentFit="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingBottom: 14,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyHeavy,
  },
  backBtn: {
    position: 'absolute',
    right: 18,
    top: 6,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    ...lu.shadows.card,
  },

  // Hero
  heroCard: {
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
    ...lu.shadows.grad,
  },
  heroIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  heroLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.9,
    fontFamily: lu.fonts.bodyMedium,
  },
  heroValue: {
    fontFamily: lu.fonts.displayHeavy,
    color: '#fff',
    fontSize: 38,
    lineHeight: 46,
    includeFontPadding: false,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 4,
  },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 99,
    marginTop: 14,
  },
  heroBtnText: {
    color: lu.colors.purple,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  heroGlow: {
    position: 'absolute',
    right: -30, top: -30,
    width: 120, height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  // Two mini wallets
  twoRow: {
    flexDirection: 'row',
    gap: 11,
    marginTop: 12,
  },
  miniWallet: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  miniWalletIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  miniLabel: {
    fontSize: 12,
    color: lu.colors.muted,
    fontFamily: lu.fonts.body,
  },
  miniValue: {
    fontSize: 20,
    fontWeight: '800',
    color: lu.colors.ink,
    marginTop: 4,
    fontFamily: lu.fonts.bodyHeavy,
  },
  miniBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 99,
    marginTop: 8,
  },
  miniBtnText: {
    color: lu.colors.purple,
    fontSize: 11.5,
    fontWeight: '700',
    fontFamily: lu.fonts.bodyBold,
  },

  // Quick actions
  quickCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    marginTop: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyHeavy,
    marginBottom: 10,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickItem: {
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  quickIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: lu.colors.ink2,
    fontFamily: lu.fonts.bodyMedium,
  },

  // Transactions
  txCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    marginTop: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  txHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  viewAll: {
    color: lu.colors.purple,
    fontSize: 12.5,
    fontWeight: '700',
    fontFamily: lu.fonts.bodyBold,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 10,
  },
  txIcon: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  txLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyBold,
  },
  txTime: {
    fontSize: 11,
    color: lu.colors.muted,
    marginTop: 2,
    fontFamily: lu.fonts.body,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  emptyTx: {
    textAlign: 'center',
    color: lu.colors.muted,
    fontSize: 13,
    paddingVertical: 20,
    fontFamily: lu.fonts.body,
  },
});
