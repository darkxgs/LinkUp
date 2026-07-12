/**
 * محفظة الماسة — سحب ذاتي / بالنيابة / تحويل للوكيل / سجل
 * لا يوجد تحويل ماس → كوينز (الشراء بالكوينز فقط)
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { ClipboardList } from 'lucide-react-native';
import { ChevronLeft } from '@/components/ui/RtlIcons';

import { Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { lu } from '@/theme/lu-brand';
import { WALLET_ASSETS } from '@/components/wallet/walletDesign';
import { SelfWithdrawSection } from '@/components/pearl-wallet/SelfWithdrawSection';
import { AgentWithdrawSection } from '@/components/pearl-wallet/AgentWithdrawSection';
import { HostAgentTransferSection } from '@/components/pearl-wallet/HostAgentTransferSection';
import {
  subscribeToMyMembership,
  type AgencyMember,
  DEFAULT_MEMBER_PERMISSIONS,
} from '@/services/agencyService';

import { ChevronLeft as ChevronLeftRtl } from '@/components/ui/RtlIcons';
import { ExchangeSection } from '@/components/pearl-wallet/ExchangeSection';
import { useAuthStore } from '@/stores/authStore';
import { History, ShieldAlert, Award, FileText, ArrowRightLeft } from 'lucide-react-native';
import { useLightStatusBarOnFocus } from '@/hooks/useLightStatusBarOnFocus';

export default function PearlWalletScreen() {
  // شاشة داكنة الخلفية/الرأس — أيقونات شريط الحالة فاتحة أثناء التركيز فقط
  useLightStatusBarOnFocus();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const pearls = user?.stats?.pearls ?? 0;
  const agencyId = (user as { agencyId?: string } | null)?.agencyId;
  const isAgent =
    user?.isAgent === true ||
    (user as any)?.agencyRole === 'owner' ||
    (user as any)?.agencyRole === 'agent';

  const [membership, setMembership] = useState<AgencyMember | null>(null);
  const [activeTab, setActiveTab] = useState<'collect_proxy' | 'exchange' | 'withdraw'>(
    isAgent ? 'collect_proxy' : 'withdraw'
  );

  useEffect(() => {
    if (!agencyId) {
      setMembership(null);
      return;
    }
    const unsub = subscribeToMyMembership((m) => {
      setMembership(m);
    });
    return () => unsub?.();
  }, [agencyId]);

  const permissions = membership?.permissions || DEFAULT_MEMBER_PERMISSIONS;

  return (
    <View style={styles.fill}>
      <LinearGradient colors={['rgba(225, 20, 20, 0.12)', '#F0F2F5']} style={StyleSheet.absoluteFill} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 16,
        }}
      >
        {/* ===== Header ===== */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeftRtl size={22} color={lu.colors.ink} />
          </Pressable>
          <Text variant="h3" weight="bold" color={lu.colors.ink}>
            محفظة اللؤلؤة
          </Text>
          <Pressable onPress={() => router.push('/wallet/pearl-log' as any)} style={styles.logBtn}>
            <ClipboardList size={20} color={lu.colors.purple} />
          </Pressable>
        </View>

        {/* ===== Pearl Balance Card ===== */}
        <View style={styles.balanceCard}>
          <LinearGradient colors={['#1A0A0C', '#0E0E11']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.balanceGlow} />
          <View style={styles.balanceRow}>
            <Image source={require('../../assets/masa.webp')} style={styles.pearlsIcon} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <Text variant="caption" color="rgba(255,255,255,0.6)" style={{ textAlign: 'right', letterSpacing: 0.5, marginBottom: 4 }}>
                رصيد الحساب
              </Text>
              <Text variant="display2" weight="bold" color="#fff" style={styles.balanceText}>
                {pearls.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        </View>

        <Text variant="caption" color={lu.colors.muted} style={styles.note}>
          الماسة تُكتسب من تحويل الكوينز أو الكازينو. لا تُشترى مباشرة. التحويل عكسي (ماسة → كوينز) غير متاح.
        </Text>

        {/* ===== Tabs System ===== */}
        <View style={styles.tabsRow}>
          {isAgent && (
            <Pressable
              onPress={() => setActiveTab('collect_proxy')}
              style={[styles.tabItem, activeTab === 'collect_proxy' && styles.tabItemActive]}
            >
              <Text
                variant="button"
                color={activeTab === 'collect_proxy' ? lu.colors.ink : lu.colors.muted}
                weight={activeTab === 'collect_proxy' ? 'bold' : 'regular'}
              >
                تحصيل بالنيابة
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setActiveTab('exchange')}
            style={[styles.tabItem, activeTab === 'exchange' && styles.tabItemActive]}
          >
            <Text
              variant="button"
              color={activeTab === 'exchange' ? lu.colors.ink : lu.colors.muted}
              weight={activeTab === 'exchange' ? 'bold' : 'regular'}
            >
              الاستبدال
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('withdraw')}
            style={[styles.tabItem, activeTab === 'withdraw' && styles.tabItemActive]}
          >
            <Text
              variant="button"
              color={activeTab === 'withdraw' ? lu.colors.ink : lu.colors.muted}
              weight={activeTab === 'withdraw' ? 'bold' : 'regular'}
            >
              السحب
            </Text>
          </Pressable>
        </View>

        {/* ===== Tab Content ===== */}
        {activeTab === 'collect_proxy' && isAgent && (
          <View style={styles.proxyContainer}>
            <Text variant="body" weight="bold" color="#9CA3AF" style={styles.proxyTitle}>
              جمع اللآلئ نيابة عن
            </Text>

            {/* Link 1 */}
            <Pressable
              onPress={() => router.push('/agency/collect' as any)}
              style={styles.proxyLinkRow}
            >
              <ChevronLeftRtl size={18} color="#9CA3AF" />
              <View style={styles.proxyLinkContent}>
                <Text variant="button" weight="bold" color={lu.colors.ink}>
                  سجلات تحصيل لؤلؤة المضيفين
                </Text>
              </View>
              <View style={[styles.proxyIconBg, { backgroundColor: '#FFE6E9' }]}>
                <Award size={20} color={lu.colors.pink} />
              </View>
            </Pressable>

            {/* Link 2 */}
            <Pressable
              onPress={() => router.push('/wallet/pearl-log?tab=all' as any)}
              style={styles.proxyLinkRow}
            >
              <ChevronLeftRtl size={18} color="#9CA3AF" />
              <View style={styles.proxyLinkContent}>
                <Text variant="button" weight="bold" color={lu.colors.ink}>
                  سجلات تحصيل لؤلؤة الآخرين
                </Text>
              </View>
              <View style={[styles.proxyIconBg, { backgroundColor: '#FDEAEA' }]}>
                <FileText size={20} color={lu.colors.blue} />
              </View>
            </Pressable>

            {/* Link 3 */}
            <Pressable
              onPress={() => router.push('/wallet/pearl-log?tab=refund' as any)}
              style={styles.proxyLinkRow}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={styles.redDot} />
                <ChevronLeftRtl size={18} color="#9CA3AF" />
              </View>
              <View style={styles.proxyLinkContent}>
                <Text variant="button" weight="bold" color={lu.colors.ink}>
                  إسترداد أموال للداعمين، تأثر اللؤلؤ
                </Text>
              </View>
              <View style={[styles.proxyIconBg, { backgroundColor: '#FEE2E2' }]}>
                <ArrowRightLeft size={20} color={lu.colors.purple} />
              </View>
            </Pressable>
          </View>
        )}

        {activeTab === 'exchange' && (
          <View style={styles.sectionCard}>
            <ExchangeSection />
          </View>
        )}

        {activeTab === 'withdraw' && (
          <>
            {agencyId ? (
              <>
                <HostAgentTransferSection pearls={pearls} permissions={permissions} />
                <AgentWithdrawSection pearls={pearls} permissions={permissions} />
              </>
            ) : null}

            <SelfWithdrawSection pearls={pearls} permissions={permissions} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...lu.shadows.card,
  },
  logBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...lu.shadows.card,
  },
  balanceCard: {
    height: 140,
    borderRadius: 32,
    marginBottom: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 24,
    position: 'relative',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 12,
  },
  balanceGlow: {
    position: 'absolute',
    top: -40,
    left: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(225, 20, 20, 0.25)',
    filter: 'blur(20px)',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    zIndex: 1,
  },
  pearlsIcon: {
    width: 64,
    height: 64,
  },
  balanceText: {
    fontSize: 34,
    lineHeight: 40,
    color: '#fff',
    fontFamily: lu.fonts.displayHeavy,
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  note: {
    marginBottom: 20,
    lineHeight: 18,
    textAlign: 'right',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 28,
    padding: 6,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 24,
  },
  tabItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tabUnderline: { display: 'none' },
  proxyContainer: {
    marginBottom: 20,
  },
  proxyTitle: {
    marginBottom: 16,
    fontSize: 14,
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  proxyLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  proxyLinkContent: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 12,
  },
  proxyIconBg: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    ...lu.shadows.card,
  },
});
