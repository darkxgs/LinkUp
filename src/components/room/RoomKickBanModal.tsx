/**
 * RoomKickBanModal — اختيار مدة الطرد/الحظر من الغرفة
 */
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { X, UserX } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { ROOM_DESIGN } from '@/theme/room-design';
import { radius, spacing } from '@/theme';
import {
  BLOCK_DURATION_PRESETS,
  type RoomBlockDuration,
} from '@/utils/roomBlockDuration';

export type KickBanChoice = { permanent: true } | { permanent: false; duration: RoomBlockDuration };

interface Props {
  visible: boolean;
  userName?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (choice: KickBanChoice) => void;
}

export function RoomKickBanModal({ visible, userName, loading, onClose, onConfirm }: Props) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const [selected, setSelected] = useState<number | 'permanent'>(0);

  useEffect(() => {
    if (visible) setSelected(0);
  }, [visible, userName]);

  const handleConfirm = () => {
    if (selected === 'permanent') {
      onConfirm({ permanent: true });
      return;
    }
    const preset = BLOCK_DURATION_PRESETS[selected];
    if (!preset) return;
    onConfirm({ permanent: false, duration: preset.duration });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <LinearGradient colors={[...ROOM_DESIGN.panelGradientShort]} style={StyleSheet.absoluteFill} />

          <View style={styles.header}>
            <View style={styles.titleRow}>
              <UserX size={20} color={lu.colors.live} />
              <Text variant="button" weight="bold" color="#fff">
                {t('room.kickBanTitle', 'طرد من الغرفة')}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={18} color="rgba(255,255,255,0.8)" />
            </Pressable>
          </View>

          {userName ? (
            <Text variant="body" color="rgba(255,255,255,0.75)" style={styles.sub}>
              {t('room.kickBanUser', { name: userName, defaultValue: `طرد ${userName}` })}
            </Text>
          ) : null}

          <Text variant="caption" color="rgba(255,255,255,0.55)" style={styles.hint}>
            {t('room.kickBanHint', 'اختر مدة الطرد — لن يتمكن من الدخول حتى انتهاء المدة')}
          </Text>

          <View style={styles.chips}>
            {BLOCK_DURATION_PRESETS.map((preset, idx) => {
              const active = selected === idx;
              const label = isAr ? preset.labelAr : preset.labelEn;
              return (
                <Pressable
                  key={`${preset.duration.amount}-${preset.duration.unit}`}
                  onPress={() => setSelected(idx)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text variant="caption" weight="bold" color={active ? '#fff' : 'rgba(255,255,255,0.75)'}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setSelected('permanent')}
              style={[styles.chip, selected === 'permanent' && styles.chipPermanent]}
            >
              <Text
                variant="caption"
                weight="bold"
                color={selected === 'permanent' ? '#fff' : 'rgba(255,255,255,0.75)'}
              >
                {t('room.kickBanPermanent', 'دائم')}
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={handleConfirm}
            disabled={loading}
            style={[styles.confirmBtn, loading && { opacity: 0.6 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text variant="button" weight="bold" color="#fff">
                {t('room.kickUser', 'طرد')}
              </Text>
            )}
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
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sub: { marginBottom: spacing.xs },
  hint: { marginBottom: spacing.md, textAlign: 'center' },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: 'rgba(225, 20, 20,0.2)',
    borderColor: lu.colors.pink,
  },
  chipPermanent: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderColor: '#EF4444',
  },
  confirmBtn: {
    backgroundColor: '#EF4444',
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
