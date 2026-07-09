/**
 * LinkUp App — شاشة تحويل العملات بين المستخدمين
 *
 * يقرأ:
 *  - عمولة التحويل من config/settings.transferCommission (الأدمن يتحكّم)
 *  - الحد الأدنى من config/settings.minTransferAmount
 *  - رصيد المرسل من useAuth
 *
 * يستدعي:
 *  - findUserForTransfer (للبحث عن المستلم)
 *  - transferCurrency (التحويل الفعلي مع transaction آمنة)
 */

import React, { useState, useMemo, useEffect } from 'react';
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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Send, Search, User as UserIcon, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { ChevronRight } from '@/components/ui/RtlIcons';

import { Text, CurrencyIcon } from '@/components/ui';
import { useAlert } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import {
  findUserForTransfer,
  transferCurrency,
  type TransferCurrency,
} from '@/services/coinTransfer';
import { colors, radius, spacing, shadows } from '@/theme';
import { useLightStatusBarOnFocus } from '@/hooks/useLightStatusBarOnFocus';

export default function TransferScreen() {
  // شاشة داكنة الخلفية/الرأس — أيقونات شريط الحالة فاتحة أثناء التركيز فقط
  useLightStatusBarOnFocus();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { settings } = useConfig();
  const { showAlert } = useAlert();

  const [currency, setCurrency] = useState<TransferCurrency>('coins');
  const [searchTerm, setSearchTerm] = useState('');
  const [recipient, setRecipient] = useState<{
    uid: string;
    displayName: string;
    avatar: string;
  } | null>(null);
  const [searching, setSearching] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const myBalance =
    currency === 'coins'
      ? user?.stats?.coins ?? 0
      : user?.stats?.pearls ?? 0;

  const commissionPercent = settings?.transferCommission ?? 5;
  const minAmount = settings?.minTransferAmount ?? 100;

  const numAmount = Number(amount) || 0;
  const commission = Math.floor((numAmount * commissionPercent) / 100);
  const netReceived = numAmount - commission;

  const canTransfer =
    !!recipient &&
    numAmount >= minAmount &&
    numAmount <= myBalance &&
    netReceived > 0 &&
    !submitting;

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    setRecipient(null);
    try {
      const found = await findUserForTransfer(searchTerm.trim());
      if (!found) {
        showAlert({
          type: 'error',
          title: t('wallet.text33651'),
          message: t('wallet.text37165'),
        });
      } else if (found.uid === user?.uid) {
        showAlert({
          type: 'warning',
          title: t('wallet.text54723'),
          message: t('wallet.text37601'),
        });
      } else {
        setRecipient(found);
      }
    } catch (e: any) {
      showAlert({ type: 'error', title: t('roomSettings.text32386'), message: e?.message ?? t('wallet.text76956') });
    } finally {
      setSearching(false);
    }
  };

  const handleTransfer = async () => {
    if (!recipient || numAmount <= 0) return;
    showAlert({
      type: 'warning',
      title: t('wallet.text58812'),
      message: `سيتم تحويل ${netReceived.toLocaleString()} ${
        currency === 'coins' ? t('lottery.text14819') : t('wallet.text23633')
      } إلى ${recipient.displayName} (عمولة ${commission.toLocaleString()} = ${commissionPercent}%)`,
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('wallet.text68187'),
          onPress: async () => {
            setSubmitting(true);
            try {
              const res = await transferCurrency(
                recipient.uid,
                numAmount,
                currency,
                note.trim() || undefined,
              );
              showAlert({
                type: 'success',
                title: t('wallet.text64459'),
                message: res.message,
                buttons: [
                  {
                    text: t('roomSettings.text80678'),
                    onPress: () => {
                      // refresh وعد للمحفظة
                      refreshUser?.();
                      router.back();
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
      <LinearGradient
        colors={['#26090C', '#3A0A0A']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronRight size={22} color="#fff" />
        </Pressable>
        <Text variant="h3" color="#fff" weight="bold">
          {t('wallet.text64698')}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* اختيار العملة */}
          <View style={styles.card}>
            <Text variant="caption" color={colors.text.tertiary} style={{ marginBottom: 10 }}>
              {t('wallet.text15940')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setCurrency('coins')}
                style={[
                  styles.currencyBtn,
                  currency === 'coins' && styles.currencyBtnActive,
                ]}
              >
                <CurrencyIcon type="coin" size={18} />
                <Text
                  variant="button"
                  color={currency === 'coins' ? '#fff' : colors.text.primary}
                  weight="bold"
                >
                  عملات ({(user?.stats?.coins ?? 0).toLocaleString()})
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setCurrency('pearls')}
                style={[
                  styles.currencyBtn,
                  currency === 'pearls' && styles.currencyBtnActive,
                ]}
              >
                <CurrencyIcon type="pearl" size={18} />
                <Text
                  variant="button"
                  color={currency === 'pearls' ? '#fff' : colors.text.primary}
                  weight="bold"
                >
                  ماسة ({(user?.stats?.pearls ?? 0).toLocaleString()})
                </Text>
              </Pressable>
            </View>
          </View>

          {/* البحث عن المستلم */}
          <View style={styles.card}>
            <Text variant="caption" color={colors.text.tertiary} style={{ marginBottom: 10 }}>
              {t('wallet.text36184')}            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={searchTerm}
                onChangeText={(t) => {
                  setSearchTerm(t);
                  if (!t) setRecipient(null);
                }}
                placeholder={t('wallet.text65066')}
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                onSubmitEditing={handleSearch}
              />
              <Pressable
                onPress={handleSearch}
                disabled={!searchTerm.trim() || searching}
                style={[
                  styles.searchBtn,
                  (!searchTerm.trim() || searching) && { opacity: 0.5 },
                ]}
              >
                {searching ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Search size={18} color="#fff" />
                )}
              </Pressable>
            </View>

            {recipient && (
              <View style={styles.recipientCard}>
                {recipient.avatar ? (
                  <Image source={{ uri: recipient.avatar }} style={styles.recipientAvatar} />
                ) : (
                  <View style={[styles.recipientAvatar, { backgroundColor: '#FCA5A5', alignItems: 'center', justifyContent: 'center' }]}>
                    <UserIcon size={20} color="#fff" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text variant="button" weight="bold">{recipient.displayName}</Text>
                  <Text variant="caption" color={colors.text.tertiary}>
                    {recipient.uid.slice(0, 12)}...
                  </Text>
                </View>
                <CheckCircle2 size={20} color="#10B981" />
              </View>
            )}
          </View>

          {/* المبلغ */}
          {recipient && (
            <View style={styles.card}>
              <Text variant="caption" color={colors.text.tertiary} style={{ marginBottom: 10 }}>
                المبلغ (الحد الأدنى {minAmount})
              </Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                style={[styles.input, { textAlign: 'center', fontSize: 24, fontWeight: '800' }]}
              />

              {/* أزرار سريعة */}
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                {[100, 500, 1000, 5000].map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => setAmount(String(v))}
                    style={styles.quickBtn}
                  >
                    <Text variant="caption" weight="bold">{v.toLocaleString()}</Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => setAmount(String(myBalance))}
                  style={[styles.quickBtn, { backgroundColor: '#FCD34D' }]}
                >
                  <Text variant="caption" weight="bold">{t('store.categories.all')}</Text>
                </Pressable>
              </View>

              {/* ملاحظة */}
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={t('wallet.text8815')}
                placeholderTextColor="#9CA3AF"
                style={[styles.input, { marginTop: 12 }]}
                maxLength={50}
              />
            </View>
          )}

          {/* ملخّص التحويل */}
          {recipient && numAmount > 0 && (
            <View style={styles.summaryCard}>
              <SummaryRow label={t('wallet.text78474')} value={numAmount} currency={currency} />
              <SummaryRow
                label={`عمولة (${commissionPercent}%)`}
                value={commission}
                currency={currency}
                muted
              />
              <View style={styles.divider} />
              <SummaryRow
                label={t('wallet.text98546')}
                value={netReceived}
                currency={currency}
                bold
              />

              {numAmount > myBalance && (
                <View style={styles.warningRow}>
                  <AlertCircle size={14} color="#EF4444" />
                  <Text variant="caption" color="#EF4444" weight="bold">
                    {t('wallet.text73377')}
                  </Text>
                </View>
              )}
              {numAmount > 0 && numAmount < minAmount && (
                <View style={styles.warningRow}>
                  <AlertCircle size={14} color="#F59E0B" />
                  <Text variant="caption" color="#F59E0B" weight="bold">
                    الحد الأدنى {minAmount}
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* زر التحويل */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            onPress={handleTransfer}
            disabled={!canTransfer}
            style={[styles.transferBtn, !canTransfer && { opacity: 0.4 }]}
          >
            <LinearGradient
              colors={['#E11414', '#C40E1E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Send size={20} color="#fff" />
                <Text variant="button" color="#fff" weight="bold">
                  تحويل {netReceived > 0 ? netReceived.toLocaleString() : ''}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ===== Helper Components =====
function SummaryRow({
  label,
  value,
  currency,
  bold,
  muted,
}: {
  label: string;
  value: number;
  currency: TransferCurrency;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text variant={bold ? 'button' : 'caption'} color={muted ? colors.text.tertiary : '#fff'} weight={bold ? 'bold' : 'regular'}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text variant={bold ? 'h4' : 'button'} color="#fff" weight="bold">
          {value.toLocaleString()}
        </Text>
        <CurrencyIcon type={currency === 'coins' ? 'coin' : 'pearl'} size={bold ? 16 : 13} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#26090C' },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  currencyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  currencyBtnActive: {
    backgroundColor: '#E11414',
    borderColor: '#8A0E0E',
  },
  input: {
    flex: 1,
    height: 46,
    paddingHorizontal: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: radius.md,
    fontSize: 15,
    color: colors.text.primary,
  },
  searchBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: '#E11414',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderRadius: radius.md,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  recipientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  quickBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 6,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  transferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
});
