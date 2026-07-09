/**
 * بطاقة بدء لعبة روم مجانية — يعرض السيناريو قبل الإطلاق
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, View, I18nManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Users, Mic2 } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { getRoomFreeGame, type RoomFreeGameId } from '@/constants/roomFreeGames';

type Props = {
  visible: boolean;
  gameId: RoomFreeGameId | null;
  loading?: boolean;
  onClose: () => void;
  onStart: () => void;
};

export function RoomFreeGameStartSheet({ visible, gameId, loading, onClose, onStart }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const game = gameId ? getRoomFreeGame(gameId) : null;

  if (!game) return null;

  const isPk = game.mode === 'native';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.base }]}
          onPress={(e) => e.stopPropagation()}
        >
          <LinearGradient
            colors={['rgba(52, 15, 15, 0.97)', 'rgba(25, 6, 6, 0.99)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.handle} />

          <Text variant="h3" weight="bold" color={colors.white} style={styles.title}>
            {game.emoji} {t(game.nameKey)}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Users size={14} color="#FCA5A5" />
              <Text variant="caption" color="rgba(255,255,255,0.85)">
                {t('roomFreeGames.playersRange', { min: game.minPlayers, max: game.maxPlayers })}
              </Text>
            </View>
            {!isPk ? (
              <View style={styles.metaChip}>
                <Mic2 size={14} color="#86efac" />
                <Text variant="caption" color="rgba(255,255,255,0.85)">
                  {t('roomGameVoice.title')}
                </Text>
              </View>
            ) : null}
          </View>

          <Text variant="body" color="rgba(255,255,255,0.88)" style={styles.description}>
            {t(game.descriptionKey)}
          </Text>

          {!isPk ? (
            <Text variant="caption" color="rgba(255,255,255,0.55)" style={styles.hint}>
              {t('roomFreeGames.startHint')}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text variant="body" weight="semibold" color="rgba(255,255,255,0.7)">
                {t('common.cancel')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.startBtn, { backgroundColor: game.color }, loading && { opacity: 0.6 }]}
              onPress={onStart}
              disabled={loading}
            >
              <Text variant="body" weight="bold" color={colors.white}>
                {isPk ? t('roomFreeGames.pkStartButton') : t('roomFreeGames.startButton')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: spacing.md,
  },
  title: { textAlign: 'center', marginBottom: spacing.sm },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  description: {
    lineHeight: 24,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    marginBottom: spacing.sm,
  },
  hint: {
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  startBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
});
