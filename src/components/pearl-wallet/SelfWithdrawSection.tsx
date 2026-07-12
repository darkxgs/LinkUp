/**
 * قسم السحب الذاتي
 *  - 4 طرق دفع: بنك / USDT / PayPal / البريد
 *  - مبالغ مختارة + حقل مبلغ مخصص
 *  - يعرض العمولة (من config.selfWithdrawCommission)
 *  - يقدّم الطلب → ينتظر موافقة الأدمن
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  I18nManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  Building2,
  Send,
  Mail,
  Bitcoin,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ArrowRightLeft,
} from 'lucide-react-native';

import { Text, useAlert } from '@/components/ui';
import { WithdrawPrimaryButton } from '@/components/wallet/WithdrawPrimaryButton';
import { useConfig } from '@/contexts/ConfigContext';
import { useAuthStore } from '@/stores/authStore';
import {
  requestSelfWithdrawal,
  PAYMENT_METHODS,
  type PaymentMethod,
} from '@/services/withdrawalService';
import { type AgencyMemberPermissions } from '@/services/agencyService';
import { parseWalletRules, getAgentWithdrawCooldownRemainingMs } from '@/services/walletRules';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { firestore } from '@/services/firebase/index';
import { useAuth } from '@/hooks/useAuth';
import { lu } from '@/theme/lu-brand';

interface Props {
  pearls: number;
  permissions?: AgencyMemberPermissions;
}

export function SelfWithdrawSection({ pearls, permissions }: Props) {
  const { settings } = useConfig();
  const { showAlert } = useAlert();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { user: authUser } = useAuth();

  const isAgent =
    user?.isAgent === true ||
    user?.agencyRole === 'owner' ||
    user?.agencyRole === 'agent';

  const rules = parseWalletRules(settings);
  const commission = isAgent
    ? rules.agentWithdrawCommission
    : rules.selfWithdrawCommission;
  const minWithdraw = isAgent ? rules.minAgentWithdraw : rules.minHostWithdraw;
  const quickAmounts = isAgent ? rules.agentWithdrawAmounts : rules.hostWithdrawAmounts;

  const agencyId = (user as any)?.agencyId;
  const isHost = !!agencyId && !isAgent;
  const isAllowed = !isHost || permissions?.allowSelfWithdraw !== false;

  const [cooldownDaysLeft, setCooldownDaysLeft] = useState(0);

  useEffect(() => {
    if (!isAgent || !authUser?.uid) return;
    const fetchLast = async (uid: string) => {
      const q = query(
        collection(firestore, 'withdrawals'),
        where('uid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(15),
      );
      const snap = await getDocs(q);
      const selfDoc = snap.docs.find((d) => d.data().type === 'self');
      if (!selfDoc) return null;
      return Number(selfDoc.data().createdAt) || null;
    };
    void getAgentWithdrawCooldownRemainingMs(
      authUser.uid,
      rules.agentWithdrawCooldownDays,
      fetchLast,
    ).then((ms) => setCooldownDaysLeft(Math.ceil(ms / (24 * 60 * 60 * 1000))));
  }, [isAgent, authUser?.uid, rules.agentWithdrawCooldownDays]);

  const [method, setMethod] = useState<PaymentMethod>('bank');
  const [expandedMethod, setExpandedMethod] = useState<PaymentMethod | null>('bank');
  const [amountPearls, setAmountPearls] = useState('');
  const [accountField, setAccountField] = useState('');
  const [accountLabel, setAccountLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const amt = Number(amountPearls) || 0;
  const commissionAmount = Math.floor((amt * commission) / 100);
  const netAmount = amt - commissionAmount;

  const canSubmit =
    amt >= minWithdraw &&
    amt <= pearls &&
    accountField.trim().length > 5 &&
    !submitting &&
    isAllowed &&
    (!isAgent || cooldownDaysLeft <= 0);

  const handleQuickAmount = (pearlsAmt: number) => {
    setAmountPearls(String(pearlsAmt));
  };

  const handleSubmit = () => {
    if (!canSubmit) return;

    showAlert({
      type: 'warning',
      title: 'تأكيد طلب السحب',
      message: `سيتم خصم ${amt.toLocaleString()} ماسة (عمولة ${commissionAmount.toLocaleString()}).\nالصافي: ${netAmount.toLocaleString()} ماسة\n\nالطلب يحتاج موافقة الإدارة.`,
      buttons: [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تأكيد السحب',
          onPress: async () => {
            setSubmitting(true);
            try {
              const accountInfo: any = { label: accountLabel.trim() };
              if (method === 'bank') accountInfo.iban = accountField.trim();
              else if (method === 'usdt') accountInfo.address = accountField.trim();
              else if (method === 'paypal') accountInfo.email = accountField.trim();
              else if (method === 'email') accountInfo.email = accountField.trim();

              await requestSelfWithdrawal(amt, method, accountInfo);
              showAlert({
                type: 'success',
                title: 'تم تقديم الطلب بنجاح',
                message: 'سيتم مراجعته من قبل الإدارة في أقرب وقت',
                buttons: [
                  {
                    text: 'حسناً',
                    onPress: () => {
                      setAmountPearls('');
                      setAccountField('');
                      setAccountLabel('');
                    },
                  },
                ],
              });
            } catch (e: any) {
              showAlert({
                type: 'error',
                title: 'عفواً',
                message: e?.message ?? 'فشل تقديم الطلب',
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
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text variant="body" color="#6B7280" weight="bold">
            عمولة السحب
          </Text>
          <Text variant="h3" weight="bold" color="#E11414">
            {commission}%
          </Text>
        </View>
        <Text variant="caption" color="#9CA3AF" style={{ marginTop: 8 }}>
          الحد الأدنى: {minWithdraw.toLocaleString()} ماسة
        </Text>
      </View>

      {isAgent && cooldownDaysLeft > 0 && (
        <View style={styles.warningCard}>
          <AlertCircle size={20} color="#D97706" />
          <Text variant="body" color="#B45309" weight="bold">
            يمكنك السحب بعد {cooldownDaysLeft} يوم
          </Text>
        </View>
      )}

      {!isAllowed && (
        <View style={styles.errorCard}>
          <AlertCircle size={20} color="#EF4444" />
          <Text variant="body" color="#B91C1C" weight="bold">
            تم إيقاف صلاحية السحب الذاتي من قِبل وكالتك
          </Text>
        </View>
      )}

      {/* Amount Selector */}
      <View style={styles.amountCard}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Text variant="h3" weight="bold" color="#111827" style={{ marginBottom: 4 }}>المبلغ المطلوب سحبه</Text>
          <Text variant="caption" color="#6B7280">أدخل المبلغ يدوياً أو اختر من السريع</Text>
        </View>
         {/* Custom Input Label */}
         <Text variant="caption" weight="bold" color="#9CA3AF" style={{ textAlign: 'center', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
           إدخال يدوي
         </Text>

         <View style={styles.hugeInputContainer}>
            <TextInput
               style={[styles.hugeInput, !isAllowed && { color: '#9CA3AF' }]}
               value={amountPearls}
               onChangeText={(v) => setAmountPearls(v.replace(/[^0-9]/g, ''))}
               placeholder="0"
               placeholderTextColor="#D1D5DB"
               keyboardType="number-pad"
               editable={isAllowed}
            />
            <Image source={require('../../../assets/masa.webp')} style={styles.hugeInputIcon} contentFit="contain" />
         </View>
         
         {amt > 0 && amt < minWithdraw && (
           <Text variant="caption" color="#EF4444" style={{ textAlign: 'center', marginBottom: 12 }}>
             ⚠️ الحد الأدنى {minWithdraw.toLocaleString()}
           </Text>
         )}
         {amt > pearls && (
           <Text variant="caption" color="#EF4444" style={{ textAlign: 'center', marginBottom: 12 }}>
             ⚠️ رصيدك غير كافٍ
           </Text>
         )}

         {/* Quick Amounts Label */}
         <Text variant="caption" weight="bold" color="#9CA3AF" style={{ textAlign: 'center', marginTop: 12, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
           مبالغ سريعة
         </Text>

         <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
           {quickAmounts.map((pearlsAmt) => (
             <Pressable
               key={pearlsAmt}
               onPress={() => isAllowed && handleQuickAmount(pearlsAmt)}
               disabled={!isAllowed || (isAgent && cooldownDaysLeft > 0)}
               style={[styles.quickGlassChip, amountPearls === String(pearlsAmt) && styles.quickGlassChipActive]}
             >
               <Text variant="button" weight="bold" color={amountPearls === String(pearlsAmt) ? '#FFF' : '#374151'}>
                 {pearlsAmt.toLocaleString('en-US')}
               </Text>
             </Pressable>
           ))}
         </ScrollView>
      </View>

      {/* Payment Methods */}
      <Text variant="h4" weight="bold" color="#111827" style={{ marginBottom: 16 }}>
        وسيلة السحب
      </Text>
      <View style={{ marginBottom: 32 }}>
        {PAYMENT_METHODS.map((m) => {
          const Icon = {
            bank: Building2,
            usdt: Bitcoin,
            paypal: Send,
            email: Mail,
          }[m.id];

          const isExpanded = expandedMethod === m.id;
          const isSelected = method === m.id;

          return (
            <View key={m.id} style={[styles.methodPremiumWrap, !isAllowed && { opacity: 0.5 }]}>
              <Pressable
                onPress={() => {
                  if (!isAllowed) return;
                  setMethod(m.id);
                  setExpandedMethod(isExpanded ? null : m.id);
                }}
                disabled={!isAllowed}
                style={[styles.methodPremiumHeader, isSelected && styles.methodPremiumHeaderActive]}
              >
                <View style={[styles.methodPremiumIcon, isSelected && { backgroundColor: '#E11414' }]}>
                  <Icon size={20} color={isSelected ? '#fff' : '#E11414'} />
                </View>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text variant="body" weight="bold" color="#111827">{m.label}</Text>
                  <Text variant="caption" color="#6B7280">{m.desc}</Text>
                </View>
                {isExpanded ? (
                  <ChevronUp size={20} color="#9CA3AF" />
                ) : (
                  <ChevronDown size={20} color="#9CA3AF" />
                )}
              </Pressable>

              {isExpanded && isSelected && (
                <View style={styles.methodPremiumForm}>
                  <Text variant="caption" color="#6B7280" style={{ marginBottom: 8 }}>
                    {m.id === 'bank' && 'أدخل رقم الحساب أو IBAN الخاص بك'}
                    {m.id === 'usdt' && 'أدخل عنوان محفظة USDT (TRC20)'}
                    {m.id === 'paypal' && 'أدخل البريد الإلكتروني المرتبط بحساب PayPal'}
                    {m.id === 'email' && 'أدخل بريدك الإلكتروني للتواصل'}
                  </Text>
                  <TextInput
                    value={accountField}
                    onChangeText={setAccountField}
                    placeholder={
                      m.id === 'bank' ? 'AE12 3456 7890 1234 5678 901' :
                      m.id === 'usdt' ? 'TXxxxxxxxxxxxx...' :
                      m.id === 'paypal' ? 'name@example.com' :
                      'name@example.com'
                    }
                    placeholderTextColor="#D1D5DB"
                    style={[styles.premiumInput, !isAllowed && { backgroundColor: '#F3F4F6' }]}
                    autoCapitalize="none"
                    editable={isAllowed}
                  />
                  <TextInput
                    value={accountLabel}
                    onChangeText={setAccountLabel}
                    placeholder="ملاحظة أو اسم للحساب (اختياري)"
                    placeholderTextColor="#D1D5DB"
                    style={[styles.premiumInput, { marginTop: 12 }, !isAllowed && { backgroundColor: '#F3F4F6' }]}
                    editable={isAllowed}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Summary Card */}
      {amt > 0 && (
        <View style={styles.previewCard}>
          <Text variant="caption" color="#6B7280" style={{ textAlign: 'center', marginBottom: 16 }}>ملخص عملية السحب</Text>
          <View style={styles.previewRow}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text variant="h4" weight="bold" color="#111827">💎 {amt.toLocaleString()}</Text>
                <Text variant="caption" color="#9CA3AF" style={{ marginTop: 4 }}>إجمالي الخصم</Text>
              </View>
              <View style={styles.previewArrowWrapper}>
                <ArrowRightLeft color="#E11414" size={20} />
              </View>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text variant="h4" weight="bold" color="#111827">💵 ${(netAmount / 1000).toFixed(2)}</Text>
                <Text variant="caption" color="#9CA3AF" style={{ marginTop: 4 }}>القيمة النقدية</Text>
              </View>
          </View>
          <View style={styles.previewDivider} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text variant="body" color="#6B7280">رسوم السحب ({commission}%)</Text>
              <Text variant="body" weight="bold" color="#EF4444">-{commissionAmount.toLocaleString()} 💎</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="body" color="#374151">الصافي باللؤلؤ</Text>
              <Text variant="h4" weight="bold" color="#111827">{netAmount.toLocaleString()} 💎</Text>
          </View>
        </View>
      )}

      <WithdrawPrimaryButton
        label="تأكيد طلب السحب"
        onPress={handleSubmit}
        disabled={!canSubmit}
        submitting={submitting}
      />

      <Pressable
        onPress={() => router.push('/wallet/pearl-log' as any)}
        style={styles.historyLink}
      >
        <Text variant="button" color="#6B7280" weight="bold">
          عرض سجل السحوبات السابقة
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  amountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  hugeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  hugeInput: {
    fontSize: 56,
    fontFamily: lu.fonts.displayHeavy,
    color: '#111827',
    textAlign: 'center',
    minWidth: 100,
  },
  hugeInputIcon: {
    width: 40,
    height: 40,
    marginLeft: 12,
  },
  quickRow: {
    paddingHorizontal: 4,
    gap: 12,
  },
  quickGlassChip: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  quickGlassChipActive: {
    backgroundColor: '#E11414',
    borderColor: '#E11414',
    shadowColor: '#E11414',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  methodPremiumWrap: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    overflow: 'hidden',
  },
  methodPremiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  methodPremiumHeaderActive: {
    backgroundColor: '#F9FAFC',
  },
  methodPremiumIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodPremiumForm: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: '#F9FAFC',
  },
  premiumInput: {
    height: 54,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    fontSize: 16,
    color: '#111827',
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 4,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  previewArrowWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F9FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 16,
  },
  historyLink: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
});
