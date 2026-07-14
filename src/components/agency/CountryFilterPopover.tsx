/**
 * فلتر الدول — نافذة منبثقة بشبكة أزرار على سمة الغرف (فاتح/داكن).
 */
import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  Text as RNText,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Globe, X, ChevronDown } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { RealCountryFlag } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { useThemeMode } from '@/stores/themeStore';

export const FILTER_COUNTRY_CODES = [
  'WW', 'PS', 'SA', 'AE', 'EG', 'JO', 'KW', 'QA', 'BH', 'OM',
  'IQ', 'SY', 'LB', 'YE', 'MA', 'DZ', 'TN', 'LY', 'SD', 'TR', 'PH',
] as const;

export const getCountryNameKey = (code: string): string =>
  code === 'WW' ? 'countries.global' : `countries.${code}`;

type CountryFilterPopoverProps = {
  visible: boolean;
  currentCode: string;
  onSelect: (code: string) => void;
  onClose: () => void;
};

export function CountryFilterPopover({
  visible,
  currentCode,
  onSelect,
  onClose,
}: CountryFilterPopoverProps) {
  const { t } = useTranslation();
  const { isDark } = useThemeMode();

  const pal = isDark
    ? {
        cardBg: '#231217',
        cardBorder: 'rgba(255,45,60,0.3)',
        cardShadow: '#FF1E30',
        title: '#FFFFFF',
        closeBg: 'rgba(255,255,255,0.08)',
        closeIcon: '#FFFFFF',
        cellBg: 'rgba(255,255,255,0.05)',
        cellBorder: lu.colors.nightLine,
        cellText: 'rgba(255,255,255,0.68)',
        globeBg: 'rgba(255,45,60,0.14)',
        globeIcon: '#FF5C6C',
      }
    : {
        cardBg: '#FFFFFF',
        cardBorder: 'rgba(225,20,20,0.14)',
        cardShadow: '#9A1414',
        title: '#15151A',
        closeBg: '#F6ECEC',
        closeIcon: '#15151A',
        cellBg: '#FFFFFF',
        cellBorder: '#E9E0E1',
        cellText: '#6B7280',
        globeBg: '#FEE2E2',
        globeIcon: '#E11414',
      };

  const countries = useMemo(
    () =>
      FILTER_COUNTRY_CODES.map((code) => ({
        code,
        name: t(getCountryNameKey(code)),
      })),
    [t],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          entering={FadeInDown.duration(280).springify().damping(18)}
          style={[
            styles.popover,
            { backgroundColor: pal.cardBg, borderColor: pal.cardBorder, shadowColor: pal.cardShadow },
          ]}
        >
          <View style={styles.popoverHeader}>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={[styles.closeBtn, { backgroundColor: pal.closeBg }]}
            >
              <X size={16} color={pal.closeIcon} strokeWidth={2.5} />
            </Pressable>
            <RNText style={[styles.popoverTitle, { color: pal.title }]}>
              {t('rooms.selectCountry')}
            </RNText>
            <View style={styles.headerPlaceholder} />
          </View>

          <FlatList
            data={countries}
            keyExtractor={(item) => item.code}
            numColumns={3}
            scrollEnabled={countries.length > 12}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.gridContent}
            renderItem={({ item }) => {
              const isActive = item.code === currentCode;
              return (
                <Pressable
                  onPress={() => onSelect(item.code)}
                  style={({ pressed }) => [
                    styles.countryCell,
                    { backgroundColor: isActive ? '#C40E2E' : pal.cellBg, borderColor: pal.cellBorder },
                    isActive && styles.countryCellActive,
                    pressed && { transform: [{ scale: 0.96 }] },
                  ]}
                >
                  {isActive ? (
                    <LinearGradient
                      colors={['#FF4D66', '#C40E2E']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                  ) : null}
                  {item.code === 'WW' ? (
                    <View
                      style={[
                        styles.globeIcon,
                        { backgroundColor: isActive ? 'rgba(255,255,255,0.22)' : pal.globeBg },
                      ]}
                    >
                      <Globe size={16} color={isActive ? '#fff' : pal.globeIcon} strokeWidth={2.3} />
                    </View>
                  ) : (
                    <RealCountryFlag countryCode={item.code} size={22} />
                  )}
                  <RNText
                    style={[
                      styles.countryCellText,
                      { color: isActive ? '#fff' : pal.cellText },
                      isActive && styles.countryCellTextActive,
                    ]}
                    numberOfLines={2}
                  >
                    {item.name}
                  </RNText>
                </Pressable>
              );
            }}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

type CountryGlobeTriggerProps = {
  countryCode: string;
  dark?: boolean;
  onPress: () => void;
};

export function CountryGlobeTrigger({ countryCode, dark, onPress }: CountryGlobeTriggerProps) {
  const { t } = useTranslation();
  const label =
    countryCode === 'WW' ? t('countries.global') : t(getCountryNameKey(countryCode));

  return (
    <Pressable onPress={onPress} style={[styles.globeTrigger, dark && styles.globeTriggerDark]}>
      <View style={[styles.globeTriggerIcon, dark && styles.globeTriggerIconDark]}>
        <Globe size={15} color={dark ? '#FF5C6C' : '#E11414'} strokeWidth={2.4} />
      </View>
      <RNText
        style={[styles.globeTriggerText, dark && { color: lu.colors.nightInk }]}
        numberOfLines={1}
      >
        {label}
      </RNText>
      <ChevronDown size={14} color={dark ? lu.colors.nightMuted : lu.colors.muted} strokeWidth={2.5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,3,5,0.72)',
    paddingTop: 120,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  popover: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    paddingBottom: 14,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 22,
    elevation: 12,
  },
  popoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  popoverTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
    textAlign: 'center',
    includeFontPadding: false,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPlaceholder: {
    width: 30,
  },
  gridContent: {
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  gridRow: {
    gap: 8,
    marginBottom: 8,
  },
  countryCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderWidth: 1.3,
    minHeight: 72,
    gap: 6,
    overflow: 'hidden',
  },
  countryCellActive: {
    borderColor: '#FF4D66',
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 5,
  },
  countryCellText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: lu.fonts.bodySemi,
    textAlign: 'center',
    lineHeight: 13,
  },
  countryCellTextActive: {
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  globeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  globeTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#FBEAEA',
    maxWidth: 150,
  },
  globeTriggerDark: {
    backgroundColor: lu.colors.nightCard,
    borderColor: lu.colors.nightLine,
  },
  globeTriggerIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  globeTriggerIconDark: {
    backgroundColor: 'rgba(255,45,60,0.14)',
  },
  globeTriggerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyHeavy,
  },
});
