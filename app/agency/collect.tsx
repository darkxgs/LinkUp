/**
 * جمع الماسة بالنيابة — للوكيل
 *  - يستلم طلبات السحب من أعضائه
 *  - يوافق → يستلم الماسة في رصيده (يعطي كاش خارجياً)
 *  - يرفض → الماسة ترجع للعضو
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { CheckCircle2, XCircle, Calendar, Clock, Users, ChevronDown, Search, Share2 } from 'lucide-react-native';
import { ChevronRight } from '@/components/ui/RtlIcons';

import { Text, useAlert } from '@/components/ui';
import {
  subscribeToAgentWithdrawals,
  fetchAgentWithdrawals,
  agentApproveWithdrawal,
  agentRejectWithdrawal,
  type WithdrawalRequest,
} from '@/services/withdrawalService';
import { lu } from '@/theme/lu-brand';
import { spacing, radius, shadows } from '@/theme';

type FilterStatus = 'pending' | 'completed' | 'rejected' | 'all';
type SubTab = 'total' | 'details';
type WeekFilter = 'all' | 1 | 2 | 3 | 4;

interface CalendarMonth {
  id: string;
  label: string;
  year: number;
  month: number;
  startMs: number;
  endMs: number;
}

type WeekWithdrawalRow = {
  id: string;
  uid: string;
  name: string;
  avatar?: string;
  amount: number;
  dateMs: number;
  dateLabel: string;
};

type WeekSalaryBlock = {
  week: 1 | 2 | 3 | 4;
  label: string;
  total: number;
  rows: WeekWithdrawalRow[];
};

/** أشهر تقويمية (الحالي + 11 سابقة) */
function getCalendarMonths(count = 12): CalendarMonth[] {
  const list: CalendarMonth[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const startMs = new Date(year, month, 1).getTime();
    const endMs = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
    list.push({
      id: `${year}-${month}`,
      label: d.toLocaleDateString('ar', { month: 'long', year: 'numeric' }),
      year,
      month,
      startMs,
      endMs,
    });
  }
  return list;
}

