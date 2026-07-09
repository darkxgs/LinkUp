/**
 * ThrowLuckyBagModal — إعداد وإرسال حقيبة الحظ
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  I18nManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Gift, Users, Coins, Sparkles, Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text, useAlert } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import {
  throwLuckyBag,
  QUICK_BAG_AMOUNTS,
  QUICK_DURATIONS_MIN,
  QUICK_COUNTDOWN_MIN,
  MAX_OPENERS,
  MIN_OPENERS,
  DEFAULT_LUCKY_BAG_COUNTDOWN_MIN,
  type LuckyBagAudience,
} from '@/services/luckyBag';
import { lu } from '@/theme/lu-brand';
import { spacing } from '@/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  onSent?: (bagId: string) => void;
}

const QUICK_OPENERS = [3, 5, 10, 15, 20];
const AUDIENCE_OPTIONS: LuckyBagAudience[] = ['everyone', 'followers', 'room_followers'];

export function ThrowLuckyBagModal({ visible, onClose, roomId, onSent }: Props) {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { showToast } = useAlert();

  const [amount, setAmount] = useState('');
  const [openers, setOpeners] = useState(10);
  const [durationMin, setDurationMin] = useState(15);
  const [countdownMin, setCountdownMin] = useState(DEFAULT_LUCKY_BAG_COUNTDOWN_MIN);
  const [audience, setAudience] = useState<LuckyBagAudience>('everyone');
  const [throwing, setThrowing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setErrorMsg(null);
    void refreshUser?.();
  }, [visible, refreshUser]);

  const myCoins = user?.stats?.coins ?? 0;
  const amt = Number(amount) || 0;
  const perPerson = openers > 0 ? Math.floor(amt / openers) : 0;
  const canThrow = amt >= openers && amt <= myCoins && openers >= MIN_OPENERS && !throwing;

  const resetForm = useCallback(() => {
    setAmount('');
    setOpeners(10);
    setDurationMin(15);
    setCountdownMin(DEFAULT_LUCKY_BAG_COUNTDOWN_MIN);
    setAudience('everyone');
    setErrorMsg(null);
  }, []);

  const executeThrow = useCallback(async () => {
    setThrowing(true);
    setErrorMsg(null);
    try {
      const bagId = await throwLuckyBag(roomId, {
        totalAmount: amt,
        maxOpeners: openers,
        audience,
        durationMinutes: durationMin,
        countdownMinutes: countdownMin,
      });
      resetForm();
      onClose();
      onSent?.(bagId);
      showToast(t('luckyBag.thrownSuccess'));
      void refreshUser?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('luckyBag.throwFailed');
      setErrorMsg(msg);
      Alert.alert(t('common.error'), msg);
    } finally {
      setThrowing(false);
    }
  }, [amt, audience, countdownMin, durationMin, onClose, onSent, openers, refreshUser, resetForm, roomId, showToast, t]);

  const handleThrow = () => {
    if (!canThrow) return;
    Alert.alert(
      t('luckyBag.throwConfirmTitle'),
      t('luckyBag.throwConfirmMsg', {
        amount: amt.toLocaleString(),
        openers,
        countdown: countdownMin,
        duration: durationMin,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('luckyBag.throw'), onPress: () => void executeThrow() },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.bg}>
        <View style={styles.card}>
          <LinearGradient
            colors={[lu.colors.gold, lu.colors.pink, lu.colors.purple]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Gift size={22} color="#fff" />
              <Text variant="h4" color="#fff" weight="bold">{t('luckyBag.title')}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} disabled={throwing}>
              <X size={22} color="#fff" />
            </Pressable>
          </LinearGradient>

          <ScrollView style={{ maxHeight: 540 }} contentContainerStyle={{ padding: spacing.md }}>
            <View style={styles.bagArt}>
              <LinearGradient colors={[lu.colors.gold, lu.colors.gold2]} style={styles.bagCircle}>
                <Gift size={44} color="#fff" />
                <View style={styles.sparkle1}><Sparkles size={16} color={lu.colors.gold} /></View>
              </LinearGradient>
              <Text variant="caption" color={lu.colors.ink2} align="center" style={{ marginTop: 8 }}>
                {t('luckyBag.splitHint')}
              </Text>
            </View>

            <Text variant="button" weight="bold" style={styles.label}>{t('luckyBag.totalCoins')}</Text>
            <View style={styles.amountInput}>
              <Coins size={18} color={lu.colors.gold} />
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
                placeholder="500"
                placeholderTextColor="#9A9AA5"
                style={styles.input}
              />
            </View>
            <Text variant="caption" color="#9A9AA5">{t('luckyBag.amountRange')}</Text>

            <View style={styles.quickRow}>
              {QUICK_BAG_AMOUNTS.filter((q) => q <= 10000).map((q) => (
                <Pressable
                  key={q}
                  onPress={() => setAmount(String(q))}
                  style={[styles.quickChip, amount === String(q) && styles.quickChipActive]}
                >
                  <Text variant="caption" weight="bold" color={amount === String(q) ? '#fff' : lu.colors.muted}>
                    {q >= 1000 ? `${q / 1000}K` : q}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text variant="button" weight="bold" style={styles.label}>
              {t('luckyBag.openersCount', { count: openers })}
            </Text>
            <View style={styles.quickRow}>
              {QUICK_OPENERS.map((o) => (
                <Pressable
                  key={o}
                  onPress={() => setOpeners(o)}
                  style={[styles.openerChip, openers === o && styles.openerChipActive]}
                >
                  <Users size={14} color={openers === o ? '#fff' : lu.colors.muted} />
                  <Text variant="caption" weight="bold" color={openers === o ? '#fff' : lu.colors.muted}>
                    {o}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text variant="caption" color="#9A9AA5">{t('luckyBag.openersRange')}</Text>

            <Text variant="button" weight="bold" style={styles.label}>{t('luckyBag.conditions')}</Text>
            <Text variant="caption" color="#9A9AA5" style={{ marginBottom: 8 }}>
              {t('luckyBag.conditionsHint')}
            </Text>
            <View style={styles.audienceGrid}>
              {AUDIENCE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setAudience(opt)}
                  style={[styles.audienceChip, audience === opt && styles.audienceChipActive]}
                >
                  <Text
                    variant="caption"
                    weight="bold"
                    color={audience === opt ? '#fff' : lu.colors.ink2}
                    style={{ textAlign: 'center' }}
                  >
                    {t(`luckyBag.audience.${opt}`)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text variant="button" weight="bold" style={styles.label}>{t('luckyBag.countdownLabel')}</Text>
            <Text variant="caption" color="#9A9AA5" style={{ marginBottom: 8 }}>
              {t('luckyBag.countdownHint')}
            </Text>
            <View style={styles.quickRow}>
              {QUICK_COUNTDOWN_MIN.map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setCountdownMin(d)}
                  style={[styles.durationChip, countdownMin === d && styles.durationChipActive]}
                >
                  <Clock size={12} color={countdownMin === d ? '#fff' : lu.colors.muted} />
                  <Text variant="caption" weight="bold" color={countdownMin === d ? '#fff' : lu.colors.muted}>
                    {d === 0 ? t('luckyBag.countdownNone') : t('luckyBag.countdownMin', { min: d })}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text variant="button" weight="bold" style={styles.label}>
              {t('luckyBag.durationLabel', { min: durationMin })}
            </Text>
            <View style={styles.quickRow}>
              {QUICK_DURATIONS_MIN.map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setDurationMin(d)}
                  style={[styles.durationChip, durationMin === d && styles.durationChipActiveAlt]}
                >
                  <Text variant="caption" weight="bold" color={durationMin === d ? '#fff' : lu.colors.muted}>
                    {t('luckyBag.countdownMin', { min: d })}
                  </Text>
                </Pressable>
              ))}
            </View>

            {amt > 0 ? (
              <View style={styles.summary}>
                <View style={styles.summaryRow}>
                  <Text variant="caption" color={lu.colors.ink2}>{t('luckyBag.shareEach')}</Text>
                  <Text variant="button" weight="bold" color={lu.colors.pink}>
                    {perPerson.toLocaleString()} {t('luckyBag.coins')}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text variant="caption" color={lu.colors.ink2}>{t('luckyBag.yourBalance')}</Text>
                  <Text variant="caption" weight="bold" color={amt > myCoins ? lu.colors.live : lu.colors.mint}>
                    {myCoins.toLocaleString()}
                  </Text>
                </View>
              </View>
            ) : null}

            {amt > myCoins ? (
              <Text variant="caption" color={lu.colors.live} align="center" style={{ marginTop: 8 }}>
                {t('luckyBag.insufficientBalance', { balance: myCoins.toLocaleString() })}
              </Text>
            ) : null}

            {errorMsg ? (
              <Text variant="caption" color={lu.colors.live} align="center" style={{ marginTop: 8 }}>
                {errorMsg}
              </Text>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={handleThrow} disabled={!canThrow} style={[styles.throwBtn, !canThrow && { opacity: 0.4 }]}>
              <LinearGradient
                colors={[lu.colors.gold, lu.colors.pink]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              {throwing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Gift size={18} color="#fff" />
                  <Text variant="button" color="#fff" weight="bold">{t('luckyBag.send')}</Text>
                </View>
              )}
            </Pressable>
            <View style={styles.balanceFooter}>
              <Coins size={14} color={lu.colors.gold} />
              <Text variant="caption" color={lu.colors.ink2}>{myCoins.toLocaleString()}</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  header: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' },
  bagArt: { alignItems: 'center', marginBottom: 8 },
  bagCircle: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  sparkle1: { position: 'absolute', top: -4, right: -4 },
  label: { marginTop: 16, marginBottom: 8, textAlign: I18nManager.isRTL ? 'right' : 'left' },
  amountInput: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, backgroundColor: '#F9FAFB',
    borderRadius: 12, borderWidth: 1.5, borderColor: '#F3F4F6',
  },
  input: { flex: 1, height: 52, fontSize: 18, fontWeight: '800', color: '#111', textAlign: I18nManager.isRTL ? 'right' : 'left' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  quickChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, backgroundColor: '#F3F4F6' },
  quickChipActive: { backgroundColor: lu.colors.gold },
  openerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, backgroundColor: '#F3F4F6',
  },
  openerChipActive: { backgroundColor: lu.colors.purple },
  audienceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  audienceChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    minWidth: '47%',
    flexGrow: 1,
  },
  audienceChipActive: { backgroundColor: lu.colors.purple },
  durationChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, backgroundColor: '#F3F4F6',
  },
  durationChipActive: { backgroundColor: lu.colors.purple },
  durationChipActiveAlt: { backgroundColor: lu.colors.pink },
  summary: { marginTop: 16, padding: 14, backgroundColor: '#FFF9E6', borderRadius: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: '#F3F4F6', alignItems: 'center' },
  throwBtn: { height: 52, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', width: '100%' },
  balanceFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
});
