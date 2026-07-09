/**
 * سجل معاملات الكوينز — مطابق لشاشة المنافس
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ChevronLeft } from '@/components/ui/RtlIcons';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { WALLET_ASSETS, WALLET_DESIGN } from '@/components/wallet/walletDesign';
import { subscribeToUserTransactions, type Transaction } from '@/services/firebase/shop';

function formatTxTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function txLabel(tx: Transaction, t: (k: string) => string): string {
  if (tx.itemName) return tx.itemName;
  switch (tx.type) {
    case 'recharge':
      return t('wallet.txRecharge');
    case 'gift_sent':
      return t('wallet.txGiftSent');
    case 'gift_received':
      return t('wallet.txGiftReceived');
    case 'withdraw':
      return t('wallet.txWithdraw');
    case 'purchase':
      return t('wallet.txPurchase');
    default:
      return tx.type;
  }
}

export default function CoinsHistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToUserTransactions(80, (data) => {
      setTxs(data.filter((x) => x.currency === 'coins'));
      setLoading(false);
    });
    return unsub;
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of txs) {
      const key = monthKey(tx.createdAt ?? 0);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    return [...map.entries()];
  }, [txs]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text weight="bold" style={styles.headerTitle}>{t('wallet.coinsHistory')}</Text>
        <Text style={styles.headerUnit}>{t('wallet.coinsUnit')}</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={22} color={WALLET_DESIGN.ink} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={WALLET_DESIGN.purple} />
        </View>
      ) : txs.length === 0 ? (
        <View style={styles.loading}>
          <Text style={styles.empty}>{t('wallet.coinsHistoryEmpty')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {grouped.map(([month, items]) => (
            <View key={month}>
              <Text style={styles.monthHeader}>{month}</Text>
              {items.map((tx) => {
                const positive = tx.amount > 0;
                return (
                  <View key={tx.id} style={styles.row}>
                    <View style={styles.rowLeft}>
                      <Image source={WALLET_ASSETS.coin} style={styles.coinIcon} contentFit="contain" />
                      <Text
                        weight="bold"
                        style={[styles.amount, positive ? styles.amountPos : styles.amountNeg]}
                      >
                        {positive ? '+' : ''}{tx.amount.toLocaleString('en-US')}
                      </Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.txTitle} numberOfLines={2}>
                        {txLabel(tx, t)}
                      </Text>
                      <Text style={styles.txTime}>{formatTxTime(tx.createdAt ?? 0)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: WALLET_DESIGN.line,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    color: WALLET_DESIGN.ink,
    includeFontPadding: false,
  },
  headerUnit: { fontSize: 12, color: WALLET_DESIGN.muted, marginEnd: 8 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  empty: { color: WALLET_DESIGN.muted, fontSize: 14 },
  monthHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 12,
    color: WALLET_DESIGN.muted,
    backgroundColor: '#F9FAFB',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WALLET_DESIGN.line,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 100 },
  coinIcon: { width: 28, height: 28 },
  amount: { fontSize: 15, includeFontPadding: false },
  amountPos: { color: WALLET_DESIGN.gold2 },
  amountNeg: { color: WALLET_DESIGN.ink },
  rowRight: { flex: 1, alignItems: 'flex-end', marginStart: 12 },
  txTitle: { fontSize: 13, color: WALLET_DESIGN.ink },
  txTime: { fontSize: 11, color: WALLET_DESIGN.muted, marginTop: 4 },
});
