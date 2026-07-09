/**
 * AuthBottomSheet — ورقة سفلية لاختيار التاريخ / القوائم
 */

import React, { ReactNode } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { lu } from '@/theme/lu-brand';

type AuthBottomSheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function AuthBottomSheet({
  visible,
  title,
  onClose,
  children,
  contentStyle,
}: AuthBottomSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + lu.spacing.md }, contentStyle]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <X size={20} color={lu.colors.ink} strokeWidth={2.5} />
            </Pressable>
          </View>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function AuthSheetRow({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint?: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, selected && styles.rowActive]}
    >
      <Text style={[styles.rowLabel, selected && styles.rowLabelActive]}>{label}</Text>
      {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      {selected ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 10, 12,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: lu.colors.card,
    borderTopLeftRadius: lu.radius.lg,
    borderTopRightRadius: lu.radius.lg,
    paddingHorizontal: lu.spacing.lg,
    paddingTop: lu.spacing.base,
    maxHeight: '85%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: lu.colors.line,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: lu.colors.line,
    alignSelf: 'center',
    marginBottom: lu.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: lu.spacing.sm,
  },
  title: {
    fontSize: 18,
    color: lu.colors.ink,
    fontFamily: lu.fonts.displaySemi,
    includeFontPadding: false,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: lu.colors.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    maxHeight: 400,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: lu.spacing.md,
    paddingHorizontal: lu.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: lu.colors.line,
    gap: lu.spacing.sm,
  },
  rowActive: {
    backgroundColor: lu.colors.purpleSoft,
    borderRadius: lu.radius.sm,
    borderBottomColor: 'transparent',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodySemi,
    includeFontPadding: false,
  },
  rowLabelActive: {
    color: lu.colors.purple,
    fontFamily: lu.fonts.bodyBold,
  },
  rowHint: {
    fontSize: 12,
    color: lu.colors.muted,
    fontFamily: lu.fonts.body,
    includeFontPadding: false,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: lu.colors.pink,
  },
});
