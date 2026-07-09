/**
 * بوب أب دعوة لعبة — يظهر للشخص المدعو فقط داخل الروم
 */
import React from 'react';
import { Modal, View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { Gamepad2 } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { radius, spacing } from '@/theme';
import type { RoomGameInvite } from '@/services/firebase/roomGameInvites';

interface Props {
  invite: RoomGameInvite | null;
  loading?: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function RoomGameInvitePopup({ invite, loading, onAccept, onDecline }: Props) {
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
          <View style={styles.emojiCircle}>
            <Text style={styles.emoji}>{invite?.gameEmoji ?? '🎮'}</Text>
          </View>
          <Text variant="h3" weight="bold" color="#fff" align="center">
            {t('roomGameInvite.popupTitle')}
          </Text>
          <Text variant="body" color="rgba(255,255,255,0.85)" align="center" style={styles.body}>
            {t('roomGameInvite.popupBody', {
              host: invite?.hostName ?? '',
              game: invite?.gameName ?? '',
            })}
          </Text>
          {invite?.joinCode ? (
            <View style={styles.codePill}>
              <Text variant="caption" color="#FEE2E2" weight="bold">
                {t('roomGameInvite.code', { code: invite.joinCode })}
              </Text>
            </View>
          ) : null}
          <View style={styles.actions}>
            <Pressable onPress={onDecline} style={styles.declineBtn} disabled={loading}>
              <Text variant="button" color="rgba(255,255,255,0.8)">
                {t('common.cancel')}
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
                <>
                  <Gamepad2 size={18} color="#fff" />
                  <Text variant="button" weight="bold" color="#fff">
                    {t('roomGameInvite.join')}
                  </Text>
                </>
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
  emojiCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emoji: { fontSize: 36 },
  body: { lineHeight: 22, marginBottom: 4 },
  codePill: {
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
