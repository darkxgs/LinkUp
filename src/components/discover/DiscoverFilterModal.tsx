import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { lu } from '@/theme/lu-brand';
import {
  DEFAULT_DISCOVER_USER_FILTER,
  type DiscoverUserFilter,
} from '@/utils/discoverFilter';
import {
  DISCOVER_AGE_MAX,
  DISCOVER_AGE_MIN,
} from '@/utils/userAge';

type Props = {
  visible: boolean;
  value: DiscoverUserFilter;
  onConfirm: (next: DiscoverUserFilter) => void;
  onClose: () => void;
};

type AgePreset = {
  label: string;
  min: number;
  max: number;
};

export function DiscoverFilterModal({ visible, value, onConfirm, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<DiscoverUserFilter>(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const isAr = i18n.language?.startsWith('ar');

  const agePresets: AgePreset[] = [
    { label: isAr ? 'الكل' : 'All Ages', min: DISCOVER_AGE_MIN, max: DISCOVER_AGE_MAX },
    { label: '18 - 22', min: 18, max: 22 },
    { label: '23 - 27', min: 23, max: 27 },
    { label: '28 - 32', min: 28, max: 32 },
    { label: '33 - 37', min: 33, max: 37 },
    { label: '38+', min: 38, max: DISCOVER_AGE_MAX },
  ];

  const handleSelectPreset = (preset: AgePreset) => {
    setDraft((d) => ({
      ...d,
      minAge: preset.min,
      maxAge: preset.max,
    }));
  };

  const isPresetActive = (preset: AgePreset) => {
    return draft.minAge === preset.min && draft.maxAge === preset.max;
  };

  const isFilterModified =
    draft.minAge !== DEFAULT_DISCOVER_USER_FILTER.minAge ||
    draft.maxAge !== DEFAULT_DISCOVER_USER_FILTER.maxAge ||
    draft.onlineOnly !== DEFAULT_DISCOVER_USER_FILTER.onlineOnly;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <X size={18} color={lu.colors.ink} strokeWidth={2.4} />
            </Pressable>
            <Text style={styles.title}>{t('home.filterTitle') || 'Filter'}</Text>
            <View style={styles.balancePlaceholder} />
          </View>

          {/* Section 1: Online Status */}
          <Text style={styles.sectionLabel}>{t('home.filterOnline') || 'Status'}</Text>
          <View style={styles.toggleRow}>
            <Pressable
              onPress={() => setDraft((d) => ({ ...d, onlineOnly: false }))}
              style={[styles.toggleBtn, !draft.onlineOnly && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleText, !draft.onlineOnly && styles.toggleTextActive]}>
                {t('home.filterAll') || 'All'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setDraft((d) => ({ ...d, onlineOnly: true }))}
              style={[styles.toggleBtn, draft.onlineOnly && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleText, draft.onlineOnly && styles.toggleTextActive]}>
                {t('home.filterOnlineOnly') || 'Online'}
              </Text>
            </Pressable>
          </View>

          {/* Section 2: Age Range */}
          <Text style={styles.sectionLabel}>
            {isAr ? 'الفئة العمرية' : 'Age Range'}
          </Text>
          <View style={styles.presetsGrid}>
            {agePresets.map((preset, idx) => {
              const active = isPresetActive(preset);
              return (
                <Pressable
                  key={idx}
                  onPress={() => handleSelectPreset(preset)}
                  style={[styles.presetCard, active && styles.presetCardActive]}
                >
                  <Text style={[styles.presetText, active && styles.presetTextActive]}>
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Confirm Button */}
          <Pressable
            onPress={() => {
              onConfirm(draft);
              onClose();
            }}
            style={({ pressed }) => [styles.confirmBtnContainer, pressed && { opacity: 0.9 }]}
          >
            <LinearGradient
              colors={['#FF2D2D', '#B00E0E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.confirmBtn}
            >
              <Text style={styles.confirmText}>
                {t('home.filterConfirm') || 'Confirm'}
              </Text>
            </LinearGradient>
          </Pressable>

          {/* Reset Button */}
          {isFilterModified && (
            <Pressable
              onPress={() => setDraft(DEFAULT_DISCOVER_USER_FILTER)}
              style={styles.resetBtn}
            >
              <Text style={styles.resetText}>
                {t('home.filterReset') || 'Reset Filters'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '85%',
    maxWidth: 340,
    padding: 22,
    shadowColor: '#9A1414',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    height: 40,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F6ECEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#15151A',
    fontFamily: lu.fonts.bodyHeavy,
    textAlign: 'center',
  },
  balancePlaceholder: {
    width: 36,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
    fontFamily: lu.fonts.bodyBold,
    marginBottom: 10,
    marginTop: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#E11414',
    borderColor: '#E11414',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    fontFamily: lu.fonts.bodyBold,
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 22,
  },
  presetCard: {
    width: '31%',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetCardActive: {
    backgroundColor: '#E11414',
    borderColor: '#E11414',
  },
  presetText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
    fontFamily: lu.fonts.bodyBold,
  },
  presetTextActive: {
    color: '#ffffff',
  },
  confirmBtnContainer: {
    borderRadius: 99,
    overflow: 'hidden',
  },
  confirmBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  resetBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 4,
  },
  resetText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E11414',
    fontFamily: lu.fonts.bodyBold,
  },
});
