/**
 * منتقي الدولة — كل دول العالم + بحث + علم مستطيل
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  I18nManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Check, X } from 'lucide-react-native';

import { Text } from './Text';
import { RealCountryFlag } from './RealCountryFlag';
import { ALL_COUNTRIES, filterCountries, type Country } from '@/data/countries';
import { lu } from '@/theme/lu-brand';

export interface CountryPickerSheetProps {
  visible: boolean;
  title?: string;
  selectedCode?: string;
  onSelect: (country: Country) => void;
  onClose: () => void;
}

export function CountryPickerSheet({
  visible,
  title = 'اختر جنسيتك',
  selectedCode,
  onSelect,
  onClose,
}: CountryPickerSheetProps) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const list = useMemo(() => filterCountries(search), [search]);

  const handleClose = () => {
    setSearch('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboard}
        >
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text variant="h3" weight="bold" style={styles.title}>
                {title}
              </Text>
              <Pressable onPress={handleClose} hitSlop={12}>
                <X size={22} color={lu.colors.ink2} />
              </Pressable>
            </View>

            <View style={styles.searchBar}>
              <Search size={18} color={lu.colors.muted} strokeWidth={2} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="ابحث عن دولة..."
                placeholderTextColor={lu.colors.muted}
                autoCorrect={false}
              />
            </View>

            <FlatList
              data={list}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 420 }}
              initialNumToRender={24}
              windowSize={10}
              ListEmptyComponent={
                <Text style={styles.empty}>لا توجد نتائج</Text>
              }
              renderItem={({ item }) => {
                const active = selectedCode === item.code;
                return (
                  <Pressable
                    onPress={() => {
                      onSelect(item);
                      setSearch('');
                    }}
                    style={[styles.row, active && styles.rowActive]}
                  >
                    {active ? (
                      <View style={styles.check}>
                        <Check size={14} color="#fff" strokeWidth={3} />
                      </View>
                    ) : (
                      <View style={styles.checkPlaceholder} />
                    )}
                    <Text
                      style={[styles.rowLabel, active && styles.rowLabelActive]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <RealCountryFlag countryCode={item.code} size={22} shape="rectangle" />
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

export { ALL_COUNTRIES };

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  keyboard: { width: '100%' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { flex: 1, textAlign: 'center', color: lu.colors.ink },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: lu.colors.ink,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    padding: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  rowActive: {
    backgroundColor: 'rgba(225, 20, 20,0.08)',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: lu.colors.ink,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  rowLabelActive: {
    color: lu.colors.purple,
    fontWeight: '800',
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: lu.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkPlaceholder: { width: 24 },
  empty: {
    textAlign: 'center',
    padding: 24,
    color: lu.colors.muted,
    fontSize: 14,
  },
});
