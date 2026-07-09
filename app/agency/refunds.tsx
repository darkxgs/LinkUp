/**
 * استرداد أموال للداعمين — للوكيل
 */
import React, { useCallback, useEffect, useState } from 'react';
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
import { RotateCcw, Gem } from 'lucide-react-native';

import { Text, useAlert } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import {
  agentRefundSupporterPearls,
  listAgencyRefunds,
  type AgencyRefundRow,
} from '@/services/agencyService';
import { lu } from '@/theme/lu-brand';

function fmt(n: number) {
  return Number(n).toLocaleString('en-US');
}

export default function AgencyRefundsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert, showToast } = useAlert();

  const [hostId, setHostId] = useState('');
  const [supporterId, setSupporterId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refunds, setRefunds] = useState<AgencyRefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const list = await listAgencyRefunds();
    setRefunds(list);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleSubmit = async () => {
    const amt = Math.floor(Number(amount) || 0);
    if (!hostId.trim() || !supporterId.trim() || amt <= 0) {
      showToast('أدخل معرّف المضيف والداعم والمبلغ');
      return;
    }
    setSubmitting(true);
    try {
      await agentRefundSupporterPearls({
        hostIdentifier: hostId.trim(),
        supporterIdentifier: supporterId.trim(),
        amount: amt,
        reason: reason.trim() || undefined,
      });
      showAlert({
        type: 'success',
        title: 'تم الاسترداد',
        message: `تم خصم ${fmt(amt)} ماسة من المضيف وإرجاعها للداعم`,
      });
      setHostId('');
      setSupporterId('');
      setAmount('');
      setReason('');
      await load();
    } catch (e: unknown) {
      showAlert({
        type: 'error',
        title: 'فشل',
        message: e instanceof Error ? e.message : 'تعذّر تنفيذ الاسترداد',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headBtn} hitSlop={10}>
          <BackChevron color={lu.colors.ink} size={22} />
        </Pressable>
        <Text weight="bold" style={styles.headTitle}>استرداد للداعمين</Text>
        <View style={styles.headBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lu.colors.purple} />
        }
      >
        <View style={styles.infoCard}>
          <RotateCcw size={20} color={lu.colors.purple} />
          <Text variant="caption" color={lu.colors.ink2} style={{ flex: 1, lineHeight: 20 }}>
            استرداد أموال للداعمين — يُخصم من ماسة المضيف ويُضاف لرصيد الداعم، ويُحدَّث سجل أرباح المضيف في الوكالة.
          </Text>
        </View>

        <Text style={styles.label}>معرّف المضيف (UID أو ID)</Text>
        <TextInput value={hostId} onChangeText={setHostId} style={styles.input} placeholderTextColor="#9CA3AF" />

        <Text style={styles.label}>معرّف الداعم (UID أو ID)</Text>
        <TextInput value={supporterId} onChangeText={setSupporterId} style={styles.input} placeholderTextColor="#9CA3AF" />

        <Text style={styles.label}>المبلغ (ماسة)</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          style={styles.input}
          placeholderTextColor="#9CA3AF"
        />

        <Text style={styles.label}>السبب (اختياري)</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          style={[styles.input, { minHeight: 72 }]}
          multiline
          placeholderTextColor="#9CA3AF"
        />

        <Pressable onPress={handleSubmit} disabled={submitting} style={styles.submitBtn}>
          <LinearGradient colors={lu.gradients.brand} style={StyleSheet.absoluteFill} />
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text weight="bold" color="#fff">تنفيذ الاسترداد</Text>
          )}
        </Pressable>

        <Text style={[styles.label, { marginTop: 20 }]}>سجل الاستردادات</Text>
        {loading ? (
          <ActivityIndicator color={lu.colors.purple} style={{ marginTop: 16 }} />
        ) : refunds.length === 0 ? (
          <Text variant="caption" color={lu.colors.ink2} align="center" style={{ marginTop: 12 }}>
            لا توجد استردادات بعد
          </Text>
        ) : (
          refunds.map((r) => (
            <View key={r.id} style={styles.refundRow}>
              <View style={{ flex: 1 }}>
                <Text weight="semibold">{r.hostName} ← {r.supporterName}</Text>
                <Text variant="caption" color={lu.colors.ink2}>
                  {new Date(r.createdAt).toLocaleString('ar')}
                </Text>
                {r.reason ? (
                  <Text variant="caption" color={lu.colors.ink2}>{r.reason}</Text>
                ) : null}
              </View>
              <View style={styles.amtCol}>
                <Gem size={14} color={lu.colors.purple} />
                <Text weight="bold">{fmt(r.amount)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: lu.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  headBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headTitle: { fontSize: 17, color: lu.colors.ink },
  infoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 13,
    color: lu.colors.ink2,
    marginBottom: 6,
    textAlign: 'right',
    fontFamily: lu.fonts.bodySemi,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: lu.colors.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: lu.colors.ink,
    textAlign: 'right',
    marginBottom: 12,
  },
  submitBtn: {
    height: 50,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  refundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  amtCol: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
