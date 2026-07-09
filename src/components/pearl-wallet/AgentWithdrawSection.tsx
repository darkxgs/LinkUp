/**
 * قسم التحصيل بالنيابة (السحب عبر الوكيل)
 *  - فقط الأعضاء في وكالة يستخدمونه
 *  - عمولة 2% (الأدمن، ليس الوكيل)
 *  - الوكيل يستلم → يوافق → يسلّم كاش خارجياً
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { User, Building2, AlertCircle, Copy, Check, ArrowRightLeft } from 'lucide-react-native';
import { ChevronLeft } from '@/components/ui/RtlIcons';
import * as Clipboard from 'expo-clipboard';

import { Text, useAlert } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { requestAgentWithdrawal } from '@/services/withdrawalService';
import { getAgencyById, type Agency, type AgencyMemberPermissions } from '@/services/agencyService';
import { parseWalletRules, isHostAgentWithdrawDayAllowed } from '@/services/walletRules';
import { WithdrawPrimaryButton } from '@/components/wallet/WithdrawPrimaryButton';
import { lu } from '@/theme/lu-brand';

const WEEKDAY_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

interface Props {
  pearls: number;
  permissions?: AgencyMemberPermissions;
}

export function AgentWithdrawSection({ pearls, permissions }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { settings } = useConfig();
  const { showAlert } = useAlert();

  const [agency, setAgency] = useState<Agency | null>(null);
  const [loadingAgency, setLoadingAgency] = useState(true);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const rules = parseWalletRules(settings);
  const commission = rules.agentWithdrawCommission;
  const minWithdraw = rules.minHostWithdraw;
  const quickAmounts = rules.hostWithdrawAmounts;
  const agentDayAllowed = isHostAgentWithdrawDayAllowed(rules);
  const allowedDaysLabel = rules.hostAgentWithdrawWeekDays
    .map((d) => WEEKDAY_AR[d] ?? String(d))
    .join('، ');

  const userData = user as any;
  const agencyId = userData?.agencyId;

  const isAllowed = permissions?.allowAgentWithdraw !== false;

  useEffect(() => {
    if (!agencyId) {
      setLoadingAgency(false);
      return;
    }
    getAgencyById(agencyId)
      .then(setAgency)
      .finally(() => setLoadingAgency(false));
  }, [agencyId]);

  const amt = Number(amount) || 0;
  const commissionAmt = Math.floor((amt * commission) / 100);
  const netAmt = amt - commissionAmt;

  const canSubmit =
    !!agency &&
    agentDayAllowed &&
    amt >= minWithdraw &&
    amt <= pearls &&
    !submitting &&
    isAllowed;

  const handleCopyAgentId = async () => {
    if (!agency) return;
    await Clipboard.setStringAsync(agency.ownerUid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    showAlert({
      type: 'warning',
      title: 'تأكيد طلب التحصيل',
      message: `سيتم خصم ${amt.toLocaleString()} ماسة وإرسال الطلب إلى وكيلك "${agency?.ownerName}".\n\nالوكيل سيقوم بتسليمك المبلغ المالي المتفق عليه خارجياً.`,
      buttons: [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تأكيد العملية',
          onPress: async () => {
            setSubmitting(true);
            try {
              await requestAgentWithdrawal(amt);
              showAlert({
                type: 'success',
                title: 'تم إرسال الطلب',
                message: `وكيلك "${agency?.ownerName}" سيتواصل معك قريباً لتسليمك المبلغ`,
                buttons: [
                  { text: 'حسناً', onPress: () => setAmount('') },
                ],
              });
            } catch (e: any) {
              showAlert({
                type: 'error',
                title: 'عفواً',
                message: e?.message ?? 'فشل إرسال الطلب',
              });
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    });
  };

  if (loadingAgency) {
    return (
      <View style={{ padding: 40, alignItems: 'center' }}>
        <ActivityIndicator color={lu.colors.purple} size="large" />
      </View>
    );
  }

  // Empty State: Not in an agency
  if (!agency) {
    return (
      <View style={styles.noAgencyCard}>
        <LinearGradient colors={['#F9FAFC', '#F3F4F6']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.noAgencyIcon}>
          <Building2 size={40} color="#E11414" />
        </View>
        <Text variant="h3" weight="bold" align="center" style={{ marginTop: 24, color: '#111827' }}>
          لست عضواً في وكالة
        </Text>
        <Text variant="caption" color="#6B7280" align="center" style={{ marginTop: 8, lineHeight: 22, paddingHorizontal: 16 }}>
          خاصية التحصيل بالنيابة متاحة فقط لأعضاء الوكالات. انضم لوكالة لتستمتع بعمولة أقل واستلام أسرع للأرباح.
        </Text>

        <View style={styles.joinBtn}>
          <WithdrawPrimaryButton
            label="انضم إلى وكالة الآن"
            onPress={() => router.push('/agencies' as any)}
          />
        </View>

        <View style={styles.benefitsList}>
          <BenefitRow text={`عمولة سحب مخفضة (${commission}%)`} />
          <BenefitRow text="استلام كاش بدون انتظار الطوابير" />
          <BenefitRow text="دعم مباشر وشخصي من وكيلك" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Agent Card */}
      <View style={styles.recipientCard}>
        <LinearGradient colors={['#F9FAFC', '#F3F4F6']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.recipientAvatarFrame}>
          {agency.ownerAvatar ? (
             <Image source={{ uri: agency.ownerAvatar }} style={styles.recipientAvatar} contentFit="cover" />
          ) : (
             <View style={[styles.recipientAvatar, { backgroundColor: '#E11414', alignItems: 'center', justifyContent: 'center' }]}>
               <User size={32} color="#fff" />
             </View>
          )}
        </View>
        <View style={{ flex: 1, alignItems: 'center', marginVertical: 12 }}>
          <Text variant="h3" weight="bold" color="#111827" style={{ marginBottom: 4 }}>{agency.ownerName}</Text>
          <Text variant="caption" color="#6B7280" style={{ letterSpacing: 1 }}>الوكيل المسؤول عنك</Text>
        </View>
        <Pressable onPress={handleCopyAgentId} style={styles.recipientIdPill}>
          <Text variant="caption" weight="bold" color={lu.colors.purple}>ID: {agency.ownerUid.slice(0, 8)}...</Text>
          {copied ? <Check size={14} color="#10B981" /> : <Copy size={14} color={lu.colors.purple} />}
        </Pressable>
      </View>

      {!isAllowed && (
        <View style={styles.errorCard}>
          <AlertCircle size={20} color="#EF4444" />
          <Text variant="body" color="#B91C1C" weight="bold">
            صلاحية السحب عبر الوكيل موقوفة من قِبل وكالتك
          </Text>
        </View>
      )}

      {!agentDayAllowed && (
        <View style={styles.warningCard}>
          <AlertCircle size={20} color="#D97706" />
          <Text variant="body" color="#92400E" weight="bold">
            السحب عبر الوكيل متاح في الأيام: {allowedDaysLabel}
          </Text>
        </View>
      )}

      {/* Amount Selector */}
      <View style={styles.amountCard}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Text variant="h3" weight="bold" color="#111827" style={{ marginBottom: 4 }}>اختر المبلغ (ماسة)</Text>
          <Text variant="caption" color="#6B7280">أدخل المبلغ أو اختر من المبالغ السريعة</Text>
        </View>
         {/* Custom Input Label */}
         <Text variant="caption" weight="bold" color="#9CA3AF" style={{ textAlign: 'center', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
           إدخال يدوي
         </Text>

         <View style={styles.hugeInputContainer}>
            <TextInput
               style={[styles.hugeInput, (!isAllowed || !agentDayAllowed) && { color: '#9CA3AF' }]}
               value={amount}
               onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
               placeholder="0"
               placeholderTextColor="#D1D5DB"
               keyboardType="number-pad"
               editable={isAllowed && agentDayAllowed}
            />
            <Image source={require('../../../assets/masa.png')} style={styles.hugeInputIcon} contentFit="contain" />
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
               onPress={() => isAllowed && agentDayAllowed && setAmount(String(pearlsAmt))}
               disabled={!isAllowed || !agentDayAllowed}
               style={[styles.quickGlassChip, amount === String(pearlsAmt) && styles.quickGlassChipActive]}
             >
               <Text variant="button" weight="bold" color={amount === String(pearlsAmt) ? '#FFF' : '#374151'}>
                 {pearlsAmt.toLocaleString('en-US')}
               </Text>
             </Pressable>
           ))}
         </ScrollView>
      </View>

      {/* Conversion Preview Card */}
      {amt > 0 && isAllowed && agentDayAllowed && (
        <View style={styles.previewCard}>
          <Text variant="caption" color="#6B7280" style={{ textAlign: 'center', marginBottom: 16 }}>ملخص عملية التحصيل</Text>
          <View style={styles.previewRow}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text variant="h4" weight="bold" color="#111827">💎 {amt.toLocaleString()}</Text>
                <Text variant="caption" color="#9CA3AF" style={{ marginTop: 4 }}>إجمالي الخصم</Text>
              </View>
              <View style={styles.previewArrowWrapper}>
                <ArrowRightLeft color="#E11414" size={20} />
              </View>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text variant="h4" weight="bold" color="#111827">💵 ${(netAmt / 1000).toFixed(2)}</Text>
                <Text variant="caption" color="#9CA3AF" style={{ marginTop: 4 }}>تستلم كاش</Text>
              </View>
          </View>
          <View style={styles.previewDivider} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text variant="body" color="#6B7280">عمولة الإدارة ({commission}%)</Text>
              <Text variant="body" weight="bold" color="#EF4444">-{commissionAmt.toLocaleString()} 💎</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="body" color="#374151">الصافي المعادل</Text>
              <Text variant="h4" weight="bold" color="#111827">{netAmt.toLocaleString()} 💎</Text>
          </View>
        </View>
      )}

      <WithdrawPrimaryButton
        label="إرسال الطلب للوكيل"
        onPress={handleSubmit}
        disabled={!canSubmit}
        submitting={submitting}
      />

      {/* Bottom Links */}
      <View style={{ marginTop: 16, gap: 12 }}>
        <Pressable onPress={() => router.push('/wallet/pearl-log' as any)} style={styles.premiumLinkRow}>
          <Text variant="button" color="#4B5563" weight="bold">سجلات التحصيل السابقة</Text>
          <ChevronLeft size={20} color="#9CA3AF" />
        </Pressable>
        <Pressable onPress={() => router.push('/agency/refunds' as any)} style={styles.premiumLinkRow}>
          <Text variant="button" color="#4B5563" weight="bold">استرداد أموال الداعمين (تأثر الماسة)</Text>
          <ChevronLeft size={20} color="#9CA3AF" />
        </Pressable>
      </View>
    </View>
  );
}

function BenefitRow({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
         <Check size={16} color="#E11414" />
      </View>
      <Text variant="body" color="#4B5563" weight="bold" style={{ flex: 1 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
  },
  noAgencyCard: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderRadius: 32,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  noAgencyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtn: {
    marginTop: 32,
    marginBottom: 32,
    width: '100%',
  },
  benefitsList: {
    width: '100%',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recipientCard: {
    backgroundColor: '#fff',
    borderRadius: 32,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 4,
  },
  recipientAvatarFrame: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  recipientAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
  },
  recipientIdPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
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
  premiumLinkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
});
