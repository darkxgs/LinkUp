/**
 * اختيار لاعب من الروم لإرسال دعوة لعبة خاصة
 */
import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { X, UserPlus } from 'lucide-react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

export interface RoomGamePickerMember {
  uid: string;
  name: string;
  avatar?: string;
  onSeat?: boolean;
}

interface Props {
  visible: boolean;
  members: RoomGamePickerMember[];
  sendingUid?: string | null;
  onClose: () => void;
  onPick: (member: RoomGamePickerMember) => void;
}

export function RoomGamePlayerPickerSheet({
  visible,
  members,
  sendingUid,
  onClose,
  onPick,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <UserPlus size={20} color="#FEE2E2" />
          <Text variant="body" weight="bold" color={colors.white} style={{ flex: 1 }}>
            {t('roomGameInvite.pickPlayer')}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={22} color={colors.white} />
          </Pressable>
        </View>
        <Text variant="caption" color="rgba(255,255,255,0.65)" style={styles.hint}>
          {t('roomGameInvite.pickHint')}
        </Text>
        <FlatList
          data={members}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text variant="body" color="rgba(255,255,255,0.5)" align="center" style={{ padding: 24 }}>
              {t('roomGameInvite.noPlayers')}
            </Text>
          }
          renderItem={({ item }) => {
            const busy = sendingUid === item.uid;
            return (
              <Pressable
                style={styles.row}
                onPress={() => onPick(item)}
                disabled={!!sendingUid}
              >
                <View style={styles.avatar}>
                  {item.avatar ? (
                    <Image source={{ uri: item.avatar }} style={styles.avatarImg} />
                  ) : (
                    <Text variant="body" weight="bold" color="#fff">
                      {(item.name || '?').slice(0, 1)}
                    </Text>
                  )}
                </View>
                <View style={styles.rowText}>
                  <Text variant="body" weight="semibold" color={colors.white} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.onSeat ? (
                    <Text variant="caption" color="#FCA5A5">
                      {t('roomGameInvite.onMic')}
                    </Text>
                  ) : null}
                </View>
                {busy ? <ActivityIndicator color="#FCA5A5" /> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    maxHeight: '70%',
    backgroundColor: '#100406',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20, 0.25)',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingBottom: 8,
  },
  hint: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowText: { flex: 1, minWidth: 0 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(225, 20, 20, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 44, height: 44 },
});
