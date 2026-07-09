/**
 * تقديم طلب حفلة / فعالية للوكالة
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, ChevronDown } from 'lucide-react-native';

import { Text, useAlert } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import { useImageUpload } from '@/hooks/useImageUpload';
import {
  AGENCY_PARTY_DURATIONS,
  AGENCY_PARTY_EVENT_TYPES,
  submitAgencyPartyRequest,
  type AgencyPartyEventType,
} from '@/services/agencyPartyRequests';

function roundToNextHour(ts = Date.now()): number {
  const d = new Date(ts);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.getTime();
}

function formatStartLabel(ts: number, isAr: boolean): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} — ${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

export default function AgencyPartyCreateScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const params = useLocalSearchParams<{ roomId?: string; agencyId?: string; agencyName?: string }>();
  const { pickAndUpload, uploading } = useImageUpload();
  const isAr = i18n.language?.startsWith('ar') !== false;

  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [startAt, setStartAt] = useState(roundToNextHour());
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [eventType, setEventType] = useState<AgencyPartyEventType>('dating');
  const [allowPromotion, setAllowPromotion] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [durationPickerOpen, setDurationPickerOpen] = useState(false);

  const eventTypeLabel = useMemo(
    () => AGENCY_PARTY_EVENT_TYPES.find((e) => e.id === eventType),
    [eventType],
  );

  const handlePickCover = async () => {
    const url = await pickAndUpload({ folder: 'banners', aspect: [1, 1], quality: 0.85 });
    if (url) setCoverUrl(url);
  };

  const shiftStart = (hours: number) => {
    setStartAt((prev) => prev + hours * 60 * 60 * 1000);
  };

  const handleSubmit = async () => {
    if (!params.agencyId || !params.roomId) {
      showAlert({ type: 'error', title: t('common.error'), message: t('agencyParty.missingRoom') });
      return;
    }
    setSubmitting(true);
    try {
      await submitAgencyPartyRequest({
        agencyId: String(params.agencyId),
        agencyName: String(params.agencyName ?? ''),
        roomId: String(params.roomId),
        description,
        coverUrl,
        eventType,
        startAt,
        durationMinutes,
        allowPublicPromotion: allowPromotion,
      });
      showAlert({
        type: 'success',
        title: t('common.done'),
        message: t('agencyParty.submitSuccess'),
      });
      router.back();
    } catch (e: any) {
      showAlert({ type: 'error', title: t('common.error'), message: e?.message ?? t('common.error') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#FFF5F5', '#FFFFFF']} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <BackChevron size={22} color="#111" />
        </Pressable>
        <Text style={styles.headerTitle}>{t('agencyParty.createTitle')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>
        <Pressable style={styles.coverBox} onPress={() => void handlePickCover()} disabled={uploading}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.coverImg} contentFit="cover" />
          ) : uploading ? (
            <ActivityIndicator color="#E11414" />
          ) : (
            <>
              <Plus size={32} color="#999" />
              <Text style={styles.coverHint}>{t('agencyParty.coverRatio')}</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.label}>{t('agencyParty.description')}</Text>
        <TextInput
          value={description}
          onChangeText={(v) => setDescription(v.slice(0, 100))}
          multiline
          placeholder={t('agencyParty.descriptionHint')}
          placeholderTextColor="#999"
          style={styles.textArea}
        />
        <Text style={styles.counter}>{description.length}/100</Text>

        <Text style={styles.label}>{t('agencyParty.eventTime')}</Text>
        <Text style={styles.subLabel}>{t('agencyParty.eventTimeHint')}</Text>
        <View style={styles.rowBtns}>
          <Pressable style={styles.selectBtn} onPress={() => shiftStart(-1)}>
            <Text style={styles.selectBtnText}>-1h</Text>
          </Pressable>
          <View style={[styles.selectBtn, { flex: 1 }]}>
            <Text style={styles.selectBtnText}>{formatStartLabel(startAt, isAr)}</Text>
          </View>
          <Pressable style={styles.selectBtn} onPress={() => shiftStart(1)}>
            <Text style={styles.selectBtnText}>+1h</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>{t('agencyParty.duration')}</Text>
        <Pressable style={styles.selectField} onPress={() => setDurationPickerOpen(true)}>
          <Text style={styles.selectFieldText}>{durationMinutes} {isAr ? 'دقيقة' : 'min'}</Text>
          <ChevronDown size={18} color="#666" />
        </Pressable>

        <Text style={styles.label}>{t('agencyParty.eventType')}</Text>
        <Pressable style={styles.selectField} onPress={() => setTypePickerOpen(true)}>
          <Text style={styles.selectFieldText}>
            {isAr ? eventTypeLabel?.labelAr : eventTypeLabel?.labelEn}
          </Text>
          <ChevronDown size={18} color="#666" />
        </Pressable>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>{t('agencyParty.promotionTitle')}</Text>
            <Text style={styles.switchSub}>{t('agencyParty.promotionSub')}</Text>
          </View>
          <Switch
            value={allowPromotion}
            onValueChange={setAllowPromotion}
            trackColor={{ true: '#EF4444', false: '#E5E7EB' }}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={styles.submitBtn} onPress={() => void handleSubmit()} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{t('agencyParty.submit')}</Text>
          )}
        </Pressable>
      </View>

      <PickerModal
        visible={typePickerOpen}
        title={t('agencyParty.eventType')}
        options={AGENCY_PARTY_EVENT_TYPES.map((e) => ({
          key: e.id,
          label: isAr ? e.labelAr : e.labelEn,
        }))}
        onClose={() => setTypePickerOpen(false)}
        onSelect={(key) => {
          setEventType(key as AgencyPartyEventType);
          setTypePickerOpen(false);
        }}
      />

      <PickerModal
        visible={durationPickerOpen}
        title={t('agencyParty.duration')}
        options={AGENCY_PARTY_DURATIONS.map((m) => ({
          key: String(m),
          label: `${m} ${isAr ? 'دقيقة' : 'min'}`,
        }))}
        onClose={() => setDurationPickerOpen(false)}
        onSelect={(key) => {
          setDurationMinutes(Number(key));
          setDurationPickerOpen(false);
        }}
      />
    </View>
  );
}

function PickerModal({
  visible,
  title,
  options,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: { key: string; label: string }[];
  onClose: () => void;
  onSelect: (key: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => (
              <Pressable style={styles.modalItem} onPress={() => onSelect(item.key)}>
                <Text style={styles.modalItemText}>{item.label}</Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111' },
  coverBox: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  coverImg: { width: '100%', height: '100%' },
  coverHint: { color: '#999', fontSize: 11, marginTop: 6 },
  label: { fontWeight: '700', color: '#111', marginBottom: 8, textAlign: 'right' },
  subLabel: { color: '#888', fontSize: 12, marginBottom: 8, textAlign: 'right' },
  textArea: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    textAlign: 'right',
    color: '#111',
  },
  counter: { color: '#999', fontSize: 11, textAlign: 'left', marginTop: 4, marginBottom: 16 },
  rowBtns: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  selectBtn: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBtnText: { color: '#333', fontWeight: '600', fontSize: 13 },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  selectFieldText: { color: '#333', fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  switchTitle: { color: '#111', fontWeight: '700', textAlign: 'right' },
  switchSub: { color: '#888', fontSize: 12, marginTop: 4, textAlign: 'right' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  submitBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '50%',
    padding: 16,
  },
  modalTitle: { fontWeight: '800', fontSize: 16, marginBottom: 12, textAlign: 'center' },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalItemText: { textAlign: 'center', fontWeight: '600', color: '#333' },
});
