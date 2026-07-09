/**
 * مركز BD — للوكلاء فقط
 *  - تاب دعوة وكالة: ابحث بـ UID + ادعُ مستخدماً ليصبح وكيل وكالة
 *  - تاب قواعد الدخل: شرح + جدول النسب (10% / 15%)
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Search, Crown, TrendingUp, CheckCircle2, XCircle, Clock, Building2, AlertCircle } from 'lucide-react-native';
import { ChevronRight } from '@/components/ui/RtlIcons';
import { Text, useAlert } from '@/components/ui';
import {
  inviteAgencyOwner,
  fetchMyBDInvites,
  fetchBdReferralConfig,
  fetchMyBdReferredAgencies,
  lookupUserForBd,
  type BdInviteRow,
  type BdReferredAgency,
  type BdReferralConfig,
  type BdUserLookup,
} from '@/services/agencyService';
import PdPolicyCard from '@/components/agency/PdPolicyCard';
import { lu } from '@/theme/lu-brand';
import { spacing, radius, shadows } from '@/theme';

type Tab = 'invite' | 'rules';
type SubTab = 'invites_log' | 'agency_data';

export default function BDCenterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [tab, setTab] = useState<Tab>('invite');
  const [subTab, setSubTab] = useState<SubTab>('invites_log');
  const [bdInvites, setBdInvites] = useState<BdInviteRow[]>([]);
  const [referredAgencies, setReferredAgencies] = useState<BdReferredAgency[]>([]);
  const [bdReferralPearlsTotal, setBdReferralPearlsTotal] = useState(0);
  const [bdConfig, setBdConfig] = useState<BdReferralConfig>({ commissionPercent: 10, benefitMonths: 6 });
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [loadingAgencies, setLoadingAgencies] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchUid, setSearchUid] = useState('');
  const [foundUser, setFoundUser] = useState<BdUserLookup | null>(null);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(false);

  const loadInvites = async () => {
    try {
      const list = await fetchMyBDInvites();
      setBdInvites(list);
    } catch {
      setBdInvites([]);
    } finally {
      setLoadingInvites(false);
    }
  };

  const loadReferredAgencies = async () => {
    try {
      const data = await fetchMyBdReferredAgencies();
      setReferredAgencies(data.agencies);
      setBdReferralPearlsTotal(data.bdReferralPearlsTotal);
    } catch {
      setReferredAgencies([]);
      setBdReferralPearlsTotal(0);
    } finally {
      setLoadingAgencies(false);
    }
  };

  const loadBdConfig = async () => {
    try {
      const cfg = await fetchBdReferralConfig();
      setBdConfig(cfg);
    } catch {
      /* defaults */
    }
  };

  const loadAll = async () => {
    await Promise.all([loadInvites(), loadReferredAgencies(), loadBdConfig()]);
    setRefreshing(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSearch = async () => {
    const raw = searchUid.trim();
    if (!raw) return;
    setSearching(true);
    setFoundUser(null);
    try {
      const u = await lookupUserForBd(raw);
      setFoundUser({
        ...u,
        displayName: u.displayName || t('rooms.userFallback'),
      });
    } catch (e: any) {
      showAlert({
        type: 'error',
        title: t('agency.text5865'),
        message: e?.message ?? t('errors.userNotFound'),
      });
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async () => {
    if (!foundUser) return;
    setInviting(true);
    try {
      await inviteAgencyOwner(searchUid.trim() || foundUser.uid);
      await loadInvites();
      showAlert({
        type: 'success',
        title: t('roomSettings.text14103'),
        message: `أُرسلت دعوة وكالة إلى ${foundUser.displayName}`,
        buttons: [
          {
            text: t('roomSettings.text80678'),
            onPress: () => {
              setFoundUser(null);
              setSearchUid('');
            },
          },
        ],
      });
    } catch (e: any) {
      showAlert({ type: 'error', title: t('room.actionFailed'), message: e?.message ?? t('chat.sendFailed') });
    } finally {
      setInviting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 10 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <ChevronRight size={22} color={lu.colors.ink} />
          </Pressable>
          <Text variant="h3" color={lu.colors.ink} weight="bold">{t('bdCenter.title')}</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable onPress={() => setTab('rules')} style={styles.tabBtn}>
          <Text
            variant="button"
            color={tab === 'rules' ? lu.colors.pink : '#64748B'}
            weight={tab === 'rules' ? 'bold' : 'medium'}
          >
            {t('bdCenter.rulesTab')}
          </Text>
          {tab === 'rules' && <View style={styles.tabUnderline} />}
        </Pressable>
        <Pressable onPress={() => setTab('invite')} style={styles.tabBtn}>
          <Text
            variant="button"
            color={tab === 'invite' ? lu.colors.pink : '#64748B'}
            weight={tab === 'invite' ? 'bold' : 'medium'}
          >
            {t('bdCenter.inviteTab')}
          </Text>
          {tab === 'invite' && <View style={styles.tabUnderline} />}
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setLoadingInvites(true);
              setLoadingAgencies(true);
              loadAll();
            }}
            tintColor={lu.colors.purple}
          />
        }
      >
        {tab === 'invite' && (
          <View style={{ padding: spacing.md }}>
            {/* Invite Form Card */}
            <View style={styles.inviteCard}>
              <Text variant="bodyLarge" weight="bold" color="#1A0A0C" style={styles.inviteCardTitle}>
                {t('bdCenter.inviteCardTitle')}
              </Text>
              
              <View style={styles.searchRow}>
                <TextInput
                  value={searchUid}
                  onChangeText={setSearchUid}
                  placeholder={t('bdCenter.searchPlaceholder')}
                  placeholderTextColor="#94A3B8"
                  style={styles.searchInput}
                  autoCapitalize="none"
                />
                <Pressable
                  onPress={handleSearch}
                  disabled={searching || !searchUid.trim()}
                  style={[
                    styles.verifyBtn,
                    (!searchUid.trim() || searching) && { opacity: 0.45 },
                  ]}
                >
                  {searching ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text variant="caption" color="#fff" weight="bold">{t('bdCenter.verify')}</Text>
                  )}
                </Pressable>
              </View>

              {foundUser && (
                <View style={styles.userFound}>
                  {foundUser.avatar ? (
                    <Image source={{ uri: foundUser.avatar }} style={styles.userAvatar} />
                  ) : (
                    <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
                      <Crown size={18} color="#64748B" />
                    </View>
                  )}
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text variant="button" weight="bold" style={{ textAlign: 'right' }}>
                      {foundUser.displayName}
                    </Text>
                    <Text variant="caption" color="#64748B" style={{ textAlign: 'right' }}>
                      ID: {foundUser.publicAccountId || foundUser.uid.slice(0, 12)}
                    </Text>
                  </View>
                  {foundUser.isAgent ? (
                    <Text variant="caption" color="#EF4444" weight="bold">وكيل بالفعل</Text>
                  ) : foundUser.hasAgency ? (
                    <Text variant="caption" color="#F59E0B" weight="bold">لديه وكالة</Text>
                  ) : (
                    <CheckCircle2 size={20} color="#10B981" />
                  )}
                </View>
              )}

              <Pressable
                onPress={handleInvite}
                disabled={!foundUser || foundUser.isAgent || inviting}
                style={[
                  styles.inviteBtn,
                  (!foundUser || foundUser.isAgent || inviting) && { opacity: 0.45 },
                ]}
              >
                {inviting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text variant="button" color="#fff" weight="bold">
                    {t('bdCenter.sendInvite')}
                  </Text>
                )}
              </Pressable>
            </View>

            {/* Sub-tabs under invite tab */}
            <View style={styles.subTabs}>
              <Pressable
                onPress={() => setSubTab('agency_data')}
                style={[styles.subTabItem, subTab === 'agency_data' && styles.subTabActive]}
              >
                <Text
                  variant="button"
                  color={subTab === 'agency_data' ? lu.colors.ink : '#64748B'}
                  weight={subTab === 'agency_data' ? 'bold' : 'medium'}
                >
                  {t('bdCenter.agencyDataTab')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSubTab('invites_log')}
                style={[styles.subTabItem, subTab === 'invites_log' && styles.subTabActive]}
              >
                <Text
                  variant="button"
                  color={subTab === 'invites_log' ? lu.colors.ink : '#64748B'}
                  weight={subTab === 'invites_log' ? 'bold' : 'medium'}
                >
                  {t('bdCenter.inviteLogTab')}
                </Text>
              </Pressable>
            </View>

            {subTab === 'invites_log' ? (
              <View style={styles.logTableCard}>
                {/* Table Headers */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.headerCell, { flex: 1.5, textAlign: 'right' }]}>{t('bdCenter.colInvited')}</Text>
                  <Text style={[styles.headerCell, { flex: 1.2, textAlign: 'center' }]}>{t('bdCenter.colTime')}</Text>
                  <Text style={[styles.headerCell, { flex: 1, textAlign: 'left' }]}>{t('bdCenter.colStatus')}</Text>
                </View>

                {loadingInvites ? (
                  <ActivityIndicator color={lu.colors.purple} style={{ marginVertical: 24 }} />
                ) : bdInvites.length === 0 ? (
                  <View style={styles.emptyTable}>
                    <Building2 size={36} color="#CBD5E1" />
                    <Text variant="caption" color="#94A3B8" style={{ marginTop: 8 }}>
                      {t('bdCenter.emptyInvites')}
                    </Text>
                  </View>
                ) : (
                  bdInvites.map((inv) => {
                    const date = new Date(inv.createdAt);
                    const dateStr = date.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
                    const timeStr = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: false });

                    let statusLabel = 'بانتظار الطلب';
                    let statusColor = '#D97706';
                    if (inv.status === 'applied') {
                      statusLabel = 'طلب مُقدَّم';
                      statusColor = '#E11414';
                    } else if (inv.status === 'accepted') {
                      statusLabel = 'وكالة مفعّلة';
                      statusColor = '#10B981';
                    } else if (inv.status === 'rejected') {
                      statusLabel = 'مرفوض';
                      statusColor = '#EF4444';
                    }

                    return (
                      <View key={inv.id} style={styles.tableRow}>
                        {/* Invitee */}
                        <View style={[styles.tableCell, { flex: 1.5, flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }]}>
                          {inv.invitedAvatar ? (
                            <Image source={{ uri: inv.invitedAvatar }} style={styles.cellAvatar} />
                          ) : (
                            <View style={[styles.cellAvatar, styles.avatarPlaceholder]}>
                              <Crown size={12} color="#64748B" />
                            </View>
                          )}
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text variant="caption" weight="bold" color="#1E293B" numberOfLines={1}>
                              {inv.invitedName}
                            </Text>
                            <Text style={{ fontSize: 9, color: '#64748B' }}>
                              ID:{(inv.invitedUid ?? '').slice(0, 8)}
                            </Text>
                          </View>
                        </View>

                        {/* Time */}
                        <View style={[styles.tableCell, { flex: 1.2, alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={styles.cellTimeText}>{dateStr}</Text>
                          <Text style={styles.cellTimeSubText}>{timeStr}</Text>
                        </View>

                        {/* Status */}
                        <View style={[styles.tableCell, { flex: 1, alignItems: 'flex-start', justifyContent: 'center' }]}>
                          <Text style={[styles.cellStatusText, { color: statusColor }]}>
                            {statusLabel}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            ) : loadingAgencies ? (
              <ActivityIndicator color={lu.colors.purple} style={{ marginVertical: 24 }} />
            ) : referredAgencies.length === 0 ? (
              <View style={styles.agencyDataCard}>
                <Building2 size={36} color={lu.colors.purple} style={{ alignSelf: 'center', marginBottom: 8 }} />
                <Text variant="body" weight="bold" align="center">لا توجد وكالات مُحالة بعد</Text>
                <Text variant="caption" color="#64748B" align="center" style={{ marginTop: 6 }}>
                  عند تفعيل وكالة جديدة من دعوتك، تظهر هنا مع نسبة عمولتك ومدة الاستفادة.
                </Text>
              </View>
            ) : (
              <View style={styles.logTableCard}>
                <View style={styles.referralSummaryRow}>
                  <Text variant="caption" color="#64748B">إجمالي عمولة BD (ماسة)</Text>
                  <Text variant="h3" weight="bold" color={lu.colors.pink}>
                    {bdReferralPearlsTotal.toLocaleString('ar-EG')}
                  </Text>
                </View>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.headerCell, { flex: 1.4, textAlign: 'right' }]}>الوكالة</Text>
                  <Text style={[styles.headerCell, { flex: 0.8, textAlign: 'center' }]}>النسبة</Text>
                  <Text style={[styles.headerCell, { flex: 1, textAlign: 'left' }]}>الحالة</Text>
                </View>
                {referredAgencies.map((ag) => {
                  const ends = ag.benefitEndsAt
                    ? new Date(ag.benefitEndsAt).toLocaleDateString('ar-EG')
                    : '—';
                  const statusLabel = ag.benefitActive
                    ? 'نشطة'
                    : ag.status === 'active'
                      ? 'انتهت المدة'
                      : ag.status === 'pending'
                        ? 'قيد التفعيل'
                        : ag.status;
                  const statusColor = ag.benefitActive ? '#10B981' : '#94A3B8';
                  return (
                    <View key={ag.id} style={styles.tableRow}>
                      <View style={[styles.tableCell, { flex: 1.4 }]}>
                        <Text variant="caption" weight="bold" color="#1E293B" style={{ textAlign: 'right' }}>
                          {ag.name}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#64748B', textAlign: 'right' }}>
                          {ag.ownerName} · {ag.memberCount} عضو
                        </Text>
                        <Text style={{ fontSize: 9, color: '#94A3B8', textAlign: 'right' }}>
                          حتى {ends}
                        </Text>
                      </View>
                      <View style={[styles.tableCell, { flex: 0.8, alignItems: 'center' }]}>
                        <View style={styles.percentBadge}>
                          <Text variant="caption" weight="bold" color={lu.colors.pink}>
                            {ag.commissionPercent}%
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.tableCell, { flex: 1, alignItems: 'flex-start' }]}>
                        <Text style={[styles.cellStatusText, { color: statusColor }]}>{statusLabel}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {tab === 'rules' && (
          <View style={{ padding: spacing.md }}>
            <View style={styles.rulesIntroCard}>
              <LinearGradient
                colors={['#FFF5F5', '#FFF8F0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <TrendingUp size={28} color={lu.colors.pink} />
              <Text variant="bodyLarge" weight="bold" color="#1A0A0C" style={{ marginTop: 10, textAlign: 'right' }}>
                قواعد الدخل
              </Text>
              <Text variant="caption" color="#475569" style={styles.rulesDescriptionText}>
                عندما تدعو مستخدماً لفتح وكالة جديدة عبر مركز BD، تحصل على نسبة من دخل مضيفات تلك الوكالة
                طوال المدة التي تحدّدها الإدارة من تاريخ تفعيل الوكالة.
                {'\n\n'}
                مثال: إذا كانت النسبة {bdConfig.commissionPercent}% ومدة الاستفادة {bdConfig.benefitMonths} أشهر،
                وحققت الوكالة المُحالة 100,000 ماسة دخل، فعمولتك =
                {' '}
                <Text variant="caption" weight="bold" color={lu.colors.pink}>
                  {Math.floor((100_000 * bdConfig.commissionPercent) / 100).toLocaleString('ar-EG')} ماسة
                </Text>
                {'\n\n'}
                تُحتسب العمولة تلقائياً من دخل المضيفات (هدايا، مكالمات، وغيرها) وتظهر في تاب «بيانات الوكالة».
              </Text>
            </View>

            <View style={styles.rulesTableCard}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.headerCell, { flex: 1.5, textAlign: 'right' }]}>البند</Text>
                <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>القيمة</Text>
              </View>
              <View style={styles.tableRow}>
                <Text variant="button" color="#1E293B" style={{ flex: 1.5, textAlign: 'right' }}>
                  نسبة عمولتك من دخل الوكالة المُحالة
                </Text>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <View style={styles.percentBadge}>
                    <Text variant="button" weight="bold" color={lu.colors.pink}>
                      {bdConfig.commissionPercent}%
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.tableRow}>
                <Text variant="button" color="#1E293B" style={{ flex: 1.5, textAlign: 'right' }}>
                  مدة الاستفادة من تفعيل الوكالة
                </Text>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <View style={styles.percentBadge}>
                    <Text variant="button" weight="bold" color={lu.colors.pink}>
                      {bdConfig.benefitMonths} شهر
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={styles.policyWrap}>
          <PdPolicyCard />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  header: {
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    position: 'relative',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: '25%',
    right: '25%',
    height: 3,
    backgroundColor: lu.colors.pink,
    borderRadius: 2,
  },
  inviteCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...lu.shadows.card,
    marginBottom: 16,
  },
  inviteCardTitle: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'right',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 10,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1A0A0C',
    textAlign: 'right',
  },
  verifyBtn: {
    paddingHorizontal: 16,
    height: 34,
    borderRadius: 10,
    backgroundColor: lu.colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userFound: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  avatarPlaceholder: {
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FCA5A5', // Soft peach/pink
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyWrap: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  subTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  subTabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  subTabActive: {
    backgroundColor: '#F1F5F9',
  },
  logTableCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...lu.shadows.card,
  },
  tableHeaderRow: {
    flexDirection: 'row-reverse',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  tableRow: {
    flexDirection: 'row-reverse',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  tableCell: {
    justifyContent: 'center',
  },
  cellAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  cellTimeText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '700',
  },
  cellTimeSubText: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
  },
  cellStatusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  emptyTable: {
    padding: 40,
    alignItems: 'center',
  },
  agencyDataCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...lu.shadows.card,
  },
  referralSummaryRow: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
    gap: 4,
  },
  rulesIntroCard: {
    borderRadius: 20,
    overflow: 'hidden',
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...lu.shadows.card,
    marginBottom: 16,
  },
  rulesDescriptionText: {
    marginTop: 12,
    lineHeight: 20,
    textAlign: 'right',
  },
  rulesTableCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...lu.shadows.card,
  },
  percentBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#FFE6E9',
    borderRadius: 99,
  },
});
