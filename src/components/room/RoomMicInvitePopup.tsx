/**
 * مودال دعوة المايك — يظهر للمدعو داخل الروم مع قبول/رفض
 */
import React from 'react';
import { Modal, View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { Mic } from 'lucide-react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { radius, spacing } from '@/theme';
import type { RoomMicInvite } from '@/services/firebase/roomMicInvites';

type Props = {
  invite: RoomMicInvite | null;
  loading?: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

export function RoomMicInvitePopup({ invite, loading, onAccept, onDecline }: Props) {
  const { t } = useTranslation();

  return (
    <Modal visible={!!invite} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={styles.backdrop}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.card}>
          <LinearGradient
            colors={['rgba(135, 28, 28, 0.95)', 'rgba(60, 10, 10, 0.98)']}
            style={StyleSheet.absoluteFill}
          />
          {invite?.inviterAvatar ? (
            <Image source={{ uri: invite.inviterAvatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={styles.iconCircle}>
              <Mic size={32} color="#fff" strokeWidth={2.2} />
            </View>
          )}
          <Text variant="h3" weight="bold" color="#fff" align="center">
            {t('room.micInviteTitle')}
          </Text>
          <Text variant="body" color="rgba(255,255,255,0.85)" align="center" style={styles.body}>
            {t('room.micInviteBody', {
              name: invite?.inviterName ?? '',
              room: invite?.roomName ?? '',
            })}
          </Text>
          {invite?.includeMembership ? (
            <View style={styles.pill}>
              <Text variant="caption" color="#FEE2E2" weight="semibold">
                {t('room.micInviteWithMembership')}
              </Text>
            </View>
          ) : null}
          <View style={styles.actions}>
            <Pressable onPress={onDecline} style={styles.declineBtn} disabled={loading}>
              <Text variant="button" color="rgba(255,255,255,0.8)">
                {t('common.reject')}
              </Text>
            </Pressable>
            <Pressable onPress={onAccept} style={styles.acceptBtn} disabled={loading}>
              <LinearGradient
                colors={[lu.colors.pink, lu.colors.purple]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text variant="button" weight="bold" color="#fff">
                  {t('common.accept')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.xl,
    overflow: 'hidden',
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20, 0.45)',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  body: { lineHeight: 22, marginBottom: 4 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20, 0.35)',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.sm,
    width: '100%',
  },
  declineBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  acceptBtn: {
    flex: 1.4,
    minHeight: 46,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
