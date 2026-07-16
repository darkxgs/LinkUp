/**
 * مركز الوكالة — للوكلاء
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ImageBackground,
  Modal,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const CITY_SKYLINE_URL = 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1000&auto=format&fit=crop';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { copyToClipboard } from '@/utils/copyToClipboard';
import { TrendingUp, Users, Gift, PhoneCall, MessageSquare, MoreHorizontal, UserPlus, BarChart3, Building2, LogOut, Crown, Gem, Copy, KeyRound, Headphones, Wallet, MessageCircle, HelpCircle, ChevronDown, RotateCcw, PieChart, Sparkles, Eye, Camera, Inbox } from 'lucide-react-native';
import { ArrowUpRight, ChevronLeft } from '@/components/ui/RtlIcons';

import { Text, useAlert, RealCountryFlag } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import { RoomSettingsSheet } from '@/components/room/RoomSettingsSheet';
import { useAuth } from '@/hooks/useAuth';
import { resolveAgencyLogoImage } from '@/utils/agencyBubbleImage';
import {
  subscribeToMyAgency,
  getCachedMyAgency,
  getAgencyById,
  getAgencyEarningsSummary,
  getAgencyManagerAnalytics,
  invalidateAgencyAnalyticsCache,
  enterAgencyLiveRoom,
  fetchAgencyJoinRequests,
  withdrawAgencySalary,
  type Agency,
  type AgencyEarningsSummary,
} from '@/services/agencyService';
import { computeAgentEntitlement } from '@/services/agencySalary';
import { SimpleLineChart } from '@/components/agency/SimpleLineChart';
import { Clock, AlertCircle } from 'lucide-react-native';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/services/firebase';
import {
  subscribeToMyAgencyApplication,
  type AgencyApplication,
} from '@/services/agencyApplications';
import { getDisplayAccountId } from '@/services/userIdentifier';
import { resolveCountryCodeFromValue } from '@/utils/countryCode';
import { lu } from '@/theme/lu-brand';
import { spacing, radius } from '@/theme';
import {
  resolveAgencyPeriodLevelIndex,
  getAgencyLevelProgress,
  getAgencyLevelDef,
} from '@/services/agencyLevels';
import { getAgencyPeriodWeekKey } from '@/services/agencyService';
import { useAgencyLevelsConfig } from '@/hooks/useAgencyLevelsConfig';
import {
  subscribeToAgencyChat,
  updateAgencyChatName,
  uploadAndSetAgencyChatAvatar,
  openAgencyChat,
} from '@/services/firebase/agencyChat';
import { isAgencyAgent } from '@/services/firebase/hostTasks';

type Tab = 'income' | 'management';
type Period = 'week' | 'last_week' | '4weeks';
type IncomeType = 'all' | 'chat' | 'gifts' | 'calls' | 'refund' | 'other';

function fmt(n: number | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  return v.toLocaleString('en-US');
}
export default function AgencyCenterScreen() {
  const { t } = useTranslation();
  const { showToast } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // فتح فوري: ابدأ من آخر وكالة مخزّنة (إن وُجدت) بدل انتظار أول لقطة من Firestore
  const cachedAgency = getCachedMyAgency();
  // نبدأ من تبويب «إدارة الوكالة» (الخيارات السبعة) لا «الدخل» — هو ما يتوقّعه المالك
  // عند فتح مركز الوكالة (كان يفتح على الدخل فيبدو أنّ لوحة الإدارة مفقودة).
  const [tab, setTab] = useState<Tab>('management');
  const [agency, setAgency] = useState<Agency | null>(cachedAgency);
  const [summary, setSummary] = useState<AgencyEarningsSummary | null>(null);
  const [period, setPeriod] = useState<Period>('week');
  const [incomeType, setIncomeType] = useState<IncomeType>('all');
  const [chartSeries, setChartSeries] = useState<Array<{ label: string; value: number }>>([]);
  const [loading, setLoading] = useState(!cachedAgency);
  const [refreshing, setRefreshing] = useState(false);
  const [application, setApplication] = useState<AgencyApplication | null>(null);
  const isAgent = isAgencyAgent(user) || !!agency;
  const isHostOnly = !!user?.agencyId && !isAgent;

  useEffect(() => {
    if (!loading && isHostOnly) {
      router.replace('/(tabs)/profile' as any);
    }
  }, [loading, isHostOnly, router]);

  useEffect(() => {
    const unsubAgency = subscribeToMyAgency(async (a) => {
      if (a) {
        setAgency(a);
        setLoading(false);
        return;
      }
      if (user?.uid) {
        try {
          const userSnap = await getDoc(doc(firestore, 'users', user.uid));
          const data = userSnap.data();
          const agencyId = data?.agencyId as string | undefined;
          const userIsAgent = isAgencyAgent(data);
          if (agencyId && userIsAgent) {
            const byId = await getAgencyById(agencyId);
            if (byId) setAgency(byId);
          }
        } catch {
          // ignore
        }
      }
      setLoading(false);
    });
    const unsubApp = subscribeToMyAgencyApplication(setApplication);
    return () => {
      unsubAgency();
      unsubApp();
    };
  }, [user?.uid]);

  const loadSummary = useCallback((force = false) => {
    return getAgencyEarningsSummary(period, { force })
      .then(setSummary)
      .catch(() => {});
  }, [period]);

  const loadChart = useCallback((force = false) => {
    const analyticsPeriod = period === '4weeks' ? '4weeks_day' : period;
    return getAgencyManagerAnalytics(
      { period: analyticsPeriod, dataType: 'income', incomeType },
      { force },
    )
      .then((res) => setChartSeries(res.series ?? []))
      .catch(() => setChartSeries([]));
  }, [period, incomeType]);

  useEffect(() => {
    if (!agency) return;
    loadSummary();
  }, [agency, loadSummary]);

  useEffect(() => {
    if (!agency) return;
    loadChart();
  }, [agency, loadChart]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // السحب للتحديث يتجاوز الكاش ويجلب بيانات جديدة للملخّص والرسم معاً
      invalidateAgencyAnalyticsCache();
      await Promise.all([loadSummary(true), loadChart(true)]);
    } finally {
      setRefreshing(false);
    }
  };

  const copyInviteCode = useCallback(async () => {
    if (!agency?.inviteCode) return;
    await copyToClipboard(agency.inviteCode);
    showToast(t('common.copied'));
  }, [agency?.inviteCode, showToast, t]);

  if (loading || isHostOnly) {
    return (
      <View style={[styles.fill, styles.centered]}>
        <ActivityIndicator color={lu.colors.pink} />
      </View>
    );
  }

  if (!agency) {
    return (
      <View style={styles.fill}>
        <LinearGradient
          colors={lu.gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 8 }]}
        >
          <View style={styles.header}>
            <View style={styles.headBtnPlaceholder} />
            <Text weight="bold" style={styles.headTitle}>
              {t('profile.agencyCenter')}
            </Text>
            <Pressable onPress={() => router.back()} style={styles.headBtn} hitSlop={10}>
              <BackChevron color="#fff" size={22} />
            </Pressable>
          </View>
        </LinearGradient>
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Crown size={32} color={lu.colors.purple} strokeWidth={2} />
          </View>
          <Text variant="h4" weight="bold" align="center">
            {t('agency.text3912')}
          </Text>
          {application && application.status !== 'active' ? (
            <>
              <View style={[
                styles.statusPill,
                application.status === 'rejected' && styles.statusPillRejected,
              ]}>
                <Text
                  variant="caption"
                  color={application.status === 'rejected' ? '#EF4444' : lu.colors.purple}
                  weight="bold"
                >
                  {({
                    pending:       t('agency.statusUnderReview'),
                    awaiting_hosts: t('agency.statusPending'),
                    ready:         t('agency.statusReady'),
                    active:        t('agency.statusActive'),
                    rejected:      t('agency.statusRejected'),
                    expired:       t('agency.statusExpired'),
                  } as Record<string, string>)[application.status] ?? application.status}
                </Text>
              </View>
              <Text variant="caption" color={lu.colors.ink2} align="center" style={{ marginTop: 8 }}>
                {application.agencyName}
              </Text>
              {/* T-3: مهلة المراجعة 12 ساعة */}
              {application.status === 'pending' && application.reviewDeadline ? (
                <View style={styles.reviewDeadlineRow}>
                  <Clock size={12} color={lu.colors.ink2} strokeWidth={2} />
                  <Text variant="caption" color={lu.colors.ink2}>
                    {t('agency.reviewWithin', {
                      hours: Math.max(0, Math.ceil((application.reviewDeadline - Date.now()) / (1000 * 60 * 60))),
                    })}
                  </Text>
                </View>
              ) : null}
              {/* T-2: سبب الرفض */}
              {application.status === 'rejected' && application.rejectionReason ? (
                <View style={styles.rejectionBox}>
                  <Text variant="caption" weight="semibold" color="#EF4444">
                    {t('agency.rejectionReasonLabel')}
                  </Text>
                  <Text variant="caption" color={lu.colors.ink2} align="center" style={{ marginTop: 4 }}>
                    {application.rejectionReason}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <Text variant="caption" color={lu.colors.ink2} align="center" style={{ marginTop: 8 }}>
              {t('agency.text89400')}
            </Text>
          )}
          <Pressable
            onPress={() => router.push('/agency/apply' as any)}
            style={styles.primaryBtn}
          >
            <LinearGradient colors={lu.gradients.brand} style={StyleSheet.absoluteFill} />
            <Text variant="button" color="#fff" weight="bold">
              {application ? t('agencyApply.viewRequest') : t('agencyApply.openRequest')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // وكالة منتهية فقط تُظهر شاشة الحالة الكاملة (طريق مسدود). الوكالة «المعلّقة»
  // (تمّت الموافقة لكن لم تكتمل المضيفات) لم تعد تحجب لوحة الإدارة عن المالك —
  // تسقط للوحة الكاملة أدناه مع شريط تقدّم التوظيف داخلها (كان المالك يهبط على
  // «دعوة مضيفات» بدل لوحة الإدارة). راجع البانر المعلّق داخل ScrollView أدناه.
  if (agency.status === 'expired') {
    const isExpired = agency.status === 'expired';
    const femaleCount = (agency as any).femaleHostCount ?? 0;
    const minRequired = (agency as any).minHostsRequired ?? 10;
    const deadline = (agency as any).hostsDeadline ?? 0;
    const daysLeft = deadline
      ? Math.max(0, Math.ceil((deadline - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;

    return (
      <View style={styles.fill}>
        <LinearGradient
          colors={isExpired ? ['#9CA3AF', '#6B7280'] : ['#E11414', '#C40E1E', '#E11414']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 8 }]}
        >
          <View style={styles.header}>
            <View style={styles.headBtnPlaceholder} />
            <Text weight="bold" style={styles.headTitle}>
              {t('profile.agencyCenter')}
            </Text>
            <Pressable onPress={() => router.back()} style={styles.headBtn} hitSlop={10}>
              <BackChevron color="#fff" size={22} />
            </Pressable>
          </View>
          <View style={styles.agencyHeroRow}>
            <View style={styles.agencyAvatar}>
              {isExpired
                ? <AlertCircle size={28} color="#fff" strokeWidth={2} />
                : <Clock size={28} color="#fff" strokeWidth={2} />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text weight="bold" style={styles.agencyName} numberOfLines={1}>
                {agency.name}
              </Text>
              <Text style={styles.agencyMeta}>
                {isExpired
                  ? t('agency.statusExpired')
                  : t('agency.statusPending')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.emptyCard, { marginTop: 12 }]}>
          {isExpired ? (
            <>
              <AlertCircle size={40} color="#EF4444" strokeWidth={1.8} />
              <Text variant="h4" weight="bold" align="center" style={{ marginTop: 12 }}>
                {t('agency.expiredTitle')}
              </Text>
              <Text variant="caption" color={lu.colors.ink2} align="center" style={{ marginTop: 8 }}>
                {t('agency.expiredHint')}
              </Text>
            </>
          ) : (
            <>
              {/* شريط التقدم */}
              <View style={{ width: '100%', marginBottom: 16 }}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>{t('agency.hostsProgress')}</Text>
                  <Text weight="bold" style={[styles.progressLabel, { color: femaleCount >= minRequired ? lu.colors.mint : lu.colors.pink }]}>
                    {femaleCount} / {minRequired}
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, Math.round((femaleCount / minRequired) * 100))}%` as any }]} />
                </View>
              </View>

              {/* كود الدعوة */}
              {agency.inviteCode ? (
                <Pressable
                  onPress={copyInviteCode}
                  style={styles.inviteCodeBox}
                  hitSlop={8}
                >
                  <View style={styles.inviteCodeInner}>
                    <KeyRound size={16} color={lu.colors.purple} strokeWidth={2} />
                    <Text weight="bold" style={styles.inviteCodeText}>
                      {agency.inviteCode}
                    </Text>
                    <Copy size={16} color={lu.colors.purple} />
                  </View>
                  <Text style={styles.inviteCodeHint}>{t('agency.tapToCopyCode')}</Text>
                </Pressable>
              ) : null}

              {/* المهلة المتبقية */}
              {daysLeft > 0 && (
                <View style={styles.deadlineRow}>
                  <Clock size={14} color={daysLeft <= 2 ? '#EF4444' : lu.colors.ink2} strokeWidth={2} />
                  <Text style={[styles.deadlineText, daysLeft <= 2 && { color: '#EF4444' }]}>
                    {t('agency.daysLeft', { count: daysLeft })}
                  </Text>
                </View>
              )}

              {/* أزرار الإجراءات */}
              <Pressable
                onPress={() => router.push('/agency/invite' as any)}
                style={[styles.primaryBtn, { marginTop: 16 }]}
              >
                <LinearGradient colors={lu.gradients.brand} style={StyleSheet.absoluteFill} />
                <Text variant="button" color="#fff" weight="bold">
                  {t('agency.inviteHosts')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/agency/members' as any)}
                style={[styles.primaryBtn, { marginTop: 8, backgroundColor: lu.colors.bg2 }]}
              >
                <Text variant="button" color={lu.colors.purple} weight="bold">
                  {t('agency.viewMembers')}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    );
  }

  const avatar =
    agency.ownerAvatar?.startsWith('http') ? agency.ownerAvatar : null;
  const publicId = getDisplayAccountId(user?.publicAccountId, user?.uid ?? '');

  return (
    <View style={[styles.fill, { backgroundColor: '#140A0C' }]}>
      {/* City Skyline Background Header */}
      <ImageBackground
        // نعرض خلفية الوكالة المرفوعة (agency.banner) إن وُجدت، وإلا صورة المدينة
        // الافتراضية — كانت الخلفية المرفوعة تُحفظ بالباك لكن هذه الصفحة لا تقرأها.
        source={{ uri: agency.banner?.startsWith('http') ? agency.banner : CITY_SKYLINE_URL }}
        style={{ width: '100%', height: 280, position: 'absolute', top: 0 }}
        imageStyle={{ opacity: 0.6 }}
      >
        <LinearGradient
          colors={['rgba(20, 10, 12, 0.2)', 'rgba(20, 10, 12, 0.9)', '#140A0C']}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <View style={[styles.headerCustom, { paddingTop: insets.top + 8, backgroundColor: 'transparent', borderBottomWidth: 0 }]}>
        <Pressable
          onPress={() => router.push('/agency/bd-center' as any)}
          style={[styles.headBtnCustom, { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}
          hitSlop={10}
        >
          <BarChart3 size={20} color="#fff" strokeWidth={2.2} />
        </Pressable>
        <Text weight="bold" style={[styles.headTitleCustom, { color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }]}>
          مركز الوكالة
        </Text>
        <Pressable onPress={() => router.back()} style={[styles.headBtnCustom, { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]} hitSlop={10}>
          <BackChevron color="#fff" size={22} />
        </Pressable>
      </View>

      <View style={[styles.tabsWrapCustom, { backgroundColor: 'transparent', borderBottomColor: 'rgba(255,255,255,0.1)' }]}>
        {(
          [
            { id: 'management' as Tab, label: 'إدارة الوكالة' },
            { id: 'income' as Tab, label: 'الدخل' },
          ] as const
        ).map((item) => {
          const active = tab === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setTab(item.id)}
              style={styles.tabBtnCustom}
            >
              <Text
                weight="bold"
                style={[styles.tabLabelCustom, { color: active ? '#D4AF37' : 'rgba(255,255,255,0.5)' }]}
              >
                {item.label}
              </Text>
              {active && (
                <View style={[styles.tabUnderlineCustom, { backgroundColor: '#D4AF37' }]} />
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1, backgroundColor: 'transparent', borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: insets.bottom + 88,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lu.colors.purple} />
        }
      >
        {agency.status === 'pending' ? (
          <View style={[styles.emptyCard, { marginTop: 0, marginBottom: 12, paddingVertical: 14, alignItems: 'stretch' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Clock size={18} color={lu.colors.pink} strokeWidth={2} />
              <Text weight="bold" style={{ color: lu.colors.ink, flex: 1, marginHorizontal: 8 }}>
                {t('agency.statusPending')}
              </Text>
              {((agency as any).hostsDeadline ?? 0) > 0 && (
                <Text style={[styles.deadlineText, (Math.max(0, Math.ceil((((agency as any).hostsDeadline ?? 0) - Date.now()) / 86_400_000)) <= 2) && { color: '#EF4444' }]}>
                  {t('agency.daysLeft', { count: Math.max(0, Math.ceil((((agency as any).hostsDeadline ?? 0) - Date.now()) / 86_400_000)) })}
                </Text>
              )}
            </View>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>{t('agency.hostsProgress')}</Text>
              <Text weight="bold" style={[styles.progressLabel, { color: (((agency as any).femaleHostCount ?? 0) >= ((agency as any).minHostsRequired ?? 10)) ? lu.colors.mint : lu.colors.pink }]}>
                {(agency as any).femaleHostCount ?? 0} / {(agency as any).minHostsRequired ?? 10}
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(100, Math.round((((agency as any).femaleHostCount ?? 0) / ((agency as any).minHostsRequired ?? 10)) * 100))}%` as any }]} />
            </View>
            {agency.inviteCode ? (
              <Pressable onPress={copyInviteCode} style={[styles.inviteCodeBox, { marginTop: 12 }]} hitSlop={8}>
                <View style={styles.inviteCodeInner}>
                  <KeyRound size={16} color={lu.colors.purple} strokeWidth={2} />
                  <Text weight="bold" style={styles.inviteCodeText}>{agency.inviteCode}</Text>
                  <Copy size={16} color={lu.colors.purple} />
                </View>
                <Text style={styles.inviteCodeHint}>{t('agency.tapToCopyCode')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {tab === 'income' ? (
          <IncomeTab
            agency={agency}
            summary={summary}
            period={period}
            setPeriod={setPeriod}
            incomeType={incomeType}
            setIncomeType={setIncomeType}
            chartSeries={chartSeries}
          />
        ) : (
          <ManagementTab agency={agency} router={router} publicId={publicId} />
        )}
      </ScrollView>
      </View>
    </View>
  );
}

function fmt2(n: number | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0.00';
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function IncomeTab({
  agency,
  summary,
  period,
  setPeriod,
  incomeType,
  setIncomeType,
  chartSeries,
}: {
  agency: Agency | null;
  summary: AgencyEarningsSummary | null;
  period: Period;
  setPeriod: (p: Period) => void;
  incomeType: IncomeType;
  setIncomeType: (t: IncomeType) => void;
  chartSeries: Array<{ label: string; value: number }>;
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const levelsConfig = useAgencyLevelsConfig();

  const periodSupportCoins = useMemo(() => {
    if (!agency) return 0;
    const weekKey = getAgencyPeriodWeekKey();
    if (String(agency.periodSupportWeekKey ?? '') !== weekKey) return 0;
    return Math.max(0, Number(agency.periodSupportCoins) || 0);
  }, [agency]);

  const totalEarnings = summary?.totalEarnings ?? 0;
  const todayEarnings = summary?.todayEarnings ?? 0;
  const agentBonus = summary?.agentBonus ?? 0;

  const { activeLevelIndex, nextLevel, neededHostCoins, neededManagerCoins } = useMemo(() => {
    const progress = getAgencyLevelProgress(periodSupportCoins, levelsConfig);
    const idx = resolveAgencyPeriodLevelIndex(
      periodSupportCoins,
      agency?.periodLevel,
      agency?.periodLevelManual,
      levelsConfig,
    );
    const levels = levelsConfig.levels;
    const current = idx >= 0 ? levels[idx] : null;
    const nextDef = progress.nextLevel
      ? getAgencyLevelDef(progress.nextLevel, levelsConfig)
      : null;
    return {
      activeLevelIndex: idx,
      nextLevel: nextDef,
      neededHostCoins: progress.remainingCoins,
      neededManagerCoins: nextDef
        ? nextDef.managerBonus - (current?.managerBonus ?? 0)
        : 0,
    };
  }, [periodSupportCoins, agency?.periodLevel, agency?.periodLevelManual, levelsConfig]);

  const periods = useMemo(() => [
    { id: 'week' as Period, label: t('time.thisWeek', 'هذا الأسبوع') },
    { id: 'last_week' as Period, label: t('time.lastWeek', 'الأسبوع الماضي') },
    { id: '4weeks' as Period, label: t('agency.text4766', 'آخر 4 أسابيع') },
  ], [t]);

  const handleShowInfo = useCallback((title: string, message: string) => {
    Alert.alert(title, message);
  }, []);

  const router = useRouter();

  const incomeTypes = useMemo(() => [
    { id: 'all' as IncomeType, label: 'الجميع' },
    { id: 'chat' as IncomeType, label: 'دردشة' },
    { id: 'gifts' as IncomeType, label: 'هدايا' },
    { id: 'calls' as IncomeType, label: 'مكالمات' },
    { id: 'refund' as IncomeType, label: 'استرداد' },
    { id: 'other' as IncomeType, label: 'أخرى' },
  ], []);

  // محفظة راتب الوكيل — إجمالي كوينز العمل + المرحلة المحقَّقة + السحب (يوم 2)
  const [withdrawingSalary, setWithdrawingSalary] = useState(false);
  const walletWorkCoins = Math.max(0, Number(agency?.walletWorkCoins) || 0);
  const salaryEnt = useMemo(() => computeAgentEntitlement(walletWorkCoins), [walletWorkCoins]);
  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const alreadyWithdrawnThisMonth = String(agency?.walletLastWithdrawMonthKey ?? '') === currentMonthKey;

  const handleWithdrawSalary = useCallback(async () => {
    if (withdrawingSalary) return;
    if (!salaryEnt.tier || salaryEnt.entitlementCoins <= 0) {
      Alert.alert('لا يوجد استحقاق', 'لم تبلغ الوكالة أدنى مرحلة في جدول الوكلاء لهذا الشهر.');
      return;
    }
    setWithdrawingSalary(true);
    try {
      const r = await withdrawAgencySalary();
      Alert.alert(
        'تم سحب الراتب ✓',
        `تم تحويل ${r.entitlementCoins.toLocaleString()} كوين (${r.diamonds} ماسة) إلى محفظة بروفايلك.\nحوّلها إلى ماس ثم قدّم طلب السحب الذاتي (رسوم 2%).`,
      );
    } catch (e: any) {
      Alert.alert('تعذّر السحب', e?.message ?? 'حدث خطأ');
    } finally {
      setWithdrawingSalary(false);
    }
  }, [withdrawingSalary, salaryEnt]);

  const canWithdraw = !!salaryEnt.tier && salaryEnt.entitlementCoins > 0 && !alreadyWithdrawnThisMonth;

  return (
    <>
      {/* محفظة الوكيل */}
      <View style={styles.walletCard}>
        <View style={styles.walletHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Wallet size={18} color="#FDE047" strokeWidth={2} />
            <Text weight="bold" style={{ color: '#fff', fontSize: 15 }}>محفظة الوكالة</Text>
          </View>
          <Pressable onPress={() => router.push('/agency/host-balances' as any)} hitSlop={8}>
            <Text style={{ color: '#FDE047', fontSize: 12 }}>أرصدة البنات (سحب بالنيابة) ›</Text>
          </Pressable>
        </View>

        <Text style={styles.walletLabel}>إجمالي كوينز العمل هذا الشهر</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
          <Text weight="bold" style={styles.walletBig}>{walletWorkCoins.toLocaleString()}</Text>
          <Text style={styles.walletUnit}>كوين</Text>
        </View>

        <View style={styles.walletDivider} />

        <View style={styles.walletRow}>
          <Text style={styles.walletRowLabel}>المرحلة المحقَّقة</Text>
          <Text weight="bold" style={styles.walletRowValue}>
            {salaryEnt.tier ? `${salaryEnt.tier.target.toLocaleString()} (${salaryEnt.tier.collectionPct}%)` : 'لم تبلغ أدنى مرحلة'}
          </Text>
        </View>
        <View style={styles.walletRow}>
          <Text style={styles.walletRowLabel}>استحقاقك للسحب</Text>
          <Text weight="bold" style={[styles.walletRowValue, { color: '#FDE047' }]}>
            {salaryEnt.entitlementCoins.toLocaleString()} كوين = {salaryEnt.diamonds} ماسة
          </Text>
        </View>
        {salaryEnt.nextTier ? (
          <Text style={styles.walletHint}>
            المرحلة التالية عند {salaryEnt.nextTier.target.toLocaleString()} كوين — الزيادة تتراكم للشهر القادم.
          </Text>
        ) : null}

        <Pressable
          onPress={handleWithdrawSalary}
          disabled={!canWithdraw || withdrawingSalary}
          style={[styles.walletBtn, (!canWithdraw || withdrawingSalary) && { opacity: 0.5 }]}
        >
          {withdrawingSalary ? (
            <ActivityIndicator color="#1a1012" />
          ) : (
            <Text weight="bold" style={{ color: '#1a1012', fontSize: 14 }}>
              {alreadyWithdrawnThisMonth ? 'تم سحب راتب هذا الشهر' : 'سحب الراتب (يوم 2 شهرياً)'}
            </Text>
          )}
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 12, gap: 8, paddingHorizontal: 20 }}>
        {periods.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => setPeriod(p.id)}
            style={[
              {
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
              },
              period === p.id && {
                backgroundColor: 'rgba(212, 175, 55, 0.15)',
                borderColor: '#D4AF37',
                shadowColor: '#D4AF37',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 10,
              }
            ]}
          >
            <Text
              weight="bold"
              style={{
                fontSize: 12,
                color: period === p.id ? '#D4AF37' : 'rgba(255,255,255,0.6)',
                fontFamily: lu.fonts.bodySemi,
              }}
            >
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ paddingHorizontal: 20 }}>
        {incomeTypes.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setIncomeType(t.id)}
            style={[
              {
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
                marginEnd: 8,
              },
              incomeType === t.id && {
                backgroundColor: 'rgba(225, 20, 20, 0.15)',
                borderColor: '#E11414',
                shadowColor: '#E11414',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 10,
              },
            ]}
          >
            <Text
              weight="bold"
              style={{
                fontSize: 12,
                color: incomeType === t.id ? '#FCA5A5' : 'rgba(255,255,255,0.6)',
                fontFamily: lu.fonts.bodySemi,
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        onPress={() => router.push('/agency/host-chart' as any)}
        style={[styles.hostsIncomeCard, { marginBottom: 12, marginHorizontal: 20 }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <ChevronLeft size={16} color="#FCA5A5" />
          <Text style={styles.incomeCardLabel}>خط بيانات المضيفين</Text>
        </View>
        <SimpleLineChart data={chartSeries} height={140} valueSuffix="ماسة" />
      </Pressable>

      <View style={[styles.managerIncomeCard, { marginHorizontal: 20 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
          <Pressable onPress={() => handleShowInfo('دخل المدير للفترة', 'هذا هو إجمالي الأرباح والمكافآت التي يحصل عليها مدير الوكالة خلال الفترة المحددة.')}>
            <HelpCircle size={14} color="rgba(255,255,255,0.4)" />
          </Pressable>
          <Text style={styles.incomeCardLabel}>دخل المدير لهذه الفترة</Text>
        </View>
        <View style={styles.incomeValueRow}>
          <Image source={require('../../assets/masa.webp')} style={{ width: 28, height: 28 }} contentFit="contain" />
          <Text style={styles.incomeValueText}>{fmt2(agentBonus)}</Text>
        </View>
      </View>

      <View style={[styles.hostsIncomeCard, { marginHorizontal: 20 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
          <Pressable onPress={() => handleShowInfo('إجمالي دخل المضيفين', 'يمثل هذا إجمالي اللآلئ التي حصل عليها جميع مضيفي الوكالة مجتمعين خلال هذه الفترة.')}>
            <HelpCircle size={14} color="rgba(255,255,255,0.4)" />
          </Pressable>
          <Text style={styles.incomeCardLabel}>إجمالي دخل جميع المضيفين لهذه الفترة</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <Pressable
            onPress={() => router.push('/agency/collect')}
            style={styles.logsBtn}
          >
            <ChevronLeft size={16} color="#D4AF37" strokeWidth={2.5} />
            <Text style={styles.logsBtnText}>السجلات</Text>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {todayEarnings > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginEnd: 8 }}>
                <Text style={styles.todayValueText}>↑ {fmt2(todayEarnings)}</Text>
                <Text style={styles.todayLabelText}>اليوم</Text>
              </View>
            )}
            <Image source={require('../../assets/masa.webp')} style={{ width: 22, height: 22 }} contentFit="contain" />
            <Text style={styles.hostsValueText}>{fmt2(totalEarnings)}</Text>
          </View>
        </View>
      </View>

      {nextLevel && (
        <View style={[styles.warningCard, { marginHorizontal: 20 }]}>
          <View style={styles.warningRow}>
            <View style={{ flex: 1, alignItems: 'flex-start' }}>
              <Text style={styles.warningLabel}>يمكن للمدير الحصول على إضافية</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Image source={require('../../assets/masa.webp')} style={{ width: 16, height: 16 }} contentFit="contain" />
                <Text style={styles.warningValue}>{fmt2(neededManagerCoins)}</Text>
              </View>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.warningLabel}>متبقّي للمستوى التالي (كوين)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Image source={require('../../assets/masa.webp')} style={{ width: 16, height: 16 }} contentFit="contain" />
                <Text style={styles.warningValue}>{fmt2(neededHostCoins)}</Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={() => setIsExpanded(!isExpanded)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 16,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.05)',
              gap: 4,
            }}
          >
            <ChevronDown size={16} color="#FCA5A5" style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }} />
            <Text style={{ fontSize: 13, color: '#FCA5A5', fontFamily: lu.fonts.bodyBold }}>المزيد</Text>
          </Pressable>

          {isExpanded && (
            <View style={{ marginTop: 12, padding: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 20, textAlign: 'right' }}>
                طريقة احتساب مستويات فترة الوكالة:
                {'\n'}
                يُحسب المستوى من إجمالي الدعم بالكوينز (قيمة الهدايا) داخل الوكالة خلال آخر 7 أيام. كل مستوى جديد يتطلب حداً أعلى من الدعم كما في الجدول.
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={[styles.levelsTableContainer, { marginHorizontal: 20 }]}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, { width: '40%', textAlign: 'left' }]}>
            إجمالي اللآلئ التي يمكن للمدير الحصول عليها
          </Text>
          <Text style={[styles.tableHeaderCell, { width: '40%', textAlign: 'center' }]}>
            حد الدعم بالكوينز
          </Text>
          <Text style={[styles.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>
            المستوى
          </Text>
        </View>

        {levelsConfig.levels.map((lvl, idx) => {
          const isActive = idx === activeLevelIndex;
          return (
            <View
              key={lvl.level}
              style={[
                styles.tableRow,
                isActive && styles.tableRowActive
              ]}
            >
              <View style={[styles.tableCellContent, { width: '40%', justifyContent: 'flex-start' }]}>
                <Image source={require('../../assets/masa.webp')} style={{ width: 14, height: 14, opacity: isActive ? 1 : 0.4 }} contentFit="contain" />
                <Text style={[styles.tableCellText, isActive && styles.tableCellTextActive]}>
                  {fmt2(lvl.managerBonus)}
                </Text>
              </View>

              <View style={[styles.tableCellContent, { width: '40%', justifyContent: 'center' }]}>
                <Image source={require('../../assets/masa.webp')} style={{ width: 14, height: 14, opacity: isActive ? 1 : 0.4 }} contentFit="contain" />
                <Text style={[styles.tableCellText, isActive && styles.tableCellTextActive]}>
                  {fmt2(lvl.supportTarget ?? lvl.hostTarget)}
                </Text>
              </View>

              <View style={[styles.tableCellContent, { width: '20%', justifyContent: 'flex-end', gap: 6 }]}>
                <Text style={[styles.tableCellText, isActive && styles.tableCellTextActive, { fontFamily: lu.fonts.bodyBold }]}>
                  المستوى {lvl.level}
                </Text>
                {isActive && (
                  <View style={styles.activeIndicatorTriangle} />
                )}
              </View>
            </View>
          );
        })}
      </View>
    </>
  );
}

function ManagementTab({
  agency,
  router,
  publicId,
}: {
  agency: Agency;
  router: ReturnType<typeof useRouter>;
  publicId: string;
}) {
  const countryCode = useMemo(() => resolveCountryCodeFromValue(agency.country), [agency.country]);
  const [clanModalOpen, setClanModalOpen] = useState(false);
  const [clanName, setClanName] = useState(agency.name);
  const [clanAvatar, setClanAvatar] = useState('');
  const [clanSaving, setClanSaving] = useState(false);
  const [clanAvatarBusy, setClanAvatarBusy] = useState(false);
  const [showAgencySettings, setShowAgencySettings] = useState(false);
  const [settingsRoomId, setSettingsRoomId] = useState<string | null>(null);
  const [openingSettings, setOpeningSettings] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchAgencyJoinRequests()
      .then((reqs) => { if (!cancelled) setPendingRequestsCount(reqs.length); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [agency.id]);

  const handleOpenAgencySettings = useCallback(async () => {
    if (openingSettings) return;
    setOpeningSettings(true);
    try {
      const roomId = await enterAgencyLiveRoom(agency.id);
      setSettingsRoomId(roomId);
      setShowAgencySettings(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'تعذّر فتح إعدادات الوكالة';
      Alert.alert('خطأ', msg);
    } finally {
      setOpeningSettings(false);
    }
  }, [agency.id, openingSettings]);

  useEffect(() => {
    if (!agency?.id) return;
    return subscribeToAgencyChat(agency.id, (chat) => {
      setClanName(chat?.name?.trim() || agency.name);
      setClanAvatar(chat?.avatar?.trim() || '');
    });
  }, [agency.id, agency.name]);

  const handleSaveClanName = async () => {
    const next = clanName.trim();
    if (next.length < 2) {
      Alert.alert('تنبيه', 'اسم العشيرة يجب أن يكون حرفين على الأقل');
      return;
    }
    setClanSaving(true);
    try {
      await updateAgencyChatName(agency.id, next);
      Alert.alert('تم', 'تم تحديث اسم العشيرة لجميع الأعضاء');
      setClanModalOpen(false);
    } catch (e: any) {
      Alert.alert('خطأ', e?.message ?? 'تعذّر حفظ الاسم');
    } finally {
      setClanSaving(false);
    }
  };

  const handleChangeClanAvatar = async () => {
    if (clanAvatarBusy) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('تنبيه', 'يلزم إذن الوصول للصور لتغيير صورة العشيرة');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    setClanAvatarBusy(true);
    try {
      const r = await uploadAndSetAgencyChatAvatar(agency.id, res.assets[0].uri);
      setClanAvatar(r.avatar);
      Alert.alert('تم', 'تم تحديث صورة العشيرة لجميع الأعضاء');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message ?? 'تعذّر تحديث صورة العشيرة');
    } finally {
      setClanAvatarBusy(false);
    }
  };

  const handleOpenClanChat = async () => {
    try {
      await openAgencyChat(agency.id);
      router.push(`/agency/chat?agencyId=${agency.id}` as any);
    } catch (e: any) {
      Alert.alert('خطأ', e?.message ?? 'تعذّر فتح العشيرة');
    }
  };

  const items = useMemo<Array<{
    label: string;
    route: string;
    Icon: React.ComponentType<any>;
    subtitle?: string;
    hasRedDot?: boolean;
    onPress?: () => void;
  }>>(() => [
    {
      label: 'عشيرة الوكالة',
      route: '__clan__',
      Icon: MessageSquare,
      subtitle: clanName ? `الاسم الحالي: ${clanName}` : 'تغيير اسم مجموعة الأعضاء',
      onPress: () => setClanModalOpen(true),
    },
    {
      label: 'دعوة المضيف',
      route: '/agency/invite',
      Icon: UserPlus,
    },
    {
      label: 'طلبات الانضمام',
      route: '/agency/requests',
      Icon: Inbox,
      subtitle: pendingRequestsCount > 0
        ? `${pendingRequestsCount} طلب بانتظار الموافقة`
        : 'موافقة أو رفض طلبات انضمام المضيفين',
      hasRedDot: pendingRequestsCount > 0,
    },
    {
      label: 'متجر إطارات الوكالة',
      route: '/agency/decor',
      Icon: Sparkles,
      subtitle: 'إطارات وخلفيات خاصة بالوكالة',
    },
    {
      label: 'تفاصيل دخل المضيف',
      route: '/agency/host-chart',
      Icon: PieChart,
    },
    {
      label: 'استرداد أموال للداعمين، تأثر الماسة',
      route: '/agency/refunds',
      Icon: RotateCcw,
      subtitle: 'يُخصم من ماسة المضيف ويُعاد للداعم',
    },
    {
      label: 'تتبع الأعضاء',
      route: '/agency/track',
      Icon: Eye,
      subtitle: 'رؤية حالة كل عضو والغرفة الحالية',
    },
    {
      label: 'إنهاء سجلات المضيفين',
      route: '/agency/members',
      Icon: LogOut,
      subtitle: 'لا يمكن للمضيف إنهاء الوكالة طواعية',
    },
    {
      label: 'بيانات إنهاء المهام',
      route: '/agency/host-completions',
      Icon: Users,
    },
  ], [clanName, pendingRequestsCount]);

  return (
    <View style={{ paddingHorizontal: 20 }}>
      <Pressable
        onPress={() => void handleOpenAgencySettings()}
        disabled={openingSettings}
        style={styles.agencyProfileCard}
      >
        <ChevronLeft size={20} color="rgba(255,255,255,0.4)" />
        
        <View style={{ flex: 1, alignItems: 'flex-end', marginEnd: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {countryCode ? <RealCountryFlag countryCode={countryCode} size={13} shape="rectangle" /> : null}
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: lu.fonts.bodySemi }}>ID: {agency.inviteCode}</Text>
          </View>
          <Text weight="bold" style={styles.agencyProfileName} numberOfLines={1}>
            {agency.name}
          </Text>
        </View>

        {(resolveAgencyLogoImage(agency) ?? agency.ownerAvatar)?.startsWith('http') ? (
          <Image source={{ uri: resolveAgencyLogoImage(agency) ?? agency.ownerAvatar }} style={styles.agencyProfileAvatar} contentFit="cover" />
        ) : (
          <View style={styles.agencyProfileAvatarPlaceholder}>
            {openingSettings ? (
              <ActivityIndicator color="#FCA5A5" />
            ) : (
              <Building2 size={24} color="#FCA5A5" strokeWidth={2} />
            )}
          </View>
        )}
      </Pressable>

      <View style={styles.menuOptionsCard}>
        {items.map((item, idx) => (
          <Pressable
            key={item.label}
            onPress={() => {
              if (item.onPress) {
                item.onPress();
                return;
              }
              router.push(item.route as any);
            }}
            style={({ pressed }) => [
              styles.menuRowCustom,
              idx < items.length - 1 && styles.menuRowBorderCustom,
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {item.hasRedDot && (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginEnd: 4, shadowColor: '#EF4444', shadowRadius: 6, shadowOpacity: 0.8 }} />
              )}
              <ChevronLeft size={18} color="rgba(255,255,255,0.3)" strokeWidth={2} />
            </View>

            <View style={{ flex: 1, alignItems: 'flex-end', marginEnd: 16 }}>
              <Text weight="semibold" style={styles.menuLabelCustom}>
                {item.label}
              </Text>
              {item.subtitle ? (
                <Text style={styles.menuSubtitleCustom}>
                  {item.subtitle}
                </Text>
              ) : null}
            </View>

            <View style={styles.menuIconBoxCustom}>
              <item.Icon size={20} color="#FCA5A5" strokeWidth={2.2} />
            </View>
          </Pressable>
        ))}
      </View>

      <Modal visible={clanModalOpen} transparent animationType="slide" onRequestClose={() => setClanModalOpen(false)}>
        <View style={styles.clanModalBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setClanModalOpen(false)} />
          <View style={styles.clanModalSheet}>
            <Text weight="bold" style={styles.clanModalTitle}>عشيرة الوكالة</Text>
            <Text style={styles.clanModalHint}>
              الاسم والصورة يظهران لكل الأعضاء في تبويب الدردشة ويتحدّثان فوراً للجميع.
            </Text>
            <Text style={styles.clanModalLabel}>صورة العشيرة</Text>
            <Pressable
              onPress={() => void handleChangeClanAvatar()}
              disabled={clanAvatarBusy}
              style={styles.clanAvatarRow}
            >
              <View style={styles.clanAvatarWrap}>
                {clanAvatar
                  ? <Image source={{ uri: clanAvatar }} style={styles.clanAvatarImg} contentFit="cover" />
                  : (
                    <View style={[styles.clanAvatarImg, styles.clanAvatarEmpty]}>
                      <Text style={styles.clanAvatarLetter}>{(clanName || agency.name || 'ع').charAt(0)}</Text>
                    </View>
                  )}
                <View style={styles.clanAvatarBadge}>
                  {clanAvatarBusy
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Camera size={14} color="#fff" strokeWidth={2.2} />}
                </View>
              </View>
              <Text style={styles.clanAvatarHint}>اضغط لتغيير صورة المجموعة</Text>
            </Pressable>
            <Text style={styles.clanModalLabel}>اسم العشيرة</Text>
            <TextInput
              style={styles.clanModalInput}
              value={clanName}
              onChangeText={setClanName}
              placeholder="مثال: عشيرة النجوم"
              placeholderTextColor="rgba(255,255,255,0.35)"
              maxLength={40}
            />
            <Pressable
              onPress={() => void handleSaveClanName()}
              disabled={clanSaving}
              style={[styles.clanModalPrimaryBtn, clanSaving && { opacity: 0.7 }]}
            >
              {clanSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text weight="bold" style={styles.clanModalPrimaryText}>حفظ الاسم للجميع</Text>
              )}
            </Pressable>
            <Pressable onPress={() => void handleOpenClanChat()} style={styles.clanModalSecondaryBtn}>
              <Text weight="semibold" style={styles.clanModalSecondaryText}>فتح دردشة العشيرة</Text>
            </Pressable>
            <Pressable onPress={() => setClanModalOpen(false)} style={styles.clanModalCancelBtn}>
              <Text style={styles.clanModalCancelText}>إلغاء</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {settingsRoomId ? (
        <RoomSettingsSheet
          visible={showAgencySettings}
          onClose={() => setShowAgencySettings(false)}
          roomId={settingsRoomId}
          canManage
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: lu.colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },

  // محفظة الوكيل
  walletCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  walletHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  walletLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 2 },
  walletBig: { color: '#fff', fontSize: 26 },
  walletUnit: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 4 },
  walletDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 12 },
  walletRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  walletRowLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  walletRowValue: { color: '#fff', fontSize: 13 },
  walletHint: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4, lineHeight: 16 },
  walletBtn: {
    marginTop: 14,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#FDE047',
    alignItems: 'center',
    justifyContent: 'center',
  },


  hero: {
    paddingBottom: 36,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  headBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headBtnPlaceholder: { width: 38 },
  headTitle: { fontSize: 17, color: '#fff' },

  agencyHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  agencyAvatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  agencyName: {
    fontSize: 20,
    lineHeight: 32,
    color: '#fff',
    fontFamily: lu.fonts.displayHeavy,
  },
  agencyMeta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
  },
  codeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  tabsWrap: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 14,
    marginTop: -18,
    backgroundColor: lu.colors.card,
    padding: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: lu.colors.line,
    ...lu.shadows.card,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    overflow: 'hidden',
  },
  tabBtnActive: {},
  tabLabel: {
    fontSize: 13,
    color: lu.colors.ink2,
  },
  tabLabelActive: {
    color: '#fff',
  },

  card: {
    backgroundColor: lu.colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: lu.colors.line,
    ...lu.shadows.card,
  },
  cardCaption: {
    fontSize: 12,
    color: lu.colors.ink2,
    textAlign: 'center',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  balanceNum: {
    fontSize: 32,
    lineHeight: 44,
    fontFamily: lu.fonts.displayHeavy,
    color: lu.colors.ink,
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
  balanceUnit: {
    fontSize: 12,
    color: lu.colors.muted,
    textAlign: 'center',
    marginTop: 4,
  },

  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statHalf: {
    flex: 1,
    marginBottom: 0,
    alignItems: 'flex-start',
    gap: 6,
  },
  statValue: {
    fontSize: 20,
    lineHeight: 30,
    fontFamily: lu.fonts.displayHeavy,
    color: lu.colors.ink,
    includeFontPadding: false,
  },
  statLabel: {
    fontSize: 11,
    color: lu.colors.ink2,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: lu.colors.ink2,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: lu.colors.ink,
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  chipsScroll: { marginHorizontal: -4 },
  chipsInner: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: lu.colors.bg2,
    borderWidth: 1,
    borderColor: lu.colors.line,
    overflow: 'hidden',
  },
  chipActive: {
    borderColor: 'transparent',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: lu.colors.ink2,
  },
  chipTextActive: {
    color: '#fff',
  },

  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  hostRowBorder: {
    borderTopWidth: 1,
    borderTopColor: lu.colors.line,
  },
  hostRank: {
    width: 26,
    fontSize: 14,
    fontWeight: '800',
    color: lu.colors.muted,
    textAlign: 'center',
  },
  hostName: {
    fontSize: 14,
    color: lu.colors.ink,
  },
  hostPearls: {
    fontSize: 14,
    color: lu.colors.pink,
  },
  emptyInline: {
    alignItems: 'center',
    paddingVertical: 28,
  },

  manageHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  manageIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageTitle: {
    fontSize: 17,
    color: lu.colors.ink,
  },
  verifiedTag: {
    fontSize: 11,
    color: lu.colors.mint,
    fontWeight: '700',
    marginTop: 2,
  },
  idCopyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: lu.colors.bg2,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  idCopyLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: lu.colors.muted,
  },
  idCopyValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: lu.colors.ink,
    letterSpacing: 1,
  },

  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: lu.colors.line,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: lu.colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    color: lu.colors.ink,
  },

  emptyCard: {
    margin: 14,
    marginTop: -8,
    padding: 32,
    backgroundColor: lu.colors.card,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: lu.colors.line,
    ...lu.shadows.card,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: lu.colors.card2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statusPill: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: lu.colors.pinkSoft,
    borderRadius: 99,
  },
  statusPillRejected: {
    backgroundColor: '#FEE2E2',
  },
  reviewDeadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: lu.colors.bg2,
    borderRadius: 99,
  },
  rejectionBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    width: '100%',
  },
  primaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 20,
  },
  enterRoomBtn: {
    flexDirection: 'row',
    gap: 8,
  },

  // حالة الوكالة المعلّقة
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    width: '100%',
  },
  progressLabel: {
    fontSize: 12,
    color: lu.colors.ink2,
    fontWeight: '600',
  },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: lu.colors.bg2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: lu.colors.pink,
  },
  inviteCodeBox: {
    width: '100%',
    marginTop: 16,
    padding: 14,
    backgroundColor: lu.colors.bg2,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: lu.colors.purple,
    alignItems: 'center',
  },
  inviteCodeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inviteCodeText: {
    fontSize: 24,
    letterSpacing: 4,
    color: lu.colors.purpleDark ?? lu.colors.purple,
    fontFamily: lu.fonts.displayHeavy,
  },
  inviteCodeHint: {
    fontSize: 11,
    color: lu.colors.muted,
    marginTop: 6,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  deadlineText: {
    fontSize: 12,
    color: lu.colors.ink2,
    fontWeight: '600',
  },
  headerCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 16,
    backgroundColor: '#FFFBF5',
    borderBottomWidth: 1,
    borderBottomColor: '#F5ECE0',
  },
  headBtnCustom: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headTitleCustom: {
    fontSize: 18,
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyBold,
  },
  tabsWrapCustom: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: lu.colors.line,
    paddingHorizontal: 20,
    justifyContent: 'space-around',
  },
  tabBtnCustom: {
    paddingVertical: 14,
    alignItems: 'center',
    position: 'relative',
  },
  tabLabelCustom: {
    fontSize: 16,
    color: '#9CA3AF',
    fontFamily: lu.fonts.bodySemi,
  },
  tabLabelActiveCustom: {
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyBold,
  },
  tabUnderlineCustom: {
    position: 'absolute',
    bottom: 0,
    width: 32,
    height: 3,
    borderRadius: 99,
    backgroundColor: lu.colors.pink,
  },
  managerIncomeCard: {
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  incomeCardLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: lu.fonts.bodySemi,
  },
  incomeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },
  incomeValueText: {
    fontSize: 32,
    lineHeight: 44,
    fontFamily: lu.fonts.displayHeavy,
    color: '#D4AF37',
    textShadowColor: 'rgba(212, 175, 55, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  hostsIncomeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  logsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  logsBtnText: {
    fontSize: 13,
    color: '#D4AF37',
    fontFamily: lu.fonts.bodyBold,
  },
  todayLabelText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: lu.fonts.bodySemi,
  },
  todayValueText: {
    fontSize: 14,
    color: '#34D399',
    fontFamily: lu.fonts.displayHeavy,
  },
  hostsValueText: {
    fontSize: 28,
    lineHeight: 40,
    fontFamily: lu.fonts.displayHeavy,
    color: '#fff',
  },
  warningCard: {
    backgroundColor: 'rgba(225, 20, 20, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20, 0.2)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  warningRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  warningLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: lu.fonts.bodySemi,
    lineHeight: 18,
  },
  warningValue: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: lu.fonts.displayHeavy,
    color: '#FCA5A5',
  },
  levelsTableContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 12,
    marginBottom: 24,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tableHeaderCell: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: lu.fonts.bodySemi,
    lineHeight: 16,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
  },
  tableRowActive: {
    backgroundColor: 'rgba(225, 20, 20, 0.1)',
    borderColor: 'rgba(225, 20, 20, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    marginVertical: 4,
    paddingHorizontal: 8,
  },
  tableCellContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tableCellText: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: lu.fonts.displayHeavy,
  },
  tableCellTextActive: {
    color: '#fff',
  },
  activeIndicatorTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderTopColor: 'transparent',
    borderBottomWidth: 5,
    borderBottomColor: 'transparent',
    borderLeftWidth: 6,
    borderLeftColor: '#F97316',
  },
  agencyProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  agencyProfileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  agencyProfileAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(225, 20, 20, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20, 0.3)',
  },
  agencyProfileName: {
    fontSize: 20,
    color: '#fff',
    fontFamily: lu.fonts.displayHeavy,
    marginTop: 4,
  },
  menuOptionsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 24,
    paddingHorizontal: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  menuRowCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
  },
  menuRowBorderCustom: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  menuIconBoxCustom: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(225, 20, 20, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20, 0.25)',
  },
  menuLabelCustom: {
    fontSize: 15,
    color: '#fff',
    fontFamily: lu.fonts.bodySemi,
  },
  menuSubtitleCustom: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: lu.fonts.body,
    marginTop: 4,
  },
  clanModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  clanModalSheet: {
    backgroundColor: '#1A1012',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  clanModalTitle: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  clanModalHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  clanAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  clanAvatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  clanAvatarImg: { width: '100%', height: '100%', borderRadius: 36, overflow: 'hidden' },
  clanAvatarEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(252,165,165,0.25)',
  },
  clanAvatarLetter: {
    color: '#fff',
    fontSize: 22,
    fontFamily: lu.fonts.displayHeavy,
  },
  clanAvatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: lu.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1a0f12',
  },
  clanAvatarHint: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'right',
    lineHeight: 18,
  },
  clanModalLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
    textAlign: 'right',
  },
  clanModalInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    textAlign: 'right',
    marginBottom: 14,
  },
  clanModalPrimaryBtn: {
    backgroundColor: '#E11414',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  clanModalPrimaryText: {
    color: '#fff',
    fontSize: 15,
  },
  clanModalSecondaryBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    marginBottom: 8,
  },
  clanModalSecondaryText: {
    color: '#D4AF37',
    fontSize: 14,
  },
  clanModalCancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  clanModalCancelText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
  },
});
