/**
 * اختيار غرفة منافسة للتحدي بين الغرف
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Radio } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { colors, spacing, radius } from '@/theme';
import type { Room } from '@/services/firebase/rooms';

type Props = {
  visible: boolean;
  rooms: Room[];
  loading?: boolean;
  onClose: () => void;
  onSelect: (room: Room) => void;
};

export function RoomPkCrossRoomPicker({
  visible,
  rooms,
  loading,
  onClose,
  onSelect,
}: Props) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['rgba(71, 17, 17, 0.98)', 'rgba(48, 10, 10, 0.98)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.header}>
            <Text variant="h4" weight="bold" color={colors.white}>
              {t('roomPk.pickOpponent')}
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={22} color={colors.white} strokeWidth={2.5} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.white} style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={rooms}
              keyExtractor={(r) => r.id}
              style={{ maxHeight: 320 }}
              ListEmptyComponent={
                <Text variant="body" color="rgba(255,255,255,0.6)" align="center" style={{ padding: 24 }}>
                  {t('roomPk.noOpponentRooms')}
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable style={styles.roomRow} onPress={() => onSelect(item)}>
                  <Radio size={18} color={colors.white} strokeWidth={2} />
                  <View style={styles.roomInfo}>
                    <Text variant="body" weight="semibold" color={colors.white} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text variant="caption" color="rgba(255,255,255,0.55)">
                      {item.hostName}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '55%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  roomInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
});
