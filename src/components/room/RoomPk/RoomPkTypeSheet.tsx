/**
 * اختيار نوع التحدي: داخل الغرفة أو بين غرفتين
 */

import React from 'react';
import { View, StyleSheet, Pressable, Modal, I18nManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Shield } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { colors, spacing, radius } from '@/theme';
import { lu } from '@/theme/lu-brand';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectInRoom: () => void;
  onSelectCrossRoom: () => void;
};

export function RoomPkTypeSheet({
  visible,
  onClose,
  onSelectInRoom,
  onSelectCrossRoom,
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
            <Text variant="h3" weight="bold" color={colors.white}>
              {t('roomPk.title')}
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={22} color={colors.white} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={styles.optionsRow}>
            <Pressable style={styles.optionCard} onPress={onSelectCrossRoom}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(251,191,36,0.2)' }]}>
                <Shield size={36} color={lu.colors.gold} strokeWidth={2} />
                <View style={styles.newBadge}>
                  <Text variant="caption" weight="bold" color="#fff" style={{ fontSize: 8 }}>
                    {t('roomPk.newBadge')}
                  </Text>
                </View>
              </View>
              <Text variant="body" weight="bold" color={colors.white} align="center">
                {t('roomPk.crossRoomTitle')}
              </Text>
              <Text variant="caption" color="rgba(255,255,255,0.65)" align="center" style={{ marginTop: 4 }}>
                {t('roomPk.crossRoomDesc')}
              </Text>
            </Pressable>

            <Pressable style={styles.optionCard} onPress={onSelectInRoom}>
              <LinearGradient
                colors={['#ED4444', '#E11414', '#EF4444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.pkLogoGrad}
              >
                <Text style={styles.pkLogoText}>PK</Text>
              </LinearGradient>
              <Text variant="body" weight="bold" color={colors.white} align="center" style={{ marginTop: 10 }}>
                {t('roomPk.inRoomTitle')}
              </Text>
              <Text variant="caption" color="rgba(255,255,255,0.65)" align="center" style={{ marginTop: 4 }}>
                {t('roomPk.inRoomDesc')}
              </Text>
            </Pressable>
          </View>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl + 8,
    overflow: 'hidden',
    minHeight: 280,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
  optionCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  newBadge: {
    position: 'absolute',
    top: -4,
    end: -4,
    backgroundColor: lu.colors.live,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pkLogoGrad: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pkLogoText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    fontStyle: 'italic',
  },
});