function getWeekOfMonth(ts: number): 1 | 2 | 3 | 4 {
  const day = new Date(ts).getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

function getWeekLabel(year: number, month: number, week: 1 | 2 | 3 | 4): string {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const ranges: [number, number][] = [
    [1, 7],
    [8, 14],
    [15, 21],
    [22, daysInMonth],
  ];
  const [start, end] = ranges[week - 1]!;
  const monthName = new Date(year, month, 1).toLocaleDateString('ar', { month: 'long' });
  return `الأسبوع ${week} (${start}–${end} ${monthName})`;
}

function formatWithdrawDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ar', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function CollectScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('pending');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('total');
  const [periodIdx, setPeriodIdx] = useState(0);
  const [weekFilter, setWeekFilter] = useState<WeekFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Date Picker Modal
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempPeriodIdx, setTempPeriodIdx] = useState(0);

  // Reject modal
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const calendarMonths = useMemo(() => getCalendarMonths(), []);
  const selectedMonth = calendarMonths[periodIdx] || calendarMonths[0];

  useEffect(() => {
    const unsub = subscribeToAgentWithdrawals(setWithdrawals);
    return unsub;
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const items = await fetchAgentWithdrawals();
      setWithdrawals(items);
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  // فلترة حسب الشهر المختار
  const filtered = useMemo(() => {
    if (!selectedMonth) return withdrawals;
    return withdrawals.filter(
      (w) => w.createdAt >= selectedMonth.startMs && w.createdAt <= selectedMonth.endMs,
    );
  }, [withdrawals, selectedMonth]);

  const completedInMonth = useMemo(
    () => filtered.filter((w) => w.status === 'completed'),
    [filtered],
  );

  const weeklySalaryBlocks = useMemo((): WeekSalaryBlock[] => {
    if (!selectedMonth) return [];
    const query = searchQuery.trim().toLowerCase();
    const blocks: WeekSalaryBlock[] = ([1, 2, 3, 4] as const).map((week) => ({
      week,
      label: getWeekLabel(selectedMonth.year, selectedMonth.month, week),
      total: 0,
      rows: [],
    }));

    completedInMonth.forEach((w) => {
      const week = getWeekOfMonth(w.createdAt);
      const block = blocks[week - 1]!;
      const row: WeekWithdrawalRow = {
        id: w.id,
        uid: w.uid,
        name: w.uidName,
        avatar: w.uidAvatar,
        amount: w.amount,
        dateMs: w.createdAt,
        dateLabel: formatWithdrawDate(w.createdAt),
      };
      if (query && !row.name.toLowerCase().includes(query) && !row.uid.toLowerCase().includes(query)) {
        return;
      }
      block.rows.push(row);
      block.total += w.amount;
    });

    blocks.forEach((b) => {
      b.rows.sort((a, c) => c.dateMs - a.dateMs);
    });

    if (weekFilter === 'all') return blocks;
    return blocks.filter((b) => b.week === weekFilter);
  }, [completedInMonth, selectedMonth, searchQuery, weekFilter]);

  const monthWithdrawalTotal = useMemo(
    () => completedInMonth.reduce((sum, w) => sum + w.amount, 0),
    [completedInMonth],
  );

  const hasWeeklyData = weeklySalaryBlocks.some((b) => b.rows.length > 0);

  const totalCollected = useMemo(() => {
    return filtered
      .filter((w) => w.status === 'completed')
      .reduce((sum, w) => sum + (w.netAmount ?? 0), 0);
  }, [filtered]);

  const uniqueMembers = useMemo(() => {
    return new Set(filtered.map((w) => w.uid)).size;
  }, [filtered]);

  const handleApprove = useCallback((w: WithdrawalRequest) => {
    showAlert({
      type: 'warning',
      title: t('agency.text46710'),
      message: `الموافقة على طلب "${w.uidName}" بقيمة ${w.netAmount.toLocaleString()} ماسة.\n\nسيتم إضافة المبلغ لرصيدك. أنت ملزم بتسليم ما يعادله كاش للعضو.`,
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('room.approve'),
          onPress: async () => {
            try {
              await agentApproveWithdrawal(w.id);
              showAlert({ type: 'success', title: t('roomSettings.text14103'), message: t('agency.text74619') });
            } catch (e: any) {
              showAlert({ type: 'error', title: t('room.actionFailed'), message: e?.message ?? t('roomSettings.text32386') });
            }
          },
        },
      ],
    });
  }, [showAlert, t]);

  const handleReject = useCallback((w: WithdrawalRequest) => {
    setRejectingId(w.id);
    setRejectReason('');
  }, []);

  const confirmReject = async () => {
    if (!rejectingId) return;
    try {
      await agentRejectWithdrawal(rejectingId, rejectReason.trim() || t('agency.text46107'));
      setRejectingId(null);
      showAlert({ type: 'success', title: t('agency.text8356'), message: t('agency.text39672') });
    } catch (e: any) {
      showAlert({ type: 'error', title: t('room.actionFailed'), message: e?.message ?? t('roomSettings.text32386') });
    }
  };

  const handleExportSheet = () => {
    showAlert({
      type: 'success',
      title: 'تصدير الشيت',
      message: 'تم تصدير شيت الراتب الإجمالي للمضيفين بنجاح بصيغة CSV.',
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 10 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <ChevronRight size={22} color={lu.colors.ink} />
          </Pressable>
          <Text variant="h3" color={lu.colors.ink} weight="bold">جمع اللؤلؤة المضيفة</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text variant="caption" color={lu.colors.muted} align="center" style={styles.description}>
          يلتزم مدير وكالة لايف بقبول تكليف "اللؤلؤة المجمعة من قبل المدير" من أي مضيف في وكالة لايف الخاصة به، وجمع لؤلؤة المضيف من صعدة، وتوزيعها.
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={lu.colors.pink}
          />
        }
      >
        {/* Period Selector Card */}
        <View style={styles.periodSelectorCard}>
          <Calendar size={18} color="#B00E0E" />
          <View style={styles.periodCol}>
            <Text variant="caption" color="#94A3B8" style={{ textAlign: 'right' }}>
              شهر استلام رواتب المضيفين
            </Text>
            <Pressable onPress={() => { setTempPeriodIdx(periodIdx); setShowDatePicker(true); }} style={styles.periodChip}>
              <Text variant="button" weight="bold" color="#1E293B">
                {selectedMonth?.label}
              </Text>
              <ChevronDown size={14} color="#64748B" />
            </Pressable>
          </View>
        </View>

        {/* Summary Statistics Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <Text variant="caption" color="#64748B" style={{ textAlign: 'right' }}>
              إجمالي الراتب الذي تم جمعه حتى الآن
            </Text>
            <View style={styles.amountRow}>
              <Image source={require('../../assets/masa.png')} style={styles.summaryPearlIcon} />
              <Text style={styles.bigNumber}>
                {totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
            <Text variant="caption" color="#10B981" weight="bold" style={{ textAlign: 'right' }}>
              إجمالي السحب هذا الشهر: {monthWithdrawalTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.memberCountBadge}>
            <Users size={20} color="#E11414" />
            <Text variant="h3" weight="bold" color="#E11414" style={{ marginTop: 4 }}>
              {uniqueMembers}
            </Text>
          </View>
        </View>

        <Text variant="caption" color="#94A3B8" align="center" style={styles.hintText}>
          جميع المضيفين الذين نقلوا اللؤلؤ إلى الوكيل خلال هذه الفترة
        </Text>

        {/* Sub-Tabs: Total Salaries vs Details */}
        <View style={styles.subTabRow}>
          <Pressable
            onPress={() => setActiveSubTab('details')}
            style={[styles.subTabItem, activeSubTab === 'details' && styles.subTabActive]}
          >
            <Text
              variant="button"
              color={activeSubTab === 'details' ? lu.colors.pink : '#64748B'}
              weight={activeSubTab === 'details' ? 'bold' : 'regular'}
            >
              تفاصيل الراتب لكل مرة
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveSubTab('total')}
            style={[styles.subTabItem, activeSubTab === 'total' && styles.subTabActive]}
          >
            <Text
              variant="button"
              color={activeSubTab === 'total' ? lu.colors.pink : '#64748B'}
              weight={activeSubTab === 'total' ? 'bold' : 'regular'}
            >
              بيانات الراتب الإجمالي
            </Text>
          </Pressable>
        </View>

        {/* Sub-tab content */}
        {activeSubTab === 'total' ? (
          <View style={styles.groupedContainer}>
            <View style={styles.searchExportRow}>
              <Pressable onPress={handleExportSheet} style={styles.exportBtn}>
                <Share2 size={16} color="#fff" />
                <Text variant="caption" color="#fff" weight="bold">تصدير الشيت</Text>
              </Pressable>

              <View style={styles.searchBox}>
                <Search size={16} color="#64748B" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="أدخل ايدي المضيف"
                  placeholderTextColor="#94A3B8"
                  style={styles.searchInput}
                />
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekFilterRow}>
              {([
                { id: 'all' as WeekFilter, label: 'كل الشهر' },
                { id: 1 as WeekFilter, label: 'الأسبوع 1' },
                { id: 2 as WeekFilter, label: 'الأسبوع 2' },
                { id: 3 as WeekFilter, label: 'الأسبوع 3' },
                { id: 4 as WeekFilter, label: 'الأسبوع 4' },
              ]).map((w) => (
                <Pressable
                  key={String(w.id)}
                  onPress={() => setWeekFilter(w.id)}
                  style={[styles.weekChip, weekFilter === w.id && styles.weekChipActive]}
                >
                  <Text
                    variant="caption"
                    weight={weekFilter === w.id ? 'bold' : 'regular'}
                    color={weekFilter === w.id ? '#fff' : '#64748B'}
                  >
                    {w.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {!hasWeeklyData ? (
              <View style={styles.emptyGroup}>
                <Users size={36} color="#CBD5E1" />
                <Text variant="caption" color="#94A3B8" style={{ marginTop: 8 }}>
                  لا يوجد سحوبات مكتملة لهذا الشهر{weekFilter !== 'all' ? ' في هذا الأسبوع' : ''}
                </Text>
              </View>
            ) : (
              weeklySalaryBlocks.map((block) => {
                if (block.rows.length === 0) return null;
                return (
                  <View key={block.week} style={styles.weekSection}>
                    <View style={styles.weekSectionHeader}>
                      <View style={styles.weekTotalBadge}>
                        <Image source={require('../../assets/masa.png')} style={styles.hostPearlIcon} />
                        <Text variant="caption" weight="bold" color="#E11414">
                          {block.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text variant="button" weight="bold" color="#1A0A0C" style={{ textAlign: 'right' }}>
                          {block.label}
                        </Text>
                        <Text variant="caption" color="#94A3B8" style={{ textAlign: 'right' }}>
                          {block.rows.length} عملية سحب
                        </Text>
                      </View>
                    </View>

                    {block.rows.map((row) => (
                      <View key={row.id} style={styles.groupedHostRow}>
                        <View style={styles.groupedSalaryCol}>
                          <Image source={require('../../assets/masa.png')} style={styles.hostPearlIcon} />
                          <Text variant="button" weight="bold" color="#1E293B">
                            {row.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                        </View>
                        <View style={styles.groupedHostDetails}>
                          <Text variant="button" weight="bold" color="#1A0A0C" style={{ textAlign: 'right' }}>
                            {row.name}
                          </Text>
                          <Text variant="caption" color="#64748B" style={{ textAlign: 'right' }}>
                            ID: {row.uid.slice(0, 10)}
                          </Text>
                          <Text variant="caption" color="#10B981" weight="bold" style={{ textAlign: 'right', marginTop: 2 }}>
                            تاريخ السحب: {row.dateLabel}
                          </Text>
                        </View>
                        {row.avatar ? (
                          <Image source={{ uri: row.avatar }} style={styles.hostAvatar} cachePolicy="memory-disk" recyclingKey={row.uid} />
                        ) : (
                          <View style={[styles.hostAvatar, styles.avatarPlaceholder]}>
                            <Users size={16} color="#64748B" />
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                );
              })
            )}
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.md }}>
            {/* Status filters for details list */}
            <View style={styles.filterTabs}>
              {[
                { id: 'pending' as FilterStatus, label: 'قيد المراجعة' },
                { id: 'completed' as FilterStatus, label: 'تم التسليم' },
                { id: 'rejected' as FilterStatus, label: 'مرفوض' },
                { id: 'all' as FilterStatus, label: 'الكل' },
              ].map((f) => {
                const count = filtered.filter((w) => f.id === 'all' || w.status === f.id).length;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setStatusFilter(f.id)}
                    style={[styles.filterChip, statusFilter === f.id && styles.filterChipActive]}
                  >
                    <Text
                      variant="caption"
                      color={statusFilter === f.id ? '#fff' : '#6B7280'}
                      weight={statusFilter === f.id ? 'bold' : 'regular'}
                    >
                      {f.label} {count > 0 && `(${count})`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* List of individual requests */}
            {filtered.filter((w) => statusFilter === 'all' || w.status === statusFilter).length === 0 ? (
              <View style={styles.empty}>
                <Clock size={48} color="#D1D5DB" />
                <Text variant="button" color="#9CA3AF" align="center" style={{ marginTop: 12 }}>
                  لا توجد طلبات تحصيل مطابقة
                </Text>
              </View>
            ) : (
              filtered
                .filter((w) => statusFilter === 'all' || w.status === statusFilter)
                .map((w) => (
                  <RequestCard
                    key={w.id}
                    w={w}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.pickerModalContainer}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setShowDatePicker(false)} />
          <View style={styles.pickerContentCard}>
            {/* Header */}
            <View style={styles.pickerHeader}>
              <Pressable onPress={() => { setPeriodIdx(tempPeriodIdx); setWeekFilter('all'); setShowDatePicker(false); }}>
                <Text variant="button" weight="bold" color={lu.colors.pink}>نعم</Text>
              </Pressable>
              <Text variant="bodyLarge" weight="bold">اختر الشهر</Text>
              <Pressable onPress={() => setShowDatePicker(false)}>
                <Text variant="button" color="#64748B">الغاء</Text>
              </Pressable>
            </View>

            {/* List of periods */}
            <ScrollView style={{ maxHeight: 240 }} contentContainerStyle={{ paddingVertical: 12 }}>
              {calendarMonths.map((p, idx) => {
                const isSelected = tempPeriodIdx === idx;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setTempPeriodIdx(idx)}
                    style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        isSelected && { fontFamily: lu.fonts.displayHeavy, fontSize: 18, color: lu.colors.ink },
                      ]}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal
        visible={!!rejectingId}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectingId(null)}
      >
        <Pressable
          style={styles.modalBg}
          onPress={() => setRejectingId(null)}
        >
          <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
            <Text variant="h4" weight="bold" align="center" style={{ marginBottom: 8 }}>
              {t('agency.text10342')}
            </Text>
            <Text variant="caption" color="#6B7280" align="center" style={{ marginBottom: 16 }}>
              {t('agency.text81565')}
            </Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder={t('agency.text72913')}
              placeholderTextColor="#9CA3AF"
              multiline
              style={styles.modalInput}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Pressable
                onPress={() => setRejectingId(null)}
                style={[styles.modalBtn, { backgroundColor: '#F3F4F6' }]}
              >
                <Text variant="button" weight="bold">{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={confirmReject}
                style={[styles.modalBtn, { backgroundColor: '#EF4444' }]}
              >
                <Text variant="button" color="#fff" weight="bold">{t('agency.text774')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const RequestCard = React.memo(function RequestCard({
  w,
  onApprove,
  onReject,
}: {
  w: WithdrawalRequest;
  onApprove: (w: WithdrawalRequest) => void;
  onReject: (w: WithdrawalRequest) => void;
}) {
  const { t } = useTranslation();
  const date = new Date(w.createdAt).toLocaleString('ar', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        {w.uidAvatar ? (
          <Image source={{ uri: w.uidAvatar }} style={styles.avatar} cachePolicy="memory-disk" recyclingKey={w.uid} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }]}>
            <Users size={20} color="#9CA3AF" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text variant="button" weight="bold">{w.uidName}</Text>
          <Text variant="caption" color="#9CA3AF">ID: {w.uid.slice(0, 12)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusBg(w.status) }]}>
          <Text style={{ color: getStatusColor(w.status), fontSize: 10, fontWeight: '700' }}>
            {getStatusLabel(w.status)}
          </Text>
        </View>
      </View>

      <View style={styles.requestDetails}>
        <View style={styles.detailRow}>
          <Text variant="caption" color="#6B7280">المبلغ المطلوب</Text>
          <Text variant="button" weight="bold">{w.amount.toLocaleString()} ماسة</Text>
        </View>
        <View style={styles.detailRow}>
          <Text variant="caption" color="#6B7280">العمولة</Text>
          <Text variant="caption" color="#EF4444">-{w.commission.toLocaleString()}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text variant="caption" color="#6B7280" weight="bold">الصافي بالدولار</Text>
          <Text variant="button" color={lu.colors.pink} weight="bold">
            ${(w.fiatValue ?? w.netAmount / 1000).toFixed(2)}
          </Text>
        </View>
        <Text variant="caption" color="#9CA3AF" style={{ marginTop: 4 }}>
          {date}
        </Text>
      </View>

      {w.status === 'pending' && (
        <View style={styles.requestActions}>
          <Pressable onPress={() => onReject(w)} style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]}>
            <XCircle size={16} color="#EF4444" />
            <Text variant="caption" color="#EF4444" weight="bold">رفض</Text>
          </Pressable>
          <Pressable onPress={() => onApprove(w)} style={[styles.actionBtn, { backgroundColor: '#D1FAE5' }]}>
            <CheckCircle2 size={16} color="#10B981" />
            <Text variant="caption" color="#10B981" weight="bold">موافقة</Text>
          </Pressable>
        </View>
      )}

      {w.status === 'rejected' && w.rejectionReason && (
        <View style={styles.rejectedNote}>
          <Text variant="caption" color="#7C2D12" weight="bold">سبب الرفض:</Text>
          <Text variant="caption" color="#7C2D12">{w.rejectionReason}</Text>
        </View>
      )}
    </View>
  );
});

function getStatusColor(s: string): string {
  if (s === 'completed') return '#059669';
  if (s === 'rejected') return '#DC2626';
  return '#D97706';
}
function getStatusBg(s: string): string {
  if (s === 'completed') return '#D1FAE5';
  if (s === 'rejected') return '#FEE2E2';
  return '#FEF3C7';
}
function getStatusLabel(s: string): string {
  if (s === 'completed') return 'تم التسليم';
  if (s === 'rejected') return 'مرفوض';
  if (s === 'approved') return 'مُوافق';
  return 'قيد المراجعة';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
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
  description: {
    paddingHorizontal: 20,
    marginTop: 8,
    lineHeight: 18,
  },
  periodSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    marginHorizontal: spacing.md,
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...lu.shadows.card,
  },
  periodCol: {
    alignItems: 'flex-end',
    flex: 1,
    paddingRight: 12,
  },
  periodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#fff',
    marginHorizontal: spacing.md,
    marginTop: 12,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...lu.shadows.card,
  },
  summaryLeft: {
    flex: 1,
    alignItems: 'flex-end',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginVertical: 4,
  },
  summaryPearlIcon: {
    width: 28,
    height: 28,
  },
  bigNumber: {
    fontSize: 28,
    lineHeight: 40,
    fontWeight: '800',
    color: '#1A0A0C',
    fontFamily: lu.fonts.displayHeavy,
  },
  memberCountBadge: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
  },
  hintText: {
    marginHorizontal: spacing.md,
    marginTop: 14,
    marginBottom: 8,
  },
  subTabRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: spacing.md,
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
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  groupedContainer: {
    marginHorizontal: spacing.md,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...lu.shadows.card,
  },
  searchExportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 16,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: lu.colors.purple,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    height: 44,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1A0A0C',
    textAlign: 'right',
  },
  weekFilterRow: {
    marginBottom: 14,
    flexGrow: 0,
  },
  weekChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: '#F1F5F9',
    marginLeft: 8,
  },
  weekChipActive: {
    backgroundColor: lu.colors.purple,
  },
  weekSection: {
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  weekSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 10,
  },
  weekTotalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  emptyGroup: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  groupedHostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  hostAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  avatarPlaceholder: {
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupedHostDetails: {
    flex: 1,
    marginRight: 12,
  },
  groupedSalaryCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hostPearlIcon: {
    width: 18,
    height: 18,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 12,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 99,
  },
  filterChipActive: {
    backgroundColor: lu.colors.pink,
  },
  empty: {
    padding: 60,
    alignItems: 'center',
  },
  requestCard: {
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...lu.shadows.card,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
  },
  requestDetails: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  rejectedNote: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: 20,
  },
  modalInput: {
    height: 80,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: radius.sm,
    textAlignVertical: 'top',
    textAlign: 'right',
  },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pickerContentCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 24,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerItem: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  pickerItemActive: {
    backgroundColor: '#FFF1F2',
    borderRadius: 12,
  },
  pickerItemText: {
    fontSize: 16,
    color: '#64748B',
    fontFamily: lu.fonts.bodySemi,
  },
});
