/**
 * طلبات الانضمام — شاشة الوكيل
 *  - تعرض الطلبات المعلّقة لوكالة الوكيل الحالي
 *  - status='requested'     → طلب عبر كود دعوة بانتظار موافقة الوكيل
 *  - status='host_accepted' → دعوة مباشرة قبلتها المضيفة بانتظار تأكيد الوكيل النهائي
 *  - موافقة / رفض لكل طلب
 */
import React, { useCallback, useEffect, useState } from 'react';
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
import { Image } from 'expo-image';
import { CheckCircle2, XCircle, Inbox, KeyRound } from 'lucide-react-native';
import { ChevronRight } from '@/components/ui/RtlIcons';

import { Text, useAlert } from '@/components/ui';
import {
  fetchAgencyJoinRequests,
  approveAgencyJoinRequest,
  rejectAgencyJoinRequest,
  type AgencyInvite,
} from '@/services/agencyService';
import { lu } from '@/theme/lu-brand';
import { spacing, radius, shadows } from '@/theme';

export default function AgencyRequestsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert, showToast } = useAlert();

  const [requests, setRequests] = useState<AgencyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchAgencyJoinRequests();
      setRequests(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (req: AgencyInvite) => {
    setBusyId(req.id);
    try {
      const result = await approveAgencyJoinRequest(req.id);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      if (result.needsGenderVerification) {
        showAlert({
          type: 'success',
          title: t('common.done'),
          message: `تمت الموافقة على "${req.invitedName}" — سينضم كعضو ويُكمل التوثيق لاحقاً`,
        });
      } else {
        showToast(`تمت الموافقة على انضمام "${req.invitedName}"`);
      }
    } catch (e: any) {
      showAlert({ type: 'error', title: t('common.error'), message: e?.message ?? t('common.error') });
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (req: AgencyInvite) => {
    setBusyId(req.id);
    try {
      await rejectAgencyJoinRequest(req.id);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      showToast('تم رفض الطلب');
    } catch (e: any) {
      showAlert({ type: 'error', title: t('common.error'), message: e?.message ?? t('common.error') });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[lu.colors.pinkSoft, lu.colors.purple]}
        style={[styles.hero, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.header}>
          <View style={{ width: 36 }} />
          <Text variant="h3" color="#fff" weight="bold">طلبات الانضمام</Text>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <ChevronRight size={20} color="#fff" />
          </Pressable>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={lu.colors.pink} size="large" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 60 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={lu.colors.pink}
            />
          }
        >
          {requests.length === 0 ? (
            <View style={styles.empty}>
              <Inbox size={52} color="#D1D5DB" />
              <Text variant="body" color="#9CA3AF" align="center" style={{ marginTop: 12 }}>
                لا توجد طلبات انضمام حالياً
              </Text>
            </View>
          ) : (
            requests.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                busy={busyId === req.id}
                onApprove={() => handleApprove(req)}
                onReject={() => handleReject(req)}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function RequestCard({
  request,
  busy,
  onApprove,
  onReject,
}: {
  request: AgencyInvite;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isHostAccepted = request.status === 'host_accepted';
  const date = new Date(request.createdAt);
  const dateStr = date.toLocaleDateString('ar', { year: 'numeric', month: '2-digit', day: '2-digit' });

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        {request.invitedAvatar ? (
          <Image source={{ uri: request.invitedAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: lu.colors.purple, alignItems: 'center', justifyContent: 'center' }]}>
            <Text variant="h3" color="#fff">{(request.invitedName ?? '?')[0]}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text variant="button" weight="bold" numberOfLines={1}>{request.invitedName}</Text>
          <View style={styles.typeRow}>
            {isHostAccepted ? (
              <CheckCircle2 size={12} color={lu.colors.purple} />
            ) : (
              <KeyRound size={12} color="#F59E0B" />
            )}
            <Text variant="caption" color={isHostAccepted ? lu.colors.purple : '#F59E0B'}>
              {isHostAccepted ? 'وافقت على دعوتك — بانتظار تأكيدك' : 'طلب انضمام (كود دعوة)'}
            </Text>
          </View>
          <Text variant="caption" color="#9CA3AF">{dateStr}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.rejectBtn, busy && { opacity: 0.5 }]}
          onPress={onReject}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <>
              <XCircle size={16} color="#EF4444" />
              <Text variant="caption" color="#EF4444" weight="bold">رفض</Text>
            </>
          )}
        </Pressable>
        <Pressable
          style={[styles.acceptBtn, busy && { opacity: 0.5 }]}
          onPress={onApprove}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <CheckCircle2 size={16} color="#fff" />
              <Text variant="caption" color="#fff" weight="bold">موافقة</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  hero: { paddingBottom: 16 },
  header: {
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 60, alignItems: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row', gap: 10, marginTop: 14,
  },
  rejectBtn: {
    flex: 1, height: 40, borderRadius: radius.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#EF4444',
  },
  acceptBtn: {
    flex: 2, height: 40, borderRadius: radius.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: lu.colors.pink,
  },
});
