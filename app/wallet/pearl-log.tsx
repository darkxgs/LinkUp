/**
 * سجل الماسة — تبويبات واضحة + فلترة زمنية + Cloud Function
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react-native';
import { ChevronLeft } from '@/components/ui/RtlIcons';

import { Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { lu } from '@/theme/lu-brand';
import { useLightStatusBarOnFocus } from '@/hooks/useLightStatusBarOnFocus';
import {
  fetchPearlLog,
  type PearlLogItem,
  type PearlLogPeriod,
  type PearlLogTab,
} from '@/services/pearlLogService';

type TabDef = {
  id: PearlLogTab;
  labelKey: string;
  hintKey: string;
  Icon: typeof ArrowDownCircle;
  color: string;
  soft: string;
};

const TABS: TabDef[] = [
  {
    id: 'income',
    labelKey: 'wallet.pearlTabIncome',
    hintKey: 'wallet.pearlTabIncomeHint',
    Icon: ArrowDownCircle,
    color: lu.colors.mint,
    soft: '#E6FBF5',
  },
  {
    id: 'review',
    labelKey: 'wallet.pearlTabReview',
    hintKey: 'wallet.pearlTabReviewHint',
    Icon: Clock,
    color: lu.colors.gold2,
    soft: lu.colors.goldSoft,
  },
  {
    id: 'audit',
    labelKey: 'wallet.pearlTabAudit',
    hintKey: 'wallet.pearlTabAuditHint',
    Icon: CheckCircle2,
    color: lu.colors.blue,
    soft: lu.colors.blueSoft,
  },
  {
    id: 'withdraw',
    labelKey: 'wallet.pearlTabWithdraw',
    hintKey: 'wallet.pearlTabWithdrawHint',
    Icon: ArrowUpCircle,
    color: lu.colors.pink,
    soft: lu.colors.pinkSoft,
  },
  {
    id: 'refund',
    labelKey: 'wallet.pearlTabRefund',
    hintKey: 'wallet.pearlTabRefundHint',
    Icon: RotateCcw,
    color: lu.colors.live,
    soft: lu.colors.redSoft,
  },
];

const PERIODS: { days: PearlLogPeriod; labelKey: string }[] = [
  { days: 0, labelKey: 'wallet.pearlPeriodAll' },
  { days: 7, labelKey: 'wallet.pearlPeriod7' },
  { days: 30, labelKey: 'wallet.pearlPeriod30' },
  { days: 90, labelKey: 'wallet.pearlPeriod90' },
];

export default function PearlLogScreen() {
  // شاشة داكنة الخلفية/الرأس — أيقونات شريط الحالة فاتحة أثناء التركيز فقط
  useLightStatusBarOnFocus();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [tab, setTab] = useState<PearlLogTab>('income');
  const [period, setPeriod] = useState<PearlLogPeriod>(0);
  const [items, setItems] = useState<PearlLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTab = TABS.find((x) => x.id === tab) ?? TABS[0]!;

  const loadItems = useCallback(async () => {
    if (!user?.uid) return;
    setError(null);
    try {
      const list = await fetchPearlLog(tab, period);
      setItems(list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('wallet.text76956');
      setError(msg);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, period, user?.uid, t]);

  useEffect(() => {
    setLoading(true);
    void loadItems();
  }, [loadItems]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadItems();
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[...lu.gradients.brand]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn} hitSlop={10}>
            <ChevronLeft size={22} color="#fff" />
          </Pressable>
          <Text variant="h3" color="#fff" weight="bold">
            {t('wallet.pearlLog')}
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {/* تبويبات — شرائح أفقية مضغوطة */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsRow}
        >
          {TABS.map((tabItem) => {
            const active = tab === tabItem.id;
            const TabIcon = tabItem.Icon;
            return (
              <Pressable
                key={tabItem.id}
                onPress={() => setTab(tabItem.id)}
                style={[
                  styles.tabChip,
                  active && {
                    borderColor: tabItem.color,
                    backgroundColor: tabItem.soft,
                  },
                ]}
              >
                <View
                  style={[
                    styles.tabIconWrap,
                    { backgroundColor: active ? tabItem.color : lu.colors.card2 },
                  ]}
                >
                  <TabIcon
                    size={15}
                    color={active ? '#fff' : lu.colors.ink2}
                    strokeWidth={2.2}
                  />
                </View>
                <Text
                  variant="caption"
                  weight={active ? 'bold' : 'regular'}
                  color={active ? tabItem.color : lu.colors.ink2}
                  style={styles.tabLabel}
                  numberOfLines={1}
                >
                  {t(tabItem.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ملخص التبويب + فلتر الوقت */}
        <View style={[styles.metaBar, { backgroundColor: activeTab.soft }]}>
          <activeTab.Icon size={14} color={activeTab.color} strokeWidth={2.2} />
          <Text variant="caption" color={lu.colors.ink2} style={styles.metaHint} numberOfLines={1}>
            {t(activeTab.hintKey)}
          </Text>
          <View style={[styles.countBadge, { backgroundColor: activeTab.color }]}>
            <Text variant="caption" color="#fff" weight="bold">
              {loading ? '…' : items.length}
            </Text>
          </View>
        </View>

        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <Pressable
              key={p.days}
              onPress={() => setPeriod(p.days)}
              style={[styles.periodChip, period === p.days && styles.periodChipActive]}
            >
              <Text
                variant="caption"
                weight={period === p.days ? 'bold' : 'regular'}
                color={period === p.days ? '#fff' : lu.colors.ink2}
              >
                {t(p.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lu.colors.pink} />
          }
        >
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={lu.colors.pink} />
            </View>
          ) : error ? (
            <View style={styles.centerBox}>
              <Text variant="button" color={lu.colors.live} align="center">
                {error}
              </Text>
              <Pressable onPress={() => { setLoading(true); void loadItems(); }} style={styles.retryBtn}>
                <Text variant="caption" color="#fff" weight="bold">
                  {t('common.retry')}
                </Text>
              </Pressable>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.centerBox}>
              <Sparkles size={44} color={lu.colors.line} />
              <Text variant="button" color={lu.colors.muted} align="center" style={{ marginTop: 12 }}>
                {t('wallet.pearlEmpty', { tab: t(activeTab.labelKey) })}
              </Text>
            </View>
          ) : (
            items.map((tx) => <TransactionRow key={`${tx.source}-${tx.id}`} tx={tx} tab={tab} />)
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function TransactionRow({ tx, tab }: { tx: PearlLogItem; tab: PearlLogTab }) {
  const { t, i18n } = useTranslation();
  const isIncoming = tx.amount > 0;
  const date = new Date(tx.createdAt);
  // التاريخ بلغة التطبيق الحالية (كان مثبّتاً على العربية حتى للإنجليزية)
  const dateLocale = i18n.language?.startsWith('ar') ? 'ar' : 'en-US';
  const dateStr = date.toLocaleDateString(dateLocale, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = date.toLocaleTimeString(dateLocale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  let label = tx.itemName ?? '';
  let statusBadge = '';
  let statusColor = lu.colors.muted;

  if (tx.source === 'withdrawal' || tx.type?.includes('withdrawal')) {
    if (tx.type?.includes('self')) label = t('wallet.text85907');
    else if (tx.type?.includes('via_agent')) label = t('wallet.text16479');
    else label = t('wallet.text11106');

    if (tx.status === 'pending') {
      statusBadge = t('wallet.pending');
      statusColor = lu.colors.gold2;
    } else if (tx.status === 'completed') {
      statusBadge = t('wallet.completed');
      statusColor = lu.colors.mint;
    } else if (tx.status === 'rejected') {
      statusBadge = t('wallet.rejected');
      statusColor = lu.colors.live;
    }
  } else if (tx.type === 'gift_received') {
    label = t('wallet.pearlGiftFrom', { name: tx.fromName ?? t('rooms.userFallback') });
  } else if (tx.type === 'transfer_received') {
    label = t('wallet.pearlTransferFrom', { name: tx.fromName ?? t('rooms.userFallback') });
  } else if (tx.type === 'agent_collected') {
    label = t('wallet.pearlAgentCollected', { name: tx.fromName ?? '' });
  } else if (tx.type?.includes('refund')) {
    label = t('wallet.pearlTabRefund');
    statusBadge = t('wallet.completed');
    statusColor = lu.colors.mint;
  } else if (!label) {
    label = tx.type?.replace(/_/g, ' ') ?? t('wallet.transactions');
  }

  const showAmount = tab !== 'review' || tx.amount !== 0;

  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: isIncoming ? '#E6FBF5' : lu.colors.pinkSoft }]}>
        {isIncoming ? (
          <ArrowDownCircle size={20} color={lu.colors.mint} />
        ) : (
          <ArrowUpCircle size={20} color={lu.colors.pink} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text variant="button" weight="bold" color={lu.colors.ink}>
            {label}
          </Text>
          {statusBadge ? (
            <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
              <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700' }}>
                {statusBadge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="caption" color={lu.colors.muted}>
          {dateStr} • {timeStr}
        </Text>
        {tx.commission != null && tx.commission > 0 ? (
          <Text variant="caption" color={lu.colors.muted}>
            {t('wallet.fee')}: {tx.commission.toLocaleString()} · {t('wallet.text63257')}:{' '}
            {(tx.netAmount ?? 0).toLocaleString()}
          </Text>
        ) : null}
      </View>
      {showAmount ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="button" color={isIncoming ? lu.colors.mint : lu.colors.live} weight="bold">
            {isIncoming ? '+' : ''}
            {tx.amount.toLocaleString()}
          </Text>
          <Text variant="caption" color={lu.colors.muted}>
            {t('profile.pearlsLabel')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: lu.colors.bg },
  hero: { paddingBottom: 14 },
  header: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    marginTop: -8,
    backgroundColor: lu.colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
  },
  tabsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 44,
    marginBottom: 8,
  },
  tabsRow: {
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: lu.radius.pill,
    backgroundColor: lu.colors.card,
    borderWidth: 1.5,
    borderColor: lu.colors.line,
  },
  tabIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 12,
    maxWidth: 72,
  },
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: lu.radius.pill,
  },
  metaHint: {
    flex: 1,
    fontSize: 11,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginHorizontal: 14,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: lu.colors.card,
    borderRadius: lu.radius.pill,
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  periodChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: lu.radius.pill,
    backgroundColor: lu.colors.card2,
  },
  periodChipActive: {
    backgroundColor: lu.colors.pink,
  },
  centerBox: {
    paddingVertical: 64,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  retryBtn: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: lu.radius.pill,
    backgroundColor: lu.colors.pink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: lu.colors.card,
    borderRadius: lu.radius.base,
    borderWidth: 1,
    borderColor: lu.colors.line,
    ...lu.shadows.card,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
