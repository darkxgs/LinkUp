/**
 * نافذة جدولة المطابقة — اختيار يوم/وقت مستقبلي + قائمة الجدولات القادمة
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, StyleSheet, Modal, Pressable, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X, CalendarClock, Trash2, Video, Mic, Check } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import {
  createMatchSchedule, subscribeToMySchedules, cancelMatchSchedule, isDue,
  type MatchSchedule, type MatchType,
} from '@/services/firebase/matchSchedule';

const DAY_LABELS = ['اليوم', 'غداً', 'بعد غد'];
const SLOT_MIN = 30;

function startOfDay(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** فتحات وقت كل 30 دقيقة لليوم المحدّد (المستقبل فقط) */
function buildSlots(dayOffset: number): { label: string; ts: number }[] {
  const base = startOfDay(dayOffset);
  const slots: { label: string; ts: number }[] = [];
  const now = Date.now();
  const minTs = now + 10 * 60 * 1000; // 10 دقائق على الأقل من الآن
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += SLOT_MIN) {
      const d = new Date(base);
      d.setHours(h, m, 0, 0);
      const ts = d.getTime();
      if (ts < minTs) continue;
      const hh = h % 12 === 0 ? 12 : h % 12;
      const ap = h < 12 ? 'ص' : 'م';
      slots.push({ label: `${hh}:${String(m).padStart(2, '0')} ${ap}`, ts });
    }
  }
  return slots;
}

function fmtSchedule(ts: number): string {
  const d = new Date(ts);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((new Date(ts).setHours(0, 0, 0, 0) - today.getTime()) / 86400000);
  const dayLabel = dayDiff <= 2 && dayDiff >= 0 ? DAY_LABELS[dayDiff] : d.toLocaleDateString('ar');
  const h = d.getHours();
  const hh = h % 12 === 0 ? 12 : h % 12;
  const ap = h < 12 ? 'ص' : 'م';
  return `${dayLabel} • ${hh}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`;
}

