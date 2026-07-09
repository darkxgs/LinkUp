/**
 * RoomMemberActionMenu — قائمة إجراءات العضو (إبلاغ / طرد / إلغاء)
 */
import React from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { radius, spacing } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onReport: () => void;
  onKick: () => void;
  onCancel?: () => void;
  showKick?: boolean;
  showCancel?: boolean;
};

export function RoomMemberActionMenu({
  visible,
  onClose,
  onReport,
  onKick,
  onCancel,
  showKick = true,
  showCancel = false,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.sm }]}>
          <Pressable style={styles.option} onPress={() => { onClose(); onReport(); }}>
            <Text variant="body" color={lu.colors.ink} align="center">
              {t('roomInfo.report')}
            </Text>
          </Pressable>
          {showKick ? (
            <Pressable style={styles.option} onPress={() => { onClose(); onKick(); }}>
              <Text variant="body" color="#EF4444" align="center" weight="bold">
                {t('room.kickUser')}
              </Text>
            </Pressable>
          ) : null}
          {showCancel && onCancel ? (
            <Pressable style={styles.option} onPress={() => { onClose(); onCancel(); }}>
              <Text variant="body" color="#EF4444" align="center">
                {t('roomInfo.cancelMembership')}
              </Text>
            </Pressable>
          ) : null}
          <Pressable style={[styles.option, styles.cancelOption]} onPress={onClose}>
            <Text variant="body" color={lu.colors.ink2} align="center">
              {t('common.cancel')}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopStartRadius: radius.xl,
    borderTopEndRadius: radius.xl,
    paddingTop: spacing.sm,
  },
  option: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F8',
  },
  cancelOption: {
    borderBottomWidth: 0,
    marginTop: 4,
  },
});
