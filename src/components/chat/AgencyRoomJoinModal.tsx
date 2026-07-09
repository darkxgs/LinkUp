/**
 * مودال صغير للانضمام لروم زميل في الوكالة
 */
import React from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Headphones, X } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { spacing, radius } from '@/theme';

interface Props {
  visible: boolean;
  peerName: string;
  roomName: string;
  onClose: () => void;
  onJoin: () => void;
}

export function AgencyRoomJoinModal({
  visible,
  peerName,
  roomName,
  onClose,
  onJoin,
}: Props) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <LinearGradient colors={['#3A1316', '#1A0A0C']} style={StyleSheet.absoluteFill} />

          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <X size={18} color="rgba(255,255,255,0.75)" />
          </Pressable>

          <View style={styles.iconWrap}>
            <Headphones size={28} color={lu.colors.pink} strokeWidth={2.2} />
          </View>

          <Text variant="h4" weight="bold" color="#fff" align="center">
            {t('chat.agencyJoinModalTitle')}
          </Text>
          <Text variant="body" color="rgba(255,255,255,0.75)" align="center" style={styles.sub}>
            {t('chat.agencyJoinModalBody', { name: peerName, room: roomName })}
          </Text>

          <Pressable onPress={onJoin} style={styles.joinBtn}>
            <LinearGradient colors={lu.gradients.brand} style={StyleSheet.absoluteFill} />
            <Text variant="button" weight="bold" color="#fff">
              {t('chat.joinRoom')}
            </Text>
          </Pressable>

          <Pressable onPress={onClose} style={styles.cancelBtn}>
            <Text variant="caption" color="rgba(255,255,255,0.55)">
              {t('common.cancel')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 95, 95, 0.15)',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sub: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    lineHeight: 22,
    paddingHorizontal: spacing.sm,
  },
  joinBtn: {
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
});