export function ScheduleMatchSheet({
  visible, type, ageRanges, onClose,
}: {
  visible: boolean;
  type: MatchType;
  ageRanges: string[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [day, setDay] = useState(0);
  const [slotTs, setSlotTs] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [schedules, setSchedules] = useState<MatchSchedule[]>([]);

  useEffect(() => {
    if (!visible) return;
    const unsub = subscribeToMySchedules(setSchedules);
    return unsub;
  }, [visible]);

  const slots = useMemo(() => buildSlots(day), [day, visible]);

  useEffect(() => { setSlotTs(null); }, [day]);

  const confirm = async () => {
    if (!slotTs) return Alert.alert('تنبيه', 'اختر وقتاً للمطابقة');
    setSaving(true);
    try {
      await createMatchSchedule({ type, ageRanges, scheduledAt: slotTs });
      setSlotTs(null);
      Alert.alert('تمت الجدولة ✅', 'سنذكّرك في وقت المطابقة');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message ?? 'تعذّرت الجدولة');
    } finally { setSaving(false); }
  };

  const remove = (s: MatchSchedule) => {
    Alert.alert('إلغاء الجدولة', `إلغاء مطابقة ${fmtSchedule(s.scheduledAt)}؟`, [
      { text: 'تراجع', style: 'cancel' },
      { text: 'إلغاء', style: 'destructive', onPress: () => cancelMatchSchedule(s).catch(() => {}) },
    ]);
  };

  const accent = type === 'video' ? lu.colors.purple : '#EC3E3E';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.bg}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <View style={styles.headTitleRow}>
              <View style={[styles.headIcon, { backgroundColor: accent + '1A' }]}>
                <CalendarClock size={18} color={accent} strokeWidth={2.2} />
              </View>
              <Text weight="bold" style={styles.title}>
                جدولة مطابقة {type === 'video' ? 'فيديو' : 'صوت'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.close}><X size={20} color={lu.colors.ink} /></Pressable>
          </View>

          {/* اليوم */}
          <Text style={styles.label}>اليوم</Text>
          <View style={styles.dayRow}>
            {DAY_LABELS.map((d, i) => (
              <Pressable key={i} onPress={() => setDay(i)} style={[styles.dayChip, day === i && { borderColor: accent, backgroundColor: accent + '12' }]}>
                <Text weight={day === i ? 'bold' : 'regular'} style={[styles.dayChipText, day === i && { color: accent }]}>{d}</Text>
              </Pressable>
            ))}
          </View>

          {/* الوقت */}
          <Text style={styles.label}>الوقت</Text>
          {slots.length === 0 ? (
            <Text color={lu.colors.muted} style={{ paddingVertical: 10 }}>لا أوقات متاحة لهذا اليوم</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              {slots.map((s) => {
                const active = slotTs === s.ts;
                return (
                  <Pressable key={s.ts} onPress={() => setSlotTs(s.ts)} style={[styles.timeChip, active && { borderColor: accent, backgroundColor: accent + '12' }]}>
                    <Text weight={active ? 'bold' : 'regular'} style={[styles.timeChipText, active && { color: accent }]}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* تأكيد */}
          <Pressable onPress={confirm} disabled={saving || !slotTs} style={[styles.confirmBtn, (!slotTs || saving) && { opacity: 0.6 }]}>
            <LinearGradient colors={type === 'video' ? lu.gradients.purple : lu.gradients.blue} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            {saving ? <ActivityIndicator color="#fff" /> : (
              <>
                {type === 'video' ? <Video size={18} color="#fff" strokeWidth={2.4} /> : <Mic size={18} color="#fff" strokeWidth={2.4} />}
                <Text variant="button" color="#fff" weight="bold">جدولة المطابقة</Text>
              </>
            )}
          </Pressable>

          {/* القادمة */}
          {schedules.length > 0 && (
            <>
              <Text style={[styles.label, { marginTop: 18 }]}>مطابقاتي المجدولة</Text>
              <View style={{ gap: 8 }}>
                {schedules.map((s) => {
                  const due = isDue(s);
                  return (
                    <View key={s.id} style={[styles.schedRow, due && { borderColor: lu.colors.mint, backgroundColor: '#EBFBF5' }]}>
                      <View style={[styles.schedIcon, { backgroundColor: (s.type === 'video' ? lu.colors.purple : '#EC3E3E') + '18' }]}>
                        {s.type === 'video' ? <Video size={16} color={lu.colors.purple} /> : <Mic size={16} color="#EC3E3E" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text weight="semibold" style={styles.schedTitle}>{fmtSchedule(s.scheduledAt)}</Text>
                        <Text style={styles.schedSub}>{s.type === 'video' ? 'فيديو' : 'صوت'}{due ? ' • جاهزة الآن' : ''}</Text>
                      </View>
                      {due && <View style={styles.dueDot}><Check size={12} color="#fff" strokeWidth={3} /></View>}
                      <Pressable onPress={() => remove(s)} hitSlop={8} style={styles.schedDel}><Trash2 size={16} color={lu.colors.live} /></Pressable>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(40, 10, 10, 0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: lu.colors.bg, borderTopLeftRadius: lu.radius.xl, borderTopRightRadius: lu.radius.xl,
    padding: 18, maxWidth: 640, width: '100%', alignSelf: 'center', ...lu.shadows.pop,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: lu.colors.line, alignSelf: 'center', marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  headIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, color: lu.colors.ink },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: lu.colors.card2, alignItems: 'center', justifyContent: 'center' },

  label: { fontSize: 13, color: lu.colors.ink2, fontFamily: lu.fonts.bodyBold, marginBottom: 8, marginTop: 4 },
  dayRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  dayChip: {
    flex: 1, paddingVertical: 11, borderRadius: lu.radius.sm, alignItems: 'center',
    backgroundColor: lu.colors.card, borderWidth: 1.5, borderColor: lu.colors.line,
  },
  dayChipText: { fontSize: 14, color: lu.colors.ink2 },
  timeChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: lu.radius.pill,
    backgroundColor: lu.colors.card, borderWidth: 1.5, borderColor: lu.colors.line,
  },
  timeChipText: { fontSize: 13.5, color: lu.colors.ink2 },

  confirmBtn: {
    height: 52, borderRadius: lu.radius.pill, marginTop: 16, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...lu.shadows.grad, shadowOpacity: 0.28,
  },

  schedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11,
    backgroundColor: lu.colors.card, borderRadius: lu.radius.base, borderWidth: 1, borderColor: lu.colors.line,
  },
  schedIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  schedTitle: { fontSize: 14, color: lu.colors.ink },
  schedSub: { fontSize: 12, color: lu.colors.muted, marginTop: 1 },
  dueDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: lu.colors.mint, alignItems: 'center', justifyContent: 'center' },
  schedDel: { padding: 6 },
});
