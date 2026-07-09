/**
 * EndRoomModal — إغلاق الغرفة (نفس التجربة للغرفة والوكالة)
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Archive, AlertOctagon, DoorOpen } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';

interface Props {
  visible: boolean;
  loading?: 'archive' | 'end' | null;
  onArchive: () => void;
  onEnd: () => void;
  onCancel: () => void;
}

export function EndRoomModal({ visible, loading, onArchive, onEnd, onCancel }: Props) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={!loading ? onCancel : undefined} />
        <View style={styles.sheet}>
          <LinearGradient
            colors={[lu.colors.room1, lu.colors.room0]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.sheetBorder} />

          <View style={styles.handle} />

          <View style={styles.iconWrap}>
            <LinearGradient
              colors={lu.gradients.pink}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGrad}
            >
              <DoorOpen size={26} color="#fff" strokeWidth={2.2} />
            </LinearGradient>
          </View>

          <Text weight="bold" style={styles.title} align="center">
            {t('room.closeRoomTitle')}
          </Text>
          <Text style={styles.subtitle} align="center">
            {t('room.closeRoomSubtitle')}
          </Text>

          <OptionCard
            loading={loading === 'archive'}
            disabled={!!loading}
            iconBg="rgba(236, 62, 62, 0.22)"
            icon={<Archive size={20} color={lu.colors.blue1} strokeWidth={2.2} />}
            title={t('room.archiveTitle')}
            desc={t('room.archiveDesc')}
            badge={t('room.recommended')}
            borderColor="rgba(236, 62, 62, 0.35)"
            onPress={onArchive}
          />

          <OptionCard
            loading={loading === 'end'}
            disabled={!!loading}
            iconBg="rgba(255,46,98,0.2)"
            icon={<AlertOctagon size={20} color={lu.colors.live} strokeWidth={2.2} />}
            title={t('room.endTitle')}
            desc={t('room.endDesc')}
            borderColor="rgba(255,46,98,0.3)"
            onPress={onEnd}
          />

          <Pressable
            onPress={onCancel}
            disabled={!!loading}
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.85 }]}
          >
            <Text weight="bold" style={styles.cancelText}>
              {t('common.cancel')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function OptionCard({
  icon,
  iconBg,
  title,
  desc,
  badge,
  borderColor,
  loading,
  disabled,
  onPress,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
  badge?: string;
  borderColor: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.optionCard,
        { borderColor },
        pressed && !disabled && styles.optionPressed,
      ]}
    >
      <View style={[styles.optIcon, { backgroundColor: iconBg }]}>
        {loading ? <ActivityIndicator size="small" color="#fff" /> : icon}
      </View>
      <View style={styles.optBody}>
        <View style={styles.optTitleRow}>
          <Text weight="bold" style={styles.optTitle}>
            {title}
          </Text>
          {badge ? (
            <View style={styles.recommendBadge}>
              <Text style={styles.recommendText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.optDesc}>{desc}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(22, 5, 5, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  sheetBorder: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  iconWrap: { alignItems: 'center', marginBottom: 12 },
  iconGrad: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, color: '#fff' },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
    marginBottom: 18,
    lineHeight: 19,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    marginBottom: 10,
  },
  optionPressed: { backgroundColor: 'rgba(255,255,255,0.1)' },
  optIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optBody: { flex: 1, gap: 3 },
  optTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  optTitle: { fontSize: 15, color: '#fff' },
  optDesc: { fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 17 },
  recommendBadge: {
    backgroundColor: lu.colors.mint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  recommendText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  cancelBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginTop: 6,
  },
  cancelText: { fontSize: 15, color: 'rgba(255,255,255,0.75)' },
});
