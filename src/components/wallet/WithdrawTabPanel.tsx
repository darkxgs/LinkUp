/**
 * تاب السحب — يُستخدم داخل شاشة استبدال - سحب
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';

import { Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { SelfWithdrawSection } from '@/components/pearl-wallet/SelfWithdrawSection';
import { AgentWithdrawSection } from '@/components/pearl-wallet/AgentWithdrawSection';
import { HostAgentTransferSection } from '@/components/pearl-wallet/HostAgentTransferSection';
import {
  subscribeToMyMembership,
  type AgencyMember,
  DEFAULT_MEMBER_PERMISSIONS,
} from '@/services/agencyService';
import { lu } from '@/theme/lu-brand';

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text variant="body" weight="bold" color="#111827">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="caption" color="#6B7280" style={{ marginTop: 4 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function WithdrawTabPanel() {
  const { user, refreshUser } = useAuth();
  const pearls = user?.stats?.pearls ?? 0;
  const agencyId = user?.agencyId ?? null;

  useFocusEffect(
    useCallback(() => {
      void refreshUser?.();
    }, [refreshUser]),
  );

  const [membership, setMembership] = useState<AgencyMember | null>(null);

  useEffect(() => {
    if (!agencyId) {
      setMembership(null);
      return;
    }
    const unsub = subscribeToMyMembership((m) => setMembership(m));
    return () => unsub?.();
  }, [agencyId]);

  const permissions = membership?.permissions || DEFAULT_MEMBER_PERMISSIONS;

  return (
    <View style={styles.wrap}>
      <View style={styles.balanceCard}>
        <View style={styles.balanceRow}>
          <Image source={require('../../../assets/masa.webp')} style={styles.pearlIcon} contentFit="contain" />
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="#6B7280" weight="bold">
              رصيد الماسة المتاح
            </Text>
            <Text variant="h2" weight="bold" color="#111827" style={styles.balanceValue}>
              {pearls.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>
        </View>
      </View>

      {agencyId ? (
        <>
          <SectionTitle title="تحويل للوكيل" subtitle="أرسل الماسة لوكيل وكالتك المعتمد" />
          <HostAgentTransferSection pearls={pearls} permissions={permissions} />

          <SectionTitle title="سحب عبر الوكيل" subtitle="اطلب سحب نقدي من خلال وكالتك" />
          <AgentWithdrawSection pearls={pearls} permissions={permissions} />
        </>
      ) : null}

      <SectionTitle title="سحب ذاتي" subtitle="قدّم طلب سحب مباشرة للإدارة" />
      <SelfWithdrawSection pearls={pearls} permissions={permissions} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 8,
    gap: 4,
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pearlIcon: {
    width: 48,
    height: 48,
  },
  balanceValue: {
    marginTop: 4,
    fontFamily: lu.fonts.displayHeavy,
  },
  sectionTitleWrap: {
    marginBottom: 12,
    marginTop: 8,
  },
});
