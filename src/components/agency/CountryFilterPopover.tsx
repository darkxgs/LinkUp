/**
 * فلتر الدول — نافذة منبثقة بشبكة أزرار (مثل التطبيق المرجعي).
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

import { RealCountryFlag } from '@/components/ui';
import { lu } from '@/theme/lu-brand';

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
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.popover} onPress={(e) => e.stopPropagation()}>
          <View style={styles.popoverHeader}>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={16} color={lu.colors.muted} strokeWidth={2.5} />
            </Pressable>
            <RNText style={styles.popoverTitle}>{t('rooms.selectCountry')}</RNText>
            <View style={{ width: 28 }} />
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
                  style={[styles.countryCell, isActive && styles.countryCellActive]}
                >
                  {item.code === 'WW' ? (
                    <View style={[styles.globeIcon, isActive && styles.globeIconActive]}>
                      <Globe size={16} color={isActive ? lu.colors.purple : '#6B7280'} strokeWidth={2.3} />
                    </View>
                  ) : (
                    <RealCountryFlag countryCode={item.code} size={22} />
                  )}
                  <RNText
                    style={[styles.countryCellText, isActive && styles.countryCellTextActive]}
                    numberOfLines={2}
                  >
                    {item.name}
                  </RNText>
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type CountryGlobeTriggerProps = {
  countryCode: string;
  onPress: () => void;
};

export function CountryGlobeTrigger({ countryCode, onPress }: CountryGlobeTriggerProps) {
  const { t } = useTranslation();
  const label =
    countryCode === 'WW' ? t('countries.global') : t(getCountryNameKey(countryCode));

  return (
    <Pressable onPress={onPress} style={styles.globeTrigger}>
      <View style={styles.globeTriggerIcon}>
        <Globe size={15} color={lu.colors.purple} strokeWidth={2.4} />
      </View>
      <RNText style={styles.globeTriggerText} numberOfLines={1}>
        {label}
      </RNText>
      <ChevronDown size={14} color={lu.colors.muted} strokeWidth={2.5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingTop: 120,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  popover: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  popoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  popoverTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyHeavy,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
    minHeight: 72,
    gap: 6,
  },
  countryCellActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  countryCellText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
    fontFamily: lu.fonts.bodySemi,
    textAlign: 'center',
    lineHeight: 13,
  },
  countryCellTextActive: {
    color: lu.colors.purple,
    fontWeight: '800',
  },
  globeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  globeIconActive: {
    backgroundColor: '#FEE2E2',
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
  globeTriggerIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  globeTriggerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyHeavy,
  },
});
