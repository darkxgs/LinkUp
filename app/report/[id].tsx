/**
 * تفاصيل بلاغ — للمبلّغ فقط
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Flag, MessageSquare, Clock } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import {
  getReportById,
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

function formatDate(ts: number, locale: string): string {
  if (!ts) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text weight="medium" style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ReportDetailScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [report, setReport] = useState<UserReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void getReportById(id).then((r) => {
      if (cancelled) return;
      setReport(r);
      setNotFound(!r);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id]);

  const status = report
    ? STATUS_STYLE[report.status] ?? STATUS_STYLE.pending
    : STATUS_STYLE.pending;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <BackChevron size={22} color={lu.colors.ink} />
        </Pressable>
        <Text weight="bold" style={styles.headerTitle}>
          {t('report.detailTitle')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={lu.colors.purple} size="large" />
        </View>
      ) : notFound || !report ? (
        <View style={styles.center}>
          <Text style={styles.notFound}>{t('report.notFound')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statusCard}>
            <View style={[styles.statusIcon, { backgroundColor: status.bg }]}>
              <Flag size={22} color={status.color} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text weight="bold" style={styles.statusTitle}>
                {t(status.labelKey)}
              </Text>
              <Text style={styles.statusSub}>
                {t('report.reportRef', { id: report.id.slice(0, 8).toUpperCase() })}
              </Text>
            </View>
          </View>

          {report.adminNote?.trim() ? (
            <View style={styles.adminNoteCard}>
              <View style={styles.adminNoteHeader}>
                <MessageSquare size={16} color={lu.colors.purple} strokeWidth={2.2} />
                <Text weight="semibold" style={styles.adminNoteTitle}>
                  {t('report.adminResponse')}
                </Text>
              </View>
              <Text style={styles.adminNoteBody}>{report.adminNote.trim()}</Text>
            </View>
          ) : report.status === 'pending' || report.status === 'reviewing' ? (
            <View style={styles.waitCard}>
              <Clock size={16} color={lu.colors.ink2} strokeWidth={2.2} />
              <Text style={styles.waitText}>{t('report.awaitingReview')}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <InfoRow
              label={t('report.fieldReason')}
              value={t(REASON_KEYS[report.reason] ?? REASON_KEYS.other)}
            />
            <View style={styles.divider} />
            <InfoRow
              label={t('report.fieldSubmitted')}
              value={formatDate(report.createdAt, i18n.language)}
            />
            {report.updatedAt ? (
              <>
                <View style={styles.divider} />
                <InfoRow
                  label={t('report.fieldUpdated')}
                  value={formatDate(report.updatedAt, i18n.language)}
                />
              </>
            ) : null}
            {report.targetDisplayName ? (
              <>
                <View style={styles.divider} />
                <InfoRow label={t('report.fieldTarget')} value={report.targetDisplayName} />
              </>
            ) : null}
          </View>

          <Text weight="semibold" style={styles.sectionLabel}>
            {t('report.text3731')}
          </Text>
          <View style={styles.card}>
            <Text style={styles.detailsText}>{report.details}</Text>
          </View>

          {report.messageText?.trim() ? (
            <>
              <Text weight="semibold" style={styles.sectionLabel}>
                {t('report.reportedContent')}
              </Text>
              <View style={styles.card}>
                <Text style={styles.detailsText}>{report.messageText.trim()}</Text>
              </View>
            </>
          ) : null}

          {report.postText?.trim() ? (
            <>
              <Text weight="semibold" style={styles.sectionLabel}>
                {t('report.reportedContent')}
              </Text>
              <View style={styles.card}>
                {report.postImageUrl ? (
                  <Image
                    source={{ uri: report.postImageUrl }}
                    style={styles.postImage}
                    contentFit="cover"
                  />
                ) : null}
                <Text style={styles.detailsText}>{report.postText.trim()}</Text>
              </View>
            </>
          ) : null}

          {report.photoUrls.length > 0 ? (
            <>
              <Text weight="semibold" style={styles.sectionLabel}>
                {t('report.text95502')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.photosRow}>
                  {report.photoUrls.map((uri) => (
                    <Image
                      key={uri}
                      source={{ uri }}
                      style={styles.photoThumb}
                      contentFit="cover"
                    />
                  ))}
                </View>
              </ScrollView>
            </>
          ) : null}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  notFound: {
    fontSize: 14,
    color: lu.colors.ink2,
    textAlign: 'center',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: lu.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: lu.colors.line,
    padding: 16,
    marginBottom: 12,
    ...lu.shadows.card,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    fontSize: 16,
    color: lu.colors.ink,
    marginBottom: 4,
  },
  statusSub: {
    fontSize: 12,
    color: lu.colors.muted,
    fontVariant: ['tabular-nums'],
  },
  adminNoteCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  adminNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminNoteTitle: {
    fontSize: 13,
    color: lu.colors.purple,
  },
  adminNoteBody: {
    fontSize: 14,
    color: lu.colors.ink,
    lineHeight: 21,
  },
  waitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: lu.colors.bg2,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  waitText: {
    flex: 1,
    fontSize: 13,
    color: lu.colors.ink2,
    lineHeight: 18,
  },
  card: {
    backgroundColor: lu.colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: lu.colors.line,
    padding: 14,
    marginBottom: 12,
  },
  infoRow: {
    gap: 4,
  },
  infoLabel: {
    fontSize: 11,
    color: lu.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: 14,
    color: lu.colors.ink,
  },
  divider: {
    height: 1,
    backgroundColor: lu.colors.line,
    marginVertical: 10,
  },
  sectionLabel: {
    fontSize: 13,
    color: lu.colors.ink2,
    marginBottom: 8,
    marginStart: 2,
  },
  detailsText: {
    fontSize: 14,
    color: lu.colors.ink,
    lineHeight: 22,
  },
  postImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginBottom: 10,
  },
  photosRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 8,
  },
  photoThumb: {
    width: 88,
    height: 88,
    borderRadius: 10,
  },
});
