/**
 * بلاغاتي — متابعة البلاغات المقدّمة للإدارة
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Flag, ChevronRight, FileText } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import { useAuth } from '@/hooks/useAuth';
import {
  subscribeMyReports,
  type ReportReason,
  type ReportStatus,
  type UserReport,
} from '@/services/firebase/reports';
import { lu } from '@/theme/lu-brand';

const STATUS_STYLE: Record<
  ReportStatus,
  { bg: string; color: string; labelKey: string }
> = {
  pending: { bg: '#FEF3C7', color: '#B45309', labelKey: 'report.statusPending' },
  reviewing: { bg: '#DBEAFE', color: '#1D4ED8', labelKey: 'report.statusReviewing' },
  resolved: { bg: '#DCFCE7', color: '#15803D', labelKey: 'report.statusResolved' },
  dismissed: { bg: '#F3F4F6', color: '#6B7280', labelKey: 'report.statusDismissed' },
};

const REASON_KEYS: Record<ReportReason, string> = {
  spam: 'report.text34773',
  harassment: 'report.text75572',
  inappropriate: 'report.text46086',
  fake: 'report.text28356',
  scam: 'report.text40896',
  hate: 'report.text43452',
  violence: 'report.text88656',
  underage: 'report.text32386',
  other: 'report.text52088',
};

const TARGET_KEYS: Record<string, string> = {
  user: 'report.targetUser',
  message: 'report.targetMessage',
  post: 'report.targetPost',
  room: 'report.targetRoom',
  general: 'report.targetGeneral',
};

function formatDate(ts: number, locale: string): string {
  if (!ts) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

function ReportRow({
  item,
  locale,
  onPress,
}: {
  item: UserReport;
  locale: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const status = STATUS_STYLE[item.status] ?? STATUS_STYLE.pending;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: lu.colors.bg2 }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${status.color}18` }]}>
        <Flag size={18} color={status.color} strokeWidth={2.2} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text weight="semibold" style={styles.rowTitle} numberOfLines={1}>
            {t(REASON_KEYS[item.reason] ?? REASON_KEYS.other)}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>
              {t(status.labelKey)}
            </Text>
          </View>
        </View>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {t(TARGET_KEYS[item.targetType] ?? TARGET_KEYS.general)}
          {item.targetDisplayName ? ` · ${item.targetDisplayName}` : ''}
        </Text>
        <Text style={styles.rowDate}>{formatDate(item.createdAt, locale)}</Text>
        <Text style={styles.rowRef}>
          {t('report.reportRef', { id: item.id.slice(0, 8).toUpperCase() })}
        </Text>
      </View>
      <ChevronRight size={18} color={lu.colors.muted} strokeWidth={2.2} />
    </Pressable>
  );
}

export default function MyReportsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setReports([]);
      setLoading(false);
      return;
    }
    const unsub = subscribeMyReports((rows) => {
      setReports(rows);
      setLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <BackChevron size={22} color={lu.colors.ink} />
        </Pressable>
        <Text weight="bold" style={styles.headerTitle}>
          {t('report.myReportsTitle')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.subtitle}>{t('report.myReportsHint')}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={lu.colors.purple} size="large" />
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <FileText size={32} color={lu.colors.muted} strokeWidth={1.8} />
          </View>
          <Text weight="semibold" style={styles.emptyTitle}>
            {t('report.noReports')}
          </Text>
          <Text style={styles.emptyHint}>{t('report.noReportsHint')}</Text>
          <Pressable
            style={styles.emptyBtn}
            onPress={() => router.push('/report' as any)}
          >
            <Text weight="semibold" style={styles.emptyBtnText}>
              {t('support.reportIssue')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.listCard}>
            {reports.map((item, i) => (
              <View key={item.id}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <ReportRow
                  item={item}
                  locale={i18n.language}
                  onPress={() => router.push(`/report/${item.id}` as any)}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: lu.colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: lu.colors.line,
    backgroundColor: lu.colors.card,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    color: lu.colors.ink,
  },
  subtitle: {
    fontSize: 13,
    color: lu.colors.ink2,
    lineHeight: 19,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: {
    marginHorizontal: 14,
    backgroundColor: lu.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: lu.colors.line,
    overflow: 'hidden',
    ...lu.shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 14,
    color: lu.colors.ink,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  rowMeta: {
    fontSize: 12,
    color: lu.colors.ink2,
  },
  rowDate: {
    fontSize: 11,
    color: lu.colors.muted,
    marginTop: 2,
  },
  rowRef: {
    fontSize: 10,
    color: lu.colors.muted,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: 1,
    backgroundColor: lu.colors.line,
    marginHorizontal: 14,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: lu.colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    color: lu.colors.ink,
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 13,
    color: lu.colors.ink2,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: lu.colors.purple,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 14,
  },
});
