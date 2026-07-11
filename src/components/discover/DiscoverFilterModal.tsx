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
import Animated, { FadeInDown } from 'react-native-reanimated';

import { lu } from '@/theme/lu-brand';
import { useThemeMode } from '@/stores/themeStore';
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
  const { isDark } = useThemeMode();
  const [draft, setDraft] = useState<DiscoverUserFilter>(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const isAr = i18n.language?.startsWith('ar');

  // لوحة ألوان النافذة حسب السمة.
  const pal = isDark
    ? {
        cardBg: '#231217',
        cardBorder: 'rgba(255,45,60,0.3)',
        cardShadow: '#FF1E30',
        title: '#FFFFFF',
        closeBg: 'rgba(255,255,255,0.08)',
        closeIcon: '#FFFFFF',
        label: 'rgba(255,255,255,0.6)',
        chipBg: 'rgba(255,255,255,0.05)',
        chipBorder: lu.colors.nightLine,
        chipText: 'rgba(255,255,255,0.68)',
        reset: '#FF5C6C',
      }
    : {
        cardBg: '#FFFFFF',
        cardBorder: 'rgba(225,20,20,0.14)',
        cardShadow: '#9A1414',
        title: '#15151A',
        closeBg: '#F6ECEC',
        closeIcon: '#15151A',
        label: '#4B5563',
        chipBg: '#FFFFFF',
        chipBorder: '#E9E0E1',
        chipText: '#6B7280',
        reset: '#E11414',
      };

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

  // شريحة اختيار — نشطة بتدرّج أحمر متوهج، خاملة زجاجية حسب السمة.
  const chip = (active: boolean, label: string, onPress: () => void, style: object, key?: React.Key) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        style,
        { backgroundColor: active ? '#C40E2E' : pal.chipBg, borderColor: pal.chipBorder },
        active && styles.chipActive,
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      {active ? (
        <LinearGradient
          colors={['#FF4D66', '#C40E2E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Text style={[styles.chipText, { color: active ? '#fff' : pal.chipText }, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          entering={FadeInDown.duration(280).springify().damping(18)}
          style={[
            styles.card,
            { backgroundColor: pal.cardBg, borderColor: pal.cardBorder, shadowColor: pal.cardShadow },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: pal.closeBg }]} hitSlop={12}>
              <X size={18} color={pal.closeIcon} strokeWidth={2.4} />
            </Pressable>
            <Text style={[styles.title, { color: pal.title }]}>{t('home.filterTitle') || 'Filter'}</Text>
            <View style={styles.balancePlaceholder} />
          </View>

          {/* Section 1: Online Status */}
          <Text style={[styles.sectionLabel, { color: pal.label }]}>{t('home.filterOnline') || 'Status'}</Text>
          <View style={styles.toggleRow}>
            {chip(!draft.onlineOnly, t('home.filterAll') || 'All', () => setDraft((d) => ({ ...d, onlineOnly: false })), { flex: 1 })}
            {chip(draft.onlineOnly, t('home.filterOnlineOnly') || 'Online', () => setDraft((d) => ({ ...d, onlineOnly: true })), { flex: 1 })}
          </View>

          {/* Section 2: Age Range */}
          <Text style={[styles.sectionLabel, { color: pal.label }]}>
            {isAr ? 'الفئة العمرية' : 'Age Range'}
          </Text>
          <View style={styles.presetsGrid}>
            {agePresets.map((preset, idx) =>
              chip(isPresetActive(preset), preset.label, () => handleSelectPreset(preset), { width: '31%' }, idx),
            )}
          </View>

          {/* Confirm Button */}
          <Pressable
            onPress={() => {
              onConfirm(draft);
              onClose();
            }}
            style={({ pressed }) => [styles.confirmBtnContainer, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          >
            <LinearGradient
              colors={['#FF4D5E', '#C40E2E']}
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
              <Text style={[styles.resetText, { color: pal.reset }]}>
                {t('home.filterReset') || 'Reset Filters'}
              </Text>
            </Pressable>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(8,3,5,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 26,
    borderWidth: 1,
    width: '85%',
    maxWidth: 340,
    padding: 22,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 22,
    elevation: 12,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
    textAlign: 'center',
    includeFontPadding: false,
  },
  balancePlaceholder: {
    width: 36,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: lu.fonts.bodyBold,
    marginBottom: 10,
    marginTop: 6,
    includeFontPadding: false,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    paddingVertical: 11,
    borderRadius: 13,
    borderWidth: 1.3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chipActive: {
    borderColor: '#FF4D66',
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 5,
  },
  chipText: {
    fontSize: 13.5,
    fontWeight: '700',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },
  chipTextActive: {
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 22,
  },
  confirmBtnContainer: {
    borderRadius: 99,
    overflow: 'hidden',
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
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
    includeFontPadding: false,
  },
  resetBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 4,
  },
  resetText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },
});
