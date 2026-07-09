/**
 * تحويل بالنيابة — المضيف/ة يرسل ماسات للوكيل المسجّل
 */
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertCircle, ArrowRightLeft, Copy, Check, User } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';

import { Text, useAlert } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { getAgencyById, type Agency, type AgencyMemberPermissions } from '@/services/agencyService';
import { transferPearlsToAgent } from '@/services/hostPearlTransfer';
import { useConfig } from '@/contexts/ConfigContext';
import { parseWalletRules } from '@/services/walletRules';
import { WithdrawPrimaryButton } from '@/components/wallet/WithdrawPrimaryButton';
import { lu } from '@/theme/lu-brand';

interface Props {
  pearls: number;
  permissions?: AgencyMemberPermissions;
  onSuccess?: () => void;
}



export function HostAgentTransferSection({ pearls, permissions, onSuccess }: Props) {
  const { user, refreshUser } = useAuth();
  const { settings } = useConfig();
  const { showAlert } = useAlert();
  const rules = parseWalletRules(settings);
  const quickAmounts = rules.hostWithdrawAmounts;
  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const agencyId = (user as { agencyId?: string } | null)?.agencyId;

  const isAllowed = permissions?.allowTransferToAgent !== false;

  useEffect(() => {
    if (!agencyId) {
      setLoading(false);
      return;
    }
    getAgencyById(agencyId)
      .then(setAgency)
      .finally(() => setLoading(false));
  }, [agencyId]);

  if (loading) {
    return <ActivityIndicator color={lu.colors.purple} style={{ marginVertical: 32 }} />;
  }

  if (!agencyId || !agency) return null;

  const amt = Number(amount) || 0;
  const canSubmit = amt > 0 && amt <= pearls && !submitting && isAllowed;

  const handleCopyId = async () => {
    await Clipboard.setStringAsync(agency.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    showAlert({
      type: 'warning',
      title: 'تأكيد التحويل',
      message: `سيتم إرسال ${amt.toLocaleString()} ماسة إلى وكالة ${agency.name}. هل أنت متأكد؟`,
      buttons: [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تأكيد التحويل',
          onPress: async () => {
            setSubmitting(true);
            try {
              await transferPearlsToAgent(amt);
              await refreshUser?.();
              setAmount('');
              onSuccess?.();
              showAlert({ type: 'success', title: 'تمت العملية', message: 'تم تحويل اللآلئ للوكيل بنجاح' });
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'فشل التحويل';
              showAlert({ type: 'error', title: 'عفواً', message: msg });
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
      {!isAllowed && (
        <View style={styles.disabledWarning}>
          <AlertCircle size={20} color="#EF4444" />
          <Text variant="body" color="#B91C1C" weight="bold">
            صلاحية التحويل موقوفة من قِبل وكالتك
          </Text>
        </View>
      )}

      {/* Recipient Card (Agency Info) */}
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
          <Text variant="h3" weight="bold" color="#111827" style={{ marginBottom: 4 }}>{agency.name}</Text>
          <Text variant="caption" color="#6B7280" style={{ letterSpacing: 1 }}>الوكيل المعتمد</Text>
        </View>
        <Pressable onPress={handleCopyId} style={styles.recipientIdPill}>
          <Text variant="caption" weight="bold" color={lu.colors.purple}>ID: {agency.id.slice(0, 8)}...</Text>
          {copied ? <Check size={14} color="#10B981" /> : <Copy size={14} color={lu.colors.purple} />}
        </Pressable>
      </View>

      {/* Amount Selector */}
      <View style={styles.amountCard}>
         <Text variant="caption" weight="bold" color="#9CA3AF" style={{ textAlign: 'center', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
           إدخال يدوي
         </Text>

         <View style={styles.hugeInputContainer}>
            <TextInput
               style={[styles.hugeInput, !isAllowed && { color: '#9CA3AF' }]}
               value={amount}
               onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
               placeholder="0"
               placeholderTextColor="#D1D5DB"
               keyboardType="number-pad"
               editable={isAllowed}
            />
            <Image source={require('../../../assets/masa.png')} style={styles.hugeInputIcon} contentFit="contain" />
         </View>

         {/* Quick Amounts Label */}
         <Text variant="caption" weight="bold" color="#9CA3AF" style={{ textAlign: 'center', marginTop: 12, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
           مبالغ سريعة
         </Text>

         <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
           {quickAmounts.map((n) => (
             <Pressable
               key={n}
               onPress={() => isAllowed && setAmount(String(n))}
               style={[styles.quickGlassChip, amount === String(n) && styles.quickGlassChipActive]}
             >
               <Text variant="button" weight="bold" color={amount === String(n) ? '#FFF' : '#374151'}>{n}</Text>
             </Pressable>
           ))}
         </ScrollView>
      </View>

      {/* Conversion Preview Card */}
      {amt > 0 && isAllowed && (
        <View style={styles.previewCard}>
          <Text variant="caption" color="#6B7280" style={{ textAlign: 'center', marginBottom: 16 }}>ملخص عملية التحويل</Text>
          <View style={styles.previewRow}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text variant="h4" weight="bold" color="#111827">💎 {amt}</Text>
                <Text variant="caption" color="#9CA3AF" style={{ marginTop: 4 }}>المبلغ الإجمالي</Text>
              </View>
              <View style={styles.previewArrowWrapper}>
                <ArrowRightLeft color="#E11414" size={20} />
              </View>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text variant="h4" weight="bold" color="#111827">{agency.name.split(' ')[0]}</Text>
                <Text variant="caption" color="#9CA3AF" style={{ marginTop: 4 }}>المستلم</Text>
              </View>
          </View>
          <View style={styles.previewDivider} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text variant="body" color="#6B7280">رسوم التحويل</Text>
              <Text variant="body" weight="bold" color="#10B981">مجانًا</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="body" color="#374151">سيصل للمستلم</Text>
              <Text variant="h4" weight="bold" color="#111827">{amt} 💎</Text>
          </View>
        </View>
      )}

      <WithdrawPrimaryButton
        label="تحويل الآن"
        onPress={handleSubmit}
        disabled={!canSubmit}
        submitting={submitting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
  },
  disabledWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
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
    padding: 20,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 16,
  },
});
