/**
 * LinkUp — أرستقراطيتي (السجل + استلام العائد)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView, Pressable, Alert, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from '@/components/ui/RtlIcons';
import { Image } from 'expo-image';

import { Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { WALLET_ASSETS } from '@/components/wallet/walletDesign';
import { useLightStatusBarOnFocus } from '@/hooks/useLightStatusBarOnFocus';
import {
  readAristocracyState,
  isAristocracyActive,
  getAristocracyLevel,
  claimAristocracyCoinReturns,
  syncAristocracyFrozenReturns,
  toggleAristocracyAutoRenew,
} from '@/services/firebase/aristocracySystem';

export default function MyAristocracyScreen() {
  // شاشة داكنة الخلفية/الرأس — أيقونات شريط الحالة فاتحة أثناء التركيز فقط
  useLightStatusBarOnFocus();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { aristocracy: config } = useConfig();
  const isAr = i18n.language?.startsWith('ar');

  const [claiming, setClaiming] = useState(false);
  const [togglingRenew, setTogglingRenew] = useState(false);

  const state = useMemo(
    () =>
      readAristocracyState({
        aristocracy: user?.aristocracy,
        aristocracyLevel: user?.aristocracyLevel,
        aristocracyExpiresAt: user?.aristocracyExpiresAt,
        aristocracyPendingReturns: user?.aristocracyPendingReturns,
        aristocracyFrozenReturns: user?.aristocracyFrozenReturns,
        aristocracyAutoRenew: user?.aristocracyAutoRenew,
      }),
    [user],
  );

  const active = isAristocracyActive(state);
  const levelDef = state.level > 0 ? getAristocracyLevel(config, state.level) : undefined;
  const canAutoRenew = active && (levelDef?.allowRenewal !== false);
  const levelName = levelDef ? (isAr ? levelDef.nameAr : levelDef.nameEn) : '';

  useEffect(() => {
    void syncAristocracyFrozenReturns().then(() => refreshUser?.());
  }, []);

  const handleClaim = useCallback(async () => {
    setClaiming(true);
    try {
      const amount = await claimAristocracyCoinReturns();
      await refreshUser?.();
      Alert.alert(t('common.success'), t('aristocracy.claimedReturn', { amount: amount.toLocaleString('en-US') }));
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.errorOccurred'));
    } finally {
      setClaiming(false);
    }
  }, [refreshUser, t]);

  const handleAutoRenew = useCallback(
    async (val: boolean) => {
      setTogglingRenew(true);
      try {
        await toggleAristocracyAutoRenew(val);
        await refreshUser?.();
      } catch (e: unknown) {
        Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.errorOccurred'));
      } finally {
        setTogglingRenew(false);
      }
    },
    [refreshUser, t],
  );

  return (
    <View style={styles.fill}>
      <LinearGradient colors={['#1A0A0C', '#0E0E11', '#0A0405']} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.autoRow}>
          <Switch
            value={canAutoRenew ? state.autoRenew : false}
            onValueChange={handleAutoRenew}
            disabled={togglingRenew || !canAutoRenew}
            trackColor={{ true: '#E11414', false: '#444' }}
          />
          <Text style={styles.autoLabel}>{t('aristocracy.autoRenew')}</Text>
        </View>
        <Text style={styles.headerTitle}>{t('aristocracy.myAristocracy')}</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ChevronLeft size={22} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingHorizontal: 16 }}>
        <LinearGradient colors={['#7A0A0A', '#3A0A0A', '#E11414']} style={styles.statusCard}>
          <Text style={styles.statusMain}>
            {active
              ? t('aristocracy.currentLevel', { name: levelName })
              : t('aristocracy.noAristocracyYet')}
          </Text>
          {active && state.expiresAt && (
            <Text style={styles.statusSub}>
              {t('aristocracy.activeUntil', {
                date: new Date(state.expiresAt).toLocaleDateString(isAr ? 'ar' : 'en-US'),
              })}
            </Text>
          )}

          <View style={styles.returnsRow}>
            <Text style={styles.returnsLabel}>{t('aristocracy.unclaimedReturns')}</Text>
            <View style={styles.returnsVal}>
              <Image source={WALLET_ASSETS.coin} style={styles.coin} contentFit="contain" />
              <Text style={styles.returnsNum}>{state.pendingReturns.toLocaleString('en-US')}</Text>
            </View>
          </View>

          {state.pendingReturns > 0 && active && (
            <Pressable style={styles.claimBtn} onPress={handleClaim} disabled={claiming}>
              {claiming ? (
                <ActivityIndicator color="#1A0A0C" />
              ) : (
                <Text style={styles.claimBtnText}>{t('aristocracy.claimReturns')}</Text>
              )}
            </Pressable>
          )}

          {state.frozenReturns > 0 && (
            <Text style={styles.frozenHint}>
              {t('aristocracy.frozenReturns', { amount: state.frozenReturns.toLocaleString('en-US') })}
            </Text>
          )}
        </LinearGradient>
        {active && levelDef?.allowRenewal === false && (
          <Text style={styles.frozenHint}>
            {isAr ? 'هذا المستوى بدون تجديد تلقائي' : 'This tier does not support auto-renew'}
          </Text>
        )}

        <View style={styles.historyBox}>
          <Text style={styles.historyTitle}>• {t('aristocracy.history')} •</Text>
          <Text style={styles.emptyHistory}>{t('aristocracy.noHistory')}</Text>
        </View>
      </ScrollView>

      {!active && (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable style={styles.activateNow} onPress={() => router.replace('/vip/aristocracy' as any)}>
            <Text style={styles.activateNowText}>{t('aristocracy.activateNow')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  autoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  autoLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },

  statusCard: { borderRadius: 20, padding: 20, marginBottom: 16 },
  statusMain: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  statusSub: { color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 6, fontSize: 13 },
  returnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  returnsLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  returnsVal: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  returnsNum: { color: '#FFD700', fontWeight: '900', fontSize: 18 },
  coin: { width: 20, height: 20 },
  claimBtn: {
    marginTop: 14,
    backgroundColor: '#FFE08A',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  claimBtnText: { color: '#1A0A0C', fontWeight: '800' },
  frozenHint: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 10, textAlign: 'center' },

  historyBox: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 200,
    alignItems: 'center',
  },
  historyTitle: { color: 'rgba(255,255,255,0.6)', fontWeight: '700', marginBottom: 24 },
  emptyHistory: { color: 'rgba(255,255,255,0.45)', fontSize: 14 },

  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  activateNow: {
    backgroundColor: '#FFE08A',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activateNowText: { color: '#1A0A0C', fontWeight: '900', fontSize: 16 },
});
