/**
 * شاشة «دعواتي» — الدعوات المباشرة المُستلَمة من وكلاء
 * يمكن للمستخدم قبول أو رفض كل دعوة
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
import { CheckCircle2, XCircle, Clock, Inbox } from 'lucide-react-native';
import { ChevronRight } from '@/components/ui/RtlIcons';

import { Text, useAlert } from '@/components/ui';
import {
  fetchMyReceivedInvites,
  acceptDirectAgencyInvite,
  rejectDirectAgencyInvite,
  type AgencyInvite,
} from '@/services/agencyService';
import { createNotification } from '@/services/firebase/notifications';
import { lu } from '@/theme/lu-brand';
import { spacing, radius, shadows } from '@/theme';

export default function MyInvitesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [invites, setInvites] = useState<AgencyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchMyReceivedInvites();
      setInvites(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAccept = async (invite: AgencyInvite) => {
    setBusyId(invite.id);
    try {
      const result = await acceptDirectAgencyInvite(invite.id);

      // موافقة الانضمام مفعّلة: المضيفة قبلت والطلب بانتظار تأكيد الوكيل النهائي —
      // لا نُنفّذ مسار «تم الانضمام» (لا إشعارات انضمام ولا تنقّل للمركز)
      if (result.pendingAgentConfirm) {
        setInvites((prev) => prev.map((i) => i.id === invite.id ? { ...i, status: 'host_accepted' } : i));
        showAlert({
          type: 'success',
          title: t('agency.text451502'),
          message: 'بانتظار تأكيد الوكيل النهائي',
          buttons: [{ text: t('common.ok') }],
        });
        return;
      }

      setInvites((prev) => prev.map((i) => i.id === invite.id ? { ...i, status: 'accepted' } : i));

      // 1. Notification to Host (invitedUid)
      try {
        await createNotification({
          uid: invite.invitedUid,
          type: 'system',
          message: `لقد انضممت بنجاح إلى وكالة "${invite.agencyName || result.agencyName}"`,
          data: {
            title: 'الانضمام لوكالة',
            body: `لقد انضممت بنجاح إلى وكالة "${invite.agencyName || result.agencyName}"`,
            agencyId: invite.agencyId || result.agencyId,
            type: 'system',
          },
          isRead: false,
        });
      } catch (err) {
        console.error('Error creating notification for host:', err);
      }

      // 2. Notification to Agency Owner (agentUid)
      try {
        await createNotification({
          uid: invite.agentUid,
          type: 'system',
          message: `لقد قبل "${invite.invitedName || 'مضيف'}" دعوتك وانضم إلى وكالة "${invite.agencyName || result.agencyName}"`,
          data: {
            title: 'انضمام عضو جديد',
            body: `لقد قبل "${invite.invitedName || 'مضيف'}" دعوتك وانضم إلى وكالة "${invite.agencyName || result.agencyName}"`,
            agencyId: invite.agencyId || result.agencyId,
            fromUid: invite.invitedUid,
            fromName: invite.invitedName,
            fromAvatar: invite.invitedAvatar,
            type: 'system',
          },
          isRead: false,
        });
      } catch (err) {
        console.error('Error creating notification for agency owner:', err);
      }

      if (result.needsGenderVerification) {
        showAlert({
          type: 'success',
          title: t('agency.text451502'),
          message: `انضممت إلى وكالة "${result.agencyName}" كعضو — أكمل التوثيق لاحقاً للحصول على مهام المضيفة`,
          buttons: [
            { text: t('common.ok'), onPress: () => router.replace('/agency/center' as any) },
            { text: 'توثيق الحساب', onPress: () => router.push('/wallet/kyc' as any) },
          ],
        });
      } else {
        showAlert({
          type: 'success',
          title: t('agency.text451502'),
          message: `انضممت إلى وكالة "${result.agencyName}"`,
          buttons: [{ text: t('common.ok'), onPress: () => router.replace('/agency/center' as any) }],
        });
      }
    } catch (e: any) {
      const msg = String(e?.message ?? '').trim();
      if (msg.includes('توثيق الحساب')) {
        showAlert({
          type: 'warning',
          title: 'توثيق الحساب مطلوب',
          message: 'عليك توثيق الحساب للانضمام للوكالة، لا يمكنك قبول الدعوة قبل التوثيق.',
          buttons: [
            { text: 'لاحقاً' },
            { text: 'توثيق الحساب', onPress: () => router.push('/wallet/kyc' as any) },
          ],
        });
      } else {
        showAlert({ type: 'error', title: t('common.error'), message: msg || t('common.error') });
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (invite: AgencyInvite) => {
    setBusyId(invite.id);
    try {
      await rejectDirectAgencyInvite(invite.id);
      setInvites((prev) => prev.map((i) => i.id === invite.id ? { ...i, status: 'rejected' } : i));
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
          <Text variant="h3" color="#fff" weight="bold">دعواتي</Text>
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
          {invites.length === 0 ? (
            <View style={styles.empty}>
              <Inbox size={52} color="#D1D5DB" />
              <Text variant="body" color="#9CA3AF" align="center" style={{ marginTop: 12 }}>
                لا توجد دعوات حالياً
              </Text>
            </View>
          ) : (
            invites.map((inv) => (
              <InviteCard
                key={inv.id}
                invite={inv}
                busy={busyId === inv.id}
                onAccept={() => handleAccept(inv)}
                onReject={() => handleReject(inv)}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function InviteCard({
  invite,
  busy,
  onAccept,
  onReject,
}: {
  invite: AgencyInvite;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const isPending = invite.status === 'pending';
  const date = new Date(invite.createdAt);
  const dateStr = date.toLocaleDateString('ar', { year: 'numeric', month: '2-digit', day: '2-digit' });

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        {invite.invitedAvatar ? (
          <Image source={{ uri: invite.invitedAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: lu.colors.purple, alignItems: 'center', justifyContent: 'center' }]}>
            <Text variant="h3" color="#fff">{(invite.agencyName ?? '?')[0]}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text variant="button" weight="bold" numberOfLines={1}>{invite.agencyName}</Text>
          <Text variant="caption" color="#6B7280">من: {invite.agentName}</Text>
          <Text variant="caption" color="#9CA3AF">{dateStr}</Text>
        </View>
        <StatusBadge status={invite.status} />
      </View>

      {isPending && (
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
            onPress={onAccept}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <CheckCircle2 size={16} color="#fff" />
                <Text variant="caption" color="#fff" weight="bold">قبول</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; label: string; Icon: any }> = {
    pending:  { color: '#F59E0B', bg: '#FEF3C7', label: 'قيد الانتظار', Icon: Clock },
    accepted: { color: '#10B981', bg: '#D1FAE5', label: 'مقبولة', Icon: CheckCircle2 },
    rejected: { color: '#EF4444', bg: '#FEE2E2', label: 'مرفوضة', Icon: XCircle },
    host_accepted: { color: '#F59E0B', bg: '#FEF3C7', label: 'بانتظار تأكيد الوكيل', Icon: Clock },
  };
  const s = map[status] ?? { color: '#F59E0B', bg: '#FEF3C7', label: 'قيد الانتظار', Icon: Clock };
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <s.Icon size={11} color={s.color} />
      <Text style={{ color: s.color, fontSize: 10, fontWeight: '700' }}>{s.label}</Text>
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
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99,
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
